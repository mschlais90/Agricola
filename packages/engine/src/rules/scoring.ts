import { RULES, SCORING_BRACKETS, SCORING_FLAT } from '../data/config';
import { IMPROVEMENT_BY_ID } from '../data/improvements';
import type { GameState, PlayerState, ScoreSheet } from '../state/types';
import { FARM_COLS, FARM_ROWS, cellKey } from '../state/types';

function bracket(brackets: readonly { min: number; pts: number }[], count: number): number {
  for (const b of brackets) if (count >= b.min) return b.pts;
  return -1;
}

export function scorePlayer(state: GameState, player: PlayerState): ScoreSheet {
  const farm = player.farm;
  const categories: ScoreSheet['categories'] = [];
  const add = (label: string, points: number, detail?: string) =>
    categories.push({ label, points, detail });

  const fieldCount = Object.keys(farm.fields).length;
  add('Fields', bracket(SCORING_BRACKETS.fields, fieldCount), `${fieldCount}`);
  add('Pastures', bracket(SCORING_BRACKETS.pastures, farm.pastures.length), `${farm.pastures.length}`);

  // Grain/vegetables: supply + still on fields.
  let grain = player.resources.grain ?? 0;
  let vegetable = player.resources.vegetable ?? 0;
  for (const f of Object.values(farm.fields)) {
    if (f.crop === 'grain') grain += f.count;
    if (f.crop === 'vegetable') vegetable += f.count;
  }
  add('Grain', bracket(SCORING_BRACKETS.grain, grain), `${grain}`);
  add('Vegetables', bracket(SCORING_BRACKETS.vegetable, vegetable), `${vegetable}`);

  add('Sheep', bracket(SCORING_BRACKETS.sheep, farm.animals.sheep), `${farm.animals.sheep}`);
  add('Wild boar', bracket(SCORING_BRACKETS.boar, farm.animals.boar), `${farm.animals.boar}`);
  add('Cattle', bracket(SCORING_BRACKETS.cattle, farm.animals.cattle), `${farm.animals.cattle}`);

  // Unused spaces: not room/field/fenced/stable.
  const used = new Set<string>([...farm.rooms, ...farm.stables, ...Object.keys(farm.fields)]);
  for (const p of farm.pastures) for (const c of p.cells) used.add(c);
  let unused = 0;
  for (let r = 0; r < FARM_ROWS; r++)
    for (let c = 0; c < FARM_COLS; c++) if (!used.has(cellKey(r, c))) unused++;
  add('Unused spaces', unused * SCORING_FLAT.unusedSpace, `${unused}`);

  const fencedCells = new Set(farm.pastures.flatMap((p) => p.cells));
  const fencedStables = farm.stables.filter((s) => fencedCells.has(s)).length;
  add('Fenced stables', fencedStables * SCORING_FLAT.fencedStable, `${fencedStables}`);

  const roomPts =
    farm.roomMaterial === 'clay'
      ? SCORING_FLAT.clayRoom
      : farm.roomMaterial === 'stone'
        ? SCORING_FLAT.stoneRoom
        : SCORING_FLAT.woodRoom;
  add(
    farm.roomMaterial === 'wood' ? 'Wooden hut' : farm.roomMaterial === 'clay' ? 'Clay hut' : 'Stone house',
    farm.rooms.length * roomPts,
    `${farm.rooms.length} rooms`,
  );

  const family = player.adults + player.newborns;
  add('Family members', family * SCORING_FLAT.familyMember, `${family}`);

  let improvementPts = 0;
  let bonusPts = 0;
  for (const id of player.improvements) {
    const def = IMPROVEMENT_BY_ID[id];
    if (!def) continue;
    improvementPts += def.points;
    if (def.bonus && def.harvestConvert) {
      const stock = player.resources[def.harvestConvert.resource] ?? 0;
      for (const b of def.bonus) {
        if (stock >= b.min) {
          bonusPts += b.pts;
          break;
        }
      }
    }
  }
  add('Improvements', improvementPts);
  if (bonusPts) add('Improvement bonus', bonusPts);

  if (player.beggingCards > 0)
    add('Begging cards', player.beggingCards * RULES.beggingPenalty, `${player.beggingCards}`);

  return {
    player: player.id,
    name: player.name,
    categories,
    total: categories.reduce((s, c) => s + c.points, 0),
  };
}

export function scoreGame(state: GameState): ScoreSheet[] {
  return state.players.map((p) => scorePlayer(state, p));
}
