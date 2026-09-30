// E2E: 실제 Chrome으로 사이트를 열어 사진 업로드 → 미리보기 → MP4 만들기 → 파일 검증까지 확인
// 실행: npm run e2e   (환경변수: E2E_QUALITY=1080p|720p, E2E_DURATION=3분, E2E_THEME=classic, E2E_CHANNEL=chrome|msedge)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { generateFixtures } from './fixtures.mjs';
import { inspectMp4 } from './inspect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'out');
const fixDir = path.join(root, 'e2e', 'fixtures');
const QUALITY = process.env.E2E_QUALITY ?? '1080p';
const DURATION_LABEL = process.env.E2E_DURATION ?? '3분';
const THEME = process.env.E2E_THEME ?? 'classic';
const CHANNEL = process.env.E2E_CHANNEL ?? 'chrome';
const SKIP_THEMES = !!process.env.E2E_SKIP_THEMES;
const out = (name) => path.join(outDir, name);

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

fs.mkdirSync(outDir, { recursive: true });
if (!process.env.E2E_SKIP_BUILD) {
  console.log('빌드 중…');
  await build({ root, logLevel: 'warn' });
}
const server = await preview({ root, preview: { port: 4173, strictPort: false }, logLevel: 'warn' });
const url = server.resolvedUrls.local[0];
console.log('미리보기 서버:', url);

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

