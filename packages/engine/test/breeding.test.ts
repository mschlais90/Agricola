import { describe, expect, it } from 'vitest';
import { reduce } from '../src/actions/reduce';
import { recomputePastures } from '../src/rules/fencing';
import { applyEdges, game, rectEdges } from './helpers';
import type { GameState } from '../src/state/types';

/** Single-player family game about to finish feeding (so breeding runs next). */
function breedingState(): GameState {
  const s = game({ playerCount: 1, playerNames: ['Ann'] });
  s.phase = 'feed';
  s.feedQueue = [0];
  s.currentPlayer = 0;
  s.players[0]!.resources.food = 99;
  return s;
}

function feed(s: GameState): GameState {
  return reduce(s, { type: 'HARVEST_FEED', player: 0, conversions: [] });
}

describe('breeding', () => {
  it('two animals of a type produce exactly one baby when there is room', () => {
    const s = breedingState();
    const farm = s.players[0]!.farm;
    applyEdges(farm, rectEdges(0, 3, 1, 4)); // capacity 8
    recomputePastures(farm);
    farm.animals.sheep = 2;
    const next = feed(s);
    expect(next.players[0]!.farm.animals.sheep).toBe(3);
    expect(next.round).toBe(s.round + 1);
  });

  it('one animal does not breed; three animals still produce only one baby', () => {
    const s = breedingState();
    const farm = s.players[0]!.farm;
    applyEdges(farm, rectEdges(0, 3, 1, 4));
    recomputePastures(farm);
    farm.animals.sheep = 1;
    expect(feed(s).players[0]!.farm.animals.sheep).toBe(1);

    farm.animals.sheep = 3;
    expect(feed(s).players[0]!.farm.animals.sheep).toBe(4);
  });

  it('no baby when there is no room — it runs away', () => {
    const s = breedingState();
    const farm = s.players[0]!.farm;
    applyEdges(farm, rectEdges(0, 4, 0, 4)); // 1 cell, capacity 2
    recomputePastures(farm);
    farm.animals.sheep = 2; // full (pet slot open... pet can hold the baby!)
    // capacity: pasture 2 + pet 1 = 3 → baby fits
    expect(feed(s).players[0]!.farm.animals.sheep).toBe(3);

    // fill the pet slot with a boar: sheep baby no longer fits
    const s2 = breedingState();
    const farm2 = s2.players[0]!.farm;
    applyEdges(farm2, rectEdges(0, 4, 0, 4));
    recomputePastures(farm2);
    farm2.animals.sheep = 2;
    farm2.animals.boar = 1;
    expect(feed(s2).players[0]!.farm.animals.sheep).toBe(2);
  });

  it('raises a decision when not all eligible babies fit', () => {
    const s = breedingState();
    const farm = s.players[0]!.farm;
    // two 1-cell pastures (capacity 2 each) + pet slot
    applyEdges(farm, rectEdges(0, 3, 0, 4));
    applyEdges(farm, [{ dir: 'v', row: 0, col: 4 }]);
    recomputePastures(farm);
    farm.animals.sheep = 2;
    farm.animals.boar = 2;
    farm.animals.cattle = 1; // pet slot used
    // sheep baby and boar baby both eligible, but no space for either... wait:
    // pastures are full (2+2), pet used → neither fits → keep [] is the only option
    const mid = feed(s);
    expect(mid.pendingDecision).toEqual({ type: 'breed', player: 0, eligible: ['sheep', 'boar'] });

    expect(() => reduce(mid, { type: 'BREED_CHOICE', player: 0, keep: ['sheep'] })).toThrow();
    const done = reduce(mid, { type: 'BREED_CHOICE', player: 0, keep: [] });
    expect(done.players[0]!.farm.animals).toEqual({ sheep: 2, boar: 2, cattle: 1 });
    expect(done.pendingDecision).toBeNull();
  });

  it('lets the player choose which baby to keep when only one fits', () => {
    const s = breedingState();
    const farm = s.players[0]!.farm;
    applyEdges(farm, rectEdges(0, 3, 0, 4));
    applyEdges(farm, [{ dir: 'v', row: 0, col: 4 }]);
    recomputePastures(farm);
    farm.animals.sheep = 2;
    farm.animals.boar = 2;
    // pet slot free → exactly one baby can go there
    const mid = feed(s);
    expect(mid.pendingDecision?.eligible).toEqual(['sheep', 'boar']);
    const done = reduce(mid, { type: 'BREED_CHOICE', player: 0, keep: ['boar'] });
    expect(done.players[0]!.farm.animals).toEqual({ sheep: 2, boar: 3, cattle: 0 });
  });
});
