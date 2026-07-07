import { IMPROVEMENTS, type GameState, type ImprovementDef } from '@agricola/engine';
import { costLines, isAffordable, shortfallText } from '../costs';
import { ICON, bagText } from '../ui';

export interface ImprovementCatalogProps {
  state: GameState;
  onClose: () => void;
}

/**
 * Read-only gallery of every Major Improvement, always openable — even when the
 * player can afford none, so the action space (which disables in that case) can't
 * be used to browse. Purely informational: buying still happens by placing a
 * worker on the Major Improvement space. Ordered so what you can build now floats
 * to the top, then whatever you're closest to affording; taken cards sink, dimmed.
 */
export function ImprovementCatalog({ state, onClose }: ImprovementCatalogProps) {
  const player = state.players[state.currentPlayer]!;
  const res = player.resources as Record<string, number | undefined>;

  const owns = (id: string) => player.improvements.includes(id);
  const available = (d: ImprovementDef) => (state.improvementSupply[d.id] ?? 0) > 0 && !owns(d.id);
  const canUpgrade = (d: ImprovementDef) => d.upgradeFrom?.some((f) => player.improvements.includes(f)) ?? false;
  const canBuy = (d: ImprovementDef) => available(d) && (canUpgrade(d) || isAffordable(d.cost, res));

  const rank = (d: ImprovementDef): number => {
    if (!available(d)) return 3; // taken / owned — sink to the bottom
    if (canBuy(d)) return 0; // affordable now
    return 1; // available but short
  };
  const missing = (d: ImprovementDef) => costLines(d.cost, res).reduce((s, l) => s + l.short, 0);

  const ordered = [...IMPROVEMENTS].sort(
    (a, b) => rank(a) - rank(b) || missing(a) - missing(b) || b.points - a.points,
  );

  const affordableCount = IMPROVEMENTS.filter(canBuy).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-800">🏗️ Major Improvements</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-stone-400 hover:bg-stone-100">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-stone-500">
          Your supply: {bagText(res as Record<string, number>) || 'nothing'} ·{' '}
          {affordableCount > 0 ? (
            <span className="font-medium text-green-700">{affordableCount} you can build now</span>
          ) : (
            <span>none affordable yet — this is your wishlist</span>
          )}
          . Build one by placing a worker on the Major Improvement space.
        </p>

        <div className="grid grid-cols-1 gap-1.5">
          {ordered.map((d) => {
            const taken = !available(d);
            const upgrade = canUpgrade(d);
            const buy = canBuy(d);
            return (
              <div
                key={d.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  taken
                    ? 'border-stone-200 bg-stone-50 opacity-50'
                    : buy
                      ? 'border-green-500 bg-green-50/60 ring-1 ring-green-200'
                      : 'border-stone-200'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-stone-800">{d.label}</span>
                  <span className="flex flex-wrap justify-end gap-1 whitespace-nowrap text-stone-500">
                    {upgrade ? (
                      <span>↩ upgrade</span>
                    ) : (
                      costLines(d.cost, res).map((l) => (
                        <span
                          key={l.resource}
                          className={!taken && l.short > 0 ? 'font-semibold text-red-600' : undefined}
                        >
                          {l.need}
                          {ICON[l.resource] ?? l.resource}
                        </span>
                      ))
                    )}
                    <span className="text-stone-400">· {d.points}pt</span>
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-stone-500">{d.desc}</span>
                {taken ? (
                  <span className="mt-0.5 block text-xs font-medium text-stone-400">
                    {owns(d.id) ? 'You already own this' : 'Taken by another player'}
                  </span>
                ) : buy ? (
                  <span className="mt-0.5 block text-xs font-medium text-green-700">
                    {upgrade ? 'Free upgrade — return a Fireplace ✓' : 'Affordable now ✓'}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-xs font-medium text-red-500">
                    {shortfallText(d.cost, res)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
