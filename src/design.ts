// 렌더링 공통 상수와 이징 함수. 모든 그리기는 1920×1080 "디자인 좌표"에서 이뤄지고
// 실제 캔버스 크기에 맞게 변환(scale)된다.

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeInOutSine = (x: number) => -(Math.cos(Math.PI * clamp01(x)) - 1) / 2;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** 2D 컨텍스트 + 부가 정보 */
export interface DrawTarget {
  ctx: CanvasRenderingContext2D;
  /** 디자인 좌표 → 픽셀 배율 (그림자 blur처럼 변환이 적용되지 않는 값 보정용) */
  k: number;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

export function get2d(canvas: HTMLCanvasElement, opaque = true): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: !opaque });
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}
