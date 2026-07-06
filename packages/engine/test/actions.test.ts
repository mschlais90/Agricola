import { describe, expect, it } from 'vitest';
import { reduce, validateAction } from '../src/actions/reduce';
import { game, rectEdges } from './helpers';
import type { GameState } from '../src/state/types';

function place(s: GameState, space: string, choices?: object, player = s.currentPlayer): GameState {
  return reduce(s, { type: 'PLACE_WORKER', player, space, choices });
}

describe('work phase basics', () => {
  it('alternates players and ends the round when all workers are placed', () => {
    const s = game(); // 2 players, 2 workers each, round 1 (not a harvest round)
    expect(s.currentPlayer).toBe(0);
    const s1 = place(s, 'forest');
    expect(s1.currentPlayer).toBe(1);
    const s2 = place(s1, 'clay-pit');
    const s3 = place(s2, 'fishing');
    const s4 = place(s3, 'reed-bank');
    expect(s4.round).toBe(2); // round advanced
    expect(s4.players[0]!.resources.wood).toBe(3);
    expect(s4.players[1]!.resources.clay).toBe(1);
    // accumulation spaces replenished for round 2
    expect(s4.actionSpaces['forest']!.pool.wood).toBe(3);
  });

  it('rejects out-of-turn placement and occupied spaces', () => {
    const s = game();
    expect(validateAction(s, { type: 'PLACE_WORKER', player: 1, space: 'forest' }).ok).toBe(false);
    const s1 = place(s, 'forest');
    const bad = validateAction(s1, { type: 'PLACE_WORKER', player: 1, space: 'forest' });
    expect(bad.ok).toBe(false);
  });

  it('starting player token takes effect next round', () => {
    const s = game();
    const s1 = place(s, 'forest'); // p0
    const s2 = place(s1, 'meeting-place'); // p1 takes token
    const s3 = place(s2, 'clay-pit'); // p0
    const s4 = place(s3, 'fishing'); // p1 → round ends
    expect(s4.round).toBe(2);
    expect(s4.startingPlayer).toBe(1);
    expect(s4.currentPlayer).toBe(1);
  });
});

describe('building actions', () => {
  it('builds a room with 5 wood + 2 reed, adjacent to the home', () => {
    const s = game();
    s.players[0]!.resources = { wood: 5, reed: 2 };
    const next = place(s, 'farm-expansion', { rooms: ['0,0'] });
    expect(next.players[0]!.farm.rooms).toContain('0,0');
    expect(next.players[0]!.resources.wood).toBe(0);

    s.players[0]!.resources = { wood: 5, reed: 2 };
    expect(
      validateAction(s, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'farm-expansion',
        choices: { rooms: ['0,4'] }, // not adjacent
      }).ok,
    ).toBe(false);
  });

  it('builds stables for 2 wood each, max 4', () => {
    const s = game();
    s.players[0]!.resources = { wood: 10 };
    const next = place(s, 'farm-expansion', { stables: ['0,2', '0,3', '0,4', '1,4'] });
    expect(next.players[0]!.farm.stables).toHaveLength(4);
    expect(next.players[0]!.resources.wood).toBe(2);

    s.players[0]!.resources = { wood: 10 };
    expect(
      validateAction(s, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'farm-expansion',
        choices: { stables: ['0,1', '0,2', '0,3', '0,4', '1,4'] },
      }).ok,
    ).toBe(false);
  });

  it('plows adjacent fields only', () => {
    const s = game();
    const s1 = place(s, 'farmland', { cell: '0,4' });
    expect(Object.keys(s1.players[0]!.farm.fields)).toEqual(['0,4']);
    // next round, plowing non-adjacent is rejected
    s1.currentPlayer = 0;
    s1.actionSpaces['farmland']!.occupiedBy = null;
    s1.players[0]!.placed = 0;
    expect(
      validateAction(s1, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'farmland',
        choices: { cell: '2,2' },
      }).ok,
    ).toBe(false);
    const s2 = place(s1, 'farmland', { cell: '1,4' });
    expect(Object.keys(s2.players[0]!.farm.fields)).toHaveLength(2);
  });

  it('renovates wood → clay → stone, paying per room', () => {
    const s = game();
    s.actionSpaces['renovation-improvement'] = { revealed: true, occupiedBy: null, pool: {} };
    s.roundSchedule[s.round - 1] = 'renovation-improvement';
    s.players[0]!.resources = { clay: 2, reed: 1 };
    const next = place(s, 'renovation-improvement', {});
    expect(next.players[0]!.farm.roomMaterial).toBe('clay');
    expect(next.players[0]!.resources.clay).toBe(0);

    // cannot renovate stone further
    const p = s.players[0]!;
    p.farm.roomMaterial = 'stone';
    p.resources = { clay: 99, stone: 99, reed: 9 };
    expect(
      validateAction(s, { type: 'PLACE_WORKER', player: 0, space: 'renovation-improvement', choices: {} }).ok,
    ).toBe(false);
  });
});

