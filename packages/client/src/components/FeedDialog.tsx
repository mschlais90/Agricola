import { useMemo, useState } from 'react';
import {
  IMPROVEMENT_BY_ID,
  cookRate,
  foodRequired,
  validateAction,
  type FeedConversion,
  type GameAction,
  type GameState,
} from '@agricola/engine';
import { ICON } from '../ui';

type Kind = FeedConversion['kind'];

export function FeedDialog({
  state,
  onSubmit,
}: {
  state: GameState;
  onSubmit: (action: GameAction) => void;
}) {
  const player = state.players[state.feedQueue[0]!]!;
  const [counts, setCounts] = useState<Partial<Record<Kind, number>>>({});

  const conversions: FeedConversion[] = Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([kind, count]) => ({ kind: kind as Kind, count: count! }));
  const action: GameAction = { type: 'HARVEST_FEED', player: player.id, conversions };
  const check = useMemo(() => validateAction(state, action), [state, conversions]);

  const need = foodRequired(state, player);
  const have = player.resources.food ?? 0;
  const gained = conversions.reduce((sum, c) => sum + foodValue(player, c), 0);
  const total = have + gained;
  const begging = Math.max(0, need - total);

  const rows: { kind: Kind; label: string; max: number; rate: number | null }[] = [
    { kind: 'raw-grain', label: `${ICON.grain} Grain (raw)`, max: player.resources.grain ?? 0, rate: 1 },
    { kind: 'raw-vegetable', label: `${ICON.vegetable} Vegetable (raw)`, max: player.resources.vegetable ?? 0, rate: 1 },
    { kind: 'cook-vegetable', label: `${ICON.vegetable} Cook vegetable`, max: player.resources.vegetable ?? 0, rate: cookRate(player, 'vegetable') },
    { kind: 'cook-sheep', label: `${ICON.sheep} Cook sheep`, max: player.farm.animals.sheep, rate: cookRate(player, 'sheep') },
    { kind: 'cook-boar', label: `${ICON.boar} Cook boar`, max: player.farm.animals.boar, rate: cookRate(player, 'boar') },
    { kind: 'cook-cattle', label: `${ICON.cattle} Cook cattle`, max: player.farm.animals.cattle, rate: cookRate(player, 'cattle') },
    { kind: 'workshop-wood', label: `${ICON.wood} Joinery`, max: workshopMax(player.improvements, 'joinery', player.resources.wood ?? 0), rate: 2 },
    { kind: 'workshop-clay', label: `${ICON.clay} Pottery`, max: workshopMax(player.improvements, 'pottery', player.resources.clay ?? 0), rate: 2 },
    { kind: 'workshop-reed', label: `${ICON.reed} Basketmaker`, max: workshopMax(player.improvements, 'basketmaker', player.resources.reed ?? 0), rate: 3 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold">Harvest — feed {player.name}</h2>
        <p className="mb-3 text-sm text-stone-600">
          Need <b>{need}</b> {ICON.food} · have <b>{have}</b>
          {gained > 0 && (
            <>
              {' '}
              + <b>{gained}</b> from conversions
            </>
          )}
        </p>

        <div className="space-y-1.5">
          {rows
            .filter((r) => r.max > 0 && r.rate !== null)
            .map((r) => (
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

        {begging > 0 && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {ICON.begging} Short {begging} food → {begging} begging card{begging > 1 ? 's' : ''} (−3 pts each)
          </p>
        )}
        {!check.ok && <p className="mt-2 text-sm text-red-600">{check.message}</p>}

        <button
          className="mt-4 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white disabled:bg-stone-300"
          disabled={!check.ok}
          onClick={() => onSubmit(action)}
        >
          {begging > 0 ? `Feed & take ${begging} begging card${begging > 1 ? 's' : ''}` : 'Feed family'}
        </button>
      </div>
    </div>
  );

  function bump(kind: Kind, d: number, max = Infinity) {
    setCounts((c) => ({ ...c, [kind]: Math.max(0, Math.min(max, (c[kind] ?? 0) + d)) }));
  }
}

function foodValue(player: GameState['players'][number], c: FeedConversion): number {
  switch (c.kind) {
    case 'raw-grain':
    case 'raw-vegetable':
      return c.count;
    case 'cook-vegetable':
      return (cookRate(player, 'vegetable') ?? 0) * c.count;
    case 'cook-sheep':
      return (cookRate(player, 'sheep') ?? 0) * c.count;
    case 'cook-boar':
      return (cookRate(player, 'boar') ?? 0) * c.count;
    case 'cook-cattle':
      return (cookRate(player, 'cattle') ?? 0) * c.count;
    case 'workshop-wood':
    case 'workshop-clay':
    case 'workshop-reed': {
      const id = { 'workshop-wood': 'joinery', 'workshop-clay': 'pottery', 'workshop-reed': 'basketmaker' }[c.kind];
      return (IMPROVEMENT_BY_ID[id]?.harvestConvert?.food ?? 0) * c.count;
    }
  }
}

function workshopMax(improvements: string[], id: string, stock: number): number {
  return improvements.includes(id) && stock > 0 ? 1 : 0;
}
