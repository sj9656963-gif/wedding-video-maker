import { defineConfig } from 'vitest/config';
import { serviceWorker } from './pwa/vite-plugin-sw.mjs';

export default defineConfig({
  // 상대 경로로 빌드해 어떤 정적 호스팅 경로에서도 동작하도록 함
  base: './',
  // 홈 화면 설치·오프라인용 서비스 워커(dist/sw.js) 생성
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
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
