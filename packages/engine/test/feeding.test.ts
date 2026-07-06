import { describe, expect, it } from 'vitest';
import { reduce, validateAction } from '../src/actions/reduce';
import { bakeFood } from '../src/rules/feeding';
import { game } from './helpers';
import type { GameState } from '../src/state/types';

function feedingState(): GameState {
  const s = game(); // 2 players
  s.phase = 'feed';
  s.feedQueue = [0, 1];
  s.currentPlayer = 0;
  return s;
}

describe('feeding', () => {
  it('pays 2 food per adult from stock', () => {
    const s = feedingState();
    s.players[0]!.resources.food = 5;
    const next = reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [] });
    expect(next.players[0]!.resources.food).toBe(1);
    expect(next.players[0]!.beggingCards).toBe(0);
    expect(next.feedQueue).toEqual([1]);
    expect(next.currentPlayer).toBe(1);
  });

  it('newborns eat 1 food', () => {
    const s = feedingState();
    s.players[0]!.newborns = 1;
    s.players[0]!.resources.food = 5;
    const next = reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [] });
    expect(next.players[0]!.resources.food).toBe(0);
  });

  it('raw grain and vegetables convert 1:1', () => {
    const s = feedingState();
    s.players[0]!.resources = { food: 0, grain: 3, vegetable: 1 };
    const next = reduce(s, {
      type: 'HARVEST_FEED',
      player: 0,
      conversions: [
        { kind: 'raw-grain', count: 3 },
        { kind: 'raw-vegetable', count: 1 },
      ],
    });
    expect(next.players[0]!.resources.food).toBe(0);
    expect(next.players[0]!.resources.grain).toBe(0);
    expect(next.players[0]!.beggingCards).toBe(0);
  });

  it('shortfall takes begging cards', () => {
    const s = feedingState();
    s.players[0]!.resources.food = 1;
    const next = reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [] });
    expect(next.players[0]!.beggingCards).toBe(3);
    expect(next.players[0]!.resources.food).toBe(0);
  });

  it('cooking animals needs a fireplace and uses its rates', () => {
    const s = feedingState();
    s.players[0]!.resources.food = 0;
    s.players[0]!.farm.animals.cattle = 1; // pet
    expect(() =>
      reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [{ kind: 'cook-cattle', count: 1 }] }),
    ).toThrow(/no cooking improvement/);

    s.players[0]!.improvements = ['fireplace-2'];
    const next = reduce(s, {
      type: 'HARVEST_FEED',
      player: 0,
      conversions: [{ kind: 'cook-cattle', count: 1 }],
    });
    // cattle → 3 food, need 4, 1 short
    expect(next.players[0]!.beggingCards).toBe(1);
    expect(next.players[0]!.farm.animals.cattle).toBe(0);
  });

  it('workshops convert at most 1 resource per harvest', () => {
    const s = feedingState();
    s.players[0]!.improvements = ['joinery'];
    s.players[0]!.resources = { food: 2, wood: 3 };
    const next = reduce(s, {
      type: 'HARVEST_FEED',
      player: 0,
      conversions: [{ kind: 'workshop-wood', count: 1 }],
    });
    expect(next.players[0]!.resources.food).toBe(0); // 2 + 2 - 4
    expect(next.players[0]!.resources.wood).toBe(2);

    expect(() =>
      reduce(s, {
        type: 'HARVEST_FEED',
        player: 0,
        conversions: [
          { kind: 'workshop-wood', count: 1 },
          { kind: 'workshop-wood', count: 1 },
        ],
      }),
    ).toThrow(/at most 1/);
  });

  it('solo variant requires 3 food per adult', () => {
    const s = game({ playerCount: 1, playerNames: ['Solo'], variant: 'solo' });
    s.phase = 'feed';
    s.feedQueue = [0];
    s.currentPlayer = 0;
    s.players[0]!.resources.food = 6;
    const next = reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [] });
    expect(next.players[0]!.resources.food).toBe(0);
  });
});

describe('anytime cooking (CONVERT)', () => {
  it('cooks animals to food during the work phase with a fireplace', () => {
    const s = game(); // round 1, work phase
    s.players[0]!.improvements = ['fireplace-2'];
    s.players[0]!.farm.animals.cattle = 1;
    s.players[0]!.resources.food = 0;
    const next = reduce(s, { type: 'CONVERT', player: 0, conversions: [{ kind: 'cook-cattle', count: 1 }] });
    expect(next.players[0]!.resources.food).toBe(3); // cattle → 3
    expect(next.players[0]!.farm.animals.cattle).toBe(0);
    // it does not consume a worker or advance the turn
    expect(next.currentPlayer).toBe(0);
    expect(next.players[0]!.placed).toBe(0);
  });

  it('converts raw grain without any improvement', () => {
    const s = game();
    s.players[0]!.resources = { food: 0, grain: 2 };
    const next = reduce(s, { type: 'CONVERT', player: 0, conversions: [{ kind: 'raw-grain', count: 2 }] });
    expect(next.players[0]!.resources.food).toBe(2);
  });

  it('rejects cooking without an improvement, workshops, and out of the work phase', () => {
    const s = game();
    s.players[0]!.farm.animals.sheep = 1;
    expect(
      validateAction(s, { type: 'CONVERT', player: 0, conversions: [{ kind: 'cook-sheep', count: 1 }] }).ok,
    ).toBe(false);

    s.players[0]!.improvements = ['joinery'];
    s.players[0]!.resources = { food: 0, wood: 1 };
    expect(
      validateAction(s, { type: 'CONVERT', player: 0, conversions: [{ kind: 'workshop-wood', count: 1 }] }).ok,
    ).toBe(false);

    s.phase = 'feed';
    expect(
      validateAction(s, { type: 'CONVERT', player: 0, conversions: [{ kind: 'raw-grain', count: 1 }] }).ok,
    ).toBe(false);
  });
});

describe('baking', () => {
  it('uses the best improvements greedily', () => {
    const player = game().players[0]!;
    player.improvements = ['fireplace-2'];
    expect(bakeFood(player, 2)).toBe(4); // 2+2
    player.improvements = ['clay-oven']; // limit 1 at 5
    expect(bakeFood(player, 2)).toBe(5); // second grain has no rate
    player.improvements = ['clay-oven', 'stone-oven', 'hearth-4'];
    // rates: 5, 4, 4, then hearth 3s → best 4 grains: 5+4+4+3
    expect(bakeFood(player, 4)).toBe(16);
  });
});
