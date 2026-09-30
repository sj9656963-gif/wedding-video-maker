// 식전영상 메이커 서비스 워커. 빌드할 때 pwa/vite-plugin-sw.mjs가 아래 VERSION·PRECACHE 값을 채워 dist/sw.js로 내보냄.
// - 화면(index.html)은 먼저 인터넷에서 받고, 안 되면 저장본
// - 이름에 해시가 붙은 스크립트·스타일·글꼴은 저장본 먼저 (내용이 바뀌면 이름도 바뀜)
// 사진·음악·만든 영상은 서버로 보내지 않고 저장하지도 않음.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `wvm-shell-${VERSION}`;
const FILES = 'wvm-files';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['./', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set(PRECACHE.map((p) => new URL(p, self.registration.scope).href));
      for (const key of await caches.keys()) {
        if (key.startsWith('wvm-shell-') && key !== SHELL) await caches.delete(key);
      }
      // 예전 빌드의 스크립트·스타일은 지움 (글꼴은 이름이 같으면 계속 씀)
      const files = await caches.open(FILES);
      for (const req of await files.keys()) {
        if (/\.(js|css)$/.test(new URL(req.url).pathname) && !keep.has(req.url)) await files.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

/** 페이지가 이미 받아 둔 파일을 저장 (첫 방문 때 서비스 워커가 켜지기 전에 받은 글꼴 등) */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(FILES).then((c) =>
      Promise.all(
        data.urls
          .filter((u) => typeof u === 'string' && u.startsWith(self.location.origin))
          .map(async (u) => {
            if (await c.match(u)) return;
            try {
              const res = await fetch(u);
              if (res.ok) await c.put(u, res);
            } catch {
              /* 인터넷이 없으면 다음 기회에 */
            }
          }),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(SHELL).then((c) => c.put('./', copy)));
          }
          return res;
        } catch {
          return (await caches.match('./', { ignoreSearch: true })) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && url.pathname.includes('/assets/')) {
        const copy = res.clone();
        event.waitUntil(caches.open(FILES).then((c) => c.put(req, copy)));
      }
      return res;
    })(),
  );
});
