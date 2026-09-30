// 추가 E2E: 내 음악 사용·음악 길이에 맞춤, 사진이 너무 많을 때, 순서 변경·오프닝 사진 지정·빼기·모두 지우기
// 실행: node e2e/edge.mjs  (npm run e2e 로 먼저 빌드·사진 생성이 되어 있어야 함)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { fixtureSpecs } from './fixtures.mjs';
import { inspectMp4 } from './inspect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'out');
const fixDir = path.join(root, 'e2e', 'fixtures');
const extraDir = path.join(fixDir, 'extra');
const out = (n) => path.join(outDir, n);
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/** 1초 무음 + 198초 멜로디 + 1초 무음 (22.05kHz 모노 16bit WAV) */
function writeWav(file) {
  const sr = 22050;
  const secs = 200;
  const n = sr * secs;
  const data = Buffer.alloc(n * 2);
  const notes = [262, 294, 330, 349, 392, 440, 494, 523];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    if (t >= 1 && t < secs - 1) {
      const f = notes[Math.floor(t * 2) % notes.length];
      v = 0.3 * Math.sin(2 * Math.PI * f * t);
    }
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sr, 24);
  header.writeUInt32LE(sr * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

fs.mkdirSync(extraDir, { recursive: true });
const wavPath = path.join(fixDir, '우리의노래.wav');
if (!fs.existsSync(wavPath)) writeWav(wavPath);

const server = await preview({ root, preview: { port: 4174, strictPort: false }, logLevel: 'warn' });
const url = `${server.resolvedUrls.local[0]}?e2e`;
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', (d) => d.accept());

const labels = () => page.$$eval('#photo-grid li.photo .open', (els) => els.map((e) => /(\w+\.\w+)/.exec(e.getAttribute('aria-label') ?? '')?.[1]));
const summary = async () => (await page.textContent('#timeline-summary')) ?? '';

try {
  await page.goto(url);
  await page.waitForSelector('#theme-list .theme-card');

  // ── 제작자 문구 · 스타일 예시 영상 ──
  const creator = '제작자 : 부산북구 주양현';
  const heroCredit = ((await page.textContent('.creator')) ?? '').trim();
  const footCredit = ((await page.textContent('.footer-credit')) ?? '').trim();
  check('제작자 문구 (상단·하단)', heroCredit === creator && footCredit === creator && (await page.locator('.creator').isVisible()), `${heroCredit} / ${footCredit}`);
  await page.waitForFunction(() => window.__wvm.demoReady(), null, { timeout: 30000 });
  await page.waitForFunction(
    () => {
      const ps = [...document.querySelectorAll('#theme-list .poster')];
      return ps.length > 0 && ps.every((p) => p.style.backgroundImage.startsWith('url("data:image/jpeg'));
    },
    null,
    { timeout: 30000 },
  );
  const posters = await page.$$eval('#theme-list .poster', (els) => els.map((e) => e.style.backgroundImage.slice(0, 26)));
  check('스타일 카드 17개에 예시 그림', posters.length === 17 && posters.every((p) => p.startsWith('url("data:image/jpeg')), `${posters.length}개`);
  const bodyText = (await page.textContent('body')) ?? '';
  check('뺀 문구 없음 (회원가입 없이 무료 · 서버 전송)', !bodyText.includes('회원가입 없이 무료') && !bodyText.includes('서버로 전송되지'));
  check('홈 화면 라이브 데모 재생', await page.evaluate(() => window.__wvm.heroPlaying()));
  // 밝기: 자동 → 라이트 → 다크 → 자동
  const modes = [];
  for (let i = 0; i < 3; i++) {
    await page.click('#appearance');
    await page.waitForTimeout(900);
    modes.push(await page.evaluate(() => `${document.documentElement.dataset.appearance}/${document.documentElement.dataset.theme}`));
  }
  check('화면 밝기 전환 (라이트·다크·자동)', modes[0] === 'light/light' && modes[1] === 'dark/dark' && /^auto\/(light|dark)$/.test(modes[2]), modes.join(' → '));
  // 3D 쇼케이스: 끌면 돌아가기만 하고, 앞에 온 카드를 누르면 그 스타일이 선택됨
  const ringCount = await page.locator('#ring .ring-card').count();
  await page.evaluate(() => document.querySelector('#styles')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(600);
  // 커서를 올리면 자동 회전이 멈춤
  await page.hover('#ring-scene', { position: { x: 30, y: 30 } });
  await page.waitForTimeout(500);
  const frontTheme = () => page.$eval('#ring .ring-card.front', (c) => c.dataset.theme);
  const themeBefore = await page.evaluate(() => window.__wvm.theme().id);
  const front0 = await frontTheme();
  const box = await page.locator('#ring .ring-card.front button').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 260, box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const front1 = await frontTheme();
  const themeAfterDrag = await page.evaluate(() => window.__wvm.theme().id);
  check('쇼케이스 끌기: 돌아가기만 하고 선택 안 됨', front1 !== front0 && themeAfterDrag === themeBefore, `앞 카드 ${front0} → ${front1}, 스타일 ${themeAfterDrag}`);
  // 지금 스타일과 다른, 뒤쪽에 있던 카드를 앞으로 불러와(초점) 마우스로 누름
  const ringThemes = await page.$$eval('#ring .ring-card', (els) => els.map((e) => e.dataset.theme));
  const f1 = ringThemes.indexOf(front1);
  const target = [3, 4, 5, 6].map((d) => ringThemes[(f1 + d) % ringCount]).find((id) => id !== themeBefore);
  const targetBtn = page.locator(`#ring .ring-card[data-theme="${target}"] button`);
  await targetBtn.focus();
  await page.waitForTimeout(1500);
  const front2 = await frontTheme();
  await targetBtn.click();
  await page.waitForTimeout(900);
  const picked = await page.evaluate(() => window.__wvm.theme().id);
  const checkedCard = await page.$eval('#theme-list input[name="theme"]:checked', (e) => e.value);
  check(
    '쇼케이스 카드 17장 · 누르면 그 스타일 선택',
    ringCount === 17 && front2 === target && picked === target && checkedCard === target && target !== themeBefore,
    `${ringCount}장, ${themeBefore} → ${picked} (앞 카드 ${front2})`,
  );
  await page.locator('#style-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__wvm.demoPlaying(), null, { timeout: 10000 }).catch(() => undefined);
  check('스타일 예시 영상 자동 재생', await page.evaluate(() => window.__wvm.demoPlaying()));
  await page.click('#style-demo-toggle');
  const pausedLabel = await page.getAttribute('#style-demo-toggle', 'aria-label');
  const pausedNow = !(await page.evaluate(() => window.__wvm.demoPlaying()));
  await page.click('#style-demo-toggle');
  const resumed = await page.evaluate(() => window.__wvm.demoPlaying());
  const playLabel = await page.getAttribute('#style-demo-toggle', 'aria-label');
  check('예시 영상 멈춤·다시 재생 버튼', pausedNow && pausedLabel === '예시 영상 재생' && resumed && playLabel === '예시 영상 일시정지', `${pausedLabel} → ${playLabel}`);
  await page.click('label.theme-card:has(input[value="modern"])');
  const demoName = ((await page.textContent('#style-demo-name')) ?? '').trim();
  check('스타일을 고르면 그 스타일 예시로 바뀜', demoName.startsWith('모던'), demoName);
  // 분위기 필터: 힙한 → 매거진 화보·스트릿·네온·썸머 비치·레트로·캠코더
  await page.click('#mood-filter button[data-mood="hip"]');
  const hipCards = await page.$$eval('#theme-list .theme-card', (els) => els.filter((e) => !e.hidden).map((e) => e.querySelector('input').value));
  check('분위기 필터 (힙한)', hipCards.join(',') === 'editorial,street,neon,summer,retro,camcorder', hipCards.join(','));
  await page.click('#mood-filter button[data-mood="all"]');
  // 양식·오프닝 디자인·효과 선택 (오프닝은 꾸미기 '오프닝' 탭, 효과는 '효과' 탭)
  await page.click('label.theme-card:has(input[value="garden"])');
  const variants = await page.$$eval('#variant-list input', (els) => els.map((e) => e.value));
  await page.click('label.variant-card:has(input[value="winter"])');
  await page.click('#czt-opening');
  await page.click('#title-options button[data-value="movie"]');
  await page.click('#czt-effect');
  await page.click('#particle-options button[data-value="hearts"]');
  const th = await page.evaluate(() => window.__wvm.theme());
  check('양식 4가지 중 선택 (가든 · 겨울 눈꽃)', variants.length === 4 && th.id === 'garden' && th.variant === 'winter', `${variants.join(',')} → ${th.variant}`);
  check('오프닝 디자인 · 효과 선택', th.title === 'movie' && th.particle === 'hearts', `${th.title}, ${th.particle}`);
  await page.waitForFunction(() => document.querySelectorAll('#variant-list .vposter[style*="data:image"]').length === 4, null, { timeout: 20000 }).catch(() => undefined);
  check('양식 미니 포스터', (await page.locator('#variant-list .vposter[style*="data:image"]').count()) === 4);
  await page.click('#czt-opening');
  await page.click('#title-options button[data-value="auto"]');
  await page.click('#czt-effect');
  await page.click('#particle-options button[data-value="auto"]');
  const back = await page.evaluate(() => window.__wvm.theme());
  check('추천 설정으로 되돌리기', back.title === 'wreath' && back.particle === 'snow', `${back.title}, ${back.particle}`);
  await page.click('label.theme-card:has(input[value="romantic"])');
  const romanticVariants = await page.$$eval('#variant-list input', (els) => els.map((e) => e.value));
  check('로맨틱 양식: 하트 팝 대신 로즈 골드', romanticVariants.includes('rosegold') && !romanticVariants.includes('heartpop'), romanticVariants.join(','));
  check('감성 문구 기본값 없음', (await page.inputValue('#f-quotes')) === '');
  await page.evaluate(() => window.scrollTo(0, 0));

  // 추가 사진 60장 (작은 크기, EXIF 없음)
  const extraCount = 60;
  if (fs.readdirSync(extraDir).length < extraCount) {
    for (let i = 0; i < extraCount; i++) {
      const b64 = await page.evaluate((i) => {
        const c = document.createElement('canvas');
        c.width = 1200;
        c.height = 800;
        const g = c.getContext('2d');
        g.fillStyle = `hsl(${(i * 47) % 360},45%,55%)`;
        g.fillRect(0, 0, 1200, 800);
        g.fillStyle = '#fff';
        g.font = 'bold 200px sans-serif';
        g.textAlign = 'center';
        g.fillText(`E${i + 1}`, 600, 460);
        return c.toDataURL('image/jpeg', 0.8).split(',')[1];
      }, i);
      fs.writeFileSync(path.join(extraDir, `EXTRA_${String(i + 1).padStart(3, '0')}.jpg`), Buffer.from(b64, 'base64'));
    }
  }

  // ── 순서 변경·오프닝 사진·빼기 ──
  const specs = fixtureSpecs();
  const base = specs.slice(0, 12).map((s) => path.join(fixDir, s.file));
  await page.setInputFiles('#file-input', base);
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''));
  const before = await labels();
  await page.click('#photo-grid li.photo:nth-child(1) button[data-act="right"]', { force: true });
  const after = await labels();
  check('▶ 버튼으로 뒤로 이동', after[0] === before[1] && after[1] === before[0], `${before.slice(0, 2)} → ${after.slice(0, 2)}`);
  check('수동으로 옮기면 정렬 버튼 해제', (await page.locator('[data-sort][aria-pressed="true"]').count()) === 0);
  const focused = await page.evaluate(() => document.activeElement?.closest('li.photo')?.querySelector('.open')?.getAttribute('aria-label') ?? '');
  check('이동 후 포커스 유지', focused.includes(before[0]), focused);

  const fifth = (await labels())[4];
  await page.click('#photo-grid li.photo:nth-child(5) button[data-act="cover"]', { force: true });
  const introPhoto = await page.evaluate(() => {
    const tl = window.__wvm.timeline();
    const id = tl.segments[0].photoId;
    return window.__wvm.photos().find((p) => p.id === id)?.name;
  });
  check('★ 오프닝 사진 지정', introPhoto === fifth, `${introPhoto}`);
  check('★ 표시 이동', (await page.locator('#photo-grid li.photo:nth-child(5) .mark').first().textContent()) === '★');

  await page.click('#photo-grid li.photo:nth-child(2) button[data-act="remove"]', { force: true });
  check('✕ 사진 빼기', (await page.locator('#photo-grid li.photo').count()) === 11);

  // ── 사진별 문구: ✎ → 편집 창, Enter로 다음 사진, Esc로 닫기 ──
  await page.click('#photo-grid li.photo:nth-child(1) button[data-act="edit"]', { force: true });
  await page.waitForSelector('#photo-editor[open]');
  const pos1 = ((await page.textContent('#pe-pos')) ?? '').trim();
  const capFocused = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.type('제주에서');
  await page.keyboard.press('Enter');
  const pos2 = ((await page.textContent('#pe-pos')) ?? '').trim();
  await page.keyboard.type('한강 산책');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#photo-editor', { state: 'hidden' });
  check('✎ 사진 문구 편집 창 (Enter로 다음 사진)', pos1 === '1 / 11' && pos2 === '2 / 11' && capFocused === 'pe-caption', `${pos1} → ${pos2}, 초점 ${capFocused}`);
  const caps = await page.evaluate(() => window.__wvm.photos().slice(0, 3).map((p) => p.caption));
  const gridCap = ((await page.textContent('#photo-grid li.photo:nth-child(1) .cap')) ?? '').trim();
  check('사진 문구 저장 · 목록에 표시', caps[0] === '제주에서' && caps[1] === '한강 산책' && caps[2] === '' && gridCap === '제주에서', `${JSON.stringify(caps)}, 목록 "${gridCap}"`);
  const segsBefore = await page.evaluate(() => JSON.stringify(window.__wvm.timeline().segments.map((s) => s.layout ?? s.kind)));
  await page.click('#photo-grid li.photo:nth-child(3) button[data-act="edit"]', { force: true });
  await page.waitForSelector('#photo-editor[open]');
  await page.keyboard.type('문구만 바꿈');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#photo-editor', { state: 'hidden' });
  const segsAfter = await page.evaluate(() => JSON.stringify(window.__wvm.timeline().segments.map((s) => s.layout ?? s.kind)));
  check('문구를 넣어도 장면 구성은 그대로', segsBefore === segsAfter);

  // ── 사진이 너무 많을 때 ──
  const many = [...specs.map((s) => path.join(fixDir, s.file)), ...fs.readdirSync(extraDir).map((f) => path.join(extraDir, f))];
  await page.setInputFiles('#file-input', many);
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''), null, { timeout: 120000 });
  const total = await page.locator('#photo-grid li.photo').count();
  // 기존 11장은 중복으로 건너뛰고, 앞에서 뺀 1장은 다시 추가됨 → 11 + 29 + 60 = 100
  check('중복 사진은 건너뜀', total === 100 && /이미 있는 사진 11장/.test((await page.textContent('#import-status')) ?? ''), `총 ${total}장`);
  await page.locator('#duration-options .chip', { hasText: /^3분$/ }).click();
  // 여러 장 모아 보기(기본 켜짐)면 한 화면에 여러 장이 들어가 100장도 3분에 담김
  check(
    '모아 보기: 100장도 3분에 모두 들어감',
    (await page.locator('#timeline-error').isHidden()) && (await page.locator('#photo-grid li.photo.unused').count()) === 0,
    await summary(),
  );
  // 한 장씩 보여주면 3분에는 다 못 넣음 ('여러 장 모아 보기'는 꾸미기 '전환 · 연출' 탭)
  await page.click('#czt-motion');
  await page.uncheck('#f-group');
  const warnVisible = await page.locator('#timeline-error').isVisible();
  const unused = await page.locator('#photo-grid li.photo.unused').count();
  const warnText = (await page.textContent('#timeline-error')) ?? '';
  check('한 장씩 3분에 사진이 너무 많으면 안내', warnVisible && unused > 0 && warnText.includes(`${unused}장`), warnText);
  await page.screenshot({ path: out('edge-too-many.png'), fullPage: false });
  await page.locator('#duration-options .chip', { hasText: /^5분$/ }).click();
  check('5분으로 늘리면 모두 들어감', (await page.locator('#timeline-error').isHidden()) && (await page.locator('#photo-grid li.photo.unused').count()) === 0, await summary());
  await page.check('#f-group');

  // ── 모두 지우기 ──
  await page.click('#btn-clear');
  check('모두 지우기', (await page.locator('#photo-grid li.photo').count()) === 0 && (await page.isDisabled('#btn-export')));

  // ── 내 음악 + 음악 길이에 맞춤 ──
  await page.setInputFiles('#file-input', specs.slice(0, 30).map((s) => path.join(fixDir, s.file)));
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''));
  await page.setInputFiles('#music-input', wavPath);
  await page.waitForFunction(() => /음악 1곡/.test(document.querySelector('#music-status')?.textContent ?? ''), null, { timeout: 60000 });
  const musicStatus = (await page.textContent('#music-status')) ?? '';
  check('내 음악 불러오기 (앞뒤 무음 제외 3:18)', /총 3:1[78]/.test(musicStatus), musicStatus);
  check('내 음악 선택으로 전환', await page.isChecked('input[name="music"][value="custom"]'));
  const fitChip = page.locator('#duration-options .chip', { hasText: '음악 길이에 맞춤' });
  check('음악 길이에 맞춤 옵션 표시', (await fitChip.count()) === 1);
  await fitChip.click();
  const s = await summary();
  const m = /전체 (\d):(\d\d)/.exec(s);
  const fitSec = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  check('영상 길이 = 음악 길이', fitSec >= 197 && fitSec <= 199, s);

  await page.selectOption('#f-quality', '720p');
  await page.click('#btn-export');
  await page.waitForSelector('#export-result:not([hidden]), #export-error:not([hidden])', { timeout: 20 * 60 * 1000 });
  const err = (await page.locator('#export-error').isVisible()) ? await page.textContent('#export-error') : '';
  check('내 음악으로 영상 만들기', !err, err ?? '');
  check('PC에서는 공유 버튼 숨김 · 저장 버튼 표시', (await page.locator('#share').isHidden()) && (await page.locator('#download').isVisible()));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const mp4 = out('edge-custom-music.mp4');
  await dl.saveAs(mp4);
  const info = await inspectMp4(mp4);
  check('MP4 길이 = 음악 길이', Math.abs(info.duration - fitSec) < 0.3, `${info.duration.toFixed(2)}초`);
  check('AAC 음악 포함', info.audio?.codec === 'aac');
  const firstSecondRms = await page.evaluate(async () => {
    const buf = await (await fetch(document.querySelector('#download').href)).arrayBuffer();
    const ab = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(buf);
    const ch = ab.getChannelData(0);
    let acc = 0;
    for (let i = 24000; i < 48000; i++) acc += ch[i] * ch[i];
    return Math.sqrt(acc / 24000);
  });
  check('앞 무음을 잘라 바로 음악 시작', firstSecondRms > 0.05, firstSecondRms.toFixed(3));
  check('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('edge 실행', false, e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: out('edge-error.png'), fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length ? 1 : 0);
