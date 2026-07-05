import { useMemo, useState } from 'react';
import { validateAction, type AnimalType, type GameAction, type GameState } from '@agricola/engine';
import { ICON } from '../ui';

export function BreedDialog({
  state,
  onSubmit,
}: {
  state: GameState;
  onSubmit: (action: GameAction) => void;
}) {
  const decision = state.pendingDecision!;
  const player = state.players[decision.player]!;
  const [keep, setKeep] = useState<AnimalType[]>([]);

  const action: GameAction = { type: 'BREED_CHOICE', player: player.id, keep };
  const check = useMemo(() => validateAction(state, action), [state, keep]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">Breeding — {player.name}</h2>
        <p className="mb-3 text-sm text-stone-600">
          Not all newborn animals fit on your farm. Choose which to keep; the rest run away.
        </p>
        <div className="flex gap-2">
          {decision.eligible.map((t) => (
            <button
              key={t}
              onClick={() => setKeep((k) => (k.includes(t) ? k.filter((x) => x !== t) : [...k, t]))}
              className={`flex-1 rounded-lg border px-3 py-3 text-2xl ${
                keep.includes(t) ? 'border-amber-500 bg-amber-100' : 'border-stone-300'
              }`}
            >
              {ICON[t]}
            </button>
          ))}
        </div>
        {!check.ok && <p className="mt-2 text-sm text-red-600">{check.message}</p>}
        <button
          className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white disabled:bg-stone-300"
          disabled={!check.ok}
          onClick={() => onSubmit(action)}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
