import { describe, expect, it } from 'vitest';
import { scorePlayer } from '../src/rules/scoring';
import { recomputePastures } from '../src/rules/fencing';
import { applyEdges, game, rectEdges } from './helpers';

function catPoints(sheet: ReturnType<typeof scorePlayer>, label: string): number {
  return sheet.categories.find((c) => c.label === label)?.points ?? NaN;
}

describe('scoring', () => {
  it('scores the starting farm correctly', () => {
    const s = game();
    const sheet = scorePlayer(s, s.players[0]!);
    expect(catPoints(sheet, 'Fields')).toBe(-1);
    expect(catPoints(sheet, 'Pastures')).toBe(-1);
    expect(catPoints(sheet, 'Grain')).toBe(-1);
    expect(catPoints(sheet, 'Vegetables')).toBe(-1);
    expect(catPoints(sheet, 'Sheep')).toBe(-1);
    expect(catPoints(sheet, 'Wild boar')).toBe(-1);
    expect(catPoints(sheet, 'Cattle')).toBe(-1);
    expect(catPoints(sheet, 'Unused spaces')).toBe(-13); // 15 - 2 rooms
    expect(catPoints(sheet, 'Wooden hut')).toBe(0);
    expect(catPoints(sheet, 'Family members')).toBe(6);
    expect(sheet.total).toBe(-1 * 7 - 13 + 6);
  });

  it('applies the rulebook brackets', () => {
    const s = game();
    const p = s.players[0]!;
    p.resources.grain = 4; // → 2 pts
    p.resources.vegetable = 1; // → 1 pt
    p.farm.animals = { sheep: 6, boar: 3, cattle: 1 }; // 3 / 2 / 1
    // 4 fields → 3 pts (adjacent chain)
    p.farm.fields = {
      '0,1': { crop: null, count: 0 },
      '0,2': { crop: null, count: 0 },
      '0,3': { crop: null, count: 0 },
      '0,4': { crop: null, count: 0 },
    };
    const sheet = scorePlayer(s, p);
    expect(catPoints(sheet, 'Grain')).toBe(2);
    expect(catPoints(sheet, 'Vegetables')).toBe(1);
    expect(catPoints(sheet, 'Sheep')).toBe(3);
    expect(catPoints(sheet, 'Wild boar')).toBe(2);
    expect(catPoints(sheet, 'Cattle')).toBe(1);
    expect(catPoints(sheet, 'Fields')).toBe(3);
  });

  it('counts crops still on fields toward grain/vegetables', () => {
    const s = game();
    const p = s.players[0]!;
    p.farm.fields = { '0,1': { crop: 'grain', count: 3 }, '0,2': { crop: 'vegetable', count: 2 } };
    p.resources.grain = 1;
    const sheet = scorePlayer(s, p);
    expect(catPoints(sheet, 'Grain')).toBe(2); // 4 grain
    expect(catPoints(sheet, 'Vegetables')).toBe(2); // 2 veg
  });

  it('scores rooms by material and fenced stables', () => {
    const s = game();
    const p = s.players[0]!;
    p.farm.roomMaterial = 'stone';
    p.farm.rooms.push('0,0');
    p.farm.stables = ['0,4', '2,4'];
    applyEdges(p.farm, rectEdges(0, 4, 0, 4)); // fence one stable
    recomputePastures(p.farm);
    const sheet = scorePlayer(s, p);
    expect(catPoints(sheet, 'Stone house')).toBe(6);
    expect(catPoints(sheet, 'Fenced stables')).toBe(1);
    expect(catPoints(sheet, 'Pastures')).toBe(1);
  });

  it('scores improvements, workshop bonuses and begging', () => {
    const s = game();
    const p = s.players[0]!;
    p.improvements = ['well', 'joinery']; // 4 + 2
    p.resources.wood = 5; // joinery bonus → 2
    p.beggingCards = 2; // -6
    const sheet = scorePlayer(s, p);
    expect(catPoints(sheet, 'Improvements')).toBe(6);
    expect(catPoints(sheet, 'Improvement bonus')).toBe(2);
    expect(catPoints(sheet, 'Begging cards')).toBe(-6);
  });
});
