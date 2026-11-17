/** Mobile map show/hide; desktop keeps map always on. */
import { store } from './logic/store.js';

const COMPACT_MQ = '(max-width: 699px), (max-height: 520px) and (orientation: landscape)';

export function initMapToggle() {
  const btn = document.getElementById('mapToggle');
  const panel = document.getElementById('mapPanel');
  if (!btn || !panel) return;

  const mq = window.matchMedia(COMPACT_MQ);

  const setVisible = (vis, remember) => {
    panel.classList.toggle('map-hidden', !vis);
    panel.setAttribute('aria-hidden', vis ? 'false' : 'true');
    btn.setAttribute('aria-expanded', vis ? 'true' : 'false');
    btn.setAttribute('aria-pressed', vis ? 'true' : 'false');
    btn.setAttribute('aria-label', vis ? '섬 지도 숨기기' : '섬 지도 보기');
    if (remember) store.set('mapVisible', vis);
  };

  const applyMode = () => {
    const compact = mq.matches;
    btn.classList.toggle('map-toggle-active', compact);
    if (!compact) {
      setVisible(true, false);
      return;
    }
    setVisible(store.get('mapVisible', false), false);
  };

  btn.addEventListener('click', () => {
    if (!mq.matches) return;
    const next = btn.getAttribute('aria-pressed') !== 'true';
    setVisible(next, true);
  });

  applyMode();
  mq.addEventListener('change', applyMode);
}