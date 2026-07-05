import { IMPROVEMENT_BY_ID } from '../data/improvements';
import { RULES } from '../data/config';
import type { GameState, PlayerState } from '../state/types';

/**
 * Feeding-phase helpers. Raw grain/vegetable → 1 food anytime. Cooking
 * vegetables/animals needs a fireplace or hearth (best owned rate applies).
 * Workshops convert 1 matching resource per harvest. Baking is NOT allowed
 * during feeding (bake-bread actions only).
 */

export interface FeedConversion {
  kind:
    | 'raw-grain'
    | 'raw-vegetable'
    | 'cook-vegetable'
    | 'cook-sheep'
    | 'cook-boar'
    | 'cook-cattle'
    | 'workshop-wood'
    | 'workshop-clay'
    | 'workshop-reed';
  count: number;
}

export function foodRequired(state: GameState, player: PlayerState): number {
  const perAdult = state.config.variant === 'solo' ? RULES.feedPerAdult.solo : RULES.feedPerAdult.family;
  return player.adults * perAdult + player.newborns * RULES.feedPerNewborn;
}

/** Best cooking rate per item across owned improvements; null = cannot cook. */
export function cookRate(
  player: PlayerState,
  item: 'vegetable' | 'sheep' | 'boar' | 'cattle',
): number | null {
  let best: number | null = null;
  for (const id of player.improvements) {
    const rate = IMPROVEMENT_BY_ID[id]?.cook?.[item];
    if (rate !== undefined && (best === null || rate > best)) best = rate;
  }
  return best;
}

/** Food yielded by `bake` grains using the player's best baking improvements (greedy optimal). */
export function bakeFood(player: PlayerState, grains: number): number {
  // Collect per-grain rates honouring per-action limits, then take the best `grains` rates.
  const rates: number[] = [];
  for (const id of player.improvements) {
    const bake = IMPROVEMENT_BY_ID[id]?.bake;
    if (!bake) continue;
    const limit = bake.limit ?? grains;
    for (let i = 0; i < limit && rates.length < 64; i++) rates.push(bake.perGrain);
  }
  rates.sort((a, b) => b - a);
  return rates.slice(0, grains).reduce((s, r) => s + r, 0);
}

export function canBake(player: PlayerState): boolean {
  return player.improvements.some((id) => IMPROVEMENT_BY_ID[id]?.bake);
}

export function canCookAnimals(player: PlayerState): boolean {
  return player.improvements.some((id) => IMPROVEMENT_BY_ID[id]?.cook);
}

/**
 * Validate conversions against the player's holdings/improvements and return
 * total food produced. Throws with a message on an illegal conversion.
 */
export function applyConversions(player: PlayerState, conversions: FeedConversion[]): number {
  let food = 0;
  const usedWorkshops = new Set<string>();
  for (const c of conversions) {
    if (!Number.isInteger(c.count) || c.count <= 0) throw new Error('invalid conversion count');
    switch (c.kind) {
      case 'raw-grain':
        take(player, 'grain', c.count);
        food += c.count;
        break;
      case 'raw-vegetable':
        take(player, 'vegetable', c.count);
        food += c.count;
        break;
      case 'cook-vegetable': {
        const rate = cookRate(player, 'vegetable');
        if (rate === null) throw new Error('no cooking improvement');
        take(player, 'vegetable', c.count);
        food += rate * c.count;
        break;
      }
      case 'cook-sheep':
      case 'cook-boar':
      case 'cook-cattle': {
        const animal = c.kind.slice(5) as 'sheep' | 'boar' | 'cattle';
        const rate = cookRate(player, animal);
        if (rate === null) throw new Error('no cooking improvement');
        if (player.farm.animals[animal] < c.count) throw new Error(`not enough ${animal}`);
        player.farm.animals[animal] -= c.count;
        food += rate * c.count;
        break;
      }
      case 'workshop-wood':
      case 'workshop-clay':
      case 'workshop-reed': {
        const resource = c.kind.slice(9) as 'wood' | 'clay' | 'reed';
        const def = player.improvements
          .map((id) => IMPROVEMENT_BY_ID[id])
          .find((d) => d?.harvestConvert?.resource === resource);
        if (!def?.harvestConvert) throw new Error(`no workshop for ${resource}`);
        if (c.count !== 1 || usedWorkshops.has(def.id)) throw new Error('workshop converts at most 1 per harvest');
        usedWorkshops.add(def.id);
        take(player, resource, 1);
        food += def.harvestConvert.food;
        break;
      }
    }
  }
  return food;
}

function take(player: PlayerState, resource: 'wood' | 'clay' | 'reed' | 'stone' | 'grain' | 'vegetable', n: number): void {
  const have = player.resources[resource] ?? 0;
  if (have < n) throw new Error(`not enough ${resource}`);
  player.resources[resource] = have - n;
}
