# Sunslide 한국어판

![Sunslide 게임 화면](assets/hero.png)

**[▶ 플레이하기 (한국어판)](https://sigco3111.github.io/sunslide-ko/)** · 원작 데모: [carlok.github.io/sunslide](https://carlok.github.io/sunslide/)

작은 행성을 감싸고 있는 **미끄러지는 초원 섬 15퍼즐** 위에서, 거품 개구리 **Pip**이 되어 거품을 쫓는 3D 웹 아케이드 게임입니다. 낮과 밤이 바뀌고, 박쥐와 싱크홀, 하늘 베리가 등장합니다.

이 저장소는 [carlok/sunslide](https://github.com/carlok/sunslide)(Apache-2.0)의 **한국어판**입니다. 게임 로직과 3D 렌더링은 원작을 그대로 두고, 사용자에게 보이는 메뉴·안내·HUD·힌트 문구를 한국어로 옮기고 한글 폰트(Noto Sans KR)를 적용했습니다.

## 게임 소개

- **목표**: 초원 섬을 밀어 거품을 모으고, 행성을 초록으로 바꾸세요.
- **15퍼즐**: 햇빛을 받는 섬만 빈 초원 쪽으로 밀 수 있습니다.
- **박쥐**: 각 섬을 지키는 박쥐는 어두울 땐 빠르고 낮엔 졸립니다. 집 칸(1–15)에 섬을 넣으면 박쥐가 잠듭니다.
- **싱크홀**: 균열에 빠지면 행성 반대편으로 떨어집니다.
- **하늘 베리 / 태양석**: 속도 부스트와 박쥐 추격 능력을 줍니다.

## 조작법

| 동작 | 터치 | 키보드 / 마우스 | 게임패드 |
|------|------|-----------------|----------|
| 이동(점프) | 행성 스와이프 또는 방향 패드 | 방향키 / WASD | 스틱 / 방향패드 |
| 섬 밀기(햇빛 받는 인접 섬) | 섬 또는 지도 탭 | 클릭 | LB/RB 선택, **A** 밀기 |
| 경유지 설정 | 지도의 떨어진 칸 탭 | 지도 클릭 | — |
| 행성 시점 | ◎ / 시점 | 스페이스, 휠 | X / Y |
| 일시정지 | ❚❚ | P / Esc | Start |
| 음악 | ♪ | M | Select |

메뉴(☰)에서 화질, 효과음·음악·진동, 움직임 줄이기, 색맹 친화 팔레트를 설정할 수 있습니다.

## 번역 범위

- **번역함**: 메뉴·설정·크레딧, 조작 안내 튜토리얼, 게임 화면 HUD 라벨, 일시정지·클리어·종료 화면, 힌트 문구(`src/game/frags/09-hud-hints-toast.js`), 페이지 제목·설명 메타 정보.
- **번역하지 않음**: 코드가 조립하는 동적 템플릿 문자열(전투·로그류 등)과 원작 로직. 번역이 빠진 문구가 남아 있을 수 있습니다. 이슈나 PR을 환영합니다.
- **폰트**: 한글 표시를 위해 Noto Sans KR(Google Fonts)을 불러옵니다.

## 개발

```bash
npm ci
npm run dev                            # http://localhost:5173/
npx vite build --base=/sunslide-ko/    # GitHub Pages용 dist/ 생성
npm test                               # Vitest + Playwright 스모크
```

- `src/game/frags/`: 렌더·오디오·UI 조각 파일(빌드 시 이어 붙음)
- `src/logic/`: 순수 게임 로직(Vitest)
- `index.html`: 한국어 UI 마크업
- `.github/workflows/pages.yml`: `main` 푸시 시 GitHub Pages 배포(`/sunslide-ko/` 경로)

Pages 설정: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 크레딧

- **원작 Sunslide**: © [carlok](https://github.com/carlok)
- **원작 저장소**: [github.com/carlok/sunslide](https://github.com/carlok/sunslide)
- **원작 데모**: [carlok.github.io/sunslide](https://carlok.github.io/sunslide/)
- **한국어 번역·배포**: [sigco3111](https://github.com/sigco3111)
- **3D 렌더링**: [three.js](https://threejs.org/) (MIT), 빌드 도구 Vite

## 라이선스

이 저장소의 소스 코드는 원작과 같이 **Apache License 2.0**을 따릅니다. 전문은 [LICENSE](LICENSE)에 있으며 원문을 그대로 유지합니다. 원작의 저작권 표기는 [NOTICE](NOTICE)에 남겼습니다. three.js는 [MIT 라이선스](https://github.com/mrdoob/three.js/blob/dev/LICENSE)입니다.
