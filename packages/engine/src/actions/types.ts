import type { FeedConversion } from '../rules/feeding';
import type {
  AnimalCounts,
  AnimalType,
  BuildingResource,
  CellKey,
  Crop,
  EdgeRef,
  PlayerId,
  ResourceBag,
} from '../state/types';

/**
 * Actions are atomic composites: the client bundles every choice a placement
 * needs, so one message is a complete, validatable unit.
 */

export interface SpaceChoices {
  /** farmExpansion */
  rooms?: CellKey[];
  stables?: CellKey[];
  /** plow / plowSow */
  cell?: CellKey;
  /** sowBake / plowSow */
  sow?: { cell: CellKey; crop: Crop }[];
  /** sowBake / majorImprovement (oven purchase) / renovationImprovement */
  bakeGrain?: number;
  /** fences / renovationFences */
  edges?: EdgeRef[];
  /** voluntary release to make a fence layout feasible */
  release?: Partial<AnimalCounts>;
  /** majorImprovement / renovationImprovement */
  improvement?: string;
  /** pay a cooking hearth by returning a fireplace */
  returnImprovement?: string;
  /** takeAnimalPool: distribution of the taken animals */
  animalKeep?: number;
  animalCook?: number;
  animalRelease?: number;
  /** dayLaborer / resourceChoice */
  resource?: BuildingResource;
}

export type GameAction =
  | { type: 'PLACE_WORKER'; player: PlayerId; space: string; choices?: SpaceChoices }
  | { type: 'HARVEST_FEED'; player: PlayerId; conversions: FeedConversion[] }
  | { type: 'BREED_CHOICE'; player: PlayerId; keep: AnimalType[] }
  /** Anytime cooking: fireplaces/hearths convert vegetables & animals (and raw grain/veg) to food. */
  | { type: 'CONVERT'; player: PlayerId; conversions: FeedConversion[] };

/**
 * One way to satisfy a resource-gated action. An action may offer several
 * (e.g. Farm Expansion: build a Room *or* a Stable) — affording ANY unblocks it.
 */
export interface CostOption {
  /** Names the path when there's more than one; omitted when there's only one. */
  label?: string;
  cost: ResourceBag;
}

export interface LegalActionDescriptor {
  space: string;
  label: string;
  enabled: boolean;
  reason?: string;
  /**
   * Present when the space is blocked specifically by resources: the cost of
   * each way to satisfy it, so the UI can show what the player is short.
   */
  requires?: CostOption[];
}
