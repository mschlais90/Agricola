import { useMemo, useState } from 'react';
import {
  cookRate,
  validateAction,
  type FeedConversion,
  type GameAction,
  type GameState,
  type PlayerId,
} from '@agricola/engine';
import { ICON } from '../ui';

type Kind = FeedConversion['kind'];

/**
 * "Any time" cooking: fireplaces/hearths convert vegetables & animals to food,
 * and raw grain/vegetables are always worth 1 food. Available during the work
 * phase so a player can bank food before a harvest.
 */
export function ConvertDialog({
  state,
  seat,
  onSubmit,
  onClose,
}: {
  state: GameState;
  seat: PlayerId;
  onSubmit: (action: GameAction) => void;
  onClose: () => void;
}) {
  const player = state.players[seat]!;
  const [counts, setCounts] = useState<Partial<Record<Kind, number>>>({});

  const conversions: FeedConversion[] = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([kind, count]) => ({ kind: kind as Kind, count: count! }));
  const action: GameAction = { type: 'CONVERT', player: seat, conversions };
  const check = useMemo(() => validateAction(state, action), [state, conversions]);

  const allRows: { kind: Kind; label: string; max: number; rate: number | null }[] = [
    { kind: 'raw-grain', label: `${ICON.grain} Grain (raw)`, max: player.resources.grain ?? 0, rate: 1 },
    { kind: 'raw-vegetable', label: `${ICON.vegetable} Vegetable (raw)`, max: player.resources.vegetable ?? 0, rate: 1 },
    { kind: 'cook-vegetable', label: `${ICON.vegetable} Cook vegetable`, max: player.resources.vegetable ?? 0, rate: cookRate(player, 'vegetable') },
    { kind: 'cook-sheep', label: `${ICON.sheep} Cook sheep`, max: player.farm.animals.sheep, rate: cookRate(player, 'sheep') },
    { kind: 'cook-boar', label: `${ICON.boar} Cook boar`, max: player.farm.animals.boar, rate: cookRate(player, 'boar') },
    { kind: 'cook-cattle', label: `${ICON.cattle} Cook cattle`, max: player.farm.animals.cattle, rate: cookRate(player, 'cattle') },
  ];
  const rows = allRows.filter((r) => r.max > 0 && r.rate !== null);

  const gained = conversions.reduce((sum, c) => {
    const row = rows.find((r) => r.kind === c.kind);
    return sum + (row?.rate ?? 0) * c.count;
  }, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Cook to food — {player.name}</h2>
        <p className="mb-3 text-sm text-stone-600">
          Turn crops and animals into food at any time. Have <b>{player.resources.food ?? 0}</b> {ICON.food}
          {gained > 0 && (
            <>
              {' '}
              → <b>{(player.resources.food ?? 0) + gained}</b>
            </>
          )}
        </p>

        {rows.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500">
            Nothing to cook — you need a Fireplace or Cooking Hearth and vegetables or animals (raw grain and
            vegetables can be converted here too).
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.kind} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <span>
                  {r.label} <span className="text-stone-400">→{r.rate}{ICON.food}</span>
                </span>
                <span className="flex items-center gap-2">
                  <button className="h-7 w-7 rounded-full border" onClick={() => bump(r.kind, -1)}>−</button>
                  <span className="w-5 text-center">{counts[r.kind] ?? 0}</span>
                  <button className="h-7 w-7 rounded-full border" onClick={() => bump(r.kind, +1, r.max)}>+</button>
                </span>
              </div>
            ))}
          </div>
        )}

        {!check.ok && conversions.length > 0 && <p className="mt-2 text-sm text-red-600">{check.message}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100" onClick={onClose}>
            Close
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white disabled:bg-stone-300"
            disabled={!check.ok || conversions.length === 0}
            onClick={() => onSubmit(action)}
          >
            Cook{gained > 0 ? ` for ${gained} ${ICON.food}` : ''}
          </button>
        </div>
      </div>
    </div>
  );

  function bump(kind: Kind, d: number, max = Infinity) {
    setCounts((c) => ({ ...c, [kind]: Math.max(0, Math.min(max, (c[kind] ?? 0) + d)) }));
  }
}
