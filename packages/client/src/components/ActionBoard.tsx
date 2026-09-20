import { useState } from 'react';
import {
  getActionSpaces,
  getLegalActions,
  type GameState,
} from '@agricola/engine';
import { PLAYER_COLORS, bagText } from '../ui';
import { requirementShort, requirementTooltip } from '../costs';
import { ImprovementCatalog } from './ImprovementCatalog';

export interface ActionBoardProps {
  state: GameState;
  onPick: (spaceId: string) => void;
}

export function ActionBoard({ state, onPick }: ActionBoardProps) {
  const defs = getActionSpaces(state.config);
  const legal = new Map(
    getLegalActions(state, state.currentPlayer).map((l) => [l.space, l]),
  );
  const res = state.players[state.currentPlayer]?.resources as Record<string, number | undefined>;
  const revealedIds = defs.filter((d) => state.actionSpaces[d.id]?.revealed);

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {revealedIds.map((def) => {
        const space = state.actionSpaces[def.id]!;
        const l = legal.get(def.id);
        const enabled = l?.enabled ?? false;
        const occupant = space.occupiedBy;
        const pool = bagText(space.pool as Record<string, number>);
        const short = !enabled ? requirementShort(l?.requires, res) : '';
        const tip = !enabled ? requirementTooltip(l?.reason, l?.requires, res) : undefined;
        const value = pool || (def.gain ? bagText(def.gain) : '');
        return (
          <button
            key={def.id}
            onClick={() => enabled && onPick(def.id)}
            disabled={!enabled}
            title={tip}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-sm transition ${
              enabled
                ? 'cursor-pointer border-amber-500 bg-amber-50 shadow-sm ring-1 ring-amber-300 hover:bg-amber-100'
                : 'border-stone-200 bg-stone-100 text-stone-400'
            }`}
          >
            {def.stage && (
              <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] leading-4 text-stone-500">
                S{def.stage}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-tight">{def.label}</span>
              {!enabled && l?.reason && occupant === null && (
                <span className="block text-[10px] leading-tight text-stone-400">
                  {l.reason}
                  {short && <span className="ml-1 font-semibold text-red-500">· {short}</span>}
                </span>
              )}
            </span>
            {value && <span className="shrink-0 text-right text-base leading-tight">{value}</span>}
            {occupant !== null && (
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white"
                style={{ background: PLAYER_COLORS[occupant] }}
                title={state.players[occupant]?.name}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The reference material that belongs below the board rather than between it
 * and your farm: the Major Improvement catalog and the round cards still to come.
 */
export function ActionReference({ state }: { state: GameState }) {
  const [showCatalog, setShowCatalog] = useState(false);
  const upcoming = getActionSpaces(state.config).filter(
    (d) => d.stage && !state.actionSpaces[d.id]?.revealed,
  );

  return (
    <div>
      <button
        onClick={() => setShowCatalog(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-amber-400 hover:bg-amber-50"
      >
        🏗️ Browse Major Improvements
        <span className="hidden text-stone-400 sm:inline">— see costs &amp; what you're saving for</span>
      </button>
      {showCatalog && <ImprovementCatalog state={state} onClose={() => setShowCatalog(false)} />}
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
