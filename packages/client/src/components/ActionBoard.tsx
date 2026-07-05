import {
  getActionSpaces,
  getLegalActions,
  type GameState,
} from '@agricola/engine';
import { PLAYER_COLORS, bagText } from '../ui';

export interface ActionBoardProps {
  state: GameState;
  onPick: (spaceId: string) => void;
}

export function ActionBoard({ state, onPick }: ActionBoardProps) {
  const defs = getActionSpaces(state.config);
  const legal = new Map(
    getLegalActions(state, state.currentPlayer).map((l) => [l.space, l]),
  );
  const revealedIds = defs.filter((d) => state.actionSpaces[d.id]?.revealed);
  const upcoming = defs.filter((d) => d.stage && !state.actionSpaces[d.id]?.revealed);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {revealedIds.map((def) => {
          const space = state.actionSpaces[def.id]!;
          const l = legal.get(def.id);
          const enabled = l?.enabled ?? false;
          const occupant = space.occupiedBy;
          const pool = bagText(space.pool as Record<string, number>);
          return (
            <button
              key={def.id}
              onClick={() => enabled && onPick(def.id)}
              disabled={!enabled}
              className={`relative rounded-lg border p-2 text-left text-sm transition ${
                enabled
                  ? 'cursor-pointer border-amber-500 bg-amber-50 shadow-sm ring-1 ring-amber-300 hover:bg-amber-100'
                  : 'border-stone-200 bg-stone-100 text-stone-400'
              }`}
            >
              <div className="font-medium leading-tight">{def.label}</div>
              <div className="mt-1 min-h-5 text-base">
                {pool || (def.gain ? bagText(def.gain) : '')}
              </div>
              {def.stage && (
                <div className="absolute right-1 top-1 rounded bg-stone-200 px-1 text-[10px] text-stone-500">
                  S{def.stage}
                </div>
              )}
              {occupant !== null && (
                <span
                  className="absolute bottom-1.5 right-1.5 inline-block h-4 w-4 rounded-full border border-white"
                  style={{ background: PLAYER_COLORS[occupant] }}
                  title={state.players[occupant]?.name}
                />
              )}
              {!enabled && l?.reason && occupant === null && (
                <div className="text-[10px] text-stone-400">{l.reason}</div>
              )}
            </button>
          );
        })}
      </div>
      {upcoming.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {upcoming
            .sort((a, b) => a.stage! - b.stage!)
            .map((d) => (
              <span key={d.id} className="rounded bg-stone-200 px-1.5 py-0.5 text-[11px] text-stone-500">
                S{d.stage} · {d.label}
              </span>
            ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-stone-400">
        Upcoming round cards (order within a stage is random, contents are public — as on the summary card)
      </p>
    </div>
  );
}
