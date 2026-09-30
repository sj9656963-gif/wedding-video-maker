// 밝은/어두운 화면: 낮(06~19시)에는 밝게, 밤에는 어둡게 자동으로. 버튼으로 자동 → 라이트 → 다크 순서로 바꿈.
// 바꿀 때는 누른 자리에서 원이 퍼지며 새 화면이 드러남 (View Transitions API 지원 브라우저)

export type Appearance = 'auto' | 'light' | 'dark';
export type Mode = 'light' | 'dark';

const KEY = 'wvm-appearance';
const LABEL: Record<Appearance, string> = { auto: '자동', light: '라이트', dark: '다크' };
const DESC: Record<Appearance, string> = {
  auto: '시간에 따라 자동 (낮 밝게 · 밤 어둡게)',
  light: '항상 밝게',
  dark: '항상 어둡게',
};
const THEME_COLOR: Record<Mode, string> = { light: '#f6f2ec', dark: '#151115' };

/** 06시~19시 전은 밝은 화면 */
export function modeForTime(d = new Date()): Mode {
  const h = d.getHours();
  return h >= 6 && h < 19 ? 'light' : 'dark';
}

export function initAppearance(onChange: (mode: Mode) => void): { mode: () => Mode } {
  const root = document.documentElement;
  const btn = document.getElementById('appearance') as HTMLButtonElement | null;
  const label = document.getElementById('appearance-label');
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pref: Appearance = root.dataset.appearance === 'light' || root.dataset.appearance === 'dark' ? root.dataset.appearance : 'auto';
  const current = (): Mode => (pref === 'auto' ? modeForTime() : pref);

  const commit = () => {
    const mode = current();
    root.dataset.theme = mode;
    root.dataset.appearance = pref;
    if (label) label.textContent = LABEL[pref];
    btn?.setAttribute('aria-label', `화면 밝기: ${DESC[pref]}. 눌러서 바꾸기`);
    btn?.setAttribute('title', DESC[pref]);
    meta?.setAttribute('content', THEME_COLOR[mode]);
    onChange(mode);
    document.dispatchEvent(new CustomEvent<Mode>('appearancechange', { detail: mode }));
  };

  const apply = (from?: { x: number; y: number }) => {
    const changes = root.dataset.theme !== current();
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!changes || !from || reduced || !doc.startViewTransition) {
      commit();
      return;
    }
    const vt = doc.startViewTransition(commit);
    const r = Math.hypot(Math.max(from.x, innerWidth - from.x), Math.max(from.y, innerHeight - from.y));
    void vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${from.x}px ${from.y}px)`, `circle(${r}px at ${from.x}px ${from.y}px)`] },
        { duration: 720, easing: 'cubic-bezier(0.7, 0, 0.25, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  btn?.addEventListener('click', (e) => {
    pref = pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto';
    try {
      if (pref === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* 저장하지 못해도 이번 화면에는 적용 */
    }
    const rect = btn.getBoundingClientRect();
    apply({ x: e.clientX || rect.left + rect.width / 2, y: e.clientY || rect.top + rect.height / 2 });
  });
  // 자동일 때 시간이 바뀌면(06시·19시) 저절로 전환
  setInterval(() => {
    if (pref === 'auto' && root.dataset.theme !== modeForTime()) apply();
  }, 60_000);
  commit();
  return { mode: current };
}
