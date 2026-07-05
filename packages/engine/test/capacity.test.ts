import { describe, expect, it } from 'vitest';
import { canAccommodate, computeAssignment } from '../src/rules/capacity';
import { recomputePastures } from '../src/rules/fencing';
import { applyEdges, farmFixture, rectEdges } from './helpers';

describe('canAccommodate', () => {
  it('house pet: exactly one animal fits with no pastures', () => {
    const farm = farmFixture();
    expect(canAccommodate(farm, { sheep: 1, boar: 0, cattle: 0 })).toBe(true);
    expect(canAccommodate(farm, { sheep: 2, boar: 0, cattle: 0 })).toBe(false);
    expect(canAccommodate(farm, { sheep: 1, boar: 1, cattle: 0 })).toBe(false);
  });

  it('unfenced stables hold one animal each', () => {
    const farm = farmFixture({ stables: ['0,3', '0,4'] });
    expect(canAccommodate(farm, { sheep: 1, boar: 1, cattle: 1 })).toBe(true); // 2 stables + pet
    expect(canAccommodate(farm, { sheep: 2, boar: 1, cattle: 1 })).toBe(false);
  });

  it('one pasture holds only a single type', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 1, 4)); // 4 cells, capacity 8
    recomputePastures(farm);
    expect(canAccommodate(farm, { sheep: 8, boar: 0, cattle: 0 })).toBe(true);
    expect(canAccommodate(farm, { sheep: 9, boar: 0, cattle: 0 })).toBe(true); // 8 + pet
    expect(canAccommodate(farm, { sheep: 10, boar: 0, cattle: 0 })).toBe(false);
    // second type must use the pet slot
    expect(canAccommodate(farm, { sheep: 8, boar: 1, cattle: 0 })).toBe(true);
    expect(canAccommodate(farm, { sheep: 9, boar: 1, cattle: 0 })).toBe(false);
    expect(canAccommodate(farm, { sheep: 8, boar: 2, cattle: 0 })).toBe(false);
  });

  it('two pastures can hold two types', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 0, 4)); // 1x2
    applyEdges(farm, [{ dir: 'v', row: 0, col: 4 }]); // split into two 1-cell pastures
    recomputePastures(farm);
    expect(canAccommodate(farm, { sheep: 2, boar: 2, cattle: 0 })).toBe(true);
    expect(canAccommodate(farm, { sheep: 2, boar: 2, cattle: 1 })).toBe(true); // pet
    expect(canAccommodate(farm, { sheep: 2, boar: 2, cattle: 2 })).toBe(false);
  });

  it('computeAssignment returns a concrete legal layout', () => {
    const farm = farmFixture({ stables: ['2,4'] });
    applyEdges(farm, rectEdges(0, 3, 0, 4));
    applyEdges(farm, [{ dir: 'v', row: 0, col: 4 }]);
    recomputePastures(farm);
    const a = computeAssignment(farm, { sheep: 2, boar: 1, cattle: 1 });
    expect(a).not.toBeNull();
    const placed = { sheep: 0, boar: 0, cattle: 0 };
    for (const p of a!.pastures) if (p.type) placed[p.type] += p.count;
    for (const s of a!.stables) if (s.type) placed[s.type]++;
    if (a!.pet) placed[a!.pet]++;
    expect(placed).toEqual({ sheep: 2, boar: 1, cattle: 1 });
  });

  it('returns null assignment when impossible', () => {
    const farm = farmFixture();
    expect(computeAssignment(farm, { sheep: 3, boar: 0, cattle: 0 })).toBeNull();
  });
});
