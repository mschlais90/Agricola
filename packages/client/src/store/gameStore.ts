import { create } from 'zustand';
import type { GameAction, GameConfig, GameState, PlayerId } from '@agricola/engine';
import { LocalTransport, clearSavedLocalGame } from '../transport/LocalTransport';
import type { Transport } from '../transport/Transport';

interface GameStore {
  screen: 'lobby' | 'game';
  transport: Transport | null;
  state: GameState | null;
  seq: number;
  error: string | null;
  /** Seat that must acknowledge the pass-device interstitial (hot-seat). */
  awaitingPass: PlayerId | null;
  lastActiveSeat: PlayerId | null;

  startLocal(config: GameConfig): void;
  resumeLocal(): boolean;
  submit(action: GameAction): void;
  acknowledgePass(): void;
  quitToLobby(): void;
  clearError(): void;
}

function attach(t: Transport, set: (p: Partial<GameStore>) => void, get: () => GameStore): void {
  t.onState((seq, state) => {
    const activeSeat = state.phase === 'finished' ? null : state.currentPlayer;
    const prev = get().lastActiveSeat;
    const needsPass =
      t.mode === 'local' &&
      t.seats === 'all' &&
      state.config.playerCount > 1 &&
      activeSeat !== null &&
      prev !== null &&
      activeSeat !== prev;
    set({
      state,
      seq,
      lastActiveSeat: activeSeat,
      awaitingPass: needsPass ? activeSeat : null,
    });
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

  startLocal(config) {
    get().transport?.dispose();
    const t = LocalTransport.create(config);
    set({ transport: t, screen: 'game', error: null, awaitingPass: null, lastActiveSeat: null });
    attach(t, set, get);
  },

  resumeLocal() {
    const t = LocalTransport.resume();
    if (!t) return false;
    get().transport?.dispose();
    set({ transport: t, screen: 'game', error: null, awaitingPass: null, lastActiveSeat: null });
    attach(t, set, get);
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
    get().transport?.dispose();
    clearSavedLocalGame();
    set({ transport: null, state: null, screen: 'lobby', awaitingPass: null, lastActiveSeat: null });
  },

  clearError() {
    set({ error: null });
  },
}));
