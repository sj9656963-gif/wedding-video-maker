// 장면 그리기 공용 도우미와 타입

import type { DrawableImage, RenderAssets } from './assets';
import type { DrawTarget } from './design';
import type { Theme } from './themes';

export interface SceneEnv extends DrawTarget {
  theme: Theme;
  assets: RenderAssets;
  /** 사용자가 사진에 넣은 문구 (없으면 빈 문자열) */
  caption?: (id: string) => string;
}

/** 장면 하나를 그릴 때의 시간 정보 */
export interface SceneTime {
  /** 영상 전체 기준 시각 */
  t: number;
  /** 구간 시작 후 경과 시간 */
  u: number;
  /** 구간 길이 */
  dur: number;
  /** 움직임 진행도 (0~1) */
  p: number;
  /** 들어올 때의 전환 길이 */
  tin: number;
  /**
   * 새 장면이 겹쳐 흐려지는 게 아니라 원형·베일·사선·밀기·확대처럼 선명하게 드러나는 전환으로 들어오는지.
   * 이때 여러 장 배치의 등장 연출이 늦으면 빈 배경이 그대로 보이므로 등장을 앞당김
   */
  reveal: boolean;
}

/** 사진 문구 (앞뒤 공백 제거) */
export function captionOf(env: SceneEnv, id: string | undefined): string {
  return id ? (env.caption?.(id) ?? '').trim() : '';
}

/** 이미지를 상자에 꽉 차게 그림(잘라내지 않음). s=확대 배율, ox/oy=-1~1 여유 공간 내 위치 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: DrawableImage,
  x: number,
  y: number,
  w: number,
  h: number,
  s = 1,
  ox = 0,
  oy = 0,
): void {
  const base = Math.max(w / img.width, h / img.height);
  const dw = img.width * base * s;
  const dh = img.height * base * s;
  const dx = x - ((dw - w) * (ox + 1)) / 2;
  const dy = y - ((dh - h) * (oy + 1)) / 2;
  ctx.drawImage(img.image, dx, dy, dw, dh);
}

/** 사각형 안에 잘라서 꽉 채움 */
export function drawCoverClipped(
  ctx: CanvasRenderingContext2D,
  img: DrawableImage,
  x: number,
  y: number,
  w: number,
  h: number,
  s = 1,
  ox = 0,
  oy = 0,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  drawCover(ctx, img, x, y, w, h, s, ox, oy);
  ctx.restore();
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** 글자 사이 간격을 둔 가운데 정렬 텍스트 (letterSpacing 미지원 브라우저 대비 직접 배치) */
export function fillSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, spacing: number): void {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, x, cy);
    x += widths[i] + spacing;
  });
  ctx.textAlign = align;
}

/**
 * 한 줄 문구를 폭에 맞춰 설정: 넘치면 글자 크기를 줄이고(최소 minScale배), 그래도 넘치면 끝을 말줄임.
 * ctx.font를 최종 크기로 바꿔 두고, 그릴 문자열과 그 폭을 돌려줌
 */
export function fitLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  font: (size: number) => string,
  size: number,
  minScale = 0.62,
): { text: string; width: number; size: number } {
  let s = size;
  ctx.font = font(s);
  let w = ctx.measureText(text).width;
  if (w > maxW && w > 0) {
    s = Math.max(size * minScale, (size * maxW) / w);
    ctx.font = font(s);
    w = ctx.measureText(text).width;
  }
  if (w <= maxW) return { text, width: w, size: s };
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxW) chars.pop();
  const out = `${chars.join('').trimEnd()}…`;
  return { text: out, width: ctx.measureText(out).width, size: s };
}

/** 작은 장식용 하트 (베지어) */
export function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.35, cy + s * 0.05, cx - s * 0.75, cy - s * 1.1, cx, cy - s * 0.38);
  ctx.bezierCurveTo(cx + s * 0.75, cy - s * 1.1, cx + s * 1.35, cy + s * 0.05, cx, cy + s * 0.9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** #rrggbb 색이 어두운지 */
export function isDark(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}
