import type { GameAction, GameConfig, GameState, PlayerId } from '@agricola/engine';
import type { ClientMessage, LobbySeat, ServerMessage } from '@agricola/protocol';
import type { Transport } from './Transport';

const SESSION_KEY = 'agricola:ws-session';

export interface WsSession {
  roomCode: string;
  playerToken: string;
  seat: number;
  name: string;
}

export function savedWsSession(): WsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as WsSession) : null;
  } catch {
    return null;
  }
}

export function clearWsSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface WsEvents {
  onLobby(roomCode: string, seats: LobbySeat[], playerCount: number): void;
  onJoined(session: WsSession): void;
  onStatus(status: ConnectionStatus): void;
  onPlayerStatus(seat: number, connected: boolean): void;
}

type Intent =
  | { kind: 'create'; config: GameConfig; hostName: string }
  | { kind: 'join'; roomCode: string; name: string }
  | { kind: 'rejoin'; session: WsSession };

export class WsTransport implements Transport {
  readonly mode = 'ws' as const;
  get seats(): PlayerId[] | 'all' {
    return this.session ? [this.session.seat] : [];
  }

  private ws: WebSocket | null = null;
  private session: WsSession | null = null;
  private intent: Intent;
  private events: WsEvents;
  private seq = 0;
  private disposed = false;
  private retryDelay = 500;

  private stateSubs = new Set<(seq: number, state: GameState) => void>();
  private errorSubs = new Set<(message: string) => void>();
  private lastState: { seq: number; state: GameState } | null = null;

  constructor(intent: Intent, events: WsEvents) {
    this.intent = intent;
    if (intent.kind === 'rejoin') this.session = intent.session;
    this.events = events;
    this.connect();
  }

  static wsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  private connect(): void {
    if (this.disposed) return;
    this.events.onStatus(this.session ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(WsTransport.wsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.retryDelay = 500;
      this.events.onStatus('connected');
      if (this.session) {
        this.send({ type: 'REJOIN', roomCode: this.session.roomCode, playerToken: this.session.playerToken });
      } else if (this.intent.kind === 'create') {
        this.send({ type: 'CREATE_GAME', config: this.intent.config, hostName: this.intent.hostName });
      } else if (this.intent.kind === 'join') {
        this.send({ type: 'JOIN_GAME', roomCode: this.intent.roomCode, name: this.intent.name });
      }
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      this.handle(msg);
    };

    ws.onclose = () => {
      if (this.disposed) return;
      // Only auto-reconnect once we hold a seat; a failed join just surfaces the error.
      if (this.session) {
        setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
        this.events.onStatus('reconnecting');
      }
    };
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'JOINED': {
        const name =
          this.intent.kind === 'create'
            ? this.intent.hostName
            : this.intent.kind === 'join'
              ? this.intent.name
              : this.intent.session.name;
        this.session = { roomCode: msg.roomCode, playerToken: msg.playerToken, seat: msg.seat, name };
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
        this.events.onJoined(this.session);
        return;
      }
      case 'LOBBY_UPDATE':
        this.events.onLobby(msg.roomCode, msg.seats, msg.playerCount);
        return;
      case 'STATE':
        this.seq = msg.seq;
        this.lastState = { seq: msg.seq, state: msg.state };
        for (const cb of this.stateSubs) cb(msg.seq, msg.state);
        return;
      case 'PLAYER_STATUS':
        this.events.onPlayerStatus(msg.seat, msg.connected);
        return;
      case 'ERROR':
        for (const cb of this.errorSubs) cb(msg.message);
        return;
      case 'PONG':
        return;
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  submit(action: GameAction): void {
    this.send({ type: 'SUBMIT_ACTION', action, expectedSeq: this.seq });
  }

  onState(cb: (seq: number, state: GameState) => void): () => void {
    this.stateSubs.add(cb);
    if (this.lastState) cb(this.lastState.seq, this.lastState.state);
    return () => this.stateSubs.delete(cb);
  }

  onError(cb: (message: string) => void): () => void {
    this.errorSubs.add(cb);
    return () => this.errorSubs.delete(cb);
  }

  dispose(): void {
    this.disposed = true;
    this.ws?.close();
    this.stateSubs.clear();
    this.errorSubs.clear();
  }
}
