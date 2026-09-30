import { defineConfig } from 'vitest/config';
import { serviceWorker } from './pwa/vite-plugin-sw.mjs';

/** 처음부터 쓰는 글꼴 (src/fonts.ts 맨 위 import). 작은 글꼴 조각은 기존처럼 CSS 안에 넣어 둠 */
const BASE_FONT_PACKAGES = new Set([
  'gowun-batang',
  'great-vibes',
  'cormorant-garamond',
  'noto-sans-kr',
  'nanum-myeongjo',
  'nanum-pen-script',
  'black-han-sans',
  'anton',
  'cinzel',
  'vt323',
  'nanum-gothic-coding',
]);

export default defineConfig({
  // 상대 경로로 빌드해 어떤 정적 호스팅 경로에서도 동작하도록 함
  base: './',
  // 홈 화면 설치·오프라인용 서비스 워커(dist/sw.js) 생성
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // 꾸미기에서 고를 때 불러오는 글꼴은 조각 파일을 CSS에 넣지 않음 (CSS가 작아지고, 실제로 쓰는 글자 조각만 받음)
    assetsInlineLimit: (file: string) => {
      const m = /[\\/]@fontsource[\\/]([^\\/]+)[\\/]/.exec(file);
      return m && !BASE_FONT_PACKAGES.has(m[1]) ? false : undefined;
    },
  },
  server: {
    // WebCodecs는 보안 컨텍스트(https 또는 localhost)에서만 동작
    host: 'localhost',
    port: 5173,
  },
  preview: {
    host: 'localhost',
    port: 4173,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
