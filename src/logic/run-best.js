/** Best completed run stored under `sunslide.best` — fewer moves, then less time. */

export const BEST_KEY = 'best';
export const SCORE_BEST_KEY = 'scoreBest';

/** @returns {number | null} Non-negative arcade score from legacy `sunslide.best` or scoreBest shapes. */
export function parseLegacyArcadeScore(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

export function readStoredScoreBest(store) {
  const legacy = parseLegacyArcadeScore(store.get(SCORE_BEST_KEY, 0));
  if (legacy !== null) return legacy;
  return 0;
}

export function normalizeRunRecord(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const moves = Number(raw.moves);
  const timeMs = Number(raw.timeMs);
  if (!Number.isFinite(moves) || !Number.isFinite(timeMs) || moves < 0 || timeMs < 0) return null;
  return { moves: Math.round(moves), timeMs: Math.round(timeMs) };
}

/**
 * One-time: legacy arcade high score lived in `sunslide.best` as a number.
 * Move it to `scoreBest` (max of both), then clear `best` so run records can use the key.
 * @returns {{ migrated: boolean, scoreBest?: number, clearedMalformed?: boolean }}
 */
export function migrateLegacyBestScore(store) {
  const raw = store.get(BEST_KEY, null);
  const legacyScore = parseLegacyArcadeScore(raw);
  if (legacyScore !== null) {
    const merged = Math.max(legacyScore, readStoredScoreBest(store));
    store.set(SCORE_BEST_KEY, merged);
    store.set(BEST_KEY, null);
    return { migrated: true, scoreBest: merged };
  }
  if (raw !== null && normalizeRunRecord(raw) === null) {
    store.set(BEST_KEY, null);
    return { migrated: true, clearedMalformed: true };
  }
  return { migrated: false };
}

export function loadStoredRunBest(store) {
  migrateLegacyBestScore(store);
  return normalizeRunRecord(store.get(BEST_KEY, null));
}

/** `true` if `candidate` strictly beats `previous` (null previous always loses to any valid candidate). */
export function isBetterRun(candidate, previous) {
  const c = normalizeRunRecord(candidate);
  if (!c) return false;
  const p = normalizeRunRecord(previous);
  if (!p) return true;
  if (c.moves !== p.moves) return c.moves < p.moves;
  return c.timeMs < p.timeMs;
}

export function compareRuns(a, b) {
  const na = normalizeRunRecord(a);
  const nb = normalizeRunRecord(b);
  if (!na && !nb) return 0;
  if (!na) return 1;
  if (!nb) return -1;
  if (na.moves !== nb.moves) return na.moves - nb.moves;
  return na.timeMs - nb.timeMs;
}

/**
 * Persist a run if it beats the stored best.
 * @returns {{ isNewBest: boolean, best: import('./run-best.js').normalizeRunRecord extends () => infer R ? R : null }}
 */
export function commitRunBest(store, record) {
  migrateLegacyBestScore(store);
  const next = normalizeRunRecord(record);
  const prev = normalizeRunRecord(store.get(BEST_KEY, null));
  if (!next) return { isNewBest: false, best: prev };
  const isNewBest = isBetterRun(next, prev);
  if (isNewBest) store.set(BEST_KEY, next);
  return { isNewBest, best: isNewBest ? next : prev };
}

export function formatRunTime(timeMs) {
  const ms = Math.max(0, Math.round(timeMs));
  const sec = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 100);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${frac}`;
  return `${s}.${frac}s`;
}

export function formatBestLine(best) {
  const b = normalizeRunRecord(best);
  if (!b) return '';
  return `최고 기록: ${b.moves}수 · ${formatRunTime(b.timeMs)}`;
}