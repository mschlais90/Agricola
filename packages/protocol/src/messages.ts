import type { GameAction, GameConfig, GameState } from '@agricola/engine';

export const PROTOCOL_VERSION = 1;

export interface LobbySeat {
  seat: number;
  name: string;
  connected: boolean;
}

export type ClientMessage =
  | { type: 'CREATE_GAME'; config: GameConfig; hostName: string }
  | { type: 'JOIN_GAME'; roomCode: string; name: string }
  | { type: 'REJOIN'; roomCode: string; playerToken: string }
  | { type: 'SUBMIT_ACTION'; action: GameAction; expectedSeq: number }
  | { type: 'REQUEST_SYNC' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'JOINED'; roomCode: string; playerToken: string; seat: number }
  | { type: 'LOBBY_UPDATE'; roomCode: string; seats: LobbySeat[]; playerCount: number }
  | { type: 'STATE'; seq: number; state: GameState }
  | { type: 'PLAYER_STATUS'; seat: number; connected: boolean }
  | { type: 'ERROR'; code: ErrorCode; message: string }
  | { type: 'PONG' };

export type ErrorCode =
  | 'no-such-room'
  | 'room-full'
  | 'bad-token'
  | 'not-started'
  | 'stale-seq'
  | 'illegal-action'
  | 'not-your-seat'
  | 'bad-message';

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const msg = JSON.parse(raw) as ClientMessage;
    return typeof msg === 'object' && msg !== null && typeof msg.type === 'string' ? msg : null;
  } catch {
    return null;
  }
}
