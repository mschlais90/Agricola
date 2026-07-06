import { getActionSpaces, type ActionSpaceDef } from '../data/actionSpaces';
import { IMPROVEMENT_BY_ID } from '../data/improvements';
import { RULES } from '../data/config';
import { canAccommodate } from '../rules/capacity';
import {
  applyConversions,
  bakeFood,
  canBake,
  cookRate,
  foodRequired,
} from '../rules/feeding';
import { countFences, recomputePastures } from '../rules/fencing';
import { scoreGame } from '../rules/scoring';
import { beginRound } from '../state/setup';
import type {
  AnimalCounts,
  AnimalType,
  CellKey,
  Farm,
  GameState,
  PlayerState,
  Resource,
} from '../state/types';
import { FARM_COLS, FARM_ROWS, cellKey, parseCell } from '../state/types';
import type { GameAction, SpaceChoices } from './types';

export class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

/** State is JSON-safe by design; cloning via JSON keeps the engine free of environment globals. */
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Pure reducer: returns a new state, throws RuleError on an illegal action. */
export function reduce(state: GameState, action: GameAction): GameState {
  const s = clone(state);
  applyAction(s, action);
  return s;
}

export function validateAction(
  state: GameState,
  action: GameAction,
): { ok: true } | { ok: false; message: string } {
  try {
    applyAction(clone(state), action);
    return { ok: true };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, message: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------------------

function applyAction(s: GameState, action: GameAction): void {
  if (s.phase === 'finished') fail('game is over');
  switch (action.type) {
    case 'PLACE_WORKER':
      return placeWorker(s, action);
    case 'HARVEST_FEED':
      return harvestFeed(s, action);
    case 'BREED_CHOICE':
      return breedChoice(s, action);
    case 'CONVERT':
      return convert(s, action);
  }
}

/**
 * Anytime cooking. Fireplaces and cooking hearths let a player turn vegetables
 * and animals into food "at any time" (rulebook, Action A / Harvest phase 2);
 * raw grain and vegetables are always worth 1 food. We allow this during the
 * work phase so a player can bank food ahead of a harvest. Workshops are
 * excluded — they only convert during the harvest.
 */
function convert(s: GameState, action: Extract<GameAction, { type: 'CONVERT' }>): void {
  if (s.phase !== 'work') fail('you can only cook to food during the work phase');
  if (action.conversions.length === 0) fail('nothing to convert');
  const player = s.players[action.player] ?? fail('no such player');
  for (const c of action.conversions) {
    if (c.kind.startsWith('workshop')) fail('workshops can only be used during the harvest');
  }
  try {
    player.resources.food = (player.resources.food ?? 0) + applyConversions(player, action.conversions);
  } catch (e) {
    fail(e instanceof Error ? e.message : 'invalid conversion');
  }
}

function placeWorker(s: GameState, action: Extract<GameAction, { type: 'PLACE_WORKER' }>): void {
  if (s.phase !== 'work') fail('not the work phase');
  if (s.pendingDecision) fail('a decision is pending');
  if (action.player !== s.currentPlayer) fail('not your turn');
  const player = s.players[action.player] ?? fail('no such player');
  if (player.placed >= player.adults) fail('no workers left');

  const space = s.actionSpaces[action.space] ?? fail('no such action space');
  if (!space.revealed) fail('space not yet revealed');
  if (space.occupiedBy !== null) fail('space is occupied');
  const def =
    getActionSpaces(s.config).find((d) => d.id === action.space) ?? fail('no such action space');

  runEffect(s, player, def, action.choices ?? {});

  space.occupiedBy = player.id;
  player.placed++;

  // Advance to the next player (clockwise) who still has workers to place.
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const idx = (s.currentPlayer + k) % n;
    const p = s.players[idx]!;
    if (p.placed < p.adults) {
      s.currentPlayer = idx;
      return;
    }
  }
  endWorkPhase(s);
}

function endWorkPhase(s: GameState): void {
  for (const space of Object.values(s.actionSpaces)) space.occupiedBy = null;

  if ((RULES.harvestRounds as readonly number[]).includes(s.round)) {
    // Harvest phase 1: fields (automatic).
    for (const p of s.players) {
      for (const f of Object.values(p.farm.fields)) {
        if (f.crop && f.count > 0) {
          p.resources[f.crop] = (p.resources[f.crop] ?? 0) + 1;
          f.count--;
          if (f.count === 0) f.crop = null;
        }
      }
    }
    // Harvest phase 2: feeding, in turn order.
    s.phase = 'feed';
    s.feedQueue = turnOrder(s);
    s.currentPlayer = s.feedQueue[0]!;
  } else {
    endRound(s);
  }
}

function turnOrder(s: GameState): number[] {
  return Array.from({ length: s.players.length }, (_, k) => (s.startingPlayer + k) % s.players.length);
}

function harvestFeed(s: GameState, action: Extract<GameAction, { type: 'HARVEST_FEED' }>): void {
  if (s.phase !== 'feed') fail('not the feeding phase');
  if (s.pendingDecision) fail('a decision is pending');
  if (s.feedQueue[0] !== action.player) fail('not your turn to feed');
  const player = s.players[action.player]!;

  try {
    player.resources.food = (player.resources.food ?? 0) + applyConversions(player, action.conversions);
  } catch (e) {
    fail(e instanceof Error ? e.message : 'invalid conversions');
  }

  const req = foodRequired(s, player);
  const food = player.resources.food ?? 0;
  if (food >= req) {
    player.resources.food = food - req;
  } else {
    player.beggingCards += req - food;
    player.resources.food = 0;
  }

  s.feedQueue.shift();
  if (s.feedQueue.length > 0) {
    s.currentPlayer = s.feedQueue[0]!;
  } else {
    startBreeding(s);
  }
}

/** Harvest phase 3: breeding — automatic unless a player must choose which babies fit. */
function startBreeding(s: GameState): void {
  s.breedQueue = turnOrder(s);
  continueBreeding(s);
}

function continueBreeding(s: GameState): void {
  while (s.breedQueue.length > 0) {
    const player = s.players[s.breedQueue[0]!]!;
    const eligible = (['sheep', 'boar', 'cattle'] as AnimalType[]).filter(
      (t) => player.farm.animals[t] >= 2,
    );
    const withAll: AnimalCounts = { ...player.farm.animals };
    for (const t of eligible) withAll[t]++;
    if (eligible.length === 0 || canAccommodate(player.farm, withAll)) {
      for (const t of eligible) player.farm.animals[t]++;
      s.breedQueue.shift();
    } else {
      s.pendingDecision = { type: 'breed', player: player.id, eligible };
      s.currentPlayer = player.id;
      return;
    }
  }
  endRound(s);
}

function breedChoice(s: GameState, action: Extract<GameAction, { type: 'BREED_CHOICE' }>): void {
  const d = s.pendingDecision;
  if (!d || d.type !== 'breed') fail('no breeding decision pending');
  if (d.player !== action.player) fail('not your decision');
  const player = s.players[action.player]!;
  const keep = [...new Set(action.keep)];
  if (keep.some((t) => !d.eligible.includes(t))) fail('type not eligible for breeding');
  const withKept: AnimalCounts = { ...player.farm.animals };
  for (const t of keep) withKept[t]++;
  if (!canAccommodate(player.farm, withKept)) fail('those newborn animals cannot be accommodated');
  player.farm.animals = withKept;
  s.pendingDecision = null;
  s.breedQueue.shift();
  continueBreeding(s);
}

function endRound(s: GameState): void {
  s.phase = 'work';
  s.feedQueue = [];
  s.breedQueue = [];
  for (const p of s.players) {
    p.adults += p.newborns; // offspring grow up at the end of the round
    p.newborns = 0;
  }
  if (s.round >= RULES.rounds) {
    s.phase = 'finished';
    s.scores = scoreGame(s);
    return;
  }
  s.round++;
  beginRound(s);
}

// ---------------------------------------------------------------------------
// Space effects

function runEffect(s: GameState, player: PlayerState, def: ActionSpaceDef, c: SpaceChoices): void {
  switch (def.effect) {
    case 'farmExpansion':
      return farmExpansion(player, c);
    case 'meetingPlace':
      s.nextStartingPlayer = player.id;
      return;
    case 'takeResources':
      return gain(player, def.gain ?? {});
    case 'takePool':
      return takePool(s, player, def.id);
    case 'takeAnimalPool':
      return takeAnimalPool(s, player, def, c);
    case 'dayLaborer':
      gain(player, { food: 1 });
      gain(player, { [pickResource(c)]: 1 });
      return;
    case 'resourceChoice': {
      const res = pickResource(c);
      if (!def.choices?.includes(res)) fail('resource not offered here');
      gain(player, { food: 1, [res]: 1 });
      return;
    }
    case 'plow':
      return plow(player, c.cell ?? fail('choose a field to plow'));
    case 'sowBake':
      return sowBake(player, c, true);
    case 'plowSow': {
      if (!c.cell && !c.sow?.length) fail('plow and/or sow something');
      if (c.cell) plow(player, c.cell);
      if (c.sow?.length) sowBake(player, { sow: c.sow }, false);
      return;
    }
    case 'fences':
      return buildFences(player, c, true);
    case 'majorImprovement':
      return buyImprovement(s, player, c);
    case 'renovationImprovement': {
      renovate(player);
      if (c.improvement) buyImprovement(s, player, c);
      return;
    }
    case 'renovationFences': {
      renovate(player);
      if (c.edges?.length) buildFences(player, c, true);
      return;
    }
    case 'familyGrowth': {
      const family = player.adults + player.newborns;
      if (family >= RULES.maxFamily) fail('family is already at maximum');
      if (player.farm.rooms.length <= family) fail('no room for offspring');
      player.newborns++;
      return;
    }
    case 'urgentFamilyGrowth': {
      if (player.adults + player.newborns >= RULES.maxFamily) fail('family is already at maximum');
      player.newborns++;
      return;
    }
  }
}

function pickResource(c: SpaceChoices): 'wood' | 'clay' | 'reed' | 'stone' {
  const r = c.resource ?? fail('choose a building resource');
  if (!['wood', 'clay', 'reed', 'stone'].includes(r)) fail('invalid resource');
  return r;
}

function gain(player: PlayerState, bag: Partial<Record<Resource, number>>): void {
  for (const [res, n] of Object.entries(bag)) {
    const key = res as Resource;
    player.resources[key] = (player.resources[key] ?? 0) + (n as number);
  }
}

function pay(player: PlayerState, bag: Partial<Record<Resource, number>>): void {
  for (const [res, n] of Object.entries(bag)) {
    const key = res as Resource;
    if ((player.resources[key] ?? 0) < (n as number)) fail(`not enough ${res}`);
  }
  for (const [res, n] of Object.entries(bag)) {
    const key = res as Resource;
    player.resources[key] = (player.resources[key] ?? 0) - (n as number);
  }
}

function takePool(s: GameState, player: PlayerState, spaceId: string): void {
  const space = s.actionSpaces[spaceId]!;
  gain(player, space.pool as Partial<Record<Resource, number>>);
  space.pool = {};
}

function takeAnimalPool(
  s: GameState,
  player: PlayerState,
  def: ActionSpaceDef,
  c: SpaceChoices,
): void {
  const space = s.actionSpaces[def.id]!;
  const type = (['sheep', 'boar', 'cattle'] as AnimalType[]).find(
    (t) => def.accumulates?.[t] !== undefined,
  )!;
  const total = (space.pool as Partial<AnimalCounts>)[type] ?? 0;
  if (total === 0) fail('no animals to take');
  const keep = c.animalKeep ?? 0;
  const cook = c.animalCook ?? 0;
  const release = c.animalRelease ?? 0;
  if (keep < 0 || cook < 0 || release < 0 || keep + cook + release !== total)
    fail(`distribute exactly ${total} ${type}`);
  if (cook > 0) {
    const rate = cookRate(player, type) ?? fail('no cooking improvement');
    gain(player, { food: rate * cook });
  }
  if (keep > 0) {
    const next: AnimalCounts = { ...player.farm.animals };
    next[type] += keep;
    if (!canAccommodate(player.farm, next)) fail('not enough room for those animals');
    player.farm.animals = next;
  }
  space.pool = {};
}

// ---- building ----

function inBounds(key: CellKey): boolean {
  const { row, col } = parseCell(key);
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < FARM_ROWS && col >= 0 && col < FARM_COLS;
}

function cellUsed(farm: Farm, key: CellKey): boolean {
  return farm.rooms.includes(key) || farm.stables.includes(key) || key in farm.fields;
}

function orthAdjacent(a: CellKey, b: CellKey): boolean {
  const p = parseCell(a);
  const q = parseCell(b);
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col) === 1;
}

