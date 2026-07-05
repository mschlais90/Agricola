import type { GameConfig } from '@agricola/engine';
import { GameRoom } from './gameRoom';
import type { GameStore } from './store/GameStore';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private store: GameStore;

  constructor(store: GameStore) {
    this.store = store;
    // Resume unfinished games across restarts.
    for (const snap of store.loadAll()) {
      const room = GameRoom.fromSnapshot(snap, store);
      if (room.isFinished || Date.now() - snap.updatedAt > 14 * 24 * 3600 * 1000) {
        store.delete(snap.roomCode);
        continue;
      }
      this.rooms.set(room.code, room);
    }
    if (this.rooms.size > 0) {
      console.log(`resumed ${this.rooms.size} saved game(s): ${[...this.rooms.keys()].join(', ')}`);
    }
  }

  create(config: GameConfig): GameRoom {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new GameRoom(code, config, this.store);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  remove(code: string): void {
    this.rooms.delete(code);
    this.store.delete(code);
  }
}
