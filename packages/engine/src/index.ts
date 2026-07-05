export const ENGINE_VERSION = '0.1.0';

// State & types
export * from './state/types';
export { setupGame } from './state/setup';

// Actions
export type { GameAction, SpaceChoices, LegalActionDescriptor } from './actions/types';
export { reduce, validateAction, RuleError } from './actions/reduce';
export { getLegalActions } from './actions/legal';

// Rules helpers (also used by the UI for previews)
export { computePastures, countFences, type FenceError } from './rules/fencing';
export { canAccommodate, computeAssignment, ANIMAL_TYPES, type AnimalAssignment } from './rules/capacity';
export {
  foodRequired,
  cookRate,
  bakeFood,
  canBake,
  canCookAnimals,
  type FeedConversion,
} from './rules/feeding';
export { scoreGame } from './rules/scoring';

// Data (UI reads labels/costs from here)
export { getActionSpaces, type ActionSpaceDef, type EffectId } from './data/actionSpaces';
export { IMPROVEMENTS, IMPROVEMENT_BY_ID, type ImprovementDef } from './data/improvements';
export { RULES } from './data/config';
