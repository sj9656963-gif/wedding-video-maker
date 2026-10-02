// Vite 플러그인: 빌드 결과의 스크립트·스타일 목록과 버전을 pwa/sw.template.js에 채워 dist/sw.js로 내보냄.
// 글꼴 조각(수천 개)은 미리 받지 않고, 실제로 쓴 것만 그때그때 저장됨 (sw.template.js 참고).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {import('vite').Plugin} */
export function serviceWorker() {
  return {
    name: 'wvm-service-worker',
    apply: 'build',
    // 파일을 다 쓴 뒤의 최종 목록으로 만듦. generateBundle 때의 목록에는 Vite가 나중에 지우는 조각
    // (꾸미기 글꼴 CSS만 불러오는 빈 스크립트 assets/400-xxxx.js 등)이 남아 있어, 그대로 넣으면 배포 사이트에서
    // 없는 파일(404)을 받으려다 서비스 워커 설치가 통째로 실패함
    writeBundle(options, bundle) {
      const outDir = options.dir ?? path.dirname(options.file ?? '');
      // 꾸미기에서 고를 때만 불러오는 글꼴 CSS(assets/400-xxxx.css 등)는 미리 받지 않음. 쓸 때 저장됨 (sw.template.js)
      const lazyFontCss = /^assets\/\d{3}(-italic)?-[^/]+\.css$/;
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f) && !lazyFontCss.test(f))
        .sort();
      const precache = [
        ...files.map((f) => `./${f}`),
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
      ];
      // 하나라도 없으면 배포된 서비스 워커가 설치되지 않으므로 빌드를 멈춤
      const missing = precache.filter((p) => !existsSync(path.join(outDir, p)));
      if (missing.length) {
        throw new Error(`서비스 워커 미리 저장 목록에 없는 파일이 있어요 (${missing.length}개): ${missing.slice(0, 5).join(', ')}`);
      }
      const template = readFileSync(fileURLToPath(new URL('./sw.template.js', import.meta.url)), 'utf8');
      const version = createHash('sha256').update(files.join('|')).update(template).digest('hex').slice(0, 12);
      const VERSION_LINE = "const VERSION = '__VERSION__';";
      const PRECACHE_LINE = 'const PRECACHE = __PRECACHE__;';
      if (!template.includes(VERSION_LINE) || !template.includes(PRECACHE_LINE)) {
        throw new Error('pwa/sw.template.js에 VERSION·PRECACHE 자리가 없어요.');
      }
      writeFileSync(
        path.join(outDir, 'sw.js'),
        template
          .replace(VERSION_LINE, `const VERSION = '${version}';`)
          .replace(PRECACHE_LINE, `const PRECACHE = ${JSON.stringify(precache)};`),
      );
    },
  };
}