function farmExpansion(player: PlayerState, c: SpaceChoices): void {
  const rooms = c.rooms ?? [];
  const stables = c.stables ?? [];
  if (rooms.length === 0 && stables.length === 0) fail('build at least one room or stable');
  const farm = player.farm;

  const roomCost = RULES.costs.room[farm.roomMaterial];
  const cost: Partial<Record<Resource, number>> = {};
  cost[farm.roomMaterial] = (cost[farm.roomMaterial] ?? 0) + roomCost * rooms.length;
  cost.reed = (cost.reed ?? 0) + RULES.costs.room.reedPerRoom * rooms.length;
  cost.wood = (cost.wood ?? 0) + RULES.costs.stable.wood * stables.length;
  pay(player, cost);

  for (const key of rooms) {
    if (!inBounds(key)) fail('room out of bounds');
    if (cellUsed(farm, key)) fail('cell already used');
    if (!farm.rooms.some((r) => orthAdjacent(r, key))) fail('rooms must be adjacent to your home');
    farm.rooms.push(key);
  }
  if (farm.stables.length + stables.length > RULES.maxStables) fail('at most 4 stables');
  for (const key of stables) {
    if (!inBounds(key)) fail('stable out of bounds');
    if (cellUsed(farm, key)) fail('cell already used');
    farm.stables.push(key);
  }
  recomputeOrFail(farm);
}

