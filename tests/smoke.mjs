// Headless smoke test — serves the Vite production build via `vite preview`.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { analyzeStagePng } from './png-luma.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests', 'out');
mkdirSync(out, { recursive: true });

const SMOKE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS) || 8 * 60 * 1000;
const SIM_TICKS = Number(process.env.SMOKE_TICKS) || 6000;

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('Run `npm run build` before the smoke test');
  process.exit(1);
}

const PORT = Number(process.env.SMOKE_PORT) || 4173;
const baseUrl = `http://127.0.0.1:${PORT}/sunslide/`;

/** Prevent CI hangs: exit if the full smoke run exceeds the budget. */
const smokeDeadline = setTimeout(() => {
  console.error(`smoke test exceeded ${SMOKE_TIMEOUT_MS}ms — aborting`);
  process.exit(124);
}, SMOKE_TIMEOUT_MS);
smokeDeadline.unref();

let previewStop = () => {};

function startPreview() {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: root,
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, BROWSER: 'none' },
    },
  );
  child.unref();
  previewStop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* already dead */
      }
    }
    setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* */
        }
      }
    }, 2000).unref();
  };
  child.on('error', (e) => {
    console.error('preview spawn failed', e);
    process.exit(1);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview did not become ready');
}

startPreview();
await waitForServer();

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1, hasTouch: false, isMobile: false, quality: 1 },
  { name: 'desktop-4k', width: 2560, height: 1440, deviceScaleFactor: 1, hasTouch: false, isMobile: false, quality: 2, large: true },
  { name: 'desktop-4k-dpr2', width: 1920, height: 1080, deviceScaleFactor: 2, hasTouch: false, isMobile: false, quality: 2, large: true },
  { name: 'phone-portrait', width: 390, height: 780, deviceScaleFactor: 2, hasTouch: true, isMobile: true, quality: 1 },
  { name: 'phone-landscape', width: 844, height: 390, deviceScaleFactor: 2, hasTouch: true, isMobile: true, quality: 1 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  timeout: 60_000,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--headless=new',
  ],
});
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error('FAIL', msg);
};

