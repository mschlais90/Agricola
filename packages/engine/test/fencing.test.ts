import { describe, expect, it } from 'vitest';
import { computePastures, countFences } from '../src/rules/fencing';
import { applyEdges, farmFixture, rectEdges } from './helpers';

function pasturesOf(farm: ReturnType<typeof farmFixture>) {
  const res = computePastures(farm);
  if ('error' in res) throw new Error(`unexpected error: ${res.error.code}`);
  return res.pastures;
}

function errorOf(farm: ReturnType<typeof farmFixture>) {
  const res = computePastures(farm);
  if (!('error' in res)) throw new Error('expected an error');
  return res.error;
}

describe('computePastures', () => {
  it('empty farm has no pastures', () => {
    expect(pasturesOf(farmFixture())).toEqual([]);
  });

  it('encloses a single cell (capacity 2)', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 4, 0, 4));
    const p = pasturesOf(farm);
    expect(p).toHaveLength(1);
    expect(p[0]!.cells).toEqual(['0,4']);
    expect(p[0]!.capacity).toBe(2);
  });

  it('encloses a 2x2 block (capacity 8)', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 1, 4));
    const p = pasturesOf(farm);
    expect(p).toHaveLength(1);
    expect(p[0]!.cells).toHaveLength(4);
    expect(p[0]!.capacity).toBe(8);
  });

  it('a stable inside doubles capacity; two stables quadruple it', () => {
    const farm = farmFixture({ stables: ['0,4'] });
    applyEdges(farm, rectEdges(0, 3, 0, 4)); // 2 cells
    expect(pasturesOf(farm)[0]!.capacity).toBe(8);

    const farm2 = farmFixture({ stables: ['0,3', '0,4'] });
    applyEdges(farm2, rectEdges(0, 3, 0, 4));
    expect(pasturesOf(farm2)[0]!.capacity).toBe(16);
  });

  it('rejects a dangling fence', () => {
    const farm = farmFixture();
    farm.fencesH[0]![4] = true; // lone fence at top edge
    expect(errorOf(farm).code).toBe('dangling-fence');
  });

  it('rejects an incomplete enclosure', () => {
    const farm = farmFixture();
    const edges = rectEdges(0, 4, 0, 4).slice(0, -1); // drop one side
    applyEdges(farm, edges);
    expect(errorOf(farm).code).toBe('dangling-fence');
  });

  it('subdivides a pasture with an internal fence', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 0, 4)); // cells 0,3 + 0,4 (vertical pair? no: rows 0..0? )
    // rectEdges(0,3,0,4): rows 0..0, cols 3..4 — a 1x2 pasture
    expect(pasturesOf(farm)).toHaveLength(1);
    applyEdges(farm, [{ dir: 'v', row: 0, col: 4 }]); // split between col 3 and 4
    const p = pasturesOf(farm);
    expect(p).toHaveLength(2);
    expect(p.map((x) => x.capacity)).toEqual([2, 2]);
  });

  it('rejects pastures over rooms and fields', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(1, 0, 1, 0)); // player home is at 1,0
    expect(errorOf(farm).code).toBe('pasture-over-building');

    const farm2 = farmFixture({ fields: { '0,4': { crop: null, count: 0 } } });
    applyEdges(farm2, rectEdges(0, 4, 0, 4));
    expect(errorOf(farm2).code).toBe('pasture-over-building');
  });

  it('rejects non-adjacent pastures', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 0, 0, 0));
    applyEdges(farm, rectEdges(0, 4, 0, 4));
    expect(errorOf(farm).code).toBe('pastures-not-adjacent');
  });

  it('allows diagonal-corner-touching? no — diagonal is not orthogonal', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 0, 3));
    applyEdges(farm, rectEdges(1, 4, 1, 4));
    expect(errorOf(farm).code).toBe('pastures-not-adjacent');
  });

  it('counts fences without double counting shared edges', () => {
    const farm = farmFixture();
    applyEdges(farm, rectEdges(0, 3, 0, 4));
    // 1x2 rect: top 2 + bottom 2 + left 1 + right 1 = 6
    expect(countFences(farm)).toBe(6);
  });
});
