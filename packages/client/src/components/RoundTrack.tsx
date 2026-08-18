import { RULES, type GameState } from '@agricola/engine';

const HARVEST_ROUNDS = new Set<number>(RULES.harvestRounds);

/** Rounds still to play before the next harvest, counting the current one. */
export function roundsUntilHarvest(state: GameState): number {
  for (const r of RULES.harvestRounds) if (r >= state.round) return r - state.round + 1;
  return 0;
}

/** The round whose end brings the next harvest (0 when none is left). */
export function nextHarvestRound(state: GameState): number {
  return RULES.harvestRounds.find((r) => r >= state.round) ?? 0;
}

/** Plain-language countdown, e.g. "Harvest in 3 rounds (end of round 7)". */
export function harvestText(state: GameState): string {
  if (state.phase === 'feed' || state.pendingDecision?.type === 'breed') return 'Harvest happening now';
  const left = roundsUntilHarvest(state);
  if (left === 0) return 'No harvest left';
  if (left === 1) return 'Harvest at the end of this round';
  return `Harvest in ${left} rounds (end of round ${nextHarvestRound(state)})`;
}

/**
 * The 14 rounds at a glance, with the harvest rounds flagged, so it's obvious
 * how much time is left to fence, sow and stock up on food.
 */
export function RoundTrack({ state }: { state: GameState }) {
  return (
    <div className="flex items-end gap-px">
      {Array.from({ length: RULES.rounds }, (_, i) => i + 1).map((r) => {
        const harvest = HARVEST_ROUNDS.has(r);
        const now = r === state.round;
        const past = r < state.round;
        return (
          <div key={r} className="flex min-w-0 flex-1 flex-col items-center">
            <span className={`text-[9px] leading-none ${harvest ? '' : 'invisible'}`} aria-hidden>
              🌾
            </span>
            <span
              title={`Round ${r}${harvest ? ' — harvest at the end' : ''}`}
              className={`mt-0.5 w-full rounded text-center text-[10px] leading-4 ${
                now
                  ? 'bg-amber-600 font-bold text-white'
                  : past
                    ? 'bg-stone-200 text-stone-400'
                    : harvest
                      ? 'bg-amber-100 font-medium text-amber-800 ring-1 ring-amber-300'
                      : 'bg-stone-100 text-stone-500'
              }`}
            >
              {r}
            </span>
          </div>
        );
      })}
    </div>
  );
}
