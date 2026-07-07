import type { GameConfig, ResourceBag } from '../state/types';

/**
 * Declarative action space definitions (Family game variant of the 2007 base game).
 *
 * - Fixed spaces are available from round 1.
 * - Round spaces carry a `stage` and are revealed one per round (shuffled within stage).
 * - `accumulates` is added to the space's pool during each round's replenish
 *   (only once revealed).
 *
 * Family-board substitutions vs the standard board (per rulebook p.8/appendix):
 * - Lessons (1 Occupation)      → Storehouse (1 food, accumulating)
 * - Day Laborer                 → 1 food + 1 building resource of choice
 * - Meeting Place               → starting player only (no minor improvement)
 * - "Major or Minor Improvement"→ major improvements only
 * - 3p/4p Occupation cards      → HOUSE RULE substitution (undocumented in our
 *   sources): 1 building resource of choice + 1 food. Marked `familySub`.
 */

export type EffectId =
  | 'farmExpansion'
  | 'meetingPlace'
  | 'takeResources' // fixed gain, from `gain`
  | 'takePool' // take everything accumulated
  | 'takeAnimalPool' // accumulated animals: keep/cook/release
  | 'dayLaborer' // 1 food + 1 building resource of choice
  | 'resourceChoice' // 1 food + choice from `choices`
  | 'plow'
  | 'sowBake'
  | 'plowSow'
  | 'fences'
  | 'majorImprovement'
  | 'renovationImprovement'
  | 'renovationFences'
  | 'familyGrowth'
  | 'urgentFamilyGrowth';

export interface ActionSpaceDef {
  id: string;
  label: string;
  effect: EffectId;
  stage?: number; // round card if set
  accumulates?: ResourceBag & { sheep?: number; boar?: number; cattle?: number };
  gain?: ResourceBag;
  /** For resourceChoice: which building resources may be picked. */
  choices?: ('wood' | 'clay' | 'reed' | 'stone')[];
  minPlayers?: number; // extra spaces for 3 / 4 players
}

export function getActionSpaces(config: GameConfig): ActionSpaceDef[] {
  const solo = config.variant === 'solo';
  const defs: ActionSpaceDef[] = [
    // ---- Fixed spaces (family board) ----
    { id: 'farm-expansion', label: 'Build Rooms / Stables', effect: 'farmExpansion' },
    { id: 'meeting-place', label: 'Starting Player', effect: 'meetingPlace' },
    { id: 'grain-seeds', label: 'Take 1 Grain', effect: 'takeResources', gain: { grain: 1 } },
    { id: 'farmland', label: 'Plow 1 Field', effect: 'plow' },
    { id: 'storehouse', label: 'Storehouse', effect: 'takePool', accumulates: { food: 1 } },
    { id: 'day-laborer', label: 'Day Laborer', effect: 'dayLaborer' },
    {
      id: 'forest',
      label: 'Forest',
      effect: 'takePool',
      accumulates: { wood: solo ? 2 : 3 },
    },
    { id: 'clay-pit', label: 'Clay Pit', effect: 'takePool', accumulates: { clay: 1 } },
    { id: 'reed-bank', label: 'Reed Bank', effect: 'takePool', accumulates: { reed: 1 } },
    { id: 'fishing', label: 'Fishing', effect: 'takePool', accumulates: { food: 1 } },

    // ---- 3-player extra spaces ----
    { id: 'grove-3p', label: 'Grove', effect: 'takePool', accumulates: { wood: 2 }, minPlayers: 3 },
    { id: 'hollow-3p', label: 'Hollow', effect: 'takePool', accumulates: { clay: 1 }, minPlayers: 3 },
    {
      id: 'resource-market-3p',
      label: 'Resource Market',
      effect: 'resourceChoice',
      choices: ['reed', 'stone'],
      minPlayers: 3,
    },
    {
      id: 'family-sub-3p',
      label: 'Materials Market', // house-rule family substitute for "1 Occupation (2 food)"
      effect: 'resourceChoice',
      choices: ['wood', 'clay', 'reed', 'stone'],
      minPlayers: 3,
    },

    // ---- 4-player extra spaces ----
    { id: 'copse-4p', label: 'Copse', effect: 'takePool', accumulates: { wood: 1 }, minPlayers: 4 },
    { id: 'hollow-4p', label: 'Hollow', effect: 'takePool', accumulates: { clay: 2 }, minPlayers: 4 },
    {
      id: 'traveling-players-4p',
      label: 'Traveling Players',
      effect: 'takePool',
      accumulates: { food: 1 },
      minPlayers: 4,
    },
    {
      id: 'resource-market-4p',
      label: 'Resource Market',
      effect: 'takeResources',
      gain: { reed: 1, stone: 1, food: 1 },
      minPlayers: 4,
    },
    {
      id: 'family-sub-4p',
      label: 'Materials Market', // house-rule family substitute for "Lessons (4p)"
      effect: 'resourceChoice',
      choices: ['wood', 'clay', 'reed', 'stone'],
      minPlayers: 4,
    },

    // ---- Round cards, by stage ----
    { id: 'sow-bake', label: 'Sow / Bake Bread', effect: 'sowBake', stage: 1 },
    { id: 'major-improvement', label: 'Major Improvement', effect: 'majorImprovement', stage: 1 },
    { id: 'sheep-market', label: 'Sheep Market', effect: 'takeAnimalPool', accumulates: { sheep: 1 }, stage: 1 },
    { id: 'fences', label: 'Build Fences', effect: 'fences', stage: 1 },

    { id: 'stone-quarry-1', label: 'Stone Quarry', effect: 'takePool', accumulates: { stone: 1 }, stage: 2 },
    { id: 'renovation-improvement', label: 'Renovate (+Improvement)', effect: 'renovationImprovement', stage: 2 },
    { id: 'family-growth', label: 'Family Growth', effect: 'familyGrowth', stage: 2 },

    { id: 'vegetable-seeds', label: 'Take 1 Vegetable', effect: 'takeResources', gain: { vegetable: 1 }, stage: 3 },
    { id: 'boar-market', label: 'Boar Market', effect: 'takeAnimalPool', accumulates: { boar: 1 }, stage: 3 },

    { id: 'stone-quarry-2', label: 'Stone Quarry', effect: 'takePool', accumulates: { stone: 1 }, stage: 4 },
    { id: 'cattle-market', label: 'Cattle Market', effect: 'takeAnimalPool', accumulates: { cattle: 1 }, stage: 4 },

    { id: 'plow-sow', label: 'Plow & Sow', effect: 'plowSow', stage: 5 },
    { id: 'urgent-family-growth', label: 'Family Growth (no room)', effect: 'urgentFamilyGrowth', stage: 5 },

    { id: 'renovation-fences', label: 'Renovate (+Fences)', effect: 'renovationFences', stage: 6 },
  ];

  return defs.filter((d) => (d.minPlayers ?? 0) <= config.playerCount);
}
