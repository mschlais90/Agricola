import { create } from 'zustand';
import type { GameAction, GameConfig, GameState, PlayerId } from '@agricola/engine';
import type { LobbySeat } from '@agricola/protocol';
import { LocalTransport, clearSavedLocalGame } from '../transport/LocalTransport';
import {
  WsTransport,
  clearWsSession,
  savedWsSession,
  type ConnectionStatus,
  type WsSession,
} from '../transport/WsTransport';
import type { Transport } from '../transport/Transport';

interface RoomLobby {
  roomCode: string;
  seats: LobbySeat[];
  playerCount: number;
}

interface GameStore {
  screen: 'lobby' | 'game';
  transport: Transport | null;
  state: GameState | null;
  seq: number;
  error: string | null;
  /** Seat that must acknowledge the pass-device interstitial (hot-seat). */
  awaitingPass: PlayerId | null;
  lastActiveSeat: PlayerId | null;
  /** Networked: seats this client controls; 'all' for hot-seat. */
  mySeats: PlayerId[] | 'all';
  roomLobby: RoomLobby | null;
  connection: ConnectionStatus | null;
  disconnectedSeats: PlayerId[];

  startLocal(config: GameConfig): void;
  resumeLocal(): boolean;
  hostOnline(config: GameConfig, hostName: string): void;
  joinOnline(roomCode: string, name: string): void;
  rejoinOnline(): boolean;
  submit(action: GameAction): void;
  acknowledgePass(): void;
  quitToLobby(): void;
  clearError(): void;
}

function attachLocal(t: LocalTransport, set: (p: Partial<GameStore>) => void, get: () => GameStore): void {
  t.onState((seq, state) => {
    const activeSeat = state.phase === 'finished' ? null : state.currentPlayer;
    const prev = get().lastActiveSeat;
    const needsPass =
      state.config.playerCount > 1 && activeSeat !== null && prev !== null && activeSeat !== prev;
    set({ state, seq, lastActiveSeat: activeSeat, awaitingPass: needsPass ? activeSeat : null });
  });
  t.onError((message) => set({ error: message }));
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'lobby',
  transport: null,
  state: null,
  seq: 0,
  error: null,
  awaitingPass: null,
  lastActiveSeat: null,
  mySeats: 'all',
  roomLobby: null,
  connection: null,
  disconnectedSeats: [],

  startLocal(config) {
    get().transport?.dispose();
    const t = LocalTransport.create(config);
    set({
      transport: t,
      screen: 'game',
      error: null,
      awaitingPass: null,
      lastActiveSeat: null,
      mySeats: 'all',
      roomLobby: null,
      connection: null,
      disconnectedSeats: [],
    });
    attachLocal(t, set, get);
  },

  resumeLocal() {
    const t = LocalTransport.resume();
    if (!t) return false;
    get().transport?.dispose();
    set({
      transport: t,
      screen: 'game',
      error: null,
      awaitingPass: null,
      lastActiveSeat: null,
      mySeats: 'all',
      roomLobby: null,
      connection: null,
      disconnectedSeats: [],
    });
    attachLocal(t, set, get);
    return true;
  },

  hostOnline(config, hostName) {
    startWs(set, get, { kind: 'create', config, hostName });
  },

  joinOnline(roomCode, name) {
    startWs(set, get, { kind: 'join', roomCode: roomCode.toUpperCase(), name });
  },

  rejoinOnline() {
    const session = savedWsSession();
    if (!session) return false;
    startWs(set, get, { kind: 'rejoin', session });
    return true;
  },

  submit(action) {
    set({ error: null });
    get().transport?.submit(action);
  },

  acknowledgePass() {
    set({ awaitingPass: null });
  },

  quitToLobby() {
    const t = get().transport;
    t?.dispose();
    if (t?.mode === 'local') clearSavedLocalGame();
    if (t?.mode === 'ws') clearWsSession();
    set({
      transport: null,
      state: null,
      screen: 'lobby',
      awaitingPass: null,
      lastActiveSeat: null,
      roomLobby: null,
      connection: null,
      mySeats: 'all',
      disconnectedSeats: [],
      error: null,
    });
  },

  clearError() {
    set({ error: null });
  },
}));

function startWs(
  set: (p: Partial<GameStore>) => void,
  get: () => GameStore,
  intent:
    | { kind: 'create'; config: GameConfig; hostName: string }
    | { kind: 'join'; roomCode: string; name: string }
    | { kind: 'rejoin'; session: WsSession },
): void {
  get().transport?.dispose();
  const t = new WsTransport(intent, {
    onLobby(roomCode, seats, playerCount) {
      set({ roomLobby: { roomCode, seats, playerCount } });
    },
    onJoined(session) {
      set({ mySeats: [session.seat], screen: 'game' });
    },
    onStatus(status) {
      set({ connection: status });
    },
    onPlayerStatus(seat, connected) {
      const cur = new Set(get().disconnectedSeats);
      if (connected) cur.delete(seat);
      else cur.add(seat);
      set({ disconnectedSeats: [...cur] });
    },
  });
  set({
    transport: t,
    screen: 'game',
    error: null,
    awaitingPass: null,
    lastActiveSeat: null,
    state: null,
    roomLobby: null,
    disconnectedSeats: [],
  });
  t.onState((seq, state) => set({ state, seq }));
  t.onError((message) => set({ error: message }));
}
