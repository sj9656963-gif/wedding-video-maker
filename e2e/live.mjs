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
/** 세부 설정(양식·꾸미기)이 열려 있는지, 그 카드가 있는 줄 바로 아래인지 */
const detailAt = (p, id) =>
  p.evaluate((id) => {
    const card = document.querySelector(`label.theme-card:has(input[value="${id}"])`);
    const cr = card.getBoundingClientRect();
    const d = document.querySelector('#style-detail');
    const r = d.getBoundingClientRect();
    return {
      open: !d.hidden && window.__wvm.detailOpen(),
      gap: Math.round(r.top - cr.bottom),
      top: Math.round(r.top),
      cardTop: Math.round(cr.top),
      cardBottom: Math.round(cr.bottom),
      vh: window.innerHeight,
      name: document.querySelector('#sd-name').textContent,
      cardName: card.querySelector('strong').textContent,
      theme: window.__wvm.theme().id,
    };
  }, id);
const saveCanvas = async (p, sel, name) => {
  const data = await p.$eval(sel, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(out(name), Buffer.from(data.split(',')[1], 'base64'));
};
/** 만들기 단계 열기 (PC는 위쪽, 휴대폰은 아래쪽 단계 표시줄) */
const go = async (p, step) => {
  await p.click(`#fb-${step}`);
  await p.waitForTimeout(250);
};
/** 세부 설정 머리줄(위에 붙음)과 그 아래 내용의 시작 */
const headAndBody = (p) =>
  p.evaluate(() => {
    const head = document.querySelector('.sd-head').getBoundingClientRect();
    const body = document.querySelector('#custom-card').getBoundingClientRect();
    return { headTop: Math.round(head.top), headBottom: Math.round(head.bottom), bodyTop: Math.round(body.top) };
  });

try {
  // ───────────── PC (1440×900) ─────────────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, 'pc');
  await page.goto(url);
  if (!fs.existsSync(path.join(fixDir, fixtureSpecs()[0].file))) await generateFixtures(page, fixDir);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  // 처음엔 1단계(사진)만 이 자리에 있고, 단계 표시줄로 바로 다른 단계를 엶
  const startStep = await page.evaluate(() => ({
    step: window.__wvm.step(),
    visible: [...document.querySelectorAll('.step')].filter((s) => !s.hidden).map((s) => s.dataset.step),
  }));
  check('처음엔 사진 단계만 보임', startStep.step === 'photos' && startStep.visible.join() === 'photos', JSON.stringify(startStep));
  await page.evaluate(() => document.querySelector('#steps').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'instant' }));
  const barBefore = (await page.locator('#flow-bar').boundingBox()).y;
  await page.click('#fb-next');
  await page.waitForTimeout(300);
  const inPlace = await page.evaluate(() => {
    const bar = document.querySelector('#flow-bar').getBoundingClientRect();
    const h = document.querySelector('#h-style').getBoundingClientRect();
    return { step: window.__wvm.step(), barTop: Math.round(bar.top), barBottom: Math.round(bar.bottom), headingTop: Math.round(h.top) };
  });
  check(
    "PC: '다음'을 누르면 다음 단계가 그 자리에 (단계 표시줄 바로 아래부터)",
    inPlace.step === 'style' && Math.abs(inPlace.barTop - barBefore) <= 2 && inPlace.headingTop >= inPlace.barBottom && inPlace.headingTop <= inPlace.barBottom + 60,
    JSON.stringify(inPlace),
  );
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

  // 고른 카드 바로 아래에 세부 설정(양식·꾸미기)이 열림 → 다른 줄의 카드를 누르면 그 줄 아래로 따라감
  await page.waitForTimeout(700);
  const d1 = await detailAt(page, 'lovely');
  check(
    'PC: 카드를 누르면 그 줄 바로 아래에 세부 설정 (화면 안)',
    d1.open && d1.gap >= 0 && d1.gap <= 40 && d1.top < d1.vh - 150 && d1.cardTop >= 60 && d1.name === '러블리',
    JSON.stringify(d1),
  );
  await page.click('label.theme-card:has(input[value="gallery"])');
  await page.waitForTimeout(900);
  const d2 = await detailAt(page, 'gallery');
  check('PC: 다른 줄의 카드를 누르면 세부 설정이 그 카드 아래로', d2.open && d2.gap >= 0 && d2.gap <= 40 && d2.top < d2.vh - 150 && d2.name === d2.cardName, JSON.stringify(d2));
  const nextBefore = (await page.locator('#style-detail').boundingBox()).y;
  await page.click('#sd-next');
  await page.waitForTimeout(500);
  const d3 = await detailAt(page, 'classic');
  const nextAfter = (await page.locator('#style-detail').boundingBox()).y;
  check(
    "PC: '다음 스타일'은 세부 설정 자리를 그대로 두고 스타일만 바꿈",
    d3.theme === 'classic' && d3.name === '클래식' && d3.gap >= 0 && d3.gap <= 40 && Math.abs(nextAfter - nextBefore) <= 3,
    `${d2.theme} → ${d3.theme}, 위치 ${Math.round(nextBefore)} → ${Math.round(nextAfter)}`,
  );
  await page.click('#sd-prev');
  await page.waitForTimeout(400);
  const back1 = await page.evaluate(() => window.__wvm.theme().id);
  check("PC: '이전 스타일'로 되돌아감", back1 === 'gallery', back1);
  await page.click('label.theme-card:has(input[value="gallery"])');
  await page.waitForTimeout(300);
  const closed = !(await page.evaluate(() => window.__wvm.detailOpen())) && (await page.locator('#style-detail').isHidden());
  await page.click('label.theme-card:has(input[value="gallery"])');
  await page.waitForTimeout(300);
  check('PC: 고른 카드를 다시 누르면 세부 설정 접기·펴기', closed && (await page.evaluate(() => window.__wvm.detailOpen())));
  await page.screenshot({ path: out('live-pc-detail.png') });
  await page.click('label.theme-card:has(input[value="lovely"])');
  await page.waitForTimeout(700);

  // 꾸미기 (카드 아래쪽 탭까지 내려가도 미리보기가 보임). 긴 탭(글씨체)을 보며 내려가도 머리줄은 위에 붙어 있음
  await page.click('#czt-font');
  await page.evaluate(() => document.querySelector('#custom-card')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const head = await page.$eval('.sd-head', (el) => {
    const r = el.getBoundingClientRect();
    const bar = document.querySelector('#flow-bar').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width - 30, r.top + 20);
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), barBottom: Math.round(bar.bottom), onTop: !!hit && el.contains(hit) };
  });
  check(
    "PC: 꾸미기를 보다가도 '이전·다음 스타일·접기'와 항목 탭이 단계 표시줄 바로 아래에 붙어 있음",
    head.top >= head.barBottom && head.top <= head.barBottom + 14 && head.onTop,
    JSON.stringify(head),
  );
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
  // 새로 열면 카드 목록이 다 보이게 접혀 있고, 고른 카드를 누르면 바로 아래에 열림
  const closedAtStart = !(await page.evaluate(() => window.__wvm.detailOpen()));
  await go(page, 'style');
  await page.click('label.theme-card:has(input[value="lovely"])');
  await page.waitForTimeout(500);
  const d4 = await detailAt(page, 'lovely');
  check('새로 열면 접혀 있다가, 고른 카드를 누르면 그 아래에 열림', closedAtStart && d4.open && d4.gap >= 0 && d4.gap <= 40, JSON.stringify(d4));
  await page.click('#cz-reset');
  const t4 = await page.evaluate(() => window.__wvm.theme());
  check('모두 스타일 기본으로 되돌리기', Object.keys(t4.custom).length === 0 && (await page.locator('#cz-reset').isHidden()), JSON.stringify(t4.custom));

  // 오프닝 디자인을 고른 그 자리에서 문구까지 (스크롤 없이), 3단계 문구 칸과 서로 연동
  const tabBefore = await page.evaluate(() => window.__wvm.czPanel());
  await page.click('#czt-opening');
  await page.waitForTimeout(300);
  const tabAlign = await headAndBody(page);
  await page.click('#title-options button[data-value="arch"]');
  await page.waitForTimeout(500);
  const fiView = await inViewport(page, '#fi-groom');
  const fiDate = await inViewport(page, '#fi-date');
  check(
    'PC: 세부 설정을 새로 열면 양식부터, 오프닝 탭을 누르면 디자인 바로 아래에 이름·날짜 칸이 화면 안에',
    tabBefore === 'variant' && (await page.evaluate(() => window.__wvm.theme().title)) === 'arch' && fiView.ok && fiDate.ok,
    `${tabBefore}, ${JSON.stringify(tabAlign)}, 이름 ${JSON.stringify(fiView)}, 날짜 ${JSON.stringify(fiDate)}`,
  );
  await page.fill('#fi-groom', '박지훈');
  await page.fill('#fi-intro-title', 'Our Day');
  await page.waitForTimeout(700);
  const demoAt = await page.evaluate(() => window.__wvm.demoTime());
  const marks = (await page.evaluate(() => window.__wvm.demoInfo())).marks;
  check(
    '오프닝 탭에서 쓴 문구가 3단계 칸에도 그대로 · 예시 영상은 오프닝 장면',
    (await page.inputValue('#f-groom')) === '박지훈' && (await page.inputValue('#f-intro-title')) === 'Our Day' && Math.abs(demoAt - marks.intro) < 1.2,
    `${await page.inputValue('#f-groom')}, ${demoAt.toFixed(2)}초 (오프닝 ${marks.intro})`,
  );
  await page.screenshot({ path: out('live-pc-opening-text.png') });
  await page.click('#ct-outro');
  await page.waitForTimeout(400);
  const outroAt = await page.evaluate(() => window.__wvm.demoTime());
  check("'엔딩'으로 바꾸면 엔딩 문구 칸 · 예시 영상은 엔딩 장면", (await page.isVisible('#fi-outro-message')) && Math.abs(outroAt - marks.outro) < 1.2, `${outroAt.toFixed(2)}초 (엔딩 ${marks.outro})`);
  await page.click('#ct-intro');
  // 아래쪽 '다음 항목'으로 탭을 차례로: 새 탭 내용은 위에 붙은 머리줄 바로 아래부터
  await page.locator('#sd-tab-next').scrollIntoViewIfNeeded();
  await page.click('#sd-tab-next');
  await page.waitForTimeout(300);
  const nextTab = await headAndBody(page);
  const nowTab = await page.evaluate(() => window.__wvm.czPanel());
  check("'다음 항목'은 다음 탭을 그 자리에 (머리줄 바로 아래부터)", nowTab === 'font' && Math.abs(nextTab.bodyTop - nextTab.headBottom) <= 3, `${nowTab} ${JSON.stringify(nextTab)}`);
  // 되돌리기: 방금 바꾼 꾸미기 → 스타일 순서로 하나씩
  await page.click('#czt-color');
  await page.click('button.chip[data-key="filter"][data-value="golden"]');
  const themeNow = await page.evaluate(() => window.__wvm.theme().id);
  await page.click('#sd-next');
  await page.waitForTimeout(400);
  const themeNext = await page.evaluate(() => window.__wvm.theme().id);
  await page.click('#sd-undo');
  await page.waitForTimeout(300);
  const u1 = await page.evaluate(() => window.__wvm.theme());
  await page.click('#sd-undo');
  await page.waitForTimeout(300);
  const u2 = await page.evaluate(() => window.__wvm.theme());
  check(
    "'되돌리기'로 방금 바꾼 스타일 → 꾸미기 순서로 취소",
    themeNext !== themeNow && u1.id === themeNow && u1.custom.filter === 'golden' && u2.id === themeNow && !u2.custom.filter && (await page.evaluate(() => window.__wvm.detailOpen())),
    `${themeNow} → ${themeNext} → ${u1.id}(${u1.custom.filter}) → ${u2.id}(${u2.custom.filter ?? '-'})`,
  );
  // 마지막 탭의 '다 골랐어요 · 다음: 문구 입력' → 3단계가 그 자리에
  await page.click('#czt-motion');
  await page.locator('#sd-tab-next').scrollIntoViewIfNeeded();
  const finishLabel = ((await page.textContent('#sd-tab-next')) ?? '').trim();
  await page.click('#sd-tab-next');
  await page.waitForTimeout(300);
  const fin = await page.evaluate(() => ({ step: window.__wvm.step(), top: Math.round(document.querySelector('#h-text').getBoundingClientRect().top) }));
  check("마지막 탭에서 '다 골랐어요 · 다음: 문구 입력' → 문구 단계", fin.step === 'text' && fin.top > 60 && fin.top < 400 && finishLabel.includes('문구 입력'), `${finishLabel} → ${JSON.stringify(fin)}`);
  await page.fill('#f-bride', '최유나');
  await go(page, 'style');
  const backInPanel = await page.evaluate(() => ({ open: window.__wvm.detailOpen(), bride: document.querySelector('#fi-bride').value }));
  check('3단계에서 쓴 이름이 오프닝 탭 칸에도 · 스타일 단계로 돌아오면 세부 설정 그대로', backInPanel.open && backInPanel.bride === '최유나', JSON.stringify(backInPanel));

  // 예시 문구 칩 (3단계)
  await go(page, 'text');
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
  await go(page, 'style');
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
  // 맨 아래 '다 골랐어요 · 접기': 접히고 고른 카드가 화면에 보임
  await page.locator('#sd-done').scrollIntoViewIfNeeded();
  await page.click('#sd-done');
  await page.waitForTimeout(400);
  const done = await page.evaluate(() => {
    const r = document.querySelector('label.theme-card:has(input:checked)').getBoundingClientRect();
    return { open: window.__wvm.detailOpen(), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  check("PC: '다 골랐어요'를 누르면 접히고 고른 카드가 화면 안에", !done.open && done.top >= 60 && done.bottom <= done.vh, JSON.stringify(done));
  // 5단계: 고른 내용 한눈에 → '바꾸기'를 누르면 그 단계가 그 자리에
  await go(page, 'export');
  const rv = await page.$$eval('#review li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  await page.click('#review button[data-go="text"]');
  await page.waitForTimeout(300);
  const rvStep = await page.evaluate(() => window.__wvm.step());
  check(
    "만들기 단계: 고른 내용 4줄 · '바꾸기'로 그 단계로",
    rv.length === 4 && rv[0].includes('16장') && rv[2].includes('박지훈 ♥ 최유나') && rvStep === 'text',
    `${rv.join(' / ')} → ${rvStep}`,
  );
  await page.close();

  // ───────────── AI 자동 추천 (PC, 처음부터) ─────────────
  const ap = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(ap, 'ai');
  await ap.goto(url);
  await ap.evaluate(() => localStorage.clear());
  await ap.reload();
  await ap.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  await ap.evaluate(() => document.querySelector('#steps').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await ap.click('#fb-style');
  // 직접 하나 바꿔 둔 뒤 AI 추천 → '원래대로'로 돌아오는지
  await ap.click('label.theme-card:has(input[value="cinema"])');
  await ap.waitForTimeout(400);
  const introBox = await ap.evaluate(() => ({ ai: window.__wvm.ai(), btn: !!document.querySelector('#ai-go'), applied: document.querySelector('#ai-box').classList.contains('applied') }));
  await ap.click('#ai-go');
  await ap.waitForTimeout(1200);
  const a1 = await ap.evaluate(() => {
    const t = window.__wvm.theme();
    const rows = [...document.querySelectorAll('#ai-box [data-ai-row]')].map((li) => li.getAttribute('data-ai-row'));
    const pill = document.querySelector('label.theme-card:has(input[value="classic"]) .ai-pill');
    return {
      ai: window.__wvm.ai(),
      theme: `${t.id}/${t.variant}`,
      custom: t.custom,
      rows,
      status: document.querySelector('#ai-box .ai-status')?.textContent ?? '',
      title: document.querySelector('#ai-title')?.textContent ?? '',
      poster: (document.querySelector('#ai-box .ai-poster')?.getAttribute('src') ?? '').slice(0, 20),
      pill: !!pill && !pill.hidden,
    };
  });
  check(
    'AI 자동 추천: 버튼 한 번에 가장 무난한 조합 (클래식 · 아이보리 골드, 꽃잎 조금)',
    !introBox.ai && introBox.btn && !introBox.applied && a1.ai?.preset === 'classic-ivory' && a1.theme === 'classic/ivory' && a1.custom.particle === 'petals' && a1.custom.amount === 'low' && a1.ai.match,
    JSON.stringify({ theme: a1.theme, custom: a1.custom, ai: a1.ai }),
  );
  check(
    'AI가 고른 세부 정보가 한눈에 (스타일·오프닝·글씨체·색감·효과·전환·음악·길이 + 그림 + AI 추천 표시)',
    a1.rows.join() === 'style,opening,font,color,effect,motion,music,length' && a1.status.includes('추천 조합') && a1.title.includes('클래식') && a1.poster.startsWith('data:image') && a1.pill,
    JSON.stringify({ rows: a1.rows, status: a1.status, title: a1.title, poster: a1.poster, pill: a1.pill }),
  );
  await ap.locator('#ai-box').screenshot({ path: out('live-pc-ai-card.png') });
  await ap.click('#ai-next');
  await ap.waitForTimeout(900);
  const a2 = await ap.evaluate(() => ({ ai: window.__wvm.ai(), theme: window.__wvm.theme().id, kicker: document.querySelector('#ai-box .ai-kicker')?.textContent ?? '' }));
  check("'다른 추천'으로 두 번째 추천 (로맨틱 · 벚꽃 핑크)", a2.ai?.rank === 1 && a2.ai.preset === 'romantic-blossom' && a2.theme === 'romantic' && a2.kicker.includes('2/'), JSON.stringify(a2));
  // 카드의 '바꾸기' → 세부 설정의 그 탭이 열림, 직접 바꾸면 'AI 추천대로 다시'
  await ap.click('#ai-box button[data-ai-go="effect"]');
  await ap.waitForTimeout(900);
  const tabOpen = await ap.evaluate(() => ({ open: window.__wvm.detailOpen(), tab: window.__wvm.czPanel(), mark: !!document.querySelector('#czp-effect .ai-pick') }));
  await ap.click('#particle-options button[data-value="hearts"]');
  await ap.waitForTimeout(300);
  const changed = await ap.evaluate(() => ({ match: window.__wvm.ai()?.match, again: !!document.querySelector('#ai-again') }));
  check("카드의 '바꾸기' → 그 탭(효과)이 열리고 AI가 고른 값에 표시 · 직접 바꾸면 'AI 추천대로 다시'", tabOpen.open && tabOpen.tab === 'effect' && tabOpen.mark && changed.match === false && changed.again, JSON.stringify({ tabOpen, changed }));
  await ap.click('#ai-revert');
  await ap.waitForTimeout(600);
  const back = await ap.evaluate(() => ({ ai: window.__wvm.ai(), theme: window.__wvm.theme().id, custom: window.__wvm.theme().custom, btn: !!document.querySelector('#ai-go') }));
  check("'원래대로' → AI 추천 전 설정 (시네마)", !back.ai && back.theme === 'cinema' && Object.keys(back.custom).length === 0 && back.btn, JSON.stringify(back));
  // 사진보다 먼저 추천을 받았다면, 사진을 올린 뒤 사진 단계에서 '사진 보고 다시 추천' → 사진을 보고 고른 메모
  await ap.click('#ai-go');
  await ap.waitForTimeout(800);
  await ap.click('#fb-photos');
  await ap.setInputFiles('#file-input', specs.slice(0, 20).map((s) => path.join(fixDir, s.file)));
  await ap.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''), null, { timeout: 60000 });
  await ap.waitForTimeout(400);
  const callout = (await ap.isVisible('#ai-photos')) && ((await ap.textContent('#ai-photos-go')) ?? '').includes('다시');
  await ap.click('#ai-photos-go');
  await ap.waitForTimeout(1500);
  const a3 = await ap.evaluate(() => {
    const box = document.querySelector('#ai-box').getBoundingClientRect();
    const bar = document.querySelector('#flow-bar').getBoundingClientRect();
    return {
      step: window.__wvm.step(),
      ai: window.__wvm.ai(),
      notes: [...document.querySelectorAll('#ai-box .ai-note')].map((n) => n.textContent),
      length: document.querySelector('#ai-box [data-ai-row="length"] .ai-vt')?.textContent ?? '',
      boxTop: Math.round(box.top),
      barBottom: Math.round(bar.bottom),
    };
  });
  check(
    "사진 단계의 '사진 보고 다시 추천' → 스타일 단계에 결과 · AI가 본 사진 메모 (사진 수·연도) · 길이는 사진 수에 맞춤",
    callout && a3.step === 'style' && a3.ai?.preset === 'classic-ivory' && a3.notes.some((n) => n.includes('사진 20장')) && /\d:\d\d/.test(a3.length) && a3.boxTop >= a3.barBottom && a3.boxTop < 400,
    JSON.stringify(a3),
  );
  await ap.screenshot({ path: out('live-pc-ai-photos.png') });
  await ap.waitForTimeout(600);
  await ap.reload();
  await ap.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  await ap.waitForTimeout(800);
  const kept = await ap.evaluate(() => ({ ai: window.__wvm.ai(), applied: document.querySelector('#ai-box').classList.contains('applied'), theme: window.__wvm.theme().id }));
  check('새로고침해도 AI 추천 표시가 이어짐', kept.ai?.preset === 'classic-ivory' && kept.ai.match && kept.applied && kept.theme === 'classic', JSON.stringify(kept));
  await ap.close();

  // ───────────── 휴대폰 (390×844) ─────────────
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await ctx.newPage();
  watch(m, 'mobile');
  await m.goto(url);
  await m.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });
  await m.evaluate(() => document.querySelector('#steps').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await m.locator('#fb-style').tap();
  await m.waitForTimeout(300);
  await m.evaluate(() => document.querySelector('#theme-list .theme-card:nth-child(9)')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await m.waitForTimeout(600);
  const mbar = await m.$eval('#flow-bar', (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, step: window.__wvm.step() };
  });
  check('휴대폰: 단계 표시줄이 화면 아래쪽에 붙어 있음 (엄지로 이전·다음)', mbar.step === 'style' && mbar.bottom <= mbar.vh && mbar.bottom >= mbar.vh - 30 && mbar.bottom - mbar.top <= 64, JSON.stringify(mbar));
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
  const md1 = await detailAt(m, 'traditional');
  const mLiveBottom = await m.$eval('#live-mobile .live-box', (el) => el.getBoundingClientRect().bottom);
  check(
    '휴대폰: 카드를 누르면 바로 아래에 세부 설정 (위쪽 미리보기에 안 가림)',
    md1.open && md1.gap >= 0 && md1.gap <= 40 && md1.top >= mLiveBottom - 1 && md1.top <= md1.vh - 120,
    `${JSON.stringify(md1)}, 미리보기 끝 ${Math.round(mLiveBottom)}`,
  );
  const mBefore = (await m.locator('#style-detail').boundingBox()).y;
  await m.locator('#sd-next').tap();
  await m.waitForTimeout(500);
  const mAfter = (await m.locator('#style-detail').boundingBox()).y;
  const mt2 = await m.evaluate(() => ({ id: window.__wvm.theme().id, name: document.querySelector('#sd-name').textContent }));
  check("휴대폰: '다음 스타일'로 스크롤 없이 바꿔 보기", mt2.id === 'editorial' && Math.abs(mAfter - mBefore) <= 3, `${JSON.stringify(mt2)}, 위치 ${Math.round(mBefore)} → ${Math.round(mAfter)}`);
  await m.screenshot({ path: out('live-mobile-detail.png') });
  await m.locator('#czt-opening').tap();
  await m.waitForTimeout(400);
  await m.locator('#title-options button[data-value="storybook"]').tap();
  await m.waitForTimeout(600);
  const ms2 = await inViewport(m, '#style-stage');
  const mt = await m.evaluate(() => window.__wvm.theme());
  const mText = await m.evaluate(() => {
    const t = document.querySelector('#cz-text .opt-h').getBoundingClientRect();
    const bar = document.querySelector('#flow-bar').getBoundingClientRect();
    return { textTop: Math.round(t.top), barTop: Math.round(bar.top) };
  });
  check(
    '휴대폰: 오프닝 디자인을 고르면 위쪽에서 바로 확인 · 바로 아래에 문구 칸',
    mt.title === 'storybook' && ms2.ok && mText.textTop > 0 && mText.textTop < mText.barTop - 30,
    `${JSON.stringify(ms2)} ${JSON.stringify(mText)}`,
  );
  // 문구 칸 쪽으로 조금 내려가도 머리줄(스타일 바꾸기 + 탭)은 미리보기 바로 아래에 붙어 있음
  await m.evaluate(() => window.scrollBy({ top: 240, behavior: 'instant' }));
  await m.waitForTimeout(300);
  const mhead = await m.evaluate(() => {
    const head = document.querySelector('.sd-head');
    const r = head.getBoundingClientRect();
    const t = head.querySelector('.sd-title').getBoundingClientRect();
    const n = head.querySelector('.sd-nav').getBoundingClientRect();
    const live = document.querySelector('#live-mobile .live-box').getBoundingClientRect();
    const hit = document.elementFromPoint(r.right - 24, r.top + 20);
    return {
      top: Math.round(r.top),
      h: Math.round(r.height),
      liveBottom: Math.round(live.bottom),
      onTop: !!hit && head.contains(hit),
      oneRow: Math.abs(t.top + t.height / 2 - (n.top + n.height / 2)) < 6,
      title: head.querySelector('.sd-title').textContent,
    };
  });
  check('휴대폰: 꾸미기를 보는 동안 세부 설정 머리줄(스타일 바꾸기 한 줄 + 항목 탭)이 미리보기 바로 아래에 붙음', mhead.onTop && mhead.oneRow && mhead.h <= 100 && mhead.top >= mhead.liveBottom - 1 && mhead.top <= mhead.liveBottom + 16, JSON.stringify(mhead));
  await m.screenshot({ path: out('live-mobile-sticky-head.png') });
  await m.screenshot({ path: out('live-mobile-opening.png') });
  await m.locator('#live-collapse').tap();
  const collapsedH = (await m.locator('#live-mobile .live-box').boundingBox())?.height ?? 999;
  check('휴대폰: 미리보기 작게 접기', collapsedH < 80, `${Math.round(collapsedH)}px`);
  await m.locator('#live-collapse').tap();
  // 음악·길이 단계에서는 위쪽 미리보기가 따라오지 않음 (단계 표시줄의 '다음'으로 그 자리에)
  await m.locator('#fb-text').tap();
  await m.waitForTimeout(300);
  const mTextTop = await m.evaluate(() => ({ step: window.__wvm.step(), h: Math.round(document.querySelector('#h-text').getBoundingClientRect().top) }));
  await m.locator('#fb-next').tap();
  await m.waitForTimeout(400);
  const away = await m.evaluate(() => ({
    step: window.__wvm.step(),
    liveHidden: document.querySelector('#live-zone').hidden,
    stage: Math.round(document.querySelector('#style-stage').getBoundingClientRect().height),
    h: Math.round(document.querySelector('#h-sound').getBoundingClientRect().top),
  }));
  check(
    "휴대폰: 아래쪽 '다음'으로 다음 단계가 화면 위쪽부터 · 음악·길이에서는 미리보기가 따라오지 않음",
    mTextTop.step === 'text' && away.step === 'sound' && away.liveHidden && away.stage === 0 && away.h > 60 && away.h < 200,
    `${JSON.stringify(mTextTop)} ${JSON.stringify(away)}`,
  );
  await m.locator('#fb-text').tap();
  await m.waitForTimeout(400);
  await m.screenshot({ path: out('live-mobile-text.png') });
  // AI 자동 추천 (휴대폰)
  await m.locator('#fb-style').tap();
  await m.waitForTimeout(300);
  await m.evaluate(() => document.querySelector('#ai-box').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await m.locator('#ai-go').tap();
  await m.waitForTimeout(1200);
  const mai = await m.evaluate(() => {
    const r = document.querySelector('#ai-box').getBoundingClientRect();
    return { ai: window.__wvm.ai(), rows: document.querySelectorAll('#ai-box [data-ai-row]').length, left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth };
  });
  check('휴대폰: AI 자동 추천 → 고른 8가지를 한눈에 (화면 폭 안)', mai.ai?.preset === 'classic-ivory' && mai.rows === 8 && mai.left >= 0 && mai.right <= mai.vw, JSON.stringify(mai));
  await m.locator('#ai-box').screenshot({ path: out('live-mobile-ai.png') });
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
