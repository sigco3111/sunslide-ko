import {
  commitRunBest,
  formatRunTime,
  formatBestLine,
  normalizeRunRecord,
  loadStoredRunBest,
} from './logic/run-best.js';
import { store } from './logic/store.js';

/**
 * Win overlay (sector clear): focus, Esc → menu, aria-live summary.
 * @param {{ onPlayAgain: () => void, onMenu: () => void }} handlers
 */
export function initWinScreen(handlers) {
  const ov = document.getElementById('ov');
  const wBlock = document.getElementById('wBlock');
  const tBlock = document.getElementById('tBlock');
  const oBlock = document.getElementById('oBlock');
  const movesEl = document.getElementById('winMoves');
  const timeEl = document.getElementById('winTime');
  const greenEl = document.getElementById('winGreen');
  const homeEl = document.getElementById('winHome');
  const bestBadge = document.getElementById('winBest');
  const prevBestEl = document.getElementById('winPrevBest');
  const announce = document.getElementById('winAnnounce');
  const againBtn = document.getElementById('winAgain');
  const menuBtn = document.getElementById('winMenu');
  const bestline = document.getElementById('bestline');

  function refreshTitleBest() {
    if (bestline) bestline.textContent = formatBestLine(loadStoredRunBest(store));
  }

  function hide() {
    wBlock?.classList.add('hide');
    ov?.classList.add('hide');
  }

  function show(stats) {
    const record = {
      moves: stats.moves ?? 0,
      timeMs: stats.timeMs ?? 0,
    };
    const { isNewBest, best } = commitRunBest(store, record);
    refreshTitleBest();

    if (movesEl) movesEl.textContent = String(record.moves);
    if (timeEl) timeEl.textContent = formatRunTime(record.timeMs);
    if (greenEl) greenEl.textContent = String(stats.greened ?? '—');
    if (homeEl) homeEl.textContent = `${stats.homes ?? 0}/15`;

    if (bestBadge) bestBadge.classList.toggle('hide', !isNewBest);
    if (prevBestEl) {
      const prev = normalizeRunRecord(best);
      prevBestEl.textContent = prev && !isNewBest ? formatBestLine(prev) : '';
      prevBestEl.classList.toggle('hide', isNewBest || !prev);
    }

    const summary = isNewBest
      ? `섹터 클리어! 새 최고 기록: ${record.moves}수, ${formatRunTime(record.timeMs)}.`
      : `섹터 클리어! ${record.moves}수, ${formatRunTime(record.timeMs)}.`;
    if (announce) announce.textContent = summary;

    tBlock?.classList.add('hide');
    oBlock?.classList.add('hide');
    wBlock?.classList.remove('hide');
    ov?.classList.remove('hide');
    requestAnimationFrame(() => againBtn?.focus());
  }

  function goMenu() {
    hide();
    tBlock?.classList.remove('hide');
    oBlock?.classList.add('hide');
    ov?.classList.remove('hide');
    handlers.onMenu();
    requestAnimationFrame(() => document.getElementById('go')?.focus());
  }

  function goAgain() {
    hide();
    handlers.onPlayAgain();
  }

  againBtn?.addEventListener('click', goAgain);
  menuBtn?.addEventListener('click', goMenu);

  document.addEventListener('keydown', (e) => {
    if (wBlock?.classList.contains('hide')) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      goMenu();
    } else if (e.code === 'Enter') {
      e.preventDefault();
      goAgain();
    }
  });

  refreshTitleBest();

  return { show, hide, refreshTitleBest };
}