try {
  await page.goto(url);
  console.log('테스트 사진 생성 중…');
  const specs = await generateFixtures(page, fixDir);
  await page.reload();
  await page.waitForSelector('#theme-list .theme-card');
  check('스타일 17종 표시', (await page.locator('#theme-list .theme-card').count()) === 17);
  check('지원 경고 없음', await page.locator('#support-warning').isHidden());
  await page.screenshot({ path: out('01-initial.png'), fullPage: true });

  // ── 사진 업로드 ──
  const files = [...specs.map((s) => path.join(fixDir, s.file)), path.join(fixDir, 'broken.jpg'), path.join(fixDir, 'notes.txt')];
  const t0 = Date.now();
  await page.setInputFiles('#file-input', files);
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''), null, {
    timeout: 180000,
  });
  const importSec = (Date.now() - t0) / 1000;
  const status = (await page.textContent('#import-status')) ?? '';
  check(`사진 ${specs.length}장 가져오기 (${importSec.toFixed(1)}초)`, status.includes(`사진 ${specs.length}장을 추가했어요`), status);
  check('손상된 파일 안내', status.includes('broken.jpg'));
  check('사진이 아닌 파일 제외 안내', status.includes('사진이 아닌 파일 1개'));
  check('목록에 사진 표시', (await page.locator('#photo-grid li.photo').count()) === specs.length);

  const labels = await page.$$eval('#photo-grid li.photo .open', (els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  const actual = labels.map((l) => /(IMG_\d+\.\w+)/.exec(l)?.[1]);
  const expected = [
    ...specs.filter((s) => s.date).sort((a, b) => a.order - b.order).map((s) => s.file),
    ...specs.filter((s) => !s.date).map((s) => s.file),
  ];
  check('촬영일순 자동 정렬', JSON.stringify(actual) === JSON.stringify(expected));

  const rotated = specs.find((s) => s.kind === 'R');
  const rotatedDims = await page.$eval(`#photo-grid li.photo:has(.open[aria-label*="${rotated.file}"]) img`, (img) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  check('EXIF 회전 사진이 세로로 보정됨', rotatedDims[1] > rotatedDims[0], rotatedDims.join('x'));

  // ── 문구 입력 ──
  await page.fill('#f-groom', '김민준');
  await page.fill('#f-bride', '이서연');
  await page.fill('#f-date', '2026-10-24');
  await page.fill('#f-time', '13:30');
  await page.fill('#f-venue', '더채플 청담 3층 그랜드홀');
  await page.click(`label.theme-card:has(input[value="${THEME}"])`);
  await page.locator('#duration-options .chip', { hasText: new RegExp(`^${DURATION_LABEL}$`) }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const summary = (await page.textContent('#timeline-summary')) ?? '';
  console.log('구성:', summary);
  check('영상 구성 요약 표시', /사진 40장/.test(summary) && /전체 3:00/.test(summary), summary);
  await page.screenshot({ path: out('02-loaded.png'), fullPage: true });

  // ── 미리보기 화면 ──
  const seekPreview = async (t) => {
    await page.evaluate((t) => {
      const s = document.querySelector('#seek');
      s.value = String(t);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }, t);
    await page.waitForTimeout(900);
  };
  const clickPhoto = async (file) => {
    await page.click(`#photo-grid li.photo .open[aria-label*="${file}"]`, { force: true });
    await page.waitForTimeout(900);
  };
  const byKind = (k, n = 0) => specs.filter((s) => s.kind === k).sort((a, b) => a.order - b.order)[n];
  /** 미리보기 캔버스를 원래 해상도(1280x720) 그대로 저장 */
  const shotPreview = async (name) => {
    const dataUrl = await page.$eval('#preview', (c) => c.toDataURL('image/png'));
    fs.writeFileSync(out(name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  };
  const themes = SKIP_THEMES ? [THEME] : ['classic', 'romantic', 'modern', 'film'];
  for (const th of themes) {
    await page.click(`label.theme-card:has(input[value="${th}"])`);
    await page.waitForTimeout(1500);
    await seekPreview(4.5);
    await shotPreview(`preview-${th}-1-intro.png`);
    await clickPhoto(byKind('L', 3).file);
    await shotPreview(`preview-${th}-2-landscape.png`);
    await clickPhoto(byKind('P', 0).file);
    await shotPreview(`preview-${th}-3-pair.png`);
    await page.focus('#f-outro-message');
    await page.waitForTimeout(900);
    await shotPreview(`preview-${th}-4-outro.png`);
  }
  await page.click(`label.theme-card:has(input[value="${THEME}"])`);
  await page.waitForTimeout(800);
  await clickPhoto(byKind('S').file);
  await shotPreview('preview-square.png');
  await clickPhoto(rotated.file);
  await shotPreview('preview-rotated.png');
  for (const t of [8.9, 9.3, 9.8]) {
    await seekPreview(t);
    await shotPreview(`preview-transition-${String(t).replace('.', '_')}.png`);
  }

  // 재생 확인
  await seekPreview(20);
  await page.click('#btn-play');
  await page.waitForTimeout(2500);
  const playT = await page.$eval('#seek', (s) => Number(s.value));
  await page.click('#btn-play');
  check('미리보기 재생 시 시간이 흐름', playT > 21 && playT < 26, `20초 → ${playT.toFixed(2)}초`);

  // ── MP4 만들기 ──
  await page.selectOption('#f-quality', QUALITY);
  const estimate = (await page.textContent('#export-estimate')) ?? '';
  console.log('예상:', estimate);
  const exportStart = Date.now();
  await page.click('#btn-export');
  let lastLog = 0;
  let shotProgress = false;
  for (;;) {
    if (await page.locator('#export-result').isVisible()) break;
    if (await page.locator('#export-error').isVisible()) break;
    if (Date.now() - lastLog > 20000) {
      console.log('  ', (await page.textContent('#progress-text')) ?? '');
      lastLog = Date.now();
    }
    if (!shotProgress && Date.now() - exportStart > 15000) {
      await page.screenshot({ path: out('03-exporting.png'), fullPage: false });
      shotProgress = true;
    }
    if (Date.now() - exportStart > 60 * 60 * 1000) throw new Error('영상 만들기 시간 초과');
    await page.waitForTimeout(1000);
  }
  const exportSec = (Date.now() - exportStart) / 1000;
  const exportError = (await page.locator('#export-error').isVisible()) ? await page.textContent('#export-error') : '';
  check(`MP4 만들기 완료 (${exportSec.toFixed(0)}초)`, !exportError, exportError ?? '');
  if (exportError) throw new Error(exportError);
  console.log('결과:', await page.textContent('#result-info'));
  await page.screenshot({ path: out('04-result.png'), fullPage: true });

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const mp4Path = out(`result-${THEME}-${QUALITY}.mp4`);
  await dl.saveAs(mp4Path);
  check('다운로드 파일명', dl.suggestedFilename() === '식전영상_김민준_이서연.mp4', dl.suggestedFilename());

  // ── 파일 구조 검증 ──
  const info = await inspectMp4(mp4Path);
  console.log(JSON.stringify(info, null, 1));
  const [w, h] = QUALITY === '720p' ? [1280, 720] : [1920, 1080];
  check('MP4 컨테이너', /mp4/i.test(info.format), info.format);
  check('영상 길이 3분', Math.abs(info.duration - 180) < 0.25, info.duration.toFixed(3));
  check(`H.264 ${w}x${h}`, info.video?.codec === 'avc' && info.video.width === w && info.video.height === h);
  const lvl = /avc1\.[0-9a-f]{4}([0-9a-f]{2})/i.exec(info.mimeType);
  const level = lvl ? parseInt(lvl[1], 16) : 99;
  check('H.264 레벨 4.1 이하 (TV·재생기 호환)', level <= 41, `${info.mimeType} → Level ${(level / 10).toFixed(1)}`);
  check('30fps 전체 프레임', Math.abs((info.video?.packets ?? 0) - 5400) <= 2, `${info.video?.packets} 프레임`);
  check('AAC 48kHz 스테레오', info.audio?.codec === 'aac' && info.audio.sampleRate === 48000 && info.audio.channels === 2);
  check('오디오 길이 = 영상 길이', Math.abs((info.audio?.duration ?? 0) - 180) < 0.2, info.audio?.duration?.toFixed(3));

  // ── 실제 영상 프레임 확인 ──
  const times = [0.05, 4.5, 9.3, 30, 60, 100, 140, 172, 179.95];
  const frames = await page.evaluate(async (times) => {
    const v = document.querySelector('#result-video');
    v.muted = true;
    if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 540;
    const g = c.getContext('2d', { willReadFrequently: true });
    const res = [];
    for (const t of times) {
      await new Promise((r) => {
        v.addEventListener('seeked', r, { once: true });
        v.currentTime = t;
      });
      await new Promise((r) => requestAnimationFrame(() => r()));
      g.drawImage(v, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      res.push({ t, mean: sum / (d.length / 4) / 3, url: c.toDataURL('image/jpeg', 0.88) });
    }
    return { res, vw: v.videoWidth, vh: v.videoHeight, dur: v.duration };
  }, times);
  check('브라우저에서 재생 가능', frames.vw === w && Math.abs(frames.dur - 180) < 0.3, `${frames.vw}x${frames.vh}, ${frames.dur}`);
  for (const f of frames.res) {
    fs.writeFileSync(out(`frame-${String(f.t).replace('.', '_')}s.jpg`), Buffer.from(f.url.split(',')[1], 'base64'));
  }
  const mean = (t) => frames.res.find((f) => f.t === t).mean;
  console.log('프레임 밝기:', frames.res.map((f) => `${f.t}s=${f.mean.toFixed(1)}`).join(' '));
  check('시작은 검은 화면에서 페이드인', mean(0.05) < 12);
  check('본편 프레임에 사진이 보임', [30, 60, 100, 140].every((t) => mean(t) > 25));
  check('끝은 검은 화면으로 페이드아웃', mean(179.95) < 12);

  // ── 음악 확인 ──
  const audio = await page.evaluate(async () => {
    const href = document.querySelector('#download').href;
    const buf = await (await fetch(href)).arrayBuffer();
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const ab = await ctx.decodeAudioData(buf);
    const ch = ab.getChannelData(0);
    const win = 48000 * 10;
    const rms = [];
    for (let s = 0; s < ch.length; s += win) {
      const e = Math.min(ch.length, s + win);
      let acc = 0;
      for (let i = s; i < e; i++) acc += ch[i] * ch[i];
      rms.push(Math.sqrt(acc / Math.max(1, e - s)));
    }
    let peakTail = 0;
    for (const x of ch.subarray(ch.length - 2400)) peakTail = Math.max(peakTail, Math.abs(x));
    let peak = 0;
    for (const x of ch) peak = Math.max(peak, Math.abs(x));
    return { duration: ab.duration, rms, peakTail, peak };
  });
  console.log('음악 RMS(10초 단위):', audio.rms.map((r) => r.toFixed(3)).join(' '), 'peak', audio.peak.toFixed(3));
  check('음악이 처음부터 끝까지 들림', audio.rms.slice(0, -1).every((r) => r > 0.02));
  check('음악 끝은 페이드아웃', audio.peakTail < 0.05, audio.peakTail.toFixed(4));
  check('음악 클리핑 없음', audio.peak <= 1.0, audio.peak.toFixed(3));

  const relevantErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
  check('콘솔 오류 없음', relevantErrors.length === 0, relevantErrors.slice(0, 5).join(' | '));
} catch (e) {
  check('E2E 실행', false, e instanceof Error ? e.stack : String(e));
  await page.screenshot({ path: out('error.png'), fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(out('report.json'), JSON.stringify({ quality: QUALITY, theme: THEME, checks }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length ? 1 : 0);
