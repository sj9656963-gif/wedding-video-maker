// 화면 캡처 여러 장을 한 장에 모아 보기 (점검용): node e2e/sheet.mjs <접두사,...> [폴더]
//   예) node e2e/sheet.mjs demo-lovely,demo-royal  → e2e/out/sheet-demo-lovely.png …
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const prefixes = (process.argv[2] ?? '').split(',').filter(Boolean);
const dir = process.argv[3] ?? path.join('e2e', 'out', 'visual');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const prefix of prefixes) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const cells = files
    .map((f) => {
      const src = `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
      return `<div style="position:relative"><img src="${src}" style="width:100%;display:block"><span style="position:absolute;left:4px;top:4px;background:#000b;color:#fff;font:13px sans-serif;padding:1px 5px">${f.replace(/\.png$/, '')}</span></div>`;
    })
    .join('');
  await page.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${cells}</body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join('e2e', 'out', `sheet-${prefix}.png`), fullPage: true });
  console.log(`sheet-${prefix}.png (${files.length}장)`);
}
await browser.close();