describe('sowing and baking', () => {
  it('sows grain (3 counters) and vegetables (2 counters)', () => {
    const s = game();
    s.actionSpaces['sow-bake']!.revealed = true;
    const p = s.players[0]!;
    p.farm.fields = { '0,4': { crop: null, count: 0 }, '1,4': { crop: null, count: 0 } };
    p.resources = { grain: 1, vegetable: 1 };
    const next = place(s, 'sow-bake', {
      sow: [
        { cell: '0,4', crop: 'grain' },
        { cell: '1,4', crop: 'vegetable' },
      ],
    });
    expect(next.players[0]!.farm.fields['0,4']).toEqual({ crop: 'grain', count: 3 });
    expect(next.players[0]!.farm.fields['1,4']).toEqual({ crop: 'vegetable', count: 2 });
    expect(next.players[0]!.resources.grain).toBe(0);
  });

  it('bakes bread only with a baking improvement', () => {
    const s = game();
    s.actionSpaces['sow-bake']!.revealed = true;
    const p = s.players[0]!;
    p.resources = { grain: 2 };
    expect(
      validateAction(s, { type: 'PLACE_WORKER', player: 0, space: 'sow-bake', choices: { bakeGrain: 2 } }).ok,
    ).toBe(false);
    p.improvements = ['fireplace-2'];
    const next = place(s, 'sow-bake', { bakeGrain: 2 });
    expect(next.players[0]!.resources.food).toBe(4); // resources were reset; 2 grain × 2
  });

  it('plow-and-sow can plow a fresh cell and sow it in the same action', () => {
    const s = game();
    s.actionSpaces['plow-sow'] = { revealed: true, occupiedBy: null, pool: {} };
    const p = s.players[0]!;
    p.resources = { grain: 1 };
    // exactly the composite action the fixed dialog produces: plow 0,4 then sow it
    const next = place(s, 'plow-sow', {
      cell: '0,4',
      sow: [{ cell: '0,4', crop: 'grain' }],
    });
    expect(next.players[0]!.farm.fields['0,4']).toEqual({ crop: 'grain', count: 3 });
    expect(next.players[0]!.resources.grain).toBe(0);
  });
});

describe('improvements', () => {
  function withImprovementSpace(): GameState {
    const s = game();
    s.actionSpaces['major-improvement']!.revealed = true;
    return s;
  }

  it('buys a fireplace and later upgrades it to a hearth by returning it', () => {
    const s = withImprovementSpace();
    s.players[0]!.resources = { clay: 2 };
    const s1 = place(s, 'major-improvement', { improvement: 'fireplace-2' });
    expect(s1.players[0]!.improvements).toEqual(['fireplace-2']);
    expect(s1.improvementSupply['fireplace-2']).toBe(0);

    // next: upgrade by returning the fireplace instead of paying clay
    s1.currentPlayer = 0;
    s1.players[0]!.placed = 0;
    s1.actionSpaces['major-improvement']!.occupiedBy = null;
    const s2 = place(s1, 'major-improvement', {
      improvement: 'hearth-4',
      returnImprovement: 'fireplace-2',
    });
    expect(s2.players[0]!.improvements).toEqual(['hearth-4']);
    expect(s2.improvementSupply['fireplace-2']).toBe(1); // available again
  });

  it('well schedules 1 food for the next 5 rounds', () => {
    const s = withImprovementSpace();
    s.players[0]!.resources = { wood: 1, stone: 3 };
    const s1 = place(s, 'major-improvement', { improvement: 'well' });
    const rounds = Object.keys(s1.futureIncome).map(Number).sort((a, b) => a - b);
    expect(rounds).toEqual([2, 3, 4, 5, 6]);
    // finish the round → food arrives with round 2
    const s2 = place(s1, 'forest', {}); // p1
    const s3 = place(s2, 'clay-pit', {}); // p0
    const s4 = place(s3, 'fishing', {}); // p1 → round 2 begins
    expect(s4.players[0]!.resources.food).toBe(1); // resources were reset; well pays 1
  });

  it('oven purchase allows an immediate bake', () => {
    const s = withImprovementSpace();
    s.players[0]!.resources = { clay: 3, stone: 1, grain: 1 };
    const s1 = place(s, 'major-improvement', { improvement: 'clay-oven', bakeGrain: 1 });
    expect(s1.players[0]!.resources.food).toBe(5); // resources were reset; 1 grain × 5
  });
});

