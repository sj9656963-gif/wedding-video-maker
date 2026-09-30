// 홈 화면 설치(PWA): 서비스 워커 등록(한 번 열면 인터넷 없이도 열림)과 '앱 설치' 버튼.
// 서비스 워커(sw.js)는 빌드할 때 만들어지므로 개발 서버(npm run dev)에서는 등록하지 않음.

/** Chrome·Edge의 설치 안내 이벤트 (표준 DOM 타입에 없음) */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** 이 페이지가 이미 받아 둔 같은 주소의 파일(글꼴·스크립트)을 서비스 워커에 알려 저장하게 함 */
function cacheLoadedFiles(sw: ServiceWorker | null | undefined): void {
  if (!sw) return;
  const urls = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) && /\/assets\//.test(u));
  if (urls.length) sw.postMessage({ type: 'cache', urls: Array.from(new Set(urls)) });
}

export function initPwa(): void {
  const btn = document.getElementById('install') as HTMLButtonElement | null;
  let deferred: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    if (btn && !isStandalone()) btn.hidden = false;
  });
  btn?.addEventListener('click', () => {
    const ev = deferred;
    if (!ev) return;
    deferred = null;
    btn.hidden = true;
    void ev.prompt().catch(() => undefined);
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (btn) btn.hidden = true;
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const q = new URLSearchParams(location.search);
  // 자동 테스트는 캐시 영향을 받지 않도록 (서비스 워커 점검은 ?sw로)
  if (q.has('e2e') && !q.has('sw')) return;
  const register = () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(async () => {
        const reg = await navigator.serviceWorker.ready;
        cacheLoadedFiles(reg.active);
        // 예시 영상용 글꼴은 조금 뒤에 받아지므로 한 번 더
        setTimeout(() => cacheLoadedFiles(reg.active), 20000);
      })
      .catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
