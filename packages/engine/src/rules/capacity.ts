import type { AnimalCounts, AnimalType, Farm } from '../state/types';

/**
 * Animal capacity. Animals are stored as totals; the rules allow rearranging
 * at any time, so legality means "some assignment exists":
 * - each pasture holds one animal type, up to its capacity
 * - each unfenced stable holds 1 animal of any type
 * - the house holds 1 pet of any type
 */

export const ANIMAL_TYPES: AnimalType[] = ['sheep', 'boar', 'cattle'];

function unfencedStableCount(farm: Farm): number {
  const fenced = new Set(farm.pastures.flatMap((p) => p.cells));
  return farm.stables.filter((s) => !fenced.has(s)).length;
}

/** Max singles slots: unfenced stables + 1 house pet. */
function singleSlots(farm: Farm): number {
  return unfencedStableCount(farm) + 1;
}

/**
 * Does a legal assignment exist for these animal counts?
 * DFS over pasture→type assignments (pasture count is tiny), then the
 * remaining animals must fit into single slots (each takes exactly 1 animal).
 */
export function canAccommodate(farm: Farm, counts: AnimalCounts): boolean {
  const caps = farm.pastures.map((p) => p.capacity);
  const singles = singleSlots(farm);
  const need: number[] = ANIMAL_TYPES.map((t) => counts[t]);

  const dfs = (i: number, remaining: number[]): boolean => {
    if (i === caps.length) {
      const overflow = remaining.reduce((sum, n) => sum + Math.max(0, n), 0);
      return overflow <= singles;
    }
    // leave pasture empty
    if (dfs(i + 1, remaining)) return true;
    for (let t = 0; t < remaining.length; t++) {
      if (remaining[t]! <= 0) continue;
      const next = [...remaining];
      next[t] = next[t]! - Math.min(next[t]!, caps[i]!);
      if (dfs(i + 1, next)) return true;
    }
    return false;
  };
  return dfs(0, need);
}

export interface AnimalAssignment {
  pastures: { cells: string[]; type: AnimalType | null; count: number; capacity: number }[];
  stables: { cell: string; type: AnimalType | null }[]; // unfenced stables only
  pet: AnimalType | null;
}

/**
 * Produce one concrete legal assignment for display purposes.
 * Returns null when the counts cannot be accommodated.
 */
export function computeAssignment(farm: Farm, counts: AnimalCounts): AnimalAssignment | null {
  if (!canAccommodate(farm, counts)) return null;
  const fenced = new Set(farm.pastures.flatMap((p) => p.cells));
  const unfenced = farm.stables.filter((s) => !fenced.has(s));

  // Greedy with verification: assign biggest herds to biggest pastures first,
  // then fall back to search via canAccommodate on the residual.
  const caps = [...farm.pastures].sort((a, b) => b.capacity - a.capacity);
  const remaining: AnimalCounts = { ...counts };
  const byPasture = new Map<string, { type: AnimalType | null; count: number }>();

  for (const p of caps) {
    // pick the type with the largest remainder that benefits
    const best = [...ANIMAL_TYPES].sort((a, b) => remaining[b] - remaining[a])[0]!;
    if (remaining[best] > 0) {
      const n = Math.min(remaining[best], p.capacity);
      byPasture.set(p.cells[0]!, { type: best, count: n });
      remaining[best] -= n;
    } else {
      byPasture.set(p.cells[0]!, { type: null, count: 0 });
    }
  }

  const singles: (AnimalType | null)[] = [];
  for (const t of ANIMAL_TYPES) {
    while (remaining[t] > 0 && singles.length < unfenced.length + 1) {
      singles.push(t);
      remaining[t]--;
    }
  }
  if (ANIMAL_TYPES.some((t) => remaining[t] > 0)) {
    // Greedy failed even though a solution exists — rare; do exhaustive search.
    return exhaustiveAssignment(farm, counts, unfenced);
  }

  return {
    pastures: farm.pastures.map((p) => {
      const a = byPasture.get(p.cells[0]!) ?? { type: null, count: 0 };
      return { cells: p.cells, type: a.type, count: a.count, capacity: p.capacity };
    }),
    stables: unfenced.map((cell, i) => ({ cell, type: singles[i + 1] ?? null })),
    pet: singles[0] ?? null,
  };
}

function exhaustiveAssignment(
  farm: Farm,
  counts: AnimalCounts,
  unfenced: string[],
): AnimalAssignment | null {
  const caps = farm.pastures.map((p) => p.capacity);
  const singles = unfenced.length + 1;
  const found: (number | null)[] = [];

  const dfs = (i: number, remaining: number[]): boolean => {
    if (i === caps.length) {
      return remaining.reduce((s, n) => s + Math.max(0, n), 0) <= singles;
    }
    for (const t of [null, 0, 1, 2] as const) {
      if (t !== null && remaining[t]! <= 0) continue;
      const next = [...remaining];
      if (t !== null) next[t] = Math.max(0, next[t]! - caps[i]!);
      found[i] = t;
      if (dfs(i + 1, next)) return true;
    }
    return false;
  };
  const need = ANIMAL_TYPES.map((t) => counts[t]);
  if (!dfs(0, need)) return null;

  const remaining: AnimalCounts = { ...counts };
  const pastures = farm.pastures.map((p, i) => {
    const t = found[i] ?? null;
    if (t === null) return { cells: p.cells, type: null, count: 0, capacity: p.capacity };
    const type = ANIMAL_TYPES[t]!;
    const n = Math.min(remaining[type], p.capacity);
    remaining[type] -= n;
    return { cells: p.cells, type: n > 0 ? type : null, count: n, capacity: p.capacity };
  });
  const singlesList: (AnimalType | null)[] = [];
  for (const t of ANIMAL_TYPES) {
    while (remaining[t] > 0 && singlesList.length < singles) {
      singlesList.push(t);
      remaining[t]--;
    }
  }
  return {
    pastures,
    stables: unfenced.map((cell, i) => ({ cell, type: singlesList[i + 1] ?? null })),
    pet: singlesList[0] ?? null,
  };
}
