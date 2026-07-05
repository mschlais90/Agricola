import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../src/actions/legal';
import { reduce, validateAction } from '../src/actions/reduce';
import type { GameAction, SpaceChoices } from '../src/actions/types';
import { getActionSpaces } from '../src/data/actionSpaces';
import { IMPROVEMENTS } from '../src/data/improvements';
import { foodRequired, type FeedConversion } from '../src/rules/feeding';
import { setupGame } from '../src/state/setup';
import { mulberry32 } from '../src/rng';
import type { GameState } from '../src/state/types';
import { FARM_COLS, FARM_ROWS, cellKey } from '../src/state/types';

/**
 * A deliberately simple bot that always finds SOME legal action, so random
 * playouts exercise the full 14-round flow across many seeds.
 */
function botAction(s: GameState, rand: () => number): GameAction {
  if (s.pendingDecision?.type === 'breed') {
    // keep as many babies as fit, greedily
    const player = s.players[s.pendingDecision.player]!;
    const keep: ('sheep' | 'boar' | 'cattle')[] = [];
    for (const t of s.pendingDecision.eligible) {
      const test = [...keep, t];
      const check = validateAction(s, { type: 'BREED_CHOICE', player: player.id, keep: test });
      if (check.ok) keep.push(t);
    }
    return { type: 'BREED_CHOICE', player: player.id, keep };
  }

  if (s.phase === 'feed') {
    const player = s.players[s.feedQueue[0]!]!;
    const conversions: FeedConversion[] = [];
    let food = player.resources.food ?? 0;
    const need = foodRequired(s, player);
    const grain = player.resources.grain ?? 0;
    if (food < need && grain > 0) {
      const n = Math.min(grain, need - food);
      conversions.push({ kind: 'raw-grain', count: n });
      food += n;
    }
    const veg = player.resources.vegetable ?? 0;
    if (food < need && veg > 0) {
      const n = Math.min(veg, need - food);
      conversions.push({ kind: 'raw-vegetable', count: n });
    }
    return { type: 'HARVEST_FEED', player: player.id, conversions };
  }

  // Work phase: try enabled spaces in random order with candidate choices.
  const player = s.players[s.currentPlayer]!;
  const legal = getLegalActions(s, player.id).filter((l) => l.enabled);
  const shuffledLegal = [...legal].sort(() => rand() - 0.5);
  for (const l of shuffledLegal) {
    for (const choices of candidateChoices(s, l.space)) {
      const action: GameAction = { type: 'PLACE_WORKER', player: player.id, space: l.space, choices };
      if (validateAction(s, action).ok) return action;
    }
  }
  throw new Error(
    `bot is stuck: round ${s.round}, player ${player.id}, legal=${JSON.stringify(legal)}`,
  );
}

function* candidateChoices(s: GameState, spaceId: string): Generator<SpaceChoices> {
  const def = getActionSpaces(s.config).find((d) => d.id === spaceId)!;
  const player = s.players[s.currentPlayer]!;
  const allCells: string[] = [];
  for (let r = 0; r < FARM_ROWS; r++) for (let c = 0; c < FARM_COLS; c++) allCells.push(cellKey(r, c));

  switch (def.effect) {
    case 'plow':
      for (const cell of allCells) yield { cell };
      return;
    case 'plowSow':
      for (const cell of allCells) yield { cell };
      return;
    case 'sowBake': {
      const empty = Object.entries(player.farm.fields).find(([, f]) => f.crop === null);
      if (empty) {
        if ((player.resources.grain ?? 0) > 0) yield { sow: [{ cell: empty[0], crop: 'grain' }] };
        if ((player.resources.vegetable ?? 0) > 0) yield { sow: [{ cell: empty[0], crop: 'vegetable' }] };
      }
      if ((player.resources.grain ?? 0) > 0) yield { bakeGrain: 1 };
      return;
    }
    case 'farmExpansion':
      for (const cell of allCells) yield { rooms: [cell] };
      for (const cell of allCells) yield { stables: [cell] };
      return;
    case 'takeAnimalPool': {
      const type = (['sheep', 'boar', 'cattle'] as const).find((t) => def.accumulates?.[t])!;
      const total = (s.actionSpaces[def.id]!.pool as Record<string, number>)[type] ?? 0;
      for (let keep = total; keep >= 0; keep--) {
        yield { animalKeep: keep, animalRelease: total - keep };
        yield { animalKeep: keep, animalCook: total - keep };
      }
      return;
    }
    case 'dayLaborer':
    case 'resourceChoice':
      for (const resource of def.choices ?? (['wood', 'clay', 'reed', 'stone'] as const))
        yield { resource };
      return;
    case 'majorImprovement':
      for (const imp of IMPROVEMENTS) yield { improvement: imp.id };
      return;
    case 'renovationImprovement':
    case 'renovationFences':
      yield {};
      return;
    case 'fences': {
      // try to fence a single free cell
      for (const cell of allCells) {
        const [r, c] = cell.split(',').map(Number) as [number, number];
        yield {
          edges: [
            { dir: 'h', row: r, col: c },
            { dir: 'h', row: r + 1, col: c },
            { dir: 'v', row: r, col: c },
            { dir: 'v', row: r, col: c + 1 },
          ],
        };
      }
      return;
    }
    default:
      yield {};
  }
}

function playout(playerCount: number, seed: number): GameState {
  let s = setupGame({
    playerCount,
    playerNames: ['A', 'B', 'C', 'D'].slice(0, playerCount),
    variant: playerCount === 1 && seed % 2 === 0 ? 'solo' : 'family',
    rngSeed: seed,
  });
  const rand = mulberry32(seed * 7919);
  let guard = 0;
  while (s.phase !== 'finished') {
    if (++guard > 2000) throw new Error('runaway game');
    s = reduce(s, botAction(s, rand));
  }
  return s;
}

describe('full-game simulation', () => {
  it('random legal playouts complete 14 rounds for 1-4 players', () => {
    for (let players = 1; players <= 4; players++) {
      for (let seed = 1; seed <= 5; seed++) {
        const final = playout(players, seed);
        expect(final.phase).toBe('finished');
        expect(final.round).toBe(14);
        expect(final.scores).toHaveLength(players);
        for (const sheet of final.scores!) expect(Number.isFinite(sheet.total)).toBe(true);
      }
    }
  });

  it('is deterministic: same seed and actions produce identical states', () => {
    const a = playout(3, 11);
    const b = playout(3, 11);
    expect(a).toEqual(b);
  });

  it('round schedule reveals stages in order', () => {
    const s = setupGame({ playerCount: 2, playerNames: ['A', 'B'], variant: 'family', rngSeed: 5 });
    const defs = getActionSpaces(s.config);
    const stages = s.roundSchedule.map((id) => defs.find((d) => d.id === id)!.stage);
    expect(stages).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  });
});
