// 실행: node e2e/pwa.mjs  (먼저 npm run build)
// 홈 화면 앱(PWA) 점검: 설치 정보(manifest) → 서비스 워커 등록 → 다시 열면 서비스 워커가 페이지를 맡음
// → 인터넷을 끊고 다시 열어도 화면·예시 영상이 나오고, 사진을 올려 미리보기까지 되는지.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { fixtureSpecs } from './fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'e2e', 'out');
const fixDir = path.join(root, 'e2e', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

// 배포된 사이트 점검: PWA_URL=https://아이디.github.io/저장소/ node e2e/pwa.mjs (이때는 로컬 서버를 띄우지 않음)
const liveUrl = process.env.PWA_URL ? process.env.PWA_URL.replace(/\/?$/, '/') : '';
const server = liveUrl ? null : await preview({ root, preview: { port: 4175, strictPort: false }, logLevel: 'warn' });
const base = liveUrl || server.resolvedUrls.local[0];
let serverOpen = !!server;
const closeServer = async () => {
  if (!serverOpen) return;
  serverOpen = false;
  server.httpServer.closeAllConnections?.();
  await new Promise((r) => server.httpServer.close(r));
};
const url = `${base}?e2e&sw`;
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const failed = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('requestfailed', (r) => failed.push(r.url().replace(base, '/')));
const ready = () => page.waitForFunction(() => window.__wvm?.demoReady(), null, { timeout: 30000 });

try {
  // ── 설치 정보 ──
  const res = await fetch(new URL('manifest.webmanifest', base));
  const manifest = await res.json();
  const icons = manifest.icons ?? [];
  const iconOk = await Promise.all(icons.map(async (i) => (await fetch(new URL(i.src, base))).ok));
  check(
    'manifest (이름·아이콘·전체 화면)',
    res.ok && manifest.name && manifest.display === 'standalone' && icons.some((i) => i.sizes === '512x512' && /maskable/.test(i.purpose ?? '')) && iconOk.every(Boolean),
    `${manifest.name} · ${icons.map((i) => `${i.sizes}${i.purpose ? `(${i.purpose})` : ''}`).join(', ')}`,
  );
  const swRes = await fetch(new URL('sw.js', base));
  const swText = await swRes.text();
  check('sw.js 빌드 (자리 표시 채워짐)', swRes.ok && !swText.includes('__VERSION__') && !swText.includes('__PRECACHE__'));
  // 미리 저장 목록이 하나라도 없으면 서비스 워커 설치가 통째로 실패함. 로컬 미리보기 서버는 없는 파일에도
  // index.html을 돌려주므로(200) 상태 코드만이 아니라 스크립트·스타일이 HTML로 오지 않는지도 봄
  const precache = JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(swText)?.[1] ?? '[]');
  const badPre = (
    await Promise.all(
      precache.map(async (p) => {
        const r = await fetch(new URL(p, base), { cache: 'no-store' });
        await r.arrayBuffer();
        const html = /text\/html/.test(r.headers.get('content-type') ?? '');
        return r.ok && !(html && /\.(js|css)$/.test(p)) ? null : `${p} (${r.status}${html ? ', html' : ''})`;
      }),
    )
  ).filter(Boolean);
  check('미리 저장 목록 파일이 모두 있음', precache.length > 5 && badPre.length === 0, badPre.length ? `${badPre.length}개 없음: ${badPre.slice(0, 3).join(', ')}` : `${precache.length}개`);

  // ── 첫 방문: 등록 ──
  await page.goto(url);
  await ready();
  const reg = await page.evaluate(async () => {
    // 설치가 실패하면 ready가 영원히 끝나지 않으므로 시간 제한
    const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 30000))]);
    if (!r) {
      const regs = await navigator.serviceWorker.getRegistrations();
      return { scope: regs[0]?.scope ?? null, state: regs[0]?.installing?.state ?? regs[0]?.waiting?.state ?? 'not ready (30s)', controlled: false };
    }
    return { scope: r.scope, state: r.active?.state ?? null, controlled: !!navigator.serviceWorker.controller };
  });
  check('서비스 워커 등록 · 활성 (사이트 주소 범위)', reg.state === 'activated' && reg.scope === base, JSON.stringify(reg));

  // ── 다시 열기: 서비스 워커가 페이지를 맡음 ──
  await page.reload();
  await ready();
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('다시 열면 서비스 워커가 페이지를 맡음', controlled);
  // 페이지가 받아 둔 글꼴 등을 저장할 시간
  await page.waitForTimeout(4000);
  const caches = await page.evaluate(async () => {
    const out = {};
    for (const k of await window.caches.keys()) out[k.replace(/-[0-9a-f]{6,}$/, '-*')] = (await (await window.caches.open(k)).keys()).length;
    return out;
  });
  check('저장본 (화면·스크립트·글꼴)', Object.keys(caches).length === 2 && Object.values(caches).every((n) => n > 0), JSON.stringify(caches));

  // ── 인터넷 끊고 다시 열기 (서버도 닫아서 저장본만으로 열리는지 확실히 확인) ──
  await ctx.setOffline(true);
  await closeServer();
  failed.length = 0;
  await page.reload();
  await ready();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#style-stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__wvm.demoPlaying(), null, { timeout: 10000 }).catch(() => undefined);
  const off = await page.evaluate(() => ({
    online: navigator.onLine,
    creator: document.querySelector('.creator')?.textContent?.trim(),
    cards: document.querySelectorAll('#theme-list .theme-card').length,
    demo: window.__wvm.demoPlaying(),
  }));
  check(
    '인터넷 없이 다시 열기 (화면·스타일 카드·예시 영상)',
    !off.online && off.creator === '제작자 : 부산북구 주양현' && off.cards === 17 && off.demo,
    JSON.stringify(off),
  );
  // 서비스 워커가 직접 받는 요청도 막혔는지 (그래야 저장본만으로 열렸다는 뜻). 저장본에 없는 파일을 요청해 봄
  const swNet = await page.evaluate(() => fetch(`./sw.js?probe=${Date.now()}`, { cache: 'no-store' }).then((r) => `열림(${r.status})`, () => '막힘'));
  console.log(`서비스 워커 쪽 인터넷: ${swNet}`);
  // 인터넷 없이 사진 올리기 → 미리보기
  const specs = fixtureSpecs();
  await page.setInputFiles('#file-input', specs.slice(0, 8).map((s) => path.join(fixDir, s.file)));
  await page.waitForFunction(() => /추가했어요/.test(document.querySelector('#import-status')?.textContent ?? ''), null, { timeout: 60000 });
  const tl = await page.evaluate(() => window.__wvm.timeline()?.segments.length ?? 0);
  await page.locator('#preview').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const lit = await page.$eval('#preview', (c) => {
    const g = document.createElement('canvas');
    g.width = 160;
    g.height = 90;
    const x = g.getContext('2d');
    x.drawImage(c, 0, 0, 160, 90);
    const d = x.getImageData(0, 0, 160, 90).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return s / (d.length / 4) / 3;
  });
  check('인터넷 없이 사진 올리기 · 미리보기 (0초 표지 화면)', tl > 5 && lit > 20, `장면 ${tl}개, 밝기 ${lit.toFixed(1)}`);
  await page.screenshot({ path: path.join(outDir, 'pwa-offline.png') });
  // 처음 쓰는 스타일·글자 (이름): 한글 글꼴은 글자 묶음별로 나뉘어 있어, 안 써 본 묶음은 저장본에 없을 수 있음
  await page.click('label.theme-card:has(input[value="classic"])');
  await page.fill('#f-groom', '황보찬혁');
  await page.fill('#f-bride', '제갈윤슬');
  await page.waitForTimeout(3000);
  await page.click('label.theme-card:has(input[value="street"])');
  await page.waitForTimeout(3000);
  // 인터넷 없이 받지 못한 파일 (처음 쓰는 글꼴 조각 등)
  const missing = [...new Set(failed)].filter((u) => !u.includes('probe='));
  console.log(`인터넷 없이 받지 못한 파일 ${missing.length}개${missing.length ? `: ${missing.slice(0, 6).join(', ')}` : ''}`);
  check('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('pwa 실행', false, e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
  await closeServer();
}
const bad = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - bad.length}/${checks.length} 통과`);
process.exit(bad.length ? 1 : 0);