function plow(player: PlayerState, key: CellKey): void {
  const farm = player.farm;
  if (!inBounds(key)) fail('field out of bounds');
  if (cellUsed(farm, key)) fail('cell already used');
  const fields = Object.keys(farm.fields);
  if (fields.length > 0 && !fields.some((f) => orthAdjacent(f, key)))
    fail('fields must be adjacent to your existing fields');
  farm.fields[key] = { crop: null, count: 0 };
  recomputeOrFail(farm);
}

function sowBake(player: PlayerState, c: SpaceChoices, allowBake: boolean): void {
  const sow = c.sow ?? [];
  const bake = c.bakeGrain ?? 0;
  if (sow.length === 0 && bake === 0) fail('sow and/or bake something');
  for (const { cell, crop } of sow) {
    const field = player.farm.fields[cell] ?? fail('not a field');
    if (field.crop !== null || field.count > 0) fail('field is not empty');
    pay(player, { [crop]: 1 });
    field.crop = crop;
    field.count = RULES.sow[crop];
  }
  if (bake > 0) {
    if (!allowBake) fail('baking not allowed here');
    if (!canBake(player)) fail('no baking improvement');
    pay(player, { grain: bake });
    gain(player, { food: bakeFood(player, bake) });
  }
}

function buildFences(player: PlayerState, c: SpaceChoices, requireNewPasture: boolean): void {
  const edges = c.edges ?? [];
  if (edges.length === 0) fail('place at least one fence');
  const farm = player.farm;
  if (countFences(farm) + edges.length > RULES.maxFences) fail('at most 15 fences');
  pay(player, { wood: RULES.costs.fence.wood * edges.length });

  const before = farm.pastures.length;
  for (const e of edges) {
    const grid = e.dir === 'h' ? farm.fencesH : farm.fencesV;
    const row = grid[e.row] ?? fail('fence out of bounds');
    if (e.col < 0 || e.col >= row.length) fail('fence out of bounds');
    if (row[e.col]) fail('fence already built');
    row[e.col] = true;
  }
  recomputeOrFail(farm);
  if (requireNewPasture && farm.pastures.length <= before)
    fail('fences must create at least one new pasture');

  // Voluntary release to make room (players may release animals at will).
  if (c.release) {
    for (const [t, n] of Object.entries(c.release)) {
      const type = t as AnimalType;
      if ((n ?? 0) < 0 || farm.animals[type] < (n ?? 0)) fail('cannot release more than you have');
      farm.animals[type] -= n ?? 0;
    }
  }
  if (!canAccommodate(farm, farm.animals))
    fail('your animals no longer fit — release some with this action');
}

