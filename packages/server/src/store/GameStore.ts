import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameConfig, GameState } from '@agricola/engine';

export interface RoomSnapshot {
  roomCode: string;
  config: GameConfig;
  seats: { name: string; token: string }[];
  seq: number;
  state: GameState | null; // null = still in lobby
  updatedAt: number;
}

export interface GameStore {
  save(snapshot: RoomSnapshot): void;
  loadAll(): RoomSnapshot[];
  delete(roomCode: string): void;
}

/**
 * Debounced atomic JSON snapshots on disk. Swap point for a hosted DB later:
 * implement this interface with SQLite/Postgres and change one constructor.
 */
export class FileStore implements GameStore {
  private dir: string;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, RoomSnapshot>();

  constructor(dataDir: string) {
    this.dir = join(dataDir, 'games');
    mkdirSync(this.dir, { recursive: true });
  }

  save(snapshot: RoomSnapshot): void {
    this.pending.set(snapshot.roomCode, snapshot);
    if (this.timers.has(snapshot.roomCode)) return;
    this.timers.set(
      snapshot.roomCode,
      setTimeout(() => {
        this.timers.delete(snapshot.roomCode);
        const snap = this.pending.get(snapshot.roomCode);
        if (!snap) return;
        this.pending.delete(snapshot.roomCode);
        const file = join(this.dir, `${snap.roomCode}.json`);
        const tmp = `${file}.tmp`;
        try {
          writeFileSync(tmp, JSON.stringify(snap));
          renameSync(tmp, file);
        } catch (e) {
          console.error(`failed to persist ${snap.roomCode}:`, e);
        }
      }, 500),
    );
  }

  loadAll(): RoomSnapshot[] {
    const out: RoomSnapshot[] = [];
    for (const f of readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(readFileSync(join(this.dir, f), 'utf8')) as RoomSnapshot);
      } catch (e) {
        console.error(`skipping corrupt snapshot ${f}:`, e);
      }
    }
    return out;
  }

  delete(roomCode: string): void {
    this.pending.delete(roomCode);
    const t = this.timers.get(roomCode);
    if (t) clearTimeout(t);
    this.timers.delete(roomCode);
    try {
      rmSync(join(this.dir, `${roomCode}.json`), { force: true });
    } catch {
      /* ignore */
    }
  }
}
