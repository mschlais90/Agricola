import { randomBytes } from 'node:crypto';
import {
  reduce,
  setupGame,
  validateAction,
  type GameAction,
  type GameConfig,
  type GameState,
} from '@agricola/engine';
import type { LobbySeat, ServerMessage } from '@agricola/protocol';
import type { GameStore, RoomSnapshot } from './store/GameStore';

export interface Client {
  send(msg: ServerMessage): void;
}

interface Seat {
  name: string;
  token: string;
  client: Client | null;
}

/** One authoritative game: validate → reduce → bump seq → persist → broadcast. */
export class GameRoom {
  readonly code: string;
  readonly config: GameConfig;
  private seats: Seat[] = [];
  private state: GameState | null = null;
  private seq = 0;
  private store: GameStore;

  constructor(code: string, config: GameConfig, store: GameStore) {
    this.code = code;
    this.config = config;
    this.store = store;
  }

  static fromSnapshot(snap: RoomSnapshot, store: GameStore): GameRoom {
    const room = new GameRoom(snap.roomCode, snap.config, store);
    room.seats = snap.seats.map((s) => ({ ...s, client: null }));
    room.state = snap.state;
    room.seq = snap.seq;
    return room;
  }

  get started(): boolean {
    return this.state !== null;
  }

  get isFull(): boolean {
    return this.seats.length >= this.config.playerCount;
  }

  get isFinished(): boolean {
    return this.state?.phase === 'finished';
  }

  /**
   * Add a player; returns their seat and token. Starts the game when full.
   * The caller must send JOINED to the new player first, then call afterJoin()
   * so the lobby/state broadcasts arrive in a predictable order.
   */
  join(name: string, client: Client): { seat: number; token: string } {
    if (this.isFull) throw new Error('room is full');
    const token = randomBytes(12).toString('hex');
    this.seats.push({ name, token, client });
    const seat = this.seats.length - 1;
    if (this.isFull) {
      this.state = setupGame({
        ...this.config,
        playerNames: this.seats.map((s) => s.name),
      });
      this.seq = 0;
    }
    this.persist();
    return { seat, token };
  }

  afterJoin(): void {
    this.broadcastLobby();
    if (this.state) this.broadcastState();
  }

  /** Re-attach a returning player by token. Caller sends JOINED, then calls afterRejoin(). */
  rejoin(token: string, client: Client): { seat: number } | null {
    const seat = this.seats.findIndex((s) => s.token === token);
    if (seat === -1) return null;
    this.seats[seat]!.client = client;
    return { seat };
  }

  afterRejoin(client: Client, seat: number): void {
    this.broadcast({ type: 'PLAYER_STATUS', seat, connected: true }, seat);
    if (this.state) {
      client.send({ type: 'STATE', seq: this.seq, state: this.state });
    } else {
      this.broadcastLobby();
    }
  }

  disconnect(client: Client): void {
    const seat = this.seats.findIndex((s) => s.client === client);
    if (seat === -1) return;
    this.seats[seat]!.client = null;
    this.broadcast({ type: 'PLAYER_STATUS', seat, connected: false });
    this.broadcastLobby();
  }

  seatOf(client: Client): number {
    return this.seats.findIndex((s) => s.client === client);
  }

  submit(client: Client, action: GameAction, expectedSeq: number): ServerMessage | null {
    if (!this.state) return err('not-started', 'game has not started');
    const seat = this.seatOf(client);
    if (seat === -1 || action.player !== seat)
      return err('not-your-seat', 'you can only act for your own seat');
    if (expectedSeq !== this.seq) {
      client.send({ type: 'STATE', seq: this.seq, state: this.state });
      return err('stale-seq', 'your view was out of date — synced');
    }
    const check = validateAction(this.state, action);
    if (!check.ok) return err('illegal-action', check.message);
    this.state = reduce(this.state, action);
    this.seq++;
    this.persist();
    this.broadcastState();
    return null;
  }

  sync(client: Client): void {
    if (this.state) client.send({ type: 'STATE', seq: this.seq, state: this.state });
    else this.broadcastLobby();
  }

  lobbySeats(): LobbySeat[] {
    return this.seats.map((s, i) => ({ seat: i, name: s.name, connected: s.client !== null }));
  }

  hasConnectedClients(): boolean {
    return this.seats.some((s) => s.client !== null);
  }

  private broadcast(msg: ServerMessage, exceptSeat?: number): void {
    this.seats.forEach((s, i) => {
      if (i !== exceptSeat) s.client?.send(msg);
    });
  }

  private broadcastState(): void {
    if (this.state) this.broadcast({ type: 'STATE', seq: this.seq, state: this.state });
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: 'LOBBY_UPDATE',
      roomCode: this.code,
      seats: this.lobbySeats(),
      playerCount: this.config.playerCount,
    });
  }

  private persist(): void {
    this.store.save({
      roomCode: this.code,
      config: this.config,
      seats: this.seats.map((s) => ({ name: s.name, token: s.token })),
      seq: this.seq,
      state: this.state,
      updatedAt: Date.now(),
    });
  }
}

function err(code: Parameters<typeof errMsg>[0], message: string): ServerMessage {
  return errMsg(code, message);
}
function errMsg(
  code: import('@agricola/protocol').ErrorCode,
  message: string,
): ServerMessage {
  return { type: 'ERROR', code, message };
}
