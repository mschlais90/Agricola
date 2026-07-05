import {
  reduce,
  setupGame,
  validateAction,
  type GameAction,
  type GameConfig,
  type GameState,
} from '@agricola/engine';
import type { Transport } from './Transport';

const STORAGE_KEY = 'agricola:local-game';

interface Snapshot {
  seq: number;
  state: GameState;
}

export function hasSavedLocalGame(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const snap = JSON.parse(raw) as Snapshot;
    return snap.state.phase !== 'finished';
  } catch {
    return false;
  }
}

export function clearSavedLocalGame(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export class LocalTransport implements Transport {
  readonly mode = 'local' as const;
  readonly seats = 'all' as const;

  private seq: number;
  private state: GameState;
  private stateSubs = new Set<(seq: number, state: GameState) => void>();
  private errorSubs = new Set<(message: string) => void>();

  private constructor(seq: number, state: GameState) {
    this.seq = seq;
    this.state = state;
  }

  static create(config: GameConfig): LocalTransport {
    const t = new LocalTransport(0, setupGame(config));
    t.persist();
    return t;
  }

  static resume(): LocalTransport | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const snap = JSON.parse(raw) as Snapshot;
      return new LocalTransport(snap.seq, snap.state);
    } catch {
      return null;
    }
  }

  submit(action: GameAction): void {
    const check = validateAction(this.state, action);
    if (!check.ok) {
      for (const cb of this.errorSubs) cb(check.message);
      return;
    }
    this.state = reduce(this.state, action);
    this.seq++;
    this.persist();
    for (const cb of this.stateSubs) cb(this.seq, this.state);
  }

  onState(cb: (seq: number, state: GameState) => void): () => void {
    this.stateSubs.add(cb);
    cb(this.seq, this.state);
    return () => this.stateSubs.delete(cb);
  }

  onError(cb: (message: string) => void): () => void {
    this.errorSubs.add(cb);
    return () => this.errorSubs.delete(cb);
  }

  dispose(): void {
    this.stateSubs.clear();
    this.errorSubs.clear();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq: this.seq, state: this.state }));
    } catch {
      // storage full/unavailable — non-fatal
    }
  }
}
