import type { Farm, GameConfig, GameState } from '../src/state/types';
import { emptyFences } from '../src/rules/fencing';
import { setupGame } from '../src/state/setup';

export function farmFixture(partial?: Partial<Farm>): Farm {
  return {
    rooms: ['1,0', '2,0'],
    roomMaterial: 'wood',
    fields: {},
    ...emptyFences(),
    stables: [],
    pastures: [],
    animals: { sheep: 0, boar: 0, cattle: 0 },
    ...partial,
  };
}

export function config(partial?: Partial<GameConfig>): GameConfig {
  return {
    playerCount: 2,
    playerNames: ['Alice', 'Bob'],
    variant: 'family',
    rngSeed: 42,
    ...partial,
  };
}

export function game(partial?: Partial<GameConfig>): GameState {
  return setupGame(config(partial));
}

/** Fence a rectangle of cells [r0..r1] x [c0..c1] and return the edge list. */
export function rectEdges(r0: number, c0: number, r1: number, c1: number) {
  const edges: { dir: 'h' | 'v'; row: number; col: number }[] = [];
  for (let c = c0; c <= c1; c++) {
    edges.push({ dir: 'h', row: r0, col: c });
    edges.push({ dir: 'h', row: r1 + 1, col: c });
  }
  for (let r = r0; r <= r1; r++) {
    edges.push({ dir: 'v', row: r, col: c0 });
    edges.push({ dir: 'v', row: r, col: c1 + 1 });
  }
  return edges;
}

export function applyEdges(farm: Farm, edges: { dir: 'h' | 'v'; row: number; col: number }[]) {
  for (const e of edges) {
    (e.dir === 'h' ? farm.fencesH : farm.fencesV)[e.row]![e.col] = true;
  }
}
