import type { Farm, Pasture } from '../state/types';
import { FARM_COLS, FARM_ROWS, cellKey, parseCell } from '../state/types';

/**
 * Fences are the source of truth; pastures are derived.
 *
 * Model: cells 0..14 plus a virtual OUTSIDE node. Two adjacent cells connect
 * when the shared edge slot has no fence; border cells connect to OUTSIDE when
 * the border edge has no fence. Connected components that do not reach OUTSIDE
 * are pastures.
 *
 * Validity (rulebook, Action D):
 * - pasture cells may not contain rooms or fields (stables are fine)
 * - every fence must separate two different regions ("no dangling fences" —
 *   all fences must form part of complete pasture boundaries)
 * - all pastures must be orthogonally contiguous as a group
 */

export type FenceError =
  | { code: 'pasture-over-building'; cell: string }
  | { code: 'dangling-fence'; edge: { dir: 'h' | 'v'; row: number; col: number } }
  | { code: 'pastures-not-adjacent' };

const OUTSIDE = FARM_ROWS * FARM_COLS;

function cellIndex(row: number, col: number): number {
  return row * FARM_COLS + col;
}

/** Union-find over cells + OUTSIDE. */
function buildComponents(farm: Farm): number[] {
  const parent = Array.from({ length: OUTSIDE + 1 }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    let c = x;
    while (parent[c] !== c) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let r = 0; r < FARM_ROWS; r++) {
    for (let c = 0; c < FARM_COLS; c++) {
      const me = cellIndex(r, c);
      // top edge h[r][c]
      if (!farm.fencesH[r]?.[c]) union(me, r === 0 ? OUTSIDE : cellIndex(r - 1, c));
      // bottom edge h[r+1][c]
      if (!farm.fencesH[r + 1]?.[c]) union(me, r === FARM_ROWS - 1 ? OUTSIDE : cellIndex(r + 1, c));
      // left edge v[r][c]
      if (!farm.fencesV[r]?.[c]) union(me, c === 0 ? OUTSIDE : cellIndex(r, c - 1));
      // right edge v[r][c+1]
      if (!farm.fencesV[r]?.[c + 1]) union(me, c === FARM_COLS - 1 ? OUTSIDE : cellIndex(r, c + 1));
    }
  }
  return Array.from({ length: OUTSIDE + 1 }, (_, i) => find(i));
}

export function countFences(farm: Farm): number {
  let n = 0;
  for (const row of farm.fencesH) for (const f of row) if (f) n++;
  for (const row of farm.fencesV) for (const f of row) if (f) n++;
  return n;
}

/**
 * Compute pastures, or return an error when the fence layout is illegal.
 * Capacity: 2 per cell, doubled for EACH stable inside the pasture.
 */
export function computePastures(farm: Farm): { pastures: Pasture[] } | { error: FenceError } {
  const comp = buildComponents(farm);
  const outsideComp = comp[OUTSIDE]!;
  const stableSet = new Set(farm.stables);
  const roomSet = new Set(farm.rooms);

  // Group enclosed cells by component.
  const groups = new Map<number, string[]>();
  for (let r = 0; r < FARM_ROWS; r++) {
    for (let c = 0; c < FARM_COLS; c++) {
      const comp0 = comp[cellIndex(r, c)]!;
      if (comp0 === outsideComp) continue;
      const key = cellKey(r, c);
      if (roomSet.has(key) || farm.fields[key]) {
        return { error: { code: 'pasture-over-building', cell: key } };
      }
      const list = groups.get(comp0) ?? [];
      list.push(key);
      groups.set(comp0, list);
    }
  }

  // Every fence must have different components on its two sides.
  for (let r = 0; r <= FARM_ROWS; r++) {
    for (let c = 0; c < FARM_COLS; c++) {
      if (!farm.fencesH[r]?.[c]) continue;
      const above = r === 0 ? outsideComp : comp[cellIndex(r - 1, c)]!;
      const below = r === FARM_ROWS ? outsideComp : comp[cellIndex(r, c)]!;
      if (above === below) return { error: { code: 'dangling-fence', edge: { dir: 'h', row: r, col: c } } };
    }
  }
  for (let r = 0; r < FARM_ROWS; r++) {
    for (let c = 0; c <= FARM_COLS; c++) {
      if (!farm.fencesV[r]?.[c]) continue;
      const left = c === 0 ? outsideComp : comp[cellIndex(r, c - 1)]!;
      const right = c === FARM_COLS ? outsideComp : comp[cellIndex(r, c)]!;
      if (left === right) return { error: { code: 'dangling-fence', edge: { dir: 'v', row: r, col: c } } };
    }
  }

  const pastures: Pasture[] = [...groups.values()].map((cells) => {
    cells.sort();
    const stables = cells.filter((k) => stableSet.has(k)).length;
    return { cells, capacity: cells.length * 2 * 2 ** stables };
  });

  // All pastures together must be orthogonally contiguous (rulebook, Action D).
  if (pastures.length > 1) {
    const pastureCells = new Set(pastures.flatMap((p) => p.cells));
    const start = [...pastureCells][0]!;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const { row, col } = parseCell(queue.pop()!);
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = cellKey(row + dr, col + dc);
        if (pastureCells.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    if (seen.size !== pastureCells.size) return { error: { code: 'pastures-not-adjacent' } };
  }

  pastures.sort((a, b) => (a.cells[0]! < b.cells[0]! ? -1 : 1));
  return { pastures };
}

/** Recompute and store the derived pasture cache. Throws on illegal layout. */
export function recomputePastures(farm: Farm): void {
  const res = computePastures(farm);
  if ('error' in res) throw new Error(`illegal fence layout: ${res.error.code}`);
  farm.pastures = res.pastures;
}

export function emptyFences(): { fencesH: boolean[][]; fencesV: boolean[][] } {
  return {
    fencesH: Array.from({ length: FARM_ROWS + 1 }, () => Array<boolean>(FARM_COLS).fill(false)),
    fencesV: Array.from({ length: FARM_ROWS }, () => Array<boolean>(FARM_COLS + 1).fill(false)),
  };
}
