// 홈 화면(홍보 영역) 초기화: 밝기 전환, 비단 배경, 모션, 쇼케이스, 숫자

import { THEMES, TITLE_DESIGNS, resolveTheme } from '../themes';
import { LAYOUT_SPECS } from '../timeline';
import { initAppearance } from './appearance';
import { initCounters, initMagnetic, initMarquee, initMorph, initNav, initReveal, initTilt, initWhy, splitHeadings } from './motion';
import { initRing } from './showcase';
import { initSilk } from './silk';

export interface Site {
  /** 스타일 카드 그림이 준비되면 쇼케이스·히어로·'왜 직접' 그림에 넣음 */
  setPosters(get: (id: string) => string | undefined): void;
  /** 샘플 사진 그림 ('왜 직접' 사진 타임라인) */
  setSamples(get: (id: string) => string | undefined): void;
  /** 영상을 만드는 동안 비단 배경 애니메이션 멈춤 */
  setBusy(busy: boolean): void;
}

/** 스타일·양식·오프닝·전환·배치 개수 (홍보 문구에 쓰는 실제 값) */
export function catalogCounts(): Record<'styles' | 'variants' | 'titles' | 'transitions' | 'layouts', number> {
  const all = THEMES.flatMap((t) => t.variants.map((v) => resolveTheme(t.id, { variant: v.id })));
  const transitions = new Set(all.flatMap((t) => t.transitions.map((x) => x.type)));
  const layouts = new Set([...Object.values(LAYOUT_SPECS).map((s) => s.layout), 'magazine']);
  return {
    styles: THEMES.length,
    variants: THEMES.reduce((s, t) => s + t.variants.length, 0),
    titles: TITLE_DESIGNS.length,
    transitions: transitions.size,
    layouts: layouts.size,
  };
}

export function initSite(opts: { onPickStyle: (id: string) => void }): Site {
  // 머리말 스크립트의 '내용 숨김 해제' 예비 타이머 취소 (이미 해제됐으면 그대로 보이게 둠)
  clearTimeout((window as Window & { __wvmFallback?: number }).__wvmFallback);
  const silkCanvas = document.getElementById('silk') as HTMLCanvasElement | null;
  const silk = silkCanvas ? initSilk(silkCanvas) : null;
  initAppearance(() => silk?.refreshColors());

  const counts = catalogCounts();
  const cmp = document.getElementById('cmp-styles');
  if (cmp) cmp.textContent = `${counts.styles}가지 스타일 · ${counts.variants}가지 양식 · 오프닝 ${counts.titles}종`;

  splitHeadings();
  initReveal();
  initNav();
  initMagnetic();
  initTilt();
  const morph = document.getElementById('morph');
  if (morph) initMorph(morph, ['영화', '동화', '화보', '선물']);
  initMarquee(
    THEMES.map((t) => t.label.toUpperCase()),
    ['영화 같은 전환', '키네틱 타이포', '레터박스', '네온사인 타이틀', '폴라로이드', '스티커 콜라주', '전시 액자', '타원 액자', '나뭇잎 리스', 'REC 캠코더', '필름 그레인', '사진별 문구'],
  );
  initWhy();
  initCounters(counts);
  const ring = initRing(opts.onPickStyle);

  return {
    setPosters(get) {
      ring.setPosters(get);
      for (const img of document.querySelectorAll<HTMLImageElement>('img[data-poster]')) {
        const url = get(img.dataset.poster ?? '');
        if (url) img.src = url;
      }
    },
    setSamples(get) {
      for (const img of document.querySelectorAll<HTMLImageElement>('img[data-sample]')) {
        const url = get(img.dataset.sample ?? '');
        if (url) img.src = url;
      }
    },
    setBusy(busy) {
      silk?.setPaused(busy);
    },
  };
}
