// 임시 점검: 스크롤 후 상단 메뉴 배경이 적용되는지
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await preview({ root, preview: { port: 4181, strictPort: false }, logLevel: 'warn' });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto(`${server.resolvedUrls.local[0]}?e2e`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#why')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const nav = document.getElementById('nav');
    const inn = nav.querySelector('.nav-in');
    const cs = getComputedStyle(inn);
    return { cls: nav.className, y: scrollY, bg: cs.backgroundColor, bf: cs.backdropFilter, z: getComputedStyle(nav).zIndex, mq: document.querySelector('.marquee').getBoundingClientRect().top };
  });
  console.log(JSON.stringify(info));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
