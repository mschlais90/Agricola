/**
 * Single source of truth for the game state shape.
 * Everything is plain JSON — no classes, Maps or Dates — so state
 * round-trips through JSON.stringify/parse and structuredClone.
 */

export type PlayerId = number; // seat index 0..3

export type Resource = 'wood' | 'clay' | 'reed' | 'stone' | 'grain' | 'vegetable' | 'food';
export type BuildingResource = 'wood' | 'clay' | 'reed' | 'stone';
export type AnimalType = 'sheep' | 'boar' | 'cattle';
export type RoomMaterial = 'wood' | 'clay' | 'stone';
export type Crop = 'grain' | 'vegetable';

export type ResourceBag = Partial<Record<Resource, number>>;
export type AnimalCounts = Record<AnimalType, number>;

/** Farm grid is 3 rows x 5 cols. Cell key is `${row},${col}`. */
export const FARM_ROWS = 3;
export const FARM_COLS = 5;
export type CellKey = string;

export function cellKey(row: number, col: number): CellKey {
  return `${row},${col}`;
}
export function parseCell(key: CellKey): { row: number; col: number } {
  const [r, c] = key.split(',');
  return { row: Number(r), col: Number(c) };
}

/**
 * Fence edge slots.
 * h[r][c] = the horizontal edge above cell (r, c); r in 0..3 (row 3 = below bottom row), c in 0..4.
 * v[r][c] = the vertical edge left of cell (r, c); r in 0..2, c in 0..5 (col 5 = right of last col).
 */
export interface EdgeRef {
  dir: 'h' | 'v';
  row: number;
  col: number;
}

export interface FieldState {
  crop: Crop | null;
  count: number; // crop counters remaining on the field
}

/** A derived enclosed pasture (recomputed after any fence/stable change). */
export interface Pasture {
  cells: CellKey[]; // sorted
  capacity: number; // 2 per cell, doubled per contained stable
}

export interface Farm {
  rooms: CellKey[];
  roomMaterial: RoomMaterial;
  fields: Record<CellKey, FieldState>;
  fencesH: boolean[][]; // [FARM_ROWS+1][FARM_COLS]
  fencesV: boolean[][]; // [FARM_ROWS][FARM_COLS+1]
  stables: CellKey[];
  /** Derived cache — always kept in sync by the reducer via recomputePastures(). */
  pastures: Pasture[];
  /**
   * Animals are tracked as totals only. The official rules let players rearrange
   * animals at any time, so legality is "a valid assignment exists" (see rules/capacity.ts),
   * and the UI displays a computed assignment.
   */
  animals: AnimalCounts;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  farm: Farm;
  resources: ResourceBag; // wood/clay/reed/stone/grain/vegetable/food
  /** Adults available to place this round. */
  adults: number;
  placed: number; // workers placed this round
  /** Offspring born this round: cannot act, eat 1 food at this round's harvest. */
  newborns: number;
  improvements: string[]; // ImprovementId[]
  beggingCards: number;
}

export type Phase =
  | 'work' // players place workers in turn order
  | 'feed' // harvest feeding: players resolve HARVEST_FEED in turn order
  | 'finished';

export interface PendingDecision {
  type: 'breed';
  player: PlayerId;
  /** Animal types eligible for a baby that cannot all be accommodated together. */
  eligible: AnimalType[];
}

export interface ActionSpaceState {
  revealed: boolean;
  occupiedBy: PlayerId | null;
  pool: ResourceBag & Partial<AnimalCounts>;
}

export interface GameConfig {
  playerCount: number; // 1..4
  playerNames: string[];
  variant: 'family' | 'solo';
  rngSeed: number;
}

export interface ScoreCategory {
  label: string;
  points: number;
  detail?: string;
}

export interface ScoreSheet {
  player: PlayerId;
  name: string;
  categories: ScoreCategory[];
  total: number;
}

export interface GameState {
  config: GameConfig;
  round: number; // 1..14
  phase: Phase;
  /** Action space ids revealed on rounds 1..14 (shuffled within stages at setup). */
  roundSchedule: string[];
  actionSpaces: Record<string, ActionSpaceState>;
  players: PlayerState[];
  /** Whose input the game is waiting on (work placement, feeding, or decision). */
  currentPlayer: PlayerId;
  startingPlayer: PlayerId;
  /** Player who will hold the starting token next round (set by Meeting Place). */
  nextStartingPlayer: PlayerId;
  pendingDecision: PendingDecision | null;
  /** Remaining copies of each major improvement (all start at 1). */
  improvementSupply: Record<string, number>;
  /** Scheduled per-round income, e.g. the Well. futureIncome[round][player] = bag. */
  futureIncome: Record<string, Record<string, ResourceBag>>;
  /** Players still to feed this harvest, in order. */
  feedQueue: PlayerId[];
  /** Players whose breeding is still to resolve this harvest, in order. */
  breedQueue: PlayerId[];
  scores: ScoreSheet[] | null;
}
