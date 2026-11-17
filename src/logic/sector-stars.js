/**
 * Optional par-move stars per sector (replay overlay; never blocks progress).
 *
 * Par moves are derived from the **shuffled layout** plus workload:
 *
 *   scramble = sum over 15 islands of Manhattan distance from current slot
 *              to home slot (columns wrap on the 4×4 ring).
 *
 *   par = PAR.base
 *       + floor(scramble × PAR.perHomeDistance)
 *       + floor(bubbleDots × PAR.perBubble)
 *       + (level − 1) × PAR.perLevel
 *
 * Stars (1–3, always at least 1 on clear):
 *   3★ moves ≤ par
 *   2★ moves ≤ ceil(par × 1.28)
 *   1★ otherwise (sector still cleared)
 */
import { COLS } from './constants.js';

export const STARS_KEY = 'stars';

export const PAR = {
  base: 14,
  perHomeDistance: 0.52,
  perBubble: 0.11,
  perLevel: 5,
};

export const STAR_THRESHOLDS = { twoStar: 1.28 };

export function homeSlotForTile(id, cols = COLS) {
  return { c: id % cols, r: Math.floor(id / cols) };
}

export function wrapColDist(a, b, cols = COLS) {
  const dc = Math.abs(a - b);
  return Math.min(dc, cols - dc);
}

/** @param {{ id: number, slot: { c: number, r: number } }[]} tiles */
export function scrambleDistanceSum(tiles, cols = COLS) {
  let sum = 0;
  if (!tiles?.length) return 0;
  for (const T of tiles) {
    const home = homeSlotForTile(T.id, cols);
    const dc = wrapColDist(T.slot.c, home.c, cols);
    const dr = Math.abs(T.slot.r - home.r);
    sum += dc + dr;
  }
  return sum;
}

export function computeParMoves(level, tiles, bubbleDots) {
  const scramble = scrambleDistanceSum(tiles);
  const bubble = Math.max(0, Math.floor(Number(bubbleDots)) || 0);
  const lv = Math.max(1, Math.floor(Number(level)) || 1);
  const par =
    PAR.base +
    Math.floor(scramble * PAR.perHomeDistance) +
    Math.floor(bubble * PAR.perBubble) +
    (lv - 1) * PAR.perLevel;
  return Math.max(PAR.base, par);
}

export function starsForMoves(moves, par) {
  const m = Math.max(0, Math.floor(Number(moves)) || 0);
  const p = Math.max(1, Math.floor(Number(par)) || 1);
  if (m <= p) return 3;
  if (m <= Math.ceil(p * STAR_THRESHOLDS.twoStar)) return 2;
  return 1;
}

export function formatStarRow(stars) {
  const s = Math.min(3, Math.max(0, Math.round(Number(stars)) || 0));
  return `${'★'.repeat(s)}${'☆'.repeat(3 - s)}`;
}

export function normalizeStarsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const sector = String(k);
    const stars = Math.min(3, Math.max(0, Math.floor(Number(v)) || 0));
    if (stars > 0) out[sector] = stars;
  }
  return out;
}

/** Keep the highest star count per sector in `sunslide.stars`. */
export function recordSectorStars(store, sector, stars) {
  const key = String(sector);
  const next = Math.min(3, Math.max(1, Math.floor(Number(stars)) || 0));
  const map = normalizeStarsMap(store.get(STARS_KEY, {}));
  const prev = map[key] || 0;
  if (next > prev) {
    map[key] = next;
    store.set(STARS_KEY, map);
    return { isNewBest: true, stars: next, map };
  }
  return { isNewBest: false, stars: Math.max(prev, next), map };
}

export function totalStarsCount(map) {
  const norm = normalizeStarsMap(map);
  return Object.values(norm).reduce((a, n) => a + n, 0);
}

export function formatTitleStarsLine(map) {
  const total = totalStarsCount(map);
  if (total <= 0) return '';
  return `★ 별 ${total}개 획득 (선택 기준 수)`;
}