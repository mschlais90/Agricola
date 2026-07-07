import type { CostOption, ResourceBag } from '@agricola/engine';
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

/** Total number of resources a path is short by — used to pick the closest one. */
function totalShort(cost: ResourceBag, resources: Resources): number {
  return costLines(cost, resources).reduce((s, l) => s + l.short, 0);
}

/** The `CostOption` the player is closest to affording (fewest missing resources). */
export function closestOption(options: CostOption[], resources: Resources): CostOption | undefined {
  return [...options].sort((a, b) => totalShort(a.cost, resources) - totalShort(b.cost, resources))[0];
}

/**
 * Multi-line tooltip for a blocked action: the reason, then each way to satisfy
 * it with a needed-vs-available breakdown. Alternatives are separated by "— or —".
 */
export function requirementTooltip(
  reason: string | undefined,
  options: CostOption[] | undefined,
  resources: Resources,
): string | undefined {
  if (!options || options.length === 0) return reason || undefined;
  const blocks = options.map((opt) => {
    const head = opt.label ? `${opt.label}:` : 'Needs:';
    return head + '\n' + costTooltip(opt.cost, resources).replace(/^Cost — needed vs\. available:\n/, '');
  });
  const body = blocks.join('\n— or —\n');
  return reason ? `${reason}\n\n${body}` : body;
}

/** Inline "Short 2🌲" for the closest satisfying path (empty if nothing missing). */
export function requirementShort(options: CostOption[] | undefined, resources: Resources): string {
  if (!options || options.length === 0) return '';
  const best = closestOption(options, resources);
  return best ? shortfallText(best.cost, resources) : '';
}
