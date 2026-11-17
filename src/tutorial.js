/** 처음 실행 시 나오는 가벼운 튜토리얼 오버레이(안내 카드). */
import { store } from './logic/store.js';
import {
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
  clampTutorialStep,
  isLastTutorialStep,
  nextTutorialStep,
  shouldAutoShowTutorial,
} from './logic/tutorial.js';

export function initTutorial() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  const scrim = document.createElement('div');
  scrim.id = 'tutorialScrim';
  scrim.className = 'tutorial-scrim hide';
  scrim.setAttribute('aria-hidden', 'true');

  const dialog = document.createElement('div');
  dialog.id = 'tutorialDialog';
  dialog.className = 'tutorial-dialog hide';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'tutorialTitle');
  dialog.setAttribute('aria-describedby', 'tutorialBody');
  dialog.tabIndex = -1;

  const counter = document.createElement('p');
  counter.id = 'tutorialStep';
  counter.className = 'tutorial-step';
  counter.setAttribute('aria-live', 'polite');

  const title = document.createElement('h2');
  title.id = 'tutorialTitle';

  const body = document.createElement('p');
  body.id = 'tutorialBody';
  body.className = 'tutorial-body';

  const actions = document.createElement('div');
  actions.className = 'tutorial-actions';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.id = 'tutorialSkip';
  skipBtn.className = 'tutorial-skip';
  skipBtn.textContent = '건너뛰기';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.id = 'tutorialNext';
  nextBtn.className = 'big tutorial-next';

  dialog.append(counter, title, body, actions);
  actions.append(skipBtn, nextBtn);
  scrim.appendChild(dialog);
  stage.appendChild(scrim);

  let step = 0;
  let open = false;
  let returnFocus = null;

  const markSeen = () => store.set(TUTORIAL_SEEN_KEY, true);

  const renderStep = () => {
    step = clampTutorialStep(step);
    const s = TUTORIAL_STEPS[step];
    title.textContent = s.title;
    body.textContent = s.body;
    counter.textContent = `${step + 1} / ${TUTORIAL_STEPS.length} 단계`;
    nextBtn.textContent = isLastTutorialStep(step) ? '알겠어요' : '다음';
    nextBtn.setAttribute('aria-label', nextBtn.textContent);
  };

  const close = (saveSeen) => {
    if (!open) return;
    open = false;
    if (saveSeen) markSeen();
    scrim.classList.add('hide');
    dialog.classList.add('hide');
    scrim.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
  };

  const show = (opts = {}) => {
    if (open) return;
    returnFocus = opts.returnFocus || document.activeElement;
    step = 0;
    renderStep();
    open = true;
    scrim.classList.remove('hide');
    dialog.classList.remove('hide');
    scrim.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey, true);
    nextBtn.focus();
  };

  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.code === 'Tab') {
      const focusables = [skipBtn, nextBtn];
      const idx = focusables.indexOf(document.activeElement);
      if (idx < 0) return;
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const next = (idx + dir + focusables.length) % focusables.length;
      focusables[next].focus();
    }
  }

  skipBtn.addEventListener('click', () => close(true));
  nextBtn.addEventListener('click', () => {
    if (isLastTutorialStep(step)) close(true);
    else {
      step = nextTutorialStep(step);
      renderStep();
    }
  });
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) close(true);
  });

  const menuBtn = document.getElementById('menuTutorialBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('menuPanel');
      if (menu && !menu.classList.contains('hide')) {
        document.getElementById('menuBtn')?.click();
      }
      show({ returnFocus: menuBtn });
    });
  }

  if (shouldAutoShowTutorial(store.get(TUTORIAL_SEEN_KEY, false))) {
    requestAnimationFrame(() => show());
  }

  return { show, close };
}
