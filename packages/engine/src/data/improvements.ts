import type { AnimalType, ResourceBag } from '../state/types';

/**
 * The 10 major improvements (2007 base game — the same set the Family game uses).
 *
 * Cooking (anytime): fireplace veg→2, sheep→2, boar→2, cattle→3;
 *                    cooking hearth veg→3, sheep→2, boar→3, cattle→4.
 * Baking (only on a "bake bread" action): fireplace grain→2, hearth grain→3,
 *   clay oven ≤1 grain→5, stone oven ≤2 grain→4 each. Buying an oven allows
 *   an immediate one-time bake.
 * Workshops (once per harvest, during feeding): joinery 1 wood→2 food,
 *   pottery 1 clay→2 food, basketmaker 1 reed→3 food; end-game bonus points
 *   for held stock of the matching resource.
 */

export interface ImprovementDef {
  id: string;
  label: string;
  /** Plain-language summary shown as a tooltip in the UI. */
  desc: string;
  cost: ResourceBag;
  /** Alternative cost: return this improvement instead of paying (cooking hearths). */
  upgradeFrom?: string[];
  points: number;
  cook?: Partial<Record<AnimalType | 'vegetable', number>>;
  /** Food per grain when baking; `limit` grains per bake action (Infinity if absent). */
  bake?: { perGrain: number; limit?: number };
  bakeOnPurchase?: boolean;
  /** Once per harvest: convert 1 unit of resource to food. */
  harvestConvert?: { resource: 'wood' | 'clay' | 'reed'; food: number };
  /** End-game bonus brackets on held stock of `harvestConvert.resource`. */
  bonus?: { min: number; pts: number }[];
}

export const IMPROVEMENTS: ImprovementDef[] = [
  {
    id: 'fireplace-2',
    label: 'Fireplace (2 clay)',
    desc: 'Any time, cook vegetables → 2 food, sheep/boar → 2 food, cattle → 3 food. On a Bake action, bake grain → 2 food. Worth 1 point.',
    cost: { clay: 2 },
    points: 1,
    cook: { vegetable: 2, sheep: 2, boar: 2, cattle: 3 },
    bake: { perGrain: 2 },
  },
  {
    id: 'fireplace-3',
    label: 'Fireplace (3 clay)',
    desc: 'Any time, cook vegetables → 2 food, sheep/boar → 2 food, cattle → 3 food. On a Bake action, bake grain → 2 food. Worth 1 point.',
    cost: { clay: 3 },
    points: 1,
    cook: { vegetable: 2, sheep: 2, boar: 2, cattle: 3 },
    bake: { perGrain: 2 },
  },
  {
    id: 'hearth-4',
    label: 'Cooking Hearth (4 clay)',
    desc: 'Any time, cook vegetables → 3 food, sheep → 2, boar → 3, cattle → 4 food. On a Bake action, bake grain → 3 food. Can be built for free by returning a Fireplace. Worth 1 point.',
    cost: { clay: 4 },
    upgradeFrom: ['fireplace-2', 'fireplace-3'],
    points: 1,
    cook: { vegetable: 3, sheep: 2, boar: 3, cattle: 4 },
    bake: { perGrain: 3 },
  },
  {
    id: 'hearth-5',
    label: 'Cooking Hearth (5 clay)',
    desc: 'Any time, cook vegetables → 3 food, sheep → 2, boar → 3, cattle → 4 food. On a Bake action, bake grain → 3 food. Can be built for free by returning a Fireplace. Worth 1 point.',
    cost: { clay: 5 },
    upgradeFrom: ['fireplace-2', 'fireplace-3'],
    points: 1,
    cook: { vegetable: 3, sheep: 2, boar: 3, cattle: 4 },
    bake: { perGrain: 3 },
  },
  {
    id: 'clay-oven',
    label: 'Clay Oven',
    desc: 'On a Bake action, bake up to 1 grain → 5 food. Bake once immediately when built. Worth 2 points.',
    cost: { clay: 3, stone: 1 },
    points: 2,
    bake: { perGrain: 5, limit: 1 },
    bakeOnPurchase: true,
  },
  {
    id: 'stone-oven',
    label: 'Stone Oven',
    desc: 'On a Bake action, bake up to 2 grain → 4 food each. Bake once immediately when built. Worth 3 points.',
    cost: { clay: 1, stone: 3 },
    points: 3,
    bake: { perGrain: 4, limit: 2 },
    bakeOnPurchase: true,
  },
  {
    id: 'well',
    label: 'Well',
    desc: 'Gain 1 food at the start of each of the next 5 rounds. Worth 4 points.',
    cost: { wood: 1, stone: 3 },
    points: 4,
    // effect (1 food for each of the next 5 rounds) is applied by the reducer
  },
  {
    id: 'joinery',
    label: 'Joinery',
    desc: 'Once each harvest, turn 1 wood → 2 food. At game end, bonus points for wood you still hold (3+/5+/7+ wood → 1/2/3 pts). Worth 2 points.',
    cost: { wood: 2, stone: 2 },
    points: 2,
    harvestConvert: { resource: 'wood', food: 2 },
    bonus: [
      { min: 7, pts: 3 },
      { min: 5, pts: 2 },
      { min: 3, pts: 1 },
    ],
  },
  {
    id: 'pottery',
    label: 'Pottery',
    desc: 'Once each harvest, turn 1 clay → 2 food. At game end, bonus points for clay you still hold (3+/5+/7+ clay → 1/2/3 pts). Worth 2 points.',
    cost: { clay: 2, stone: 2 },
    points: 2,
    harvestConvert: { resource: 'clay', food: 2 },
    bonus: [
      { min: 7, pts: 3 },
      { min: 5, pts: 2 },
      { min: 3, pts: 1 },
    ],
  },
  {
    id: 'basketmaker',
    label: "Basketmaker's Workshop",
    desc: 'Once each harvest, turn 1 reed → 3 food. At game end, bonus points for reed you still hold (2+/4+/5+ reed → 1/2/3 pts). Worth 2 points.',
    cost: { reed: 2, stone: 2 },
    points: 2,
    harvestConvert: { resource: 'reed', food: 3 },
    bonus: [
      { min: 5, pts: 3 },
      { min: 4, pts: 2 },
      { min: 2, pts: 1 },
    ],
  },
];

export const IMPROVEMENT_BY_ID: Record<string, ImprovementDef> = Object.fromEntries(
  IMPROVEMENTS.map((d) => [d.id, d]),
);