try {
  for (const vp of VIEWPORTS) {
    const { name, quality, large, ...opts } = vp;
    const ctx = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      ...opts,
    });
    await ctx.addInitScript(() => {
      window.__ssSmokeNoFullscreen = true;
      try {
        localStorage.setItem('sunslide.tutorialSeen', JSON.stringify(true));
      } catch {
        /* private mode */
      }
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
  // 'load' only — networkidle can hang on WebGL / rAF; gameplay readiness uses __sunslide.
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 60_000 });
    const debugLeak = await page.evaluate(
      () => !!document.getElementById('debugOverlay'),
    );
    if (debugLeak) fail(`${name}: debug overlay must not load without ?debug`);
    await page.waitForFunction(() => !!window.__sunslide, null, { timeout: 30_000 });

    const menu = await page.evaluate(async () => {
      const btn = document.getElementById('menuBtn');
      const panel = document.getElementById('menuPanel');
      if (!btn || !panel) return { ok: false, why: 'menu nodes missing' };
      btn.click();
      const open =
        btn.getAttribute('aria-expanded') === 'true' && !panel.classList.contains('hide');
      document.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }),
      );
      const closed =
        btn.getAttribute('aria-expanded') === 'false' && panel.classList.contains('hide');
      btn.click();
      const open2 =
        btn.getAttribute('aria-expanded') === 'true' && !panel.classList.contains('hide');
      document.getElementById('stage').dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 4, clientY: innerHeight - 4 }),
      );
      const outside =
        btn.getAttribute('aria-expanded') === 'false' && panel.classList.contains('hide');
      const settings = !!document.getElementById('menuSettings');
      return { ok: open && closed && open2 && outside && settings, open, closed, open2, outside, settings };
    });
    if (!menu.ok) fail(`${name}: hamburger menu ${JSON.stringify(menu)}`);
    await page.evaluate(() => {
      document.getElementById('menuPanel')?.classList.add('hide');
      document.getElementById('menuScrim')?.classList.add('hide');
      const mb = document.getElementById('menuBtn');
      if (mb) mb.setAttribute('aria-expanded', 'false');
    });

    const isCompactMobile = name === 'phone-portrait' || name === 'phone-landscape';
    if (isCompactMobile) {
      await page.evaluate(() => localStorage.removeItem('sunslide.mapVisible'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__sunslide, null, { timeout: 30_000 });
      const mapT0 = await page.evaluate(() => {
        const btn = document.getElementById('mapToggle');
        const panel = document.getElementById('mapPanel');
        if (!btn || !panel) return { ok: false, why: 'map toggle nodes missing' };
        if (!btn.classList.contains('map-toggle-active')) {
          return { ok: false, why: 'toggle should be active on compact viewport' };
        }
        return {
          ok:
            panel.classList.contains('map-hidden') &&
            btn.getAttribute('aria-pressed') === 'false',
        };
      });
      if (!mapT0.ok) fail(`${name}: map hidden by default ${JSON.stringify(mapT0)}`);
      const mapOpen = await page.evaluate(() => {
        const btn = document.getElementById('mapToggle');
        const panel = document.getElementById('mapPanel');
        const map = document.getElementById('map');
        btn.click();
        const box = map.getBoundingClientRect();
        return {
          ok:
            !panel.classList.contains('map-hidden') &&
            btn.getAttribute('aria-pressed') === 'true' &&
            btn.getAttribute('aria-expanded') === 'true' &&
            box.height > 40,
        };
      });
      if (!mapOpen.ok) fail(`${name}: map toggle open ${JSON.stringify(mapOpen)}`);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__sunslide, null, { timeout: 30_000 });
      const mapPersist = await page.evaluate(() => {
        const btn = document.getElementById('mapToggle');
        const panel = document.getElementById('mapPanel');
        return {
          ok:
            btn?.getAttribute('aria-pressed') === 'true' &&
            !panel?.classList.contains('map-hidden'),
        };
      });
      if (!mapPersist.ok) fail(`${name}: map preference not persisted ${JSON.stringify(mapPersist)}`);
      const touch = await page.evaluate((min) => {
        const ids = ['menuBtn', 'go', 'mapToggle', 'bPause', 'bMus', 'bView2'];
        const out = [];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) continue;
          if (id === 'mapToggle' && !el.classList.contains('map-toggle-active')) continue;
          const r = el.getBoundingClientRect();
          out.push({
            id,
            w: r.width,
            h: r.height,
            ok: r.width >= min && r.height >= min,
          });
        }
        document.querySelectorAll('#pad button').forEach((el, i) => {
          const r = el.getBoundingClientRect();
          out.push({
            id: el.id || `pad-${i}`,
            w: r.width,
            h: r.height,
            ok: r.width >= min && r.height >= min,
          });
        });
        const bad = out.filter((x) => !x.ok);
        return { ok: bad.length === 0, bad, out };
      }, 44);
      if (!touch.ok) fail(`${name}: touch targets under 44px ${JSON.stringify(touch.bad)}`);
    }

    await page.evaluate((q) => window.__sunslide.setQuality(q), quality ?? 1);
    await page.locator('#go').scrollIntoViewIfNeeded();
    const playClick = await page.evaluate(() => {
      const go = document.getElementById('go');
      if (!go) return { ok: false, why: 'missing #go' };
      const r = go.getBoundingClientRect();
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const top = document.elementFromPoint(cx, cy);
      return { ok: top === go || go.contains(top), top: top?.id || top?.tagName };
    });
    if (!playClick.ok) fail(`${name}: #go not top element before click ${JSON.stringify(playClick)}`);
    const playOpts = { timeout: 20_000, noWaitAfter: true };
    try {
      await page.click('#go', playOpts);
    } catch (e) {
      if (e.name !== 'TimeoutError') throw e;
      const retryHit = await page.evaluate(() => {
        const go = document.getElementById('go');
        if (!go) return { ok: false, why: 'missing #go' };
        const r = go.getBoundingClientRect();
        const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
        const top = document.elementFromPoint(cx, cy);
        return { ok: top === go || go.contains(top), top: top?.id || top?.tagName };
      });
      if (!retryHit.ok) fail(`${name}: #go covered after click timeout ${JSON.stringify(retryHit)}`);
      await page.waitForTimeout(300);
      await page.click('#go', playOpts);
    }
    await page.waitForTimeout(800);

    if (name === 'desktop') {
      const amb = await page.evaluate(() => {
        const S = window.__sunslide;
        if (!S?.setAmbientGreenPercent || !S.getAmbientLayerGains) {
          return { ok: false, why: 'ambient hooks missing' };
        }
        S.setAmbientGreenPercent(55);
        const g = S.getAmbientLayerGains(55);
        return {
          ok: g.pad > 0 && g.birds > 0 && g.melody === 0,
          g,
          progress: S.greenProgress,
        };
      });
      if (!amb.ok) fail(`desktop: ambient green mapping ${JSON.stringify(amb)}`);
      const starsHud = await page.evaluate(() => {
        const hook = window.__sunslide?.showClearStarsForTest;
        if (!hook) return { ok: false, why: 'missing showClearStarsForTest' };
        const r = hook({ moves: 9, par: 12, sector: 1, stars: 2 });
        const panel = document.getElementById('clearStars');
        return {
          ok:
            r.visible &&
            r.stars === 2 &&
            r.row === '★★☆' &&
            panel?.getAttribute('role') === 'status',
          r,
        };
      });
      if (!starsHud.ok) fail(`desktop: sector stars overlay ${JSON.stringify(starsHud)}`);
      await page.evaluate(() => window.__ssHideClearStars?.());
      const greenHud = await page.evaluate(() => {
        const bar = document.getElementById('greenGoal');
        const pct = document.getElementById('greenPct');
        if (!bar || !pct) return { ok: false, why: 'green HUD missing' };
        const before = pct.textContent;
        const S = window.__sunslide;
        let popped = false;
        outer: for (let tid = 0; tid < S.tiles.length; tid++) {
          const T = S.tiles[tid];
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 8; x++) {
              if (T.dots[y * 8 + x] === 1) {
                S.popBubbleAt(tid, x, y);
                popped = true;
                break outer;
              }
            }
          }
        }
        for (let i = 0; i < 6; i++) S.update(0.05);
        S.refreshHud?.();
        return {
          ok:
            popped &&
            bar.getAttribute('role') === 'progressbar' &&
            S.planetGreenPercent > 0 &&
            pct.textContent !== before,
          before,
          after: pct.textContent,
          percent: S.planetGreenPercent,
        };
      });
      if (!greenHud.ok) fail(`desktop: planet green HUD ${JSON.stringify(greenHud)}`);
      const winCheck = await page.evaluate(() => {
        const hook = window.__sunslide?.showWinForTest;
        if (!hook) return { ok: false, why: 'missing showWinForTest' };
        const r = hook({ moves: 7, timeMs: 9100, homes: 9, greened: 4 });
        const wBlock = document.getElementById('wBlock');
        const again = document.getElementById('winAgain');
        const menu = document.getElementById('winMenu');
        const announce = document.getElementById('winAnnounce');
        const ar = again?.getBoundingClientRect();
        const mr = menu?.getBoundingClientRect();
        return {
          ok:
            r.dialogOpen &&
            wBlock?.getAttribute('role') === 'dialog' &&
            document.getElementById('winMoves')?.textContent === '7' &&
            (announce?.textContent?.includes('섹터 클리어') ?? false) &&
            ar &&
            Math.min(ar.width, ar.height) >= 44 &&
            mr &&
            Math.min(mr.width, mr.height) >= 44,
          r,
          announce: announce?.textContent,
        };
      });
      if (!winCheck.ok) fail(`desktop: win screen ${JSON.stringify(winCheck)}`);
      await page.click('#winMenu');
      await page.waitForFunction(
        () =>
          document.getElementById('tBlock') &&
          !document.getElementById('tBlock').classList.contains('hide'),
      );
      await page.click('#go');
      await page.waitForTimeout(400);
    }

    const simTicks = large ? Math.min(SIM_TICKS, 2800) : SIM_TICKS;
    const res = await page.evaluate(
      ({ ticks }) => {
        const S = window.__sunslide;
        S.inv = 1e9;
        let batLeaks = 0,
          warps = 0,
          last = S.state;
        for (let i = 0; i < ticks; i++) {
          if (i % 25 === 0) S.want = Math.floor(Math.random() * 4);
          if (i % 90 === 0)
            for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) S.trySlide(c, r);
          S.update(0.03);
          for (const g of S.bats)
            if (g.mode === 'live' && (g.a.t !== g.home || (g.a.moving && g.a.nt !== g.home)))
              batLeaks++;
          if (S.state === 'warp' && last !== 'warp') warps++;
          last = S.state;
        }
        const counted = S.tiles.reduce(
          (a, t) => a + t.dots.reduce((x, v) => x + (v ? 1 : 0), 0),
          0,
        );
        const leftSum = S.tiles.reduce((a, t) => a + t.left, 0);
        return { state: S.state, dotsLeft: S.dotsLeft, counted, leftSum, batLeaks, warps };
      },
      { ticks: simTicks },
      { timeout: 120_000 },
    );
    console.log(name, res);
    if (res.batLeaks) fail(`${name}: bats left their island ${res.batLeaks}×`);
    if (res.dotsLeft !== res.counted || res.leftSum !== res.counted)
      fail(`${name}: bubble counters out of sync`);

    const eco = await page.evaluate(() => {
      const S = window.__sunslide;
      let cell = null;
      for (const T of S.tiles) {
        for (let i = 0; i < 32; i++) {
          if (T.dots[i] === 1) {
            cell = { t: T.id, x: i % 8, y: (i / 8) | 0 };
            break;
          }
        }
        if (cell) break;
      }
      const before = S.greenedCount;
      if (cell) S.popBubbleAt(cell.t, cell.x, cell.y);
      for (let i = 0; i < 40; i++) S.update(1 / 60);
      return { before, after: S.greenedCount, cell };
    });
    if (!eco.cell) fail(`${name}: no bubble cell for ecology check`);
    if (eco.after <= eco.before) fail(`${name}: pop should green a tile (${eco.before}→${eco.after})`);

  const ecoLayout = await page.evaluate(() => window.__sunslide.getEcologyLayout());
  const CW = Math.PI * 2 / 32;
  const CH = (2 * (70 * Math.PI / 180)) / 16;
  if (ecoLayout.sx > CW * 1.05 || ecoLayout.sz > CH * 1.05) {
    fail(`${name}: ecology patch too large ${JSON.stringify(ecoLayout)} vs cell ${CW.toFixed(4)}×${CH.toFixed(4)}`);
  }
  if (ecoLayout.thick > 0.012) fail(`${name}: ecology patch too thick ${ecoLayout.thick}`);

    const layout = await page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const s = r('stage'),
        m = r('map'),
        o = r('overlay');
      return {
        stage: [s.width, s.height],
        viewport: [innerWidth, innerHeight],
        fillsViewport: s.width >= innerWidth * 0.96 && s.height >= innerHeight * 0.96,
        overlayPresent: o.width > 80 && o.height > 80,
        mapVisible: m.width > 60 && m.height > 40,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        overflowY: document.documentElement.scrollHeight > innerHeight + 1,
      };
    });
    if (layout.stage[0] < 200 || layout.stage[1] < 200)
      fail(`${name}: stage too small ${layout.stage}`);
    if (!layout.fillsViewport)
      fail(`${name}: stage should fill viewport ${layout.stage} vs ${layout.viewport}`);
    if (!layout.overlayPresent) fail(`${name}: HUD overlay missing or too small`);
    if (!isCompactMobile && !layout.mapVisible) fail(`${name}: map not visible`);
    if (isCompactMobile && layout.mapVisible) {
      const toggledOn = await page.evaluate(() => {
        const panel = document.getElementById('mapPanel');
        return (
          document.getElementById('mapToggle')?.getAttribute('aria-pressed') === 'true' &&
          !panel?.classList.contains('map-hidden')
        );
      });
      if (!toggledOn) fail(`${name}: map should stay visible after toggle/persist checks`);
    }
    if (layout.overflowX || layout.overflowY) fail(`${name}: page overflows the viewport`);

    if (large) {
      await page.waitForFunction(
        () => {
          const m = window.__sunslide?.getRenderMetrics?.();
          return m && (!m.useBloom || m.postPipelineReady);
        },
        { timeout: 20_000 },
      );
      await page.evaluate(() => {
        const S = window.__sunslide;
        for (let i = 0; i < 150; i++) S.update(1 / 60);
      });
      await page.waitForTimeout(400);
    }

    const stageShot = path.join(out, `${name}-stage.png`);
    const stageBox = await page.locator('#stage').boundingBox();
    if (!stageBox) fail(`${name}: #stage not found for screenshot`);
    else {
      const clip = {
        x: stageBox.x,
        y: stageBox.y,
        width: stageBox.width,
        height: stageBox.height,
      };
      await page.screenshot({
        path: stageShot,
        clip,
        animations: 'disabled',
        timeout: 60_000,
      });
    }
    await page.screenshot({
      path: path.join(out, `${name}.png`),
      timeout: large ? 90_000 : 30_000,
      animations: 'disabled',
    });
    if (large) {
      const luma = analyzeStagePng(readFileSync(stageShot));
      console.log(name, 'render-luma', luma);
      if (!luma.ok) {
        const why = luma.noScene
          ? `scene did not render (mean=${luma.mean.toFixed(1)} hiFrac=${(luma.hiFrac * 100).toFixed(2)}%)`
          : `macro black tiles (deadArea=${(luma.macro.deadAreaFrac * 100).toFixed(1)}% bright=${luma.macro.hasBrightSignal})`;
        fail(`${name}: ${why}`);
      }
      const metrics = await page.evaluate(() => window.__sunslide.getRenderMetrics());
      console.log(name, 'render-metrics', metrics);
      const [cw, ch] = metrics.canvasBuffer;
      const [rw, rh] = metrics.composerRT;
      if (!metrics.useBloom) fail(`${name}: expected bloom on for large desktop regression`);
      if (Math.abs(rw - cw) > 2 || Math.abs(rh - ch) > 2) {
        fail(`${name}: composer RT ${rw}x${rh} != canvas buffer ${cw}x${ch}`);
      }
      if (metrics.pixelRatio < 0.74 && metrics.stageCss[0] * metrics.stageCss[1] > 1.2e6) {
        fail(`${name}: pixelRatio ${metrics.pixelRatio} too low for bloom on large stage`);
      }
    }
    if (errors.length) fail(`${name}: console errors\n  ` + errors.slice(0, 5).join('\n  '));
    await ctx.close();
  }
} finally {
  clearTimeout(smokeDeadline);
  await browser.close().catch(() => {});
  previewStop();
}

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log('smoke test passed — screenshots in tests/out/');