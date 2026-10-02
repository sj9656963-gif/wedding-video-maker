// 장면(구간) 하나의 화면 그리기: 배치별 그리기 함수로 나눠 보냄

import { DESIGN_H as H, DESIGN_W as W, clamp01, smoothstep } from './design';
import { captionOf, drawCover, fitLine, type SceneEnv, type SceneTime } from './draw-utils';
import {
  drawCollageScene,
  drawFilmstripScene,
  drawGridScene,
  drawMagazineScene,
  drawOvalScene,
  drawPolaroidScene,
  drawYearChapter,
} from './layouts';
import { drawArchScene, drawGalleryScene, drawPosterScene, drawStickerScene } from './layouts-extra';
import { overlayInsets } from './overlays';
import { fontSpec } from './themes';
import { motionState } from './timeline';
import type { PhotoSegment, Segment, TitleSegment, TransitionType } from './types';

export type { SceneEnv } from './draw-utils';

type MotionSt = ReturnType<typeof motionState>;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 들어오는 장면을 선명한 채로 공간적으로 드러내는 전환 */
const REVEAL_TRANSITIONS: ReadonlySet<TransitionType> = new Set<TransitionType>([
  'veil',
  'iris',
  'wipe',
  'push',
  'zoom',
  'glitch',
  'tracking',
  'ink',
  'blinds',
  'slide',
  'split',
  'mosaic',
  'clock',
  'shine',
  'page',
]);

/** 그림자와 (테마에 따라) 흰 테두리가 있는 사진 카드 */
function drawCard(env: SceneEnv, img: NonNullable<ReturnType<SceneEnv['assets']['image']>>, cx: number, cy: number, w: number, h: number): void {
  const { ctx, theme, k } = env;
  const b = theme.photoBorder;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.42)';
  ctx.shadowBlur = 38 * k;
  ctx.shadowOffsetY = 12 * k;
  ctx.fillStyle = b > 0 ? theme.look.frame : '#111111';
  ctx.fillRect(cx - w / 2 - b, cy - h / 2 - b, w + b * 2, h + b * 2);
  ctx.restore();
  ctx.drawImage(img.image, cx - w / 2, cy - h / 2, w, h);
}

function drawBlurBackground(env: SceneEnv, id: string, st: MotionSt): void {
  const { ctx, theme } = env;
  const bl = env.assets.blur(id);
  if (bl) drawCover(ctx, bl, 0, 0, W, H, 1.04 + (st.s - 1) * 0.5, 0, 0);
  ctx.fillStyle = theme.colors.sceneDim;
  ctx.fillRect(0, 0, W, H);
}

/** 사진 문구가 나타나는 정도 (장면이 자리 잡은 뒤 천천히, 짧은 장면에서도 가운데쯤엔 다 보이게) */
function captionAlpha(time: SceneTime, delay = 0.35): number {
  const FADE = 0.8;
  // 겹치며 들어오는 전환(디졸브 등)은 전환이 반쯤 지나 사진이 충분히 보일 때부터 (다른 배치와 같은 박자)
  const start = Math.min((time.reveal ? 0 : time.tin * 0.4) + delay, Math.max(0, time.dur * 0.45 - FADE));
  return smoothstep(start, start + FADE, time.u);
}

/** 화면 가득 찬 사진 아래쪽 가운데의 사진 문구 (레터박스·캠코더 표시 위로) */
function drawLowerCaption(env: SceneEnv, text: string, time: SceneTime): void {
  const { ctx, theme, k } = env;
  const a = captionAlpha(time);
  if (a <= 0.002) return;
  const base = H - Math.max(92, overlayInsets(theme).textBottom + 44);
  ctx.save();
  // 글자 뒤 아래쪽을 살짝 어둡게 해 어떤 사진에서도 읽히게
  const scrim = ctx.createLinearGradient(0, base - 240, 0, base + 90);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, `rgba(0,0,0,${(0.36 * a).toFixed(3)})`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, base - 240, W, H - base + 240);
  ctx.globalAlpha *= a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = 18 * k;
  ctx.fillStyle = theme.colors.text;
  const f = theme.fonts;
  const fit = fitLine(ctx, text, 980, (s) => fontSpec(f.body, s, f.bodyWeight), 50);
  ctx.fillText(fit.text, W / 2, base + (1 - a) * 12);
  // 문구 위 짧은 강조선
  ctx.shadowBlur = 0;
  ctx.strokeStyle = theme.colors.accent;
  ctx.globalAlpha *= 0.85;
  ctx.lineWidth = 2;
  const half = 34 * a;
  const ly = base - fit.size - 24;
  ctx.beginPath();
  ctx.moveTo(W / 2 - half, ly);
  ctx.lineTo(W / 2 + half, ly);
  ctx.stroke();
  ctx.restore();
}

