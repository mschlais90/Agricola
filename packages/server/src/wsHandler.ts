import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { parseClientMessage, type ServerMessage } from '@agricola/protocol';
import type { Client, GameRoom } from './gameRoom';
import type { RoomManager } from './roomManager';

interface Session {
  ws: WebSocket;
  room: GameRoom | null;
  alive: boolean;
}

export function attachWsHandler(wss: WebSocketServer, rooms: RoomManager): void {
  const sessions = new Set<Session>();

  // Heartbeat: reap sockets that miss two pings.
  const interval = setInterval(() => {
    for (const s of sessions) {
      if (!s.alive) {
        s.ws.terminate();
        continue;
      }
      s.alive = false;
      s.ws.ping();
    }
  }, 20_000);
  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const session: Session = { ws, room: null, alive: true };
    sessions.add(session);
    const client: Client = {
      send(msg: ServerMessage) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      },
    };

    ws.on('pong', () => (session.alive = true));

    ws.on('message', (raw: Buffer | string) => {
      const msg = parseClientMessage(String(raw));
      if (!msg) return client.send({ type: 'ERROR', code: 'bad-message', message: 'unparseable message' });

      try {
        switch (msg.type) {
          case 'PING':
            return client.send({ type: 'PONG' });

          case 'CREATE_GAME': {
            const room = rooms.create({ ...msg.config, playerNames: [] });
            const { seat, token } = room.join(msg.hostName, client);
            session.room = room;
            client.send({ type: 'JOINED', roomCode: room.code, playerToken: token, seat });
            room.afterJoin();
            return;
          }

          case 'JOIN_GAME': {
            const room = rooms.get(msg.roomCode);
            if (!room) return client.send({ type: 'ERROR', code: 'no-such-room', message: `no game ${msg.roomCode.toUpperCase()}` });
            if (room.isFull) return client.send({ type: 'ERROR', code: 'room-full', message: 'that game is full' });
            const { seat, token } = room.join(msg.name, client);
            session.room = room;
            client.send({ type: 'JOINED', roomCode: room.code, playerToken: token, seat });
            room.afterJoin();
            return;
          }

          case 'REJOIN': {
            const room = rooms.get(msg.roomCode);
            if (!room) return client.send({ type: 'ERROR', code: 'no-such-room', message: `no game ${msg.roomCode.toUpperCase()}` });
            const res = room.rejoin(msg.playerToken, client);
            if (!res) return client.send({ type: 'ERROR', code: 'bad-token', message: 'unknown player token' });
            session.room = room;
            client.send({ type: 'JOINED', roomCode: room.code, playerToken: msg.playerToken, seat: res.seat });
            room.afterRejoin(client, res.seat);
            return;
          }

          case 'SUBMIT_ACTION': {
            if (!session.room) return;
            const errMsg = session.room.submit(client, msg.action, msg.expectedSeq);
            if (errMsg) client.send(errMsg);
            return;
          }

          case 'REQUEST_SYNC':
            session.room?.sync(client);
            return;
        }
      } catch (e) {
        client.send({
          type: 'ERROR',
          code: 'bad-message',
          message: e instanceof Error ? e.message : 'server error',
        });
      }
    });

    ws.on('close', () => {
      sessions.delete(session);
      session.room?.disconnect(client);
    });
  });
}