function renovate(player: PlayerState): void {
  const farm = player.farm;
  const next = farm.roomMaterial === 'wood' ? 'clay' : farm.roomMaterial === 'clay' ? 'stone' : null;
  if (!next) fail('your house is already stone');
  pay(player, { [next]: farm.rooms.length, reed: RULES.costs.renovationReed });
  farm.roomMaterial = next;
}

function buyImprovement(s: GameState, player: PlayerState, c: SpaceChoices): void {
  const id = c.improvement ?? fail('choose an improvement');
  const def = IMPROVEMENT_BY_ID[id] ?? fail('no such improvement');
  if ((s.improvementSupply[id] ?? 0) < 1) fail('improvement no longer available');

  if (c.returnImprovement) {
    if (!def.upgradeFrom?.includes(c.returnImprovement)) fail('cannot upgrade from that');
    const idx = player.improvements.indexOf(c.returnImprovement);
    if (idx === -1) fail('you do not own that improvement');
    player.improvements.splice(idx, 1);
    s.improvementSupply[c.returnImprovement] = (s.improvementSupply[c.returnImprovement] ?? 0) + 1;
  } else {
    pay(player, def.cost);
  }

  s.improvementSupply[id] = 0;
  player.improvements.push(id);

  if (id === 'well') {
    for (let r = s.round + 1; r <= Math.min(s.round + 5, RULES.rounds); r++) {
      const roundIncome = (s.futureIncome[String(r)] ??= {});
      const bag = (roundIncome[String(player.id)] ??= {});
      bag.food = (bag.food ?? 0) + 1;
    }
  }

  if ((c.bakeGrain ?? 0) > 0) {
    if (!def.bakeOnPurchase) fail('this improvement does not allow baking on purchase');
    pay(player, { grain: c.bakeGrain! });
    gain(player, { food: bakeFood(player, c.bakeGrain!) });
  }
}

function recomputeOrFail(farm: Farm): void {
  try {
    recomputePastures(farm);
  } catch (e) {
    fail(e instanceof Error ? e.message : 'illegal farm layout');
  }
}