/** 액자형 사진 아래의 사진 문구 */
function drawCardCaption(env: SceneEnv, text: string, cx: number, y: number, maxW: number, time: SceneTime): void {
  const { ctx, theme, k } = env;
  const a = captionAlpha(time, 0.5);
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = 14 * k;
  ctx.fillStyle = theme.colors.text;
  const f = theme.fonts;
  const fit = fitLine(ctx, text, maxW, (s) => fontSpec(f.body, s, f.bodyWeight), 42);
  ctx.fillText(fit.text, cx, y + (1 - a) * 10);
  ctx.restore();
}

/** 흐린 배경 위 액자 한 장. 그린 사진 카드의 자리(테두리 포함)를 돌려줌 (연도 표시가 테두리에 걸치지 않게) */
function drawContain(env: SceneEnv, seg: PhotoSegment, st: MotionSt, time: SceneTime): Box | null {
  const id = seg.photoIds[0];
  const img = env.assets.image(id);
  drawBlurBackground(env, id, st);
  if (!img) return null;
  const ins = overlayInsets(env.theme);
  const cap = captionOf(env, id);
  const b = env.theme.photoBorder;
  const capSpace = cap ? 104 : 0;
  // 레터박스가 있으면 그 안쪽에. 문구가 있으면 캠코더·디카 날짜 표시보다 위에서 끝나고,
  // 그만큼 위로 몰리지 않게 캠코더 REC 줄 아래에서 시작
  const top = cap ? Math.max(ins.top, ins.hudTop) : ins.top;
  const bottom = cap ? Math.max(ins.bottom, ins.hud) : ins.bottom;
  const band = H - top - bottom;
  const maxH = band * (ins.top ? 0.9 : 0.86) - capSpace;
  const fit = Math.min((W * 0.9 - b * 2) / img.width, (maxH - b * 2) / img.height);
  const cs = 1 + (st.s - 1) * 0.35;
  const w = img.width * fit * cs;
  const h = img.height * fit * cs;
  const cy = top + (band - capSpace) / 2;
  drawCard(env, img, W / 2, cy, w, h);
  if (cap) drawCardCaption(env, cap, W / 2, cy + h / 2 + b + 60, W * 0.8, time);
  return { x: W / 2 - w / 2 - b, y: cy - h / 2 - b, w: w + b * 2, h: h + b * 2 };
}

function drawPair(env: SceneEnv, seg: PhotoSegment, st: MotionSt, p: number, time: SceneTime): void {
  const [idA, idB] = seg.photoIds;
  const a = env.assets.image(idA);
  const b = idB ? env.assets.image(idB) : null;
  drawBlurBackground(env, idA, st);
  if (!a || !b) return;
  const ins = overlayInsets(env.theme);
  const caps = [captionOf(env, idA), captionOf(env, idB)];
  const capSpace = caps[0] || caps[1] ? 96 : 0;
  const band = H - ins.top - (capSpace ? Math.max(ins.bottom, ins.hud) : ins.bottom);
  const border = env.theme.photoBorder;
  const gap = 56;
  let hh = Math.min(H * 0.8, band * 0.88) - capSpace;
  let wa = (hh * a.width) / a.height;
  let wb = (hh * b.width) / b.height;
  const totalW = wa + wb + gap + border * 4;
  if (totalW > W * 0.9) {
    const s = (W * 0.9) / totalW;
    hh *= s;
    wa *= s;
    wb *= s;
  }
  const cs = 1 + (st.s - 1) * 0.35;
  const cy = ins.top + (band - capSpace) / 2;
  // 두 사진이 살짝 반대 방향으로 움직이는 시차 효과
  const par = (p - 0.5) * 12;
  const cxA = W / 2 - (gap / 2 + border + wa / 2) * cs;
  const cxB = W / 2 + (gap / 2 + border + wb / 2) * cs;
  drawCard(env, a, cxA, cy - par, wa * cs, hh * cs);
  drawCard(env, b, cxB, cy + par, wb * cs, hh * cs);
  const below = (hh * cs) / 2 + border + 54;
  if (caps[0]) drawCardCaption(env, caps[0], cxA, cy - par + below, wa * cs + 120, time);
  if (caps[1]) drawCardCaption(env, caps[1], cxB, cy + par + below, wb * cs + 120, time);
}

