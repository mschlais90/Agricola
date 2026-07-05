import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '@agricola/protocol';
import { RoomManager } from '../src/roomManager';
import { FileStore } from '../src/store/GameStore';
import { attachWsHandler } from '../src/wsHandler';

let server: http.Server;
let wss: WebSocketServer;
let port: number;
let dataDir: string;
let store: FileStore;
let rooms: RoomManager;

class TestClient {
  ws: WebSocket;
  inbox: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];

  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      const w = this.waiters.shift();
      if (w) w(msg);
      else this.inbox.push(msg);
    });
  }

  async open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((res) => this.ws.once('open', res));
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg));
  }

  next(timeoutMs = 2000): Promise<ServerMessage> {
    const queued = this.inbox.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout waiting for message')), timeoutMs);
      this.waiters.push((m) => {
        clearTimeout(t);
        res(m);
      });
    });
  }

  async nextOfType<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    for (let i = 0; i < 20; i++) {
      const m = await this.next();
      if (m.type === type) return m as Extract<ServerMessage, { type: T }>;
    }
    throw new Error(`no ${type} received`);
  }

  close(): void {
    this.ws.close();
  }
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'agricola-test-'));
  store = new FileStore(dataDir);
  rooms = new RoomManager(store);
  server = http.createServer();
  wss = new WebSocketServer({ server, path: '/ws' });
  attachWsHandler(wss, rooms);
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  for (const c of wss.clients) c.terminate();
  await new Promise((res) => wss.close(res));
  server.closeAllConnections();
  await new Promise((res) => server.close(res));
  rmSync(dataDir, { recursive: true, force: true });
});

const config = { playerCount: 2, playerNames: [], variant: 'family' as const, rngSeed: 99 };

describe('game server', () => {
  it('runs a 2-player game over websockets with rejoin', async () => {
    const host = new TestClient();
    await host.open();
    host.send({ type: 'CREATE_GAME', config, hostName: 'Host' });
    const joined = await host.nextOfType('JOINED');
    expect(joined.seat).toBe(0);
    const code = joined.roomCode;
    expect(code).toMatch(/^[A-Z]{4}$/);

    // unknown room is rejected
    const stranger = new TestClient();
    await stranger.open();
    stranger.send({ type: 'JOIN_GAME', roomCode: 'ZZZZ', name: 'Nobody' });
    expect((await stranger.nextOfType('ERROR')).code).toBe('no-such-room');
    stranger.close();

    const guest = new TestClient();
    await guest.open();
    guest.send({ type: 'JOIN_GAME', roomCode: code, name: 'Guest' });
    const gJoined = await guest.nextOfType('JOINED');
    expect(gJoined.seat).toBe(1);

    // both receive the initial STATE when the room fills
    const hostState = await host.nextOfType('STATE');
    const guestState = await guest.nextOfType('STATE');
    expect(hostState.seq).toBe(0);
    expect(guestState.state.players.map((p) => p.name)).toEqual(['Host', 'Guest']);

    // out-of-turn / wrong-seat action is rejected
    guest.send({
      type: 'SUBMIT_ACTION',
      action: { type: 'PLACE_WORKER', player: 0, space: 'forest' },
      expectedSeq: 0,
    });
    expect((await guest.nextOfType('ERROR')).code).toBe('not-your-seat');

    // legal action broadcasts to everyone
    host.send({
      type: 'SUBMIT_ACTION',
      action: { type: 'PLACE_WORKER', player: 0, space: 'forest' },
      expectedSeq: 0,
    });
    const s1 = await host.nextOfType('STATE');
    expect(s1.seq).toBe(1);
    expect(s1.state.players[0]!.resources.wood).toBe(3);
    await guest.nextOfType('STATE');

    // stale seq → resync + error
    host.send({
      type: 'SUBMIT_ACTION',
      action: { type: 'PLACE_WORKER', player: 0, space: 'clay-pit' },
      expectedSeq: 0,
    });
    await host.nextOfType('ERROR');

    // rejoin with token after disconnect
    guest.close();
    await new Promise((r) => setTimeout(r, 50));
    const guest2 = new TestClient();
    await guest2.open();
    guest2.send({ type: 'REJOIN', roomCode: code, playerToken: gJoined.playerToken });
    const rejoined = await guest2.nextOfType('JOINED');
    expect(rejoined.seat).toBe(1);
    const resync = await guest2.nextOfType('STATE');
    expect(resync.seq).toBe(1);

    // bad token rejected
    const imposter = new TestClient();
    await imposter.open();
    imposter.send({ type: 'REJOIN', roomCode: code, playerToken: 'nope' });
    expect((await imposter.nextOfType('ERROR')).code).toBe('bad-token');

    host.close();
    guest2.close();
    imposter.close();
  });

  it('persists snapshots and resumes rooms after restart', async () => {
    const host = new TestClient();
    await host.open();
    host.send({ type: 'CREATE_GAME', config, hostName: 'Solo Host' });
    const joined = await host.nextOfType('JOINED');
    host.close();

    // wait out the debounce
    await new Promise((r) => setTimeout(r, 700));

    const rooms2 = new RoomManager(new FileStore(dataDir));
    const room = rooms2.get(joined.roomCode);
    expect(room).toBeDefined();
    expect(room!.started).toBe(false);
    expect(room!.lobbySeats()).toEqual([{ seat: 0, name: 'Solo Host', connected: false }]);
  });
});
