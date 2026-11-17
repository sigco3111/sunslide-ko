import { describe, expect, it } from 'vitest';
import {
  computeParMoves,
  scrambleDistanceSum,
  starsForMoves,
  formatStarRow,
  normalizeStarsMap,
  recordSectorStars,
  totalStarsCount,
  formatTitleStarsLine,
  STARS_KEY,
} from '../../src/logic/sector-stars.js';
import { createStore } from '../../src/logic/store.js';

const homeTiles = () =>
  Array.from({ length: 15 }, (_, id) => ({
    id,
    slot: { c: id % 4, r: Math.floor(id / 4) },
  }));

describe('sector-stars', () => {
  it('sums scramble distance from home slots', () => {
    expect(scrambleDistanceSum(homeTiles())).toBe(0);
    const tiles = homeTiles();
    tiles[0].slot = { c: 2, r: 1 };
    expect(scrambleDistanceSum(tiles)).toBeGreaterThan(0);
  });

  it('computes par from layout, bubbles, and level', () => {
    const par1 = computeParMoves(1, homeTiles(), 80);
    const scrambled = homeTiles();
    scrambled[5].slot = { c: 0, r: 3 };
    const par2 = computeParMoves(1, scrambled, 80);
    expect(par2).toBeGreaterThan(par1);
    expect(computeParMoves(3, homeTiles(), 80)).toBeGreaterThan(computeParMoves(1, homeTiles(), 80));
  });

  it('awards 1–3 stars vs par', () => {
    expect(starsForMoves(10, 12)).toBe(3);
    expect(starsForMoves(15, 12)).toBe(2);
    expect(starsForMoves(40, 12)).toBe(1);
    expect(formatStarRow(2)).toBe('★★☆');
  });

  it('persists best stars per sector in sunslide.stars', () => {
    const mem = new Map();
    const store = createStore({
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
    });
    expect(STARS_KEY).toBe('stars');
    recordSectorStars(store, 1, 2);
    expect(JSON.parse(mem.get('sunslide.stars'))['1']).toBe(2);
    const again = recordSectorStars(store, 1, 3);
    expect(again.isNewBest).toBe(true);
    recordSectorStars(store, 1, 1);
    expect(normalizeStarsMap(store.get(STARS_KEY, {}))['1']).toBe(3);
    recordSectorStars(store, 2, 2);
    expect(totalStarsCount(store.get(STARS_KEY, {}))).toBe(5);
    expect(formatTitleStarsLine(store.get(STARS_KEY, {}))).toContain('별 5개 획득');
  });
});