function drawTitleBackground(env: SceneEnv, seg: TitleSegment, st: MotionSt): void {
  const { ctx, theme } = env;
  const img = seg.photoId ? env.assets.image(seg.photoId) : null;
  if (img) {
    drawCover(ctx, img, 0, 0, W, H, st.s, st.ox, st.oy);
  } else {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    g.addColorStop(0, theme.swatch[1]);
    g.addColorStop(1, theme.colors.bg);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.fillStyle = theme.colors.titleDim;
  ctx.fillRect(0, 0, W, H);
}

/** 구간의 시각 t 화면(오프닝/엔딩 문구 제외)을 그림. 호출 시 변환은 디자인 좌표 기준이어야 함 */
export function drawSegmentVisual(env: SceneEnv, seg: Segment, t: number): void {
  const { ctx, theme } = env;
  // 오프닝/엔딩과 이어지는 장면은 같은 움직임 구간을 공유 (사진이 끊기지 않도록)
  const span = seg.motionSpan ?? seg;
  const p = clamp01((t - span.start) / (span.end - span.start));
  const st = motionState(seg.motion, p);
  ctx.fillStyle = theme.colors.bg;
  ctx.fillRect(0, 0, W, H);
  if (seg.kind !== 'photo') {
    drawTitleBackground(env, seg, st);
    return;
  }
  const time: SceneTime = {
    t,
    u: t - seg.start,
    dur: seg.end - seg.start,
    p,
    tin: seg.transitionIn?.duration ?? 0,
    reveal: seg.transitionIn ? REVEAL_TRANSITIONS.has(seg.transitionIn.type) : false,
  };
  let card: Box | null = null;
  switch (seg.layout) {
    case 'cover': {
      const id = seg.photoIds[0];
      const img = env.assets.image(id);
      if (img) drawCover(ctx, img, 0, 0, W, H, st.s, st.ox, st.oy);
      const cap = captionOf(env, id);
      if (cap) drawLowerCaption(env, cap, time);
      break;
    }
    case 'contain':
      card = drawContain(env, seg, st, time);
      break;
    case 'pair':
      drawPair(env, seg, st, p, time);
      break;
    case 'polaroid':
      drawPolaroidScene(env, seg, time, st);
      break;
    case 'collage':
      drawCollageScene(env, seg, time);
      break;
    case 'grid':
      drawGridScene(env, seg, time);
      break;
    case 'oval':
      drawOvalScene(env, seg, time, st);
      break;
    case 'magazine':
      drawMagazineScene(env, seg, time, st);
      break;
    case 'filmstrip':
      drawFilmstripScene(env, seg, time, st);
      break;
    case 'poster':
      drawPosterScene(env, seg, time, st);
      break;
    case 'sticker':
      drawStickerScene(env, seg, time, st);
      break;
    case 'gallery':
      drawGalleryScene(env, seg, time);
      break;
    case 'arch':
      drawArchScene(env, seg, time, st);
      break;
  }
  // 매거진은 글 영역에, 포스터는 큰 글자로 연도를 보여주므로 따로 표시하지 않음
  if (seg.year !== undefined && seg.layout !== 'magazine' && seg.layout !== 'poster') drawYearChapter(env, seg.year, time, card);
}
