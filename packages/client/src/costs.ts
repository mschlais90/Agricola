import type { ResourceBag } from '@agricola/engine';
import { ICON } from './ui';

export interface CostLine {
  resource: string;
  need: number;
  have: number;
  short: number;
}

type Resources = Record<string, number | undefined>;

export function costLines(cost: ResourceBag, resources: Resources): CostLine[] {
  return Object.entries(cost)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([resource, need]) => {
      const have = resources[resource] ?? 0;
      return { resource, need: need as number, have, short: Math.max(0, (need as number) - have) };
    });
}

export function isAffordable(cost: ResourceBag, resources: Resources): boolean {
  return costLines(cost, resources).every((l) => l.short === 0);
}

const NAME: Record<string, string> = {
  wood: 'Wood',
  clay: 'Clay',
  reed: 'Reed',
  stone: 'Stone',
  grain: 'Grain',
  vegetable: 'Vegetable',
  food: 'Food',
};

/** Plain-text tooltip: one line per resource comparing what's needed to what you have. */
export function costTooltip(cost: ResourceBag, resources: Resources): string {
  const lines = costLines(cost, resources);
  if (lines.length === 0) return '';
  return (
    'Cost — needed vs. available:\n' +
    lines
      .map(
        (l) =>
          `${NAME[l.resource] ?? l.resource}: need ${l.need}, have ${l.have}` +
          (l.short > 0 ? ` (short ${l.short})` : ' ✓'),
      )
      .join('\n')
  );
}

/** Short inline note of what's missing, e.g. "Short 2🧱 1🗿". */
export function shortfallText(cost: ResourceBag, resources: Resources): string {
  const shorts = costLines(cost, resources).filter((l) => l.short > 0);
  if (shorts.length === 0) return '';
  return 'Short ' + shorts.map((l) => `${l.short}${ICON[l.resource] ?? l.resource}`).join(' ');
}
