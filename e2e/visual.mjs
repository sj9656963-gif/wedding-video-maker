// 화면 확인용 캡처: 홈페이지, '왜 직접' 그림, 스타일 예시 영상 장면, 실제 사진으로 만든 모든 배치·전환, 휴대폰(390px) 화면을 원본 해상도로 저장
// 실행: npm run e2e:visual  → e2e/out/visual/*.png
//   V_ONLY=page|why|demo|video|mobile 로 일부만, V_THEMES=romantic,cinema 로 스타일 지정,
//   V_CAPTIONS=1 이면 사진마다 문구를 넣고 캡처(파일 이름에 -cap), E2E_SKIP_BUILD=1 이면 기존 dist 사용
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { generateFixtures } from './fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'out', 'visual');
const fixDir = path.join(root, 'e2e', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });
const out = (n) => path.join(outDir, n);
const only = process.env.V_ONLY ?? '';
const withCaptions = !!process.env.V_CAPTIONS;
const THEME_LIST = (process.env.V_THEMES ?? 'romantic,classic,cinema,garden,street,neon,camcorder,film,modern,gallery').split(',');
/** 길이가 다른 문구 (짧음 · 보통 · 넘쳐서 줄여야 하는 긴 문구) */
const CAPTIONS = ['제주에서', '2019 봄, 한강 산책', '우리가 함께 걸었던 가장 길고 따뜻했던 여름밤 바닷가'];

