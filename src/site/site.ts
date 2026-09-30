// 홈 화면(홍보 영역) 초기화: 밝기 전환, 비단 배경, 모션, 쇼케이스, 숫자

import { fontFamilyCount } from '../font-catalog';
import { FILTERS, PARTICLES, THEMES, TITLE_DESIGNS, TRANSITIONS } from '../themes';
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

export type CountKey = 'styles' | 'variants' | 'titles' | 'transitions' | 'layouts' | 'fonts' | 'particles' | 'filters';

/** 스타일·양식·오프닝·전환·배치·글씨체·효과 개수 (홍보 문구에 쓰는 실제 값) */
export function catalogCounts(): Record<CountKey, number> {
  const layouts = new Set([...Object.values(LAYOUT_SPECS).map((s) => s.layout), 'magazine']);
  return {
    styles: THEMES.length,
    variants: THEMES.reduce((s, t) => s + t.variants.length, 0),
    titles: TITLE_DESIGNS.length,
    transitions: TRANSITIONS.length,
    layouts: layouts.size,
    fonts: fontFamilyCount(),
    particles: PARTICLES.filter((p) => p.id !== 'none').length,
    filters: FILTERS.length,
  };
}

export function initSite(opts: { onPickStyle: (id: string) => void }): Site {
  // 머리말 스크립트의 '내용 숨김 해제' 예비 타이머 취소 (이미 해제됐으면 그대로 보이게 둠)
  clearTimeout((window as Window & { __wvmFallback?: number }).__wvmFallback);
  const silkCanvas = document.getElementById('silk') as HTMLCanvasElement | null;
  const silk = silkCanvas ? initSilk(silkCanvas) : null;
  initAppearance(() => silk?.refreshColors());

  const counts = catalogCounts();
  // 문구 속 숫자도 실제 값으로 (제목을 단어별로 나누기 전에)
  for (const el of document.querySelectorAll<HTMLElement>('[data-stat]')) {
    const v = counts[el.dataset.stat as CountKey];
    if (v !== undefined) el.textContent = String(v);
  }
  const cmp = document.getElementById('cmp-styles');
  if (cmp) cmp.textContent = `${counts.styles}가지 스타일 · ${counts.variants}가지 양식 · 오프닝 ${counts.titles}종`;
  const cmpCustom = document.getElementById('cmp-custom');
  if (cmpCustom) cmpCustom.textContent = `글씨체 ${counts.fonts}종 · 색감 필터 ${counts.filters}종 · 효과 ${counts.particles}종 직접 선택`;

  splitHeadings();
  initReveal();
  initNav();
  initMagnetic();
  initTilt();
  const morph = document.getElementById('morph');
  if (morph) initMorph(morph, ['영화', '동화', '화보', '선물']);
  initMarquee(
    THEMES.map((t) => t.label.toUpperCase()),
    [
      '영화 같은 전환',
      '키네틱 타이포',
      `글씨체 ${counts.fonts}종`,
      '버블 타이틀',
      '한지 낙관',
      '매거진 커버',
      '동화책 별자리',
      '모노그램',
      '여행 엽서',
      '레트로 선셋',
      '네온사인 타이틀',
      '폴라로이드',
      '스티커 콜라주',
      '전시 액자',
      'REC 캠코더',
      '색감 필터',
      '사진별 문구',
    ],
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
