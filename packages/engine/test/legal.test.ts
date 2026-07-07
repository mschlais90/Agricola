import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../src/actions/legal';
import { game } from './helpers';

describe('getLegalActions — resource shortfall metadata', () => {
  it('reports the cost of each way to satisfy a resource-blocked space', () => {
    // Round 1: players hold only starting food, so Build Rooms/Stables is unaffordable.
    const s = game();
    const expansion = getLegalActions(s, 0).find((l) => l.space === 'farm-expansion');
    expect(expansion).toBeDefined();
    expect(expansion!.enabled).toBe(false);
    expect(expansion!.reason).toMatch(/room or stable/);

    // Both build paths are surfaced with their real costs (wood house → 5 wood + 2 reed; stable → 2 wood).
    const labels = expansion!.requires?.map((r) => r.label);
    expect(labels).toEqual(['Room', 'Stable']);
    const room = expansion!.requires!.find((r) => r.label === 'Room')!;
    expect(room.cost).toEqual({ wood: 5, reed: 2 });
    const stable = expansion!.requires!.find((r) => r.label === 'Stable')!;
    expect(stable.cost).toEqual({ wood: 2 });
  });

  it('omits `requires` for enabled spaces and non-resource blocks', () => {
    const s = game();
    const forest = getLegalActions(s, 0).find((l) => l.space === 'forest');
    expect(forest!.enabled).toBe(true);
    expect(forest!.requires).toBeUndefined();
  });
});