describe('animal markets', () => {
  it('keeps, cooks or releases the accumulated animals', () => {
    const s = game();
    s.actionSpaces['sheep-market']!.revealed = true;
    s.actionSpaces['sheep-market']!.pool = { sheep: 3 };

    // keep 1 (pet), release 2
    const a = place(s, 'sheep-market', { animalKeep: 1, animalRelease: 2 });
    expect(a.players[0]!.farm.animals.sheep).toBe(1);

    // cooking needs an improvement
    expect(
      validateAction(s, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'sheep-market',
        choices: { animalCook: 3 },
      }).ok,
    ).toBe(false);
    s.players[0]!.improvements = ['fireplace-2'];
    const b = place(s, 'sheep-market', { animalCook: 3 });
    expect(b.players[0]!.resources.food).toBe(2 + 6);

    // distribution must cover the whole pool
    expect(
      validateAction(s, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'sheep-market',
        choices: { animalKeep: 1 },
      }).ok,
    ).toBe(false);
  });
});

describe('fence action', () => {
  it('charges wood, requires a new pasture, and rejects dangling fences', () => {
    const s = game();
    s.actionSpaces['fences']!.revealed = true;
    s.players[0]!.resources = { wood: 4 };
    const edges = rectEdges(0, 4, 0, 4);
    const next = place(s, 'fences', { edges });
    expect(next.players[0]!.farm.pastures).toHaveLength(1);
    expect(next.players[0]!.resources.wood).toBe(0);

    s.players[0]!.resources = { wood: 4 };
    expect(
      validateAction(s, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'fences',
        choices: { edges: edges.slice(0, 2) },
      }).ok,
    ).toBe(false);
  });

  it('subdividing forces released animals when they no longer fit', () => {
    const s = game();
    s.actionSpaces['fences']!.revealed = true;
    const p = s.players[0]!;
    p.resources = { wood: 7 };
    const s1 = place(s, 'fences', { edges: rectEdges(0, 3, 0, 4) }); // 1x2, cap 4
    const p1 = s1.players[0]!;
    p1.farm.animals.sheep = 4;
    p1.farm.animals.boar = 1; // pet

    s1.currentPlayer = 0;
    p1.placed = 0;
    s1.actionSpaces['fences']!.occupiedBy = null;

    // split → two capacity-2 pastures; 4 sheep still fit (2+2) but boar pet + nothing else
    const s2 = reduce(s1, {
      type: 'PLACE_WORKER',
      player: 0,
      space: 'fences',
      choices: { edges: [{ dir: 'v', row: 0, col: 4 }] },
    });
    expect(s2.players[0]!.farm.pastures).toHaveLength(2);

    // with 5 sheep (4 + pet... pet is taken by boar) a release is required
    p1.farm.animals.sheep = 5;
    expect(
      validateAction(s1, {
        type: 'PLACE_WORKER',
        player: 0,
        space: 'fences',
        choices: { edges: [{ dir: 'v', row: 0, col: 4 }] },
      }).ok,
    ).toBe(false);
    const s3 = reduce(s1, {
      type: 'PLACE_WORKER',
      player: 0,
      space: 'fences',
      choices: { edges: [{ dir: 'v', row: 0, col: 4 }], release: { sheep: 1 } },
    });
    expect(s3.players[0]!.farm.animals.sheep).toBe(4);
  });
});

describe('family growth', () => {
  it('requires a spare room and feeds the newborn 1 food at harvest', () => {
    const s = game();
    s.actionSpaces['family-growth']!.revealed = true;
    expect(
      validateAction(s, { type: 'PLACE_WORKER', player: 0, space: 'family-growth' }).ok,
    ).toBe(false); // 2 rooms, 2 family

    s.players[0]!.farm.rooms.push('0,0');
    const next = place(s, 'family-growth', {});
    expect(next.players[0]!.newborns).toBe(1);
  });

  it('urgent family growth ignores rooms', () => {
    const s = game();
    s.actionSpaces['urgent-family-growth'] = { revealed: true, occupiedBy: null, pool: {} };
    const next = place(s, 'urgent-family-growth', {});
    expect(next.players[0]!.newborns).toBe(1);
  });
});
