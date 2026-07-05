import type { ResourceBag } from '@agricola/engine';

/** Artwork-free iconography (emoji only — no copied assets). */
export const ICON: Record<string, string> = {
  wood: '🪵',
  clay: '🧱',
  reed: '🎋',
  stone: '🪨',
  grain: '🌾',
  vegetable: '🥕',
  food: '🍲',
  sheep: '🐑',
  boar: '🐗',
  cattle: '🐄',
  family: '👤',
  begging: '🙏',
};

export const PLAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea'];

export function bagText(bag: ResourceBag & Record<string, number | undefined>): string {
  return Object.entries(bag)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n}${ICON[k] ?? k}`)
    .join(' ');
}