if (!process.env.E2E_SKIP_BUILD) await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 4179, strictPort: false }, logLevel: 'warn' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const saveCanvas = async (p, selector, name) => {
  const url = await p.$eval(selector, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(out(name), Buffer.from(url.split(',')[1], 'base64'));
};

try {
  await page.goto(`${server.resolvedUrls.local[0]}?e2e`);
  const specs = await generateFixtures(page, fixDir);
  await page.reload();
  await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!only || only === 'page') {
    // 라이트·다크 화면에서 구역별로 (스크롤해야 등장 애니메이션이 재생되므로 한 화면씩)
    const sections = [
      ['why', '#why'],
      ['why3', '.why-item:nth-child(3)'],
      ['compare', '#compare'],
      ['styles', '#styles'],
      ['how', '#how'],
      ['numbers', '#numbers'],
      ['studio', '#studio'],
      ['style-card', '#style-card'],
      ['faq', '#faq'],
      ['cta', '.cta-band'],
    ];
    for (const mode of (process.env.V_MODES ?? 'light,dark').split(',')) {
      await page.evaluate((m) => localStorage.setItem('wvm-appearance', m), mode);
      await page.reload();
      await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(2200);
      await page.screenshot({ path: out(`page-${mode}-00-top.png`) });
      let i = 1;
      for (const [name, sel] of sections) {
        await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start', behavior: 'instant' }), sel);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: out(`page-${mode}-${String(i++).padStart(2, '0')}-${name}.png`) });
      }
    }
    await page.evaluate(() => localStorage.removeItem('wvm-appearance'));
    await page.reload();
    await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
    await page.waitForTimeout(800);
  }

  // ── '왜 직접' 그림: 항목마다 가운데로 스크롤해 장면이 다 조립된 뒤 무대만 캡처 ──
  if (!only || only === 'why') {
    for (const mode of (process.env.V_MODES ?? 'light,dark').split(',')) {
      await page.evaluate((m) => localStorage.setItem('wvm-appearance', m), mode);
      await page.reload();
      await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
      await page.waitForTimeout(1200);
      for (let i = 1; i <= 5; i++) {
        await page.evaluate((n) => document.querySelector(`.why-item:nth-child(${n})`)?.scrollIntoView({ block: 'center', behavior: 'instant' }), i);
        await page.waitForTimeout(i === 2 ? 3600 : 2600);
        await page.locator('#why-stage').screenshot({ path: out(`why-${mode}-${i}.png`) });
      }
    }
    await page.evaluate(() => localStorage.removeItem('wvm-appearance'));
    await page.reload();
    await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  }

  // ── 스타일 예시 영상 ──
  if (!only || only === 'demo') {
    await page.evaluate(() => window.__wvm.demoPause());
    for (const th of THEME_LIST) {
      await page.click(`label.theme-card:has(input[value="${th}"])`);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__wvm.demoPause());
      const info = await page.evaluate(() => window.__wvm.demoInfo());
      const cues = info.cues;
      for (let i = 0; i < cues.length; i++) {
        const end = i + 1 < cues.length ? cues[i + 1].start : info.duration;
        // 장면 가운데와 (다음 장면으로 넘어가는) 전환 중간
        for (const [tag, t] of [
          ['mid', (cues[i].start + end) / 2 + 0.3],
          ['tr', end - 0.1],
        ]) {
          if (tag === 'tr' && i === cues.length - 1) continue;
          await page.evaluate((t) => window.__wvm.demoSeek(t), t);
          await saveCanvas(page, '#style-demo', `demo-${th}-${i}-${tag}.png`);
        }
      }
    }
  }

  // ── 실제 사진으로 모든 배치·전환 ──
  if (!only || only === 'video') {
    await page.setInputFiles('#file-input', specs.map((s) => path.join(fixDir, s.file)));
    await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''));
    await page.fill('#f-groom', '김민준');
    await page.fill('#f-bride', '이서연');
    await page.fill('#f-date', '2026-10-24');
    await page.fill('#f-time', '13:30');
    await page.fill('#f-venue', '더채플 청담 3층 그랜드홀');
    if (withCaptions) {
      await page.fill('#f-quotes', '함께 걸어온 길\n그리고 오늘');
      await page.evaluate((caps) => window.__wvm.setCaptions((i) => caps[i % caps.length]), CAPTIONS);
      await page.waitForTimeout(900);
    }
    const suffix = withCaptions ? '-cap' : '';
    const seek = async (t) => {
      await page.evaluate((t) => {
        const s = document.querySelector('#seek');
        s.value = String(t);
        s.dispatchEvent(new Event('input', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }, t);
      await page.waitForTimeout(700);
    };
    for (const entry of THEME_LIST) {
      // 'camcorder:digicam'처럼 쓰면 그 양식까지 골라서 캡처 (파일 이름에는 camcorder-digicam)
      const [thId, variant] = entry.split(':');
      const th = variant ? `${thId}-${variant}` : thId;
      await page.click(`label.theme-card:has(input[value="${thId}"])`);
      await page.waitForTimeout(1200);
      if (variant) {
        await page.click(`label.variant-card:has(input[value="${variant}"])`);
        await page.waitForTimeout(1200);
      }
      const tl = await page.evaluate(() => window.__wvm.timeline());
      const summary = await page.textContent('#timeline-summary');
      console.log(`[${th}] ${summary}`);
      const layouts = tl.segments.filter((s) => s.kind === 'photo').map((s) => s.layout);
      const trs = tl.segments.slice(1).map((s) => s.transitionIn.type);
      console.log(`  배치: ${JSON.stringify(Object.fromEntries([...new Set(layouts)].map((l) => [l, layouts.filter((x) => x === l).length])))}`);
      console.log(`  전환: ${JSON.stringify(Object.fromEntries([...new Set(trs)].map((l) => [l, trs.filter((x) => x === l).length])))}`);
      const seenLayout = new Set();
      const seenTr = new Set();
      for (const seg of tl.segments) {
        if (seg.kind !== 'photo') continue;
        const tin = seg.transitionIn.duration;
        const key = seg.layout + (seg.year ? '-year' : '');
        if (!seenLayout.has(key)) {
          seenLayout.add(key);
          await seek(seg.start + tin + (seg.year ? 1.4 : 1.9));
          await saveCanvas(page, '#preview', `video-${th}-L-${key}${suffix}.png`);
        }
        const tr = seg.transitionIn.type;
        if (!seenTr.has(tr) && seg.index > 0 && !withCaptions) {
          seenTr.add(tr);
          await seek(seg.start + tin * 0.5);
          await saveCanvas(page, '#preview', `video-${th}-T-${tr}.png`);
        }
      }
    }
  }

  // ── 휴대폰 화면 (390px) ──
  if (!only || only === 'mobile') {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const m = await ctx.newPage();
    m.on('pageerror', (e) => errors.push(String(e)));
    m.on('console', (msg) => msg.type() === 'error' && errors.push(`[mobile] ${msg.text()}`));
    await m.goto(`${server.resolvedUrls.local[0]}?e2e`);
    await m.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
    await m.waitForTimeout(1200);
    const coarse = await m.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches);
    console.log('mobile coarse pointer:', coarse);
    await m.screenshot({ path: out('mobile-top.png') });
    await m.locator('#style-stage').scrollIntoViewIfNeeded();
    await m.waitForTimeout(800);
    await m.screenshot({ path: out('mobile-style.png') });
    await m.locator('#theme-list').scrollIntoViewIfNeeded();
    await m.waitForTimeout(300);
    await m.screenshot({ path: out('mobile-cards.png') });
    // '왜 직접': 항목마다 글 위의 그림
    const arts = await m.locator('.why-art').count();
    for (let i = 0; i < arts; i++) {
      await m.locator('.why-art').nth(i).scrollIntoViewIfNeeded();
      await m.evaluate(() => window.scrollBy(0, -80));
      await m.waitForTimeout(i === 1 ? 3600 : 2600);
      await m.screenshot({ path: out(`mobile-why-${i + 1}.png`) });
    }
    for (const [sel, name] of [['table.cmp', 'compare'], ['#ring-scene', 'ring'], ['#how', 'how']]) {
      await m.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
      await m.waitForTimeout(1600);
      await m.screenshot({ path: out(`mobile-${name}.png`) });
    }
    // 쇼케이스: 옆으로 밀면 돌아가기만 하고, 앞에 온 다른 카드를 탭하면 그 스타일이 선택됨
    const cdp = await ctx.newCDPSession(m);
    const frontTheme = () => m.$eval('#ring .ring-card.front', (c) => c.dataset.theme);
    const before = await m.evaluate(() => window.__wvm.theme().id);
    await m.evaluate(() => document.querySelector('#ring-scene')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await m.waitForTimeout(600);
    const sb = await m.locator('#ring-scene').boundingBox();
    const sy = sb.y + sb.height / 2;
    const sx = sb.x + sb.width * 0.75;
    const f0 = await frontTheme();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 16, y: sy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await m.waitForTimeout(1500);
    const f1 = await frontTheme();
    const afterSwipe = await m.evaluate(() => window.__wvm.theme().id);
    console.log(`mobile ring swipe: front ${f0} → ${f1}, theme ${before} → ${afterSwipe} (${f1 !== f0 && afterSwipe === before ? 'OK' : 'FAIL'})`);
    const ringThemes = await m.$$eval('#ring .ring-card', (els) => els.map((e) => e.dataset.theme));
    const fi = ringThemes.indexOf(f1);
    const target = [3, 4, 5, 6].map((d) => ringThemes[(fi + d) % ringThemes.length]).find((id) => id !== before);
    const targetBtn = m.locator(`#ring .ring-card[data-theme="${target}"] button`);
    await targetBtn.focus();
    await m.waitForTimeout(1300);
    const f2 = await frontTheme();
    await targetBtn.tap({ force: true });
    await m.waitForTimeout(900);
    const picked = await m.evaluate(() => window.__wvm.theme().id);
    console.log(`mobile ring tap: front ${f2}, theme ${before} → ${picked} (${f2 === target && picked === target ? 'OK' : 'FAIL'})`);
    await cdp.detach();
    // 스튜디오: 사진 올리기 → 목록 → 사진을 누르면 편집 창
    await m.setInputFiles('#file-input', specs.slice(0, 14).map((s) => path.join(fixDir, s.file)));
    await m.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''));
    await m.locator('#photo-grid').scrollIntoViewIfNeeded();
    await m.waitForTimeout(500);
    await m.screenshot({ path: out('mobile-studio-grid.png') });
    await m.locator('#photo-grid li.photo:nth-child(2) .open').tap();
    await m.waitForTimeout(600);
    await m.screenshot({ path: out('mobile-editor.png') });
    await m.locator('#pe-caption').tap();
    await m.keyboard.type('2019 봄, 제주');
    await m.waitForTimeout(300);
    await m.screenshot({ path: out('mobile-editor-typed.png') });
    await m.locator('#pe-close').tap();
    await m.waitForTimeout(500);
    await m.screenshot({ path: out('mobile-studio-grid-cap.png') });
    // 떠 있는 미리보기 버튼 → 미리보기 창
    await m.locator('#h-text').scrollIntoViewIfNeeded();
    await m.waitForTimeout(700);
    console.log('mobile fab visible:', await m.locator('#preview-fab').isVisible());
    await m.screenshot({ path: out('mobile-fab.png') });
    if (await m.locator('#preview-fab').isVisible()) {
      await m.locator('#preview-fab').tap();
      await m.waitForTimeout(900);
      await m.screenshot({ path: out('mobile-preview-sheet.png') });
      await m.locator('#ps-close').tap();
      await m.waitForTimeout(400);
      console.log('preview returned home:', await m.evaluate(() => document.querySelector('#preview-home')?.contains(document.querySelector('#preview'))));
    }
    await m.locator('.footer-credit').scrollIntoViewIfNeeded();
    await m.waitForTimeout(1600);
    await m.screenshot({ path: out('mobile-footer.png') });
    // 가로 스크롤이 생기는 요소 (화면 밖으로 넘치는 것)
    const overflow = await m.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || getComputedStyle(el).position === 'fixed') return false;
          if (el.closest('.marquee, .ring-scene, .skip-link, dialog')) return false;
          return r.right > vw + 1 || r.left < -1;
        })
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} ${Math.round(el.getBoundingClientRect().right)}`);
      return { scrollWidth: document.documentElement.scrollWidth, vw, wide };
    });
    console.log('mobile overflow:', JSON.stringify(overflow));
    await ctx.close();
  }
  console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
