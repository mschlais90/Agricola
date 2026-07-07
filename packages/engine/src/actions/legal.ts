import { getActionSpaces } from '../data/actionSpaces';
import { IMPROVEMENTS } from '../data/improvements';
import { RULES } from '../data/config';
import { countFences } from '../rules/fencing';
import type { GameState, PlayerId, ResourceBag } from '../state/types';
import type { CostOption, LegalActionDescriptor } from './types';

/**
 * Cheap per-space enablement for the UI. Full validation happens on submit;
 * this only rules out placements that can never be completed.
 */
export function getLegalActions(state: GameState, playerId: PlayerId): LegalActionDescriptor[] {
  if (state.phase !== 'work' || state.pendingDecision || state.currentPlayer !== playerId) return [];
  const player = state.players[playerId];
  if (!player || player.placed >= player.adults) return [];

  return getActionSpaces(state.config)
    .filter((def) => {
      const space = state.actionSpaces[def.id];
      return space?.revealed;
    })
    .map((def) => {
      const space = state.actionSpaces[def.id]!;
      if (space.occupiedBy !== null)
        return { space: def.id, label: def.label, enabled: false, reason: 'occupied' };
      const blocked = blockedInfo(state, playerId, def.id);
      return blocked
        ? { space: def.id, label: def.label, enabled: false, reason: blocked.reason, requires: blocked.requires }
        : { space: def.id, label: def.label, enabled: true };
    });
}

interface BlockInfo {
  reason: string;
  /** Set only when the block is a resource shortfall the player could still cover. */
  requires?: CostOption[];
}

function blockedInfo(state: GameState, playerId: PlayerId, spaceId: string): BlockInfo | null {
  const player = state.players[playerId]!;
  const res = player.resources;
  const farm = player.farm;
  const family = player.adults + player.newborns;

  switch (spaceId) {
    case 'farm-expansion': {
      const roomCost = RULES.costs.room[farm.roomMaterial];
      const roomBag: ResourceBag = { reed: RULES.costs.room.reedPerRoom };
      roomBag[farm.roomMaterial] = roomCost;
      const canRoom = (res[farm.roomMaterial] ?? 0) >= roomCost && (res.reed ?? 0) >= RULES.costs.room.reedPerRoom;
      const canStable =
        (res.wood ?? 0) >= RULES.costs.stable.wood && farm.stables.length < RULES.maxStables;
      if (canRoom || canStable) return null;
      const requires: CostOption[] = [{ label: 'Room', cost: roomBag }];
      if (farm.stables.length < RULES.maxStables)
        requires.push({ label: 'Stable', cost: { wood: RULES.costs.stable.wood } });
      return { reason: 'cannot afford a room or stable', requires };
    }
    case 'fences':
      if ((res.wood ?? 0) >= 1 && countFences(farm) < RULES.maxFences) return null;
      if (countFences(farm) >= RULES.maxFences) return { reason: 'no fences left to place' };
      return { reason: 'need wood for a fence', requires: [{ cost: { wood: RULES.costs.fence.wood } }] };
    case 'family-growth':
      if (family >= RULES.maxFamily) return { reason: 'family at maximum' };
      return farm.rooms.length > family ? null : { reason: 'no room for offspring' };
    case 'urgent-family-growth':
      return family < RULES.maxFamily ? null : { reason: 'family at maximum' };
    case 'major-improvement':
      // Detail lives in the browsable catalog (each improvement's own shortfall),
      // so no single `requires` here — there are up to ten different costs.
      return anyAffordableImprovement(state, playerId) ? null : { reason: 'cannot afford any improvement' };
    case 'renovation-improvement':
    case 'renovation-fences': {
      const next = farm.roomMaterial === 'wood' ? 'clay' : farm.roomMaterial === 'clay' ? 'stone' : null;
      if (!next) return { reason: 'house already stone' };
      if ((res[next] ?? 0) >= farm.rooms.length && (res.reed ?? 0) >= RULES.costs.renovationReed) return null;
      const cost: ResourceBag = { reed: RULES.costs.renovationReed };
      cost[next] = farm.rooms.length;
      return { reason: 'cannot afford renovation', requires: [{ cost }] };
    }
    case 'sow-bake': {
      const hasEmptyField = Object.values(farm.fields).some((f) => f.crop === null && f.count === 0);
      const canSow = hasEmptyField && ((res.grain ?? 0) > 0 || (res.vegetable ?? 0) > 0);
      const canBakeNow =
        (res.grain ?? 0) > 0 && player.improvements.some((id) => IMPROVEMENTS.some((d) => d.id === id && d.bake));
      return canSow || canBakeNow ? null : { reason: 'nothing to sow or bake' };
    }
    default:
      return null;
  }
}

function anyAffordableImprovement(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId]!;
  return IMPROVEMENTS.some((def) => {
    if ((state.improvementSupply[def.id] ?? 0) < 1) return false;
    if (def.upgradeFrom?.some((from) => player.improvements.includes(from))) return true;
    return Object.entries(def.cost).every(
      ([resource, n]) => (player.resources[resource as keyof typeof player.resources] ?? 0) >= (n as number),
    );
  });
}
