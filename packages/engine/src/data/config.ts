/**
 * All tunable rule numbers live in the data/ files, transcribed from the
 * 2007 Lookout/Z-Man Agricola rulebook (Family game variant + Solo rules).
 * Logic files never hard-code these.
 */

export const RULES = {
  rounds: 14,
  /** Stage of each round card slot; harvests fire at the end of rounds 4,7,9,11,13,14. */
  stageOfRound: [1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6] as const,
  harvestRounds: [4, 7, 9, 11, 13, 14] as const,

  maxFamily: 5,
  maxStables: 4,
  maxFences: 15,

  /** Starting food: starting player 2, everyone else 3. Solo: 0. */
  startingFood: { startingPlayer: 2, others: 3, solo: 0 },

  /** Food per adult at each harvest (solo variant pays 3). Newborns eat 1. */
  feedPerAdult: { family: 2, solo: 3 },
  feedPerNewborn: 1,
  beggingPenalty: -3,

  costs: {
    room: { wood: 5, clay: 5, stone: 5, reedPerRoom: 2 },
    renovationReed: 1, // plus 1 clay-or-stone per room
    stable: { wood: 2 },
    fence: { wood: 1 },
  },

  sow: { grain: 3, vegetable: 2 }, // counters on a newly sown field

  /** The Forest accumulates 3 wood normally, 2 in the solo game. */
  forestWood: { family: 3, solo: 2 },

  /** Official solo series first-game target score. */
  soloGoal: 50,
} as const;

export const SCORING_BRACKETS = {
  // value → points; first bracket that the count satisfies (checked descending).
  fields: [
    { min: 5, pts: 4 },
    { min: 4, pts: 3 },
    { min: 3, pts: 2 },
    { min: 2, pts: 1 },
    { min: 0, pts: -1 },
  ],
  pastures: [
    { min: 4, pts: 4 },
    { min: 3, pts: 3 },
    { min: 2, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
  grain: [
    { min: 8, pts: 4 },
    { min: 6, pts: 3 },
    { min: 4, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
  vegetable: [
    { min: 4, pts: 4 },
    { min: 3, pts: 3 },
    { min: 2, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
  sheep: [
    { min: 8, pts: 4 },
    { min: 6, pts: 3 },
    { min: 4, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
  boar: [
    { min: 7, pts: 4 },
    { min: 5, pts: 3 },
    { min: 3, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
  cattle: [
    { min: 6, pts: 4 },
    { min: 4, pts: 3 },
    { min: 2, pts: 2 },
    { min: 1, pts: 1 },
    { min: 0, pts: -1 },
  ],
} as const;

export const SCORING_FLAT = {
  unusedSpace: -1,
  fencedStable: 1,
  clayRoom: 1,
  stoneRoom: 2,
  woodRoom: 0,
  familyMember: 3,
} as const;
