import { useState } from 'react';
import {
  IMPROVEMENT_BY_ID,
  RULES,
  foodRequired,
  getActionSpaces,
  type GameState,
} from '@agricola/engine';
import { ActionBoard } from '../components/ActionBoard';
import { BreedDialog } from '../components/BreedDialog';
import { FarmGrid } from '../components/FarmGrid';
import { FeedDialog } from '../components/FeedDialog';
import { SpaceDialog } from '../components/SpaceDialog';
import { useGameStore } from '../store/gameStore';
import { ICON, PLAYER_COLORS, bagText } from '../ui';
import { ScoringView } from './ScoringView';

/** Effects that need no choices — placing the worker submits immediately. */
const INSTANT = new Set(['takeResources', 'takePool', 'meetingPlace', 'familyGrowth', 'urgentFamilyGrowth']);

export function GameView() {
  const state = useGameStore((s) => s.state);
  const submit = useGameStore((s) => s.submit);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  const awaitingPass = useGameStore((s) => s.awaitingPass);
  const acknowledgePass = useGameStore((s) => s.acknowledgePass);
  const quitToLobby = useGameStore((s) => s.quitToLobby);
  const [openSpace, setOpenSpace] = useState<string | null>(null);
  const [viewSeat, setViewSeat] = useState<number | null>(null);

  if (!state) return null;
  if (state.phase === 'finished') return <ScoringView state={state} />;

  const active = state.players[state.currentPlayer]!;
  const shown = state.players[viewSeat ?? state.currentPlayer]!;
  const nextHarvestIn = nextHarvest(state);

  const pick = (spaceId: string) => {
    const def = getActionSpaces(state.config).find((d) => d.id === spaceId)!;
    if (INSTANT.has(def.effect)) {
      submit({ type: 'PLACE_WORKER', player: state.currentPlayer, space: spaceId, choices: {} });
    } else {
      setOpenSpace(spaceId);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 pb-24">
      {/* status bar */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-bold">
              Round {state.round}/{RULES.rounds}
            </span>
            <span className="hidden text-stone-500 sm:inline">
              Harvest {nextHarvestIn === 0 ? 'after this round' : `in ${nextHarvestIn + 1} rounds`} 🌾
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: PLAYER_COLORS[active.id] }} />
            <b>{active.name}</b>
            <span className="text-stone-500">
              {state.phase === 'work'
                ? `places worker ${active.placed + 1}/${active.adults}`
                : 'is feeding the family'}
            </span>
          </div>
          <button onClick={quitToLobby} className="rounded px-2 py-1 text-xs text-stone-400 hover:bg-stone-100">
            Quit
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-3 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Actions</h2>
          <ActionBoard state={state} onPick={pick} />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              {shown.name}'s farm {shown.id !== active.id && '(viewing)'}
            </h2>
            <div className="flex gap-1">
              {state.players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setViewSeat(p.id === state.currentPlayer ? null : p.id)}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    shown.id === p.id ? 'text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                  style={shown.id === p.id ? { background: PLAYER_COLORS[p.id] } : undefined}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <FarmGrid farm={shown.farm} />
          <PlayerPanel state={state} playerId={shown.id} />
        </section>
      </main>

      {/* dialogs */}
      {openSpace && state.phase === 'work' && (
        <SpaceDialog
          state={state}
          spaceId={openSpace}
          onSubmit={(a) => {
            submit(a);
            setOpenSpace(null);
          }}
          onCancel={() => setOpenSpace(null)}
        />
      )}
      {state.phase === 'feed' && !state.pendingDecision && !awaitingPass && (
        <FeedDialog state={state} onSubmit={submit} />
      )}
      {state.pendingDecision?.type === 'breed' && !awaitingPass && (
        <BreedDialog state={state} onSubmit={submit} />
      )}

      {/* hot-seat pass interstitial */}
      {awaitingPass !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/90 p-4">
          <button onClick={acknowledgePass} className="rounded-2xl bg-white px-10 py-8 text-center shadow-2xl">
            <div className="text-sm uppercase tracking-wide text-stone-400">Pass the device to</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: PLAYER_COLORS[awaitingPass] }}>
              {state.players[awaitingPass]?.name}
            </div>
            <div className="mt-3 text-sm text-stone-500">Tap to continue</div>
          </button>
        </div>
      )}

      {/* error toast */}
      {error && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
          onClick={clearError}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function nextHarvest(state: GameState): number {
  for (const r of RULES.harvestRounds) if (r >= state.round) return r - state.round;
  return 0;
}

function PlayerPanel({ state, playerId }: { state: GameState; playerId: number }) {
  const p = state.players[playerId]!;
  const feedNeed = foodRequired(state, p);
  return (
    <div className="mt-2 rounded-lg bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-base">{bagText(p.resources as Record<string, number>) || '—'}</span>
        <span className="text-stone-400">|</span>
        <span>
          {ICON.family}×{p.adults}
          {p.newborns > 0 && ` +${p.newborns}👶`}
        </span>
        <span className="text-stone-500">needs {feedNeed}{ICON.food}/harvest</span>
        {p.beggingCards > 0 && (
          <span className="text-red-600">
            {ICON.begging}×{p.beggingCards}
          </span>
        )}
      </div>
      {p.improvements.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {p.improvements.map((id) => (
            <span key={id} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
              {IMPROVEMENT_BY_ID[id]?.label ?? id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
