// E2E: 스타일·꾸미기를 고를 때 스크롤하지 않아도 미리보기가 바로 보이는지 (PC 오른쪽 고정, 휴대폰 위쪽 고정),
// 꾸미기(글씨체·색감·효과·전환)가 적용되고 예시 영상이 그 장면으로 이동하는지, 예시 문구 칩이 입력되는지 확인.
// 실행: npm run e2e:live   (E2E_SKIP_BUILD=1 이면 기존 dist 사용) → e2e/out/live-*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { fixtureSpecs, generateFixtures } from './fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'out');
const fixDir = path.join(root, 'e2e', 'fixtures');
const out = (n) => path.join(outDir, n);
fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

if (!process.env.E2E_SKIP_BUILD) await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 4177, strictPort: false }, logLevel: 'warn' });
const url = `${server.resolvedUrls.local[0]}?e2e`;
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome', headless: true });
const errors = [];
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`[${tag}] ${e}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] ${m.text()}`));
};

/** 요소가 지금 화면 안에 (가려진 부분 없이) 보이는지 */
const inViewport = (p, sel) =>
  p.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    return { ok: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  });
/** 예시 영상 캔버스의 평균 색 (바뀌었는지 비교용) */
const demoPixels = (p) =>
  p.$eval('#style-demo', (c) => {
    const g = document.createElement('canvas');
    g.width = 96;
    g.height = 54;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 96, 54);
    return Array.from(x.getImageData(0, 0, 96, 54).data.filter((_, i) => i % 4 !== 3));
  });
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const saveCanvas = async (p, sel, name) => {
  const data = await p.$eval(sel, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(out(name), Buffer.from(data.split(',')[1], 'base64'));
};

try {
  // ───────────── PC (1440×900) ─────────────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, 'pc');
  await page.goto(url);
  if (!fs.existsSync(path.join(fixDir, fixtureSpecs()[0].file))) await generateFixtures(page, fixDir);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  // 스타일 카드 목록 맨 아래까지 내려가도 미리보기가 오른쪽에 그대로 보임
  await page.evaluate(() => document.querySelector('#theme-list .theme-card:last-child')?.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.waitForTimeout(500);
  const st1 = await inViewport(page, '#style-stage');
  check('PC: 스타일 목록 아래쪽에서도 예시 영상이 화면 안에', st1.ok, JSON.stringify(st1));
  const beforePix = await demoPixels(page);
  await page.click('label.theme-card:has(input[value="lovely"])');
  await page.waitForTimeout(700);
  const name = ((await page.textContent('#style-demo-name')) ?? '').trim();
  const afterPix = await demoPixels(page);
  const st2 = await inViewport(page, '#style-stage');
  check('PC: 러블리를 고르면 스크롤 없이 바로 예시가 바뀜', name.startsWith('러블리') && diff(beforePix, afterPix) > 3 && st2.ok, `${name}, 차이 ${diff(beforePix, afterPix).toFixed(1)}`);
  const toast = ((await page.textContent('#apply-toast')) ?? '').trim();
  check('PC: 적용 안내 표시', toast.includes('러블리'), toast);
  await page.screenshot({ path: out('live-pc-lovely.png') });

  // 꾸미기 (카드 아래쪽 탭까지 내려가도 미리보기가 보임)
  await page.evaluate(() => document.querySelector('#custom-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.click('#czt-font');
  await page.click('#fr-name');
  await page.click('button.font-chip[data-key="fontName"][data-value="Gaegu"]');
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__wvm.theme());
  const info = await page.evaluate(() => window.__wvm.demoInfo());
  const dt = await page.evaluate(() => window.__wvm.demoTime());
  check('글씨체(제목·이름) 적용', t1.fonts.name === 'Gaegu' && t1.custom.fontName === 'Gaegu', t1.fonts.name);
  check('글씨체를 고르면 예시가 오프닝(이름) 장면으로 바로 이동', Math.abs(dt - info.marks.intro) < 0.8, `${dt.toFixed(2)}초 (오프닝 ${info.marks.intro})`);
  const st3 = await inViewport(page, '#style-stage');
  check('PC: 꾸미기 카드에서도 예시 영상이 화면 안에', st3.ok, JSON.stringify(st3));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out('live-pc-font.png') });
  await page.click('#fr-title');
  await page.click('button.font-chip[data-key="fontTitle"][data-value="Pacifico"]');
  await page.click('#czt-color');
  await page.click('button.chip[data-key="filter"][data-value="golden"]');
  await page.click('button.swatch[data-key="accent"][data-value="#ff5fa2"]');
  await page.click('#czt-effect');
  await page.click('#particle-options button[data-value="butterflies"]');
  await page.click('button.chip[data-key="frame"][data-value="flowers"]');
  await page.click('#czt-motion');
  await page.click('button.chip[data-key="transition"][data-value="clock"]');
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => window.__wvm.theme());
  check(
    '꾸미기 적용 (영문 제목 글꼴·필터·포인트 색·나비·꽃 코너·시계 전환)',
    t2.fonts.title === 'Pacifico' && t2.custom.filter === 'golden' && t2.custom.accent === '#ff5fa2' && t2.particle === 'butterflies' && t2.custom.frame === 'flowers' && t2.custom.transition === 'clock',
    JSON.stringify(t2.custom),
  );
  const cues = (await page.evaluate(() => window.__wvm.demoInfo())).cues.map((c) => c.label);
  check('전환을 고르면 예시 영상 전환이 바뀜', cues.filter((c) => c.startsWith('시계 방향')).length >= 3, cues.join(' / '));
  const count = ((await page.textContent('#cz-count')) ?? '').trim();
  check('꾸민 항목 수 표시', /7개/.test(count), count);
  await page.waitForTimeout(900);
  await page.screenshot({ path: out('live-pc-custom.png') });
  // 새로고침해도 유지
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  const t3 = await page.evaluate(() => window.__wvm.theme());
  check('꾸미기가 새로고침 뒤에도 유지', t3.id === 'lovely' && t3.custom.fontName === 'Gaegu' && t3.custom.transition === 'clock', JSON.stringify(t3.custom));
  await page.click('#cz-reset');
  const t4 = await page.evaluate(() => window.__wvm.theme());
  check('모두 스타일 기본으로 되돌리기', Object.keys(t4.custom).length === 0 && (await page.locator('#cz-reset').isHidden()), JSON.stringify(t4.custom));

  // 예시 문구 칩
  await page.evaluate(() => document.querySelector('#text-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const chip = page.locator('#sg-intro-title .sg-chip').first();
  const chipText = (await chip.getAttribute('title')) ?? '';
  await chip.click();
  check('예시 칩을 누르면 오프닝 제목에 들어감', (await page.inputValue('#f-intro-title')) === chipText && (await chip.getAttribute('aria-pressed')) === 'true', chipText);
  const firstBefore = await page.locator('#sg-intro-title .sg-chip').first().textContent();
  await page.click('#sg-intro-title .sg-more');
  const firstAfter = await page.locator('#sg-intro-title .sg-chip').first().textContent();
  check("'다른 예시'로 다른 문구", firstBefore !== firstAfter, `${firstBefore} → ${firstAfter}`);
  await page.click('#sg-quotes .sg-more:has-text("한 번에")');
  const quotes = (await page.inputValue('#f-quotes')).split('\n').filter(Boolean);
  check('중간 문구 예시 한 번에 넣기', quotes.length === 4, quotes.join(' / '));
  await page.waitForTimeout(700);
  const cueLabels = (await page.evaluate(() => window.__wvm.demoInfo())).cues.map((c) => c.label);
  check('중간 문구를 넣으면 예시 영상에 문구 장면이 생김', cueLabels.some((c) => c.includes('영상 중간 문구')), cueLabels.join(' / '));
  await page.locator('#sg-outro-message .sg-chip').first().click();
  check('엔딩 인사말 예시', ((await page.inputValue('#f-outro-message')) ?? '').includes('\n'));
  await page.locator('#sg-outro-title .sg-chip').nth(1).click();
  check('엔딩 제목 예시', (await page.inputValue('#f-outro-title')).length > 0, await page.inputValue('#f-outro-title'));
  const st4 = await inViewport(page, '#style-stage');
  check('PC: 문구 칸에서도 예시 영상이 화면 안에', st4.ok, JSON.stringify(st4));
  await page.screenshot({ path: out('live-pc-text.png') });

  // 사진을 올리면 '내 영상' 탭으로 바뀌고 꾸미기가 내 영상에도 적용
  const specs = fixtureSpecs();
  await page.setInputFiles('#file-input', specs.slice(0, 16).map((s) => path.join(fixDir, s.file)));
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''), null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check("사진을 올리면 미리보기가 '내 영상'으로", (await page.evaluate(() => window.__wvm.liveTab())) === 'mine' && (await page.locator('#preview').isVisible()));
  await page.evaluate(() => document.querySelector('#custom-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.click('#czt-color');
  await page.click('button.chip[data-key="filter"][data-value="mono"]');
  await page.waitForTimeout(800);
  const gray = await page.$eval('#preview', (c) => {
    const g = document.createElement('canvas');
    g.width = 64;
    g.height = 36;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    return s / (d.length / 4);
  });
  const pv = await inViewport(page, '#preview');
  check('흑백 필터가 내 영상 미리보기에 바로 적용 (화면 안)', gray < 6 && pv.ok, `채도 ${gray.toFixed(1)}, ${JSON.stringify(pv)}`);
  await page.screenshot({ path: out('live-pc-mine.png') });
  await page.click('#cz-reset');
  await page.close();

  // ───────────── 휴대폰 (390×844) ─────────────
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await ctx.newPage();
  watch(m, 'mobile');
  await m.goto(url);
  await m.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  await m.evaluate(() => document.querySelector('#theme-list .theme-card:nth-child(9)')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await m.waitForTimeout(600);
  const ms1 = await inViewport(m, '#style-stage');
  check('휴대폰: 스타일 목록 중간에서도 예시 영상이 위쪽에 보임', ms1.ok && ms1.top < 200, JSON.stringify(ms1));
  const stageBox = await m.locator('#live-mobile .live-box').boundingBox();
  const room = 844 - (stageBox.y + stageBox.height);
  check('휴대폰: 미리보기 아래로 고를 자리가 화면 절반 이상 남음', room >= 844 * 0.5, `미리보기 끝 ${Math.round(stageBox.y + stageBox.height)}px, 남은 자리 ${Math.round(room)}px`);
  // 미리보기 바로 아래에 보이는 카드를 누름
  await m.evaluate((y) => {
    const card = document.querySelector('label.theme-card:has(input[value="traditional"])');
    window.scrollBy(0, card.getBoundingClientRect().top - y - 12);
  }, stageBox.y + stageBox.height);
  await m.waitForTimeout(300);
  const cardBox = await m.locator('label.theme-card:has(input[value="traditional"])').boundingBox();
  const liveBottom = await m.$eval('#live-mobile .live-box', (el) => el.getBoundingClientRect().bottom);
  check('휴대폰: 고르는 카드가 미리보기에 가리지 않고 보임', cardBox.y >= liveBottom - 1 && cardBox.y + cardBox.height <= 844, `카드 ${Math.round(cardBox.y)}~${Math.round(cardBox.y + cardBox.height)}, 미리보기 끝 ${Math.round(liveBottom)}`);
  await m.locator('label.theme-card:has(input[value="traditional"])').tap();
  await m.waitForTimeout(700);
  const mname = ((await m.textContent('#style-demo-name')) ?? '').trim();
  check('휴대폰: 카드를 누르면 위쪽 예시가 바로 바뀜', mname.startsWith('전통 혼례') && (await inViewport(m, '#style-stage')).ok, mname);
  await m.screenshot({ path: out('live-mobile-style.png') });
  await m.evaluate(() => document.querySelector('#czp-opening')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await m.waitForTimeout(400);
  await m.locator('#title-options button[data-value="storybook"]').tap();
  await m.waitForTimeout(600);
  const ms2 = await inViewport(m, '#style-stage');
  const mt = await m.evaluate(() => window.__wvm.theme());
  check('휴대폰: 오프닝 디자인을 고르면 위쪽에서 바로 확인', mt.title === 'storybook' && ms2.ok, JSON.stringify(ms2));
  await m.screenshot({ path: out('live-mobile-opening.png') });
  await m.locator('#live-collapse').tap();
  const collapsedH = (await m.locator('#live-mobile .live-box').boundingBox())?.height ?? 999;
  check('휴대폰: 미리보기 작게 접기', collapsedH < 80, `${Math.round(collapsedH)}px`);
  await m.locator('#live-collapse').tap();
  // 음악 카드처럼 미리보기 자리 밖으로 가면 붙어 있지 않음
  await m.evaluate(() => document.querySelector('#h-music')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await m.waitForTimeout(500);
  const away = await m.$eval('#style-stage', (el) => el.getBoundingClientRect().bottom);
  check('휴대폰: 음악 카드에서는 미리보기가 따라오지 않음 (메뉴 뒤로 올라감)', away < 80, `${Math.round(away)}`);
  await m.evaluate(() => document.querySelector('#text-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await m.waitForTimeout(400);
  await m.screenshot({ path: out('live-mobile-text.png') });
  // 가로 스크롤 없음
  const sw = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('휴대폰: 가로로 넘치는 화면 없음', sw[0] <= sw[1], sw.join(' / '));
  await ctx.close();

  check('콘솔 오류 없음', errors.length === 0, errors.slice(0, 4).join(' | '));
} catch (e) {
  check('live 실행', false, e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
fs.writeFileSync(out('live-report.json'), JSON.stringify(checks, null, 2));
process.exit(failed.length ? 1 : 0);
