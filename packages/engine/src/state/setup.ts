import { getActionSpaces } from '../data/actionSpaces';
import { IMPROVEMENTS } from '../data/improvements';
import { RULES } from '../data/config';
import { mulberry32, shuffled } from '../rng';
import { emptyFences } from '../rules/fencing';
import type { Farm, GameConfig, GameState, PlayerState } from '../state/types';
import { cellKey } from '../state/types';

function initialFarm(): Farm {
  return {
    rooms: [cellKey(1, 0), cellKey(2, 0)],
    roomMaterial: 'wood',
    fields: {},
    ...emptyFences(),
    stables: [],
    pastures: [],
    animals: { sheep: 0, boar: 0, cattle: 0 },
  };
}

export function setupGame(config: GameConfig): GameState {
  if (config.playerCount < 1 || config.playerCount > 4) throw new Error('1-4 players supported');
  if (config.variant === 'solo' && config.playerCount !== 1) throw new Error('solo is 1 player');
  const rand = mulberry32(config.rngSeed);

  const defs = getActionSpaces(config);
  // Shuffle round cards within each stage; concatenate stages 1..6.
  const roundSchedule: string[] = [];
  for (let stage = 1; stage <= 6; stage++) {
    roundSchedule.push(...shuffled(defs.filter((d) => d.stage === stage).map((d) => d.id), rand));
  }

  const players: PlayerState[] = Array.from({ length: config.playerCount }, (_, i) => ({
    id: i,
    name: config.playerNames[i] ?? `Player ${i + 1}`,
    farm: initialFarm(),
    resources: {
      food:
        config.variant === 'solo'
          ? RULES.startingFood.solo
          : i === 0
            ? RULES.startingFood.startingPlayer
            : RULES.startingFood.others,
    },
    adults: 2,
    placed: 0,
    newborns: 0,
    improvements: [],
    beggingCards: 0,
  }));

  const state: GameState = {
    config,
    round: 1,
    phase: 'work',
    roundSchedule,
    actionSpaces: Object.fromEntries(
      defs.map((d) => [d.id, { revealed: d.stage === undefined, occupiedBy: null, pool: {} }]),
    ),
    players,
    currentPlayer: 0,
    startingPlayer: 0,
    nextStartingPlayer: 0,
    pendingDecision: null,
    improvementSupply: Object.fromEntries(IMPROVEMENTS.map((d) => [d.id, 1])),
    futureIncome: {},
    feedQueue: [],
    breedQueue: [],
    scores: null,
  };

  beginRound(state);
  return state;
}

/** Reveal this round's card, replenish accumulation spaces, deliver scheduled income. */
export function beginRound(state: GameState): void {
  const defs = getActionSpaces(state.config);
  const revealId = state.roundSchedule[state.round - 1];
  if (revealId) {
    const space = state.actionSpaces[revealId];
    if (space) space.revealed = true;
  }

  for (const d of defs) {
    if (!d.accumulates) continue;
    const space = state.actionSpaces[d.id];
    if (!space || !space.revealed) continue;
    for (const [k, v] of Object.entries(d.accumulates)) {
      const key = k as keyof typeof space.pool;
      space.pool[key] = (space.pool[key] ?? 0) + (v as number);
    }
  }

  // Scheduled income (Well).
  const income = state.futureIncome[String(state.round)];
  if (income) {
    for (const [pid, bag] of Object.entries(income)) {
      const player = state.players[Number(pid)];
      if (!player) continue;
      for (const [res, n] of Object.entries(bag)) {
        const key = res as keyof typeof player.resources;
        player.resources[key] = (player.resources[key] ?? 0) + (n as number);
      }
    }
    delete state.futureIncome[String(state.round)];
  }

  state.startingPlayer = state.nextStartingPlayer;
  state.currentPlayer = state.startingPlayer;
  for (const p of state.players) p.placed = 0;
}
