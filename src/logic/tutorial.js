/** First-run tutorial steps and persistence helpers (pure). */

export const TUTORIAL_SEEN_KEY = 'tutorialSeen';

export const TUTORIAL_STEPS = [
  {
    id: 'slide',
    title: '초원 섬을 밀어요',
    body:
      '햇빛을 받는 15퍼즐 판입니다. 빈 초원 옆에서 빛나는 섬을 행성이나 지도에서 탭하면 그 조각이 빈칸으로 밀려 들어갑니다. 빛을 받는 섬만 움직여요.',
  },
  {
    id: 'bubbles',
    title: '거품을 터뜨리고, 초록으로',
    body:
      '거품 위를 뛰어넘어 모으세요. 거품을 치울 때마다 그 섬이 피어나고, 초원이 퍼지면서 조각이 더 초록빛으로 변합니다.',
  },
  {
    id: 'goal',
    title: '목표',
    body:
      '모든 섬을 집 칸(1–15)에 넣고, 햇빛으로 박쥐를 깨우고, 모든 거품을 치우면 구역 클리어입니다. 그다음 구역으로 계속 뛰어가세요.',
  },
];

export function shouldAutoShowTutorial(seen) {
  return seen !== true;
}

export function clampTutorialStep(index, stepCount = TUTORIAL_STEPS.length) {
  const n = Number(stepCount);
  const max = Number.isFinite(n) && n > 0 ? n - 1 : 0;
  const i = Number(index);
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(max, Math.floor(i)));
}

export function isLastTutorialStep(stepIndex, stepCount = TUTORIAL_STEPS.length) {
  return clampTutorialStep(stepIndex, stepCount) >= stepCount - 1;
}

export function nextTutorialStep(stepIndex, stepCount = TUTORIAL_STEPS.length) {
  return clampTutorialStep(stepIndex + 1, stepCount);
}
