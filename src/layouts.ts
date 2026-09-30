// 여러 장·특수 배치 장면: 폴라로이드, 콜라주, 모자이크, 타원 액자, 매거진(감성 문구), 필름 스트립, 연도 챕터.
// 사용자가 사진에 넣은 문구는 모든 배치에서 그 배치에 맞는 자리(카드 여백·칸 아래쪽 등)에 표시됨.

import type { DrawableImage } from './assets';
import { DESIGN_H as H, DESIGN_W as W, clamp01, easeInOutCubic, easeOutCubic, smoothstep } from './design';
import {
  captionOf,
  drawCover,
  drawCoverClipped,
  fillSpaced,
  fitLine,
  isDark,
  roundRectPath,
  type SceneEnv,
  type SceneTime,
} from './draw-utils';
import { overlayInsets } from './overlays';
import { hash01 } from './random';
import { wrapText } from './text-layout';
import { fontSpec } from './themes';
import type { PhotoSegment } from './types';

type MotionSt = { s: number; ox: number; oy: number };

const deg = (d: number) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;

/** 여러 장 배치의 배경: 흐린 사진 + 테마 색 */
export function drawBackdrop(env: SceneEnv, id: string | undefined, st: MotionSt): void {
  const { ctx, theme } = env;
  const look = theme.look;
  ctx.fillStyle = look.backdropBase;
  ctx.fillRect(0, 0, W, H);
  const bl = id ? env.assets.blur(id) : null;
  if (bl && look.backdropBlurAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= look.backdropBlurAlpha;
    drawCover(ctx, bl, 0, 0, W, H, 1.06 + (st.s - 1) * 0.4, 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = look.backdropWash;
  ctx.fillRect(0, 0, W, H);
}

/** 배경(backdrop) 위에 쓰는 사진 문구 색: 배경이 어두우면 밝은 글자 */
export function backdropTextColor(env: SceneEnv): string {
  return isDark(env.theme.look.backdropBase) ? env.theme.colors.text : env.theme.look.caption;
}

// ───────────────────────── 폴라로이드 ─────────────────────────

const POLAROID_SLOTS: Record<number, { x: number; y: number; r: number }[]> = {
  1: [{ x: 0, y: 0, r: -3 }],
  2: [
    { x: -330, y: 16, r: -6 },
    { x: 330, y: -14, r: 5 },
  ],
  3: [
    { x: -545, y: 28, r: -7 },
    { x: 0, y: -22, r: 2.5 },
    { x: 545, y: 16, r: 6.5 },
  ],
};
const POLAROID_WIDTH: Record<number, number> = { 1: 560, 2: 520, 3: 468 };

function drawPolaroidCard(
  env: SceneEnv,
  img: DrawableImage,
  id: string,
  cx: number,
  cy: number,
  cardW: number,
  rot: number,
  alpha: number,
  scale: number,
  seed: number,
): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const pad = cardW * 0.055;
  const photoW = cardW - pad * 2;
  const a = Math.min(1.2, Math.max(0.8, img.width / img.height));
  const photoH = photoW / a;
  const bottom = cardW * 0.2;
  const cardH = pad + photoH + bottom;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(40,20,24,0.36)';
  ctx.shadowBlur = 36 * k;
  ctx.shadowOffsetY = 16 * k;
  ctx.fillStyle = look.frame;
  ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const top = -cardH / 2 + pad;
  drawCoverClipped(ctx, img, -photoW / 2, top, photoW, photoH, 1, 0, -0.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-photoW / 2, top, photoW, photoH);
  // 아래 여백에는 사용자가 넣은 문구만 손글씨로 (날짜를 자동으로 적지 않음)
  const caption = captionOf(env, id);
  if (caption) {
    ctx.fillStyle = look.caption;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = fitLine(ctx, caption, photoW * 0.94, (s) => fontSpec(theme.fonts.hand, s), cardW * 0.095);
    ctx.fillText(fit.text, 0, cardH / 2 - bottom * 0.5);
  }
  if (look.tape) {
    const tw = cardW * 0.34;
    const th = cardW * 0.085;
    ctx.save();
    ctx.translate((hash01(seed * 13 + 1) - 0.5) * cardW * 0.2, -cardH / 2 + th * 0.12);
    ctx.rotate(deg((hash01(seed * 13 + 2) - 0.5) * 10));
    ctx.fillStyle = look.tape;
    ctx.fillRect(-tw / 2, -th / 2, tw, th);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-tw / 2, -th / 2, tw, th * 0.35);
    ctx.restore();
  }
  ctx.restore();
}

export function drawPolaroidScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const ids = seg.photoIds;
  const n = Math.min(3, ids.length);
  drawBackdrop(env, ids[0], m);
  const flip = seg.variant % 2 === 1 ? -1 : 1;
  const slots = POLAROID_SLOTS[n];
  const cardW = POLAROID_WIDTH[n];
  for (let j = 0; j < n; j++) {
    const img = env.assets.image(ids[j]);
    if (!img) continue;
    const slot = slots[j];
    // 선명하게 드러나는 전환이면 전환 도중에 카드가 모두 자리 잡도록 앞당김
    const appear = st.reveal ? j * 0.22 - 0.35 : st.tin * 0.35 + j * 0.38;
    const e = easeOutCubic((st.u - appear) / 0.9);
    if (e <= 0) continue;
    const float = Math.sin(st.u * 0.55 + j * 1.7);
    const cx = W / 2 + slot.x * flip + float * 3;
    const cy = H / 2 + slot.y + (1 - e) * 90 + Math.sin(st.u * 0.45 + j) * 5;
    const rot = deg(slot.r * flip + (1 - e) * 7 * (j % 2 ? -1 : 1) + float * 0.5);
    drawPolaroidCard(env, img, ids[j], cx, cy, cardW, rot, e, 1.07 - 0.07 * e, j + seg.variant * 3 + seg.index);
  }
}

// ───────────────────────── 콜라주 · 모자이크 ─────────────────────────

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

const M = 56;
const G = 18;

/** 칸을 놓을 세로 범위: 레터박스가 있으면 그 안쪽으로, 칸에 문구가 있으면 아래 모서리 화면 글자(캠코더 날짜 등) 위까지 */
function cellBand(env: SceneEnv, seg: PhotoSegment): { y0: number; hh: number } {
  const ins = overlayInsets(env.theme);
  const hasCaption = ins.hud > 0 && seg.photoIds.some((id) => captionOf(env, id));
  const y0 = Math.max(M, ins.top + G);
  const y1 = H - Math.max(M, ins.bottom + G, hasCaption ? ins.hud : 0);
  return { y0, hh: y1 - y0 };
}

function aspectsOf(imgs: (DrawableImage | null)[]): number[] {
  return imgs.map((img) => (img ? img.width / img.height : 1.5));
}

/** 가장 세로로 긴 사진부터 정렬한 인덱스 */
const byAspect = (a: number[]) => a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

function collageCells(a: number[], variant: number, y0: number, hh: number): { cells: Cell[]; order: number[] } {
  const tall = a.filter((v) => v < 1.1).length;
  if (tall >= 2) {
    const w = (W - 2 * M - 2 * G) / 3;
    return {
      cells: [0, 1, 2].map((i) => ({ x: M + i * (w + G), y: y0, w, h: hh })),
      order: [0, 1, 2],
    };
  }
  const flip = variant % 2 === 1;
  const wBig = Math.round((W - 2 * M - G) * 0.57);
  const wS = W - 2 * M - G - wBig;
  const hS = (hh - G) / 2;
  const bigX = flip ? W - M - wBig : M;
  const sX = flip ? M : M + wBig + G;
  const sorted = byAspect(a);
  return {
    cells: [
      { x: bigX, y: y0, w: wBig, h: hh },
      { x: sX, y: y0, w: wS, h: hS },
      { x: sX, y: y0 + hS + G, w: wS, h: hS },
    ],
    // 가장 세로에 가까운 사진을 큰 칸에
    order: [sorted[0], ...[0, 1, 2].filter((i) => i !== sorted[0])],
  };
}

function gridCells(a: number[], variant: number, y0: number, hh: number): { cells: Cell[]; order: number[] } {
  const land = a.filter((v) => v >= 1.3).length;
  const tall = a.filter((v) => v < 1.1).length;
  if (land >= 3) {
    const w = (W - 2 * M - G) / 2;
    const h = (hh - G) / 2;
    return {
      cells: [0, 1, 2, 3].map((i) => ({ x: M + (i % 2) * (w + G), y: y0 + Math.floor(i / 2) * (h + G), w, h })),
      order: [0, 1, 2, 3],
    };
  }
  if (tall >= 3) {
    const w = (W - 2 * M - 3 * G) / 4;
    return {
      cells: [0, 1, 2, 3].map((i) => ({ x: M + i * (w + G), y: y0, w, h: hh })),
      order: [0, 1, 2, 3],
    };
  }
  // 큰 세로 칸 + 넓은 칸 + 작은 칸 두 개
  const flip = variant % 2 === 1;
  const wBig = Math.round((W - 2 * M - G) * 0.4);
  const wR = W - 2 * M - G - wBig;
  const hR = (hh - G) / 2;
  const wSmall = (wR - G) / 2;
  const bigX = flip ? W - M - wBig : M;
  const rX = flip ? M : M + wBig + G;
  const sorted = byAspect(a);
  return {
    cells: [
      { x: bigX, y: y0, w: wBig, h: hh },
      { x: rX, y: y0, w: wR, h: hR },
      { x: rX, y: y0 + hR + G, w: wSmall, h: hR },
      { x: rX + wSmall + G, y: y0 + hR + G, w: wSmall, h: hR },
    ],
    order: [sorted[0], sorted[3], sorted[1], sorted[2]],
  };
}

/** 칸(콜라주·모자이크·필름 스트립) 아래쪽 안에 쓰는 사진 문구: 사진 위 어둡게 한 띠 + 흰 글자 */
function drawCellCaption(env: SceneEnv, text: string, x: number, y: number, w: number, h: number): void {
  const { ctx, theme, k } = env;
  const band = Math.min(130, h * 0.36);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y + h - band, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h - band, w, band);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8 * k;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const pad = Math.min(26, w * 0.06);
  const size = Math.max(24, Math.min(34, w * 0.065));
  const fit = fitLine(ctx, text, w - pad * 2, (s) => fontSpec(theme.fonts.body, s, theme.fonts.bodyWeight), size);
  ctx.fillText(fit.text, x + pad, y + h - pad);
  ctx.restore();
}

function drawCells(
  env: SceneEnv,
  seg: PhotoSegment,
  st: SceneTime,
  layout: { cells: Cell[]; order: number[] },
  imgs: (DrawableImage | null)[],
  stagger: number,
): void {
  const { ctx, theme } = env;
  ctx.fillStyle = theme.look.gap;
  ctx.fillRect(0, 0, W, H);
  layout.cells.forEach((c, j) => {
    const img = imgs[layout.order[j]];
    if (!img) return;
    // 선명하게 드러나는 전환이면 칸이 비어 보이지 않게 처음부터 채워 둠
    const e = st.reveal ? 1 : easeOutCubic((st.u - (st.tin * 0.25 + j * stagger)) / 0.8);
    if (e <= 0) return;
    const sc = 0.94 + 0.06 * e;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const w = c.w * sc;
    const h = c.h * sc;
    ctx.save();
    ctx.globalAlpha *= e;
    // 칸 안의 사진은 살짝 확대된 상태에서 제자리로 온 뒤 천천히 다가감
    const zoom = 1.12 - 0.08 * e + st.p * 0.05;
    drawCoverClipped(ctx, img, cx - w / 2, cy - h / 2, w, h, zoom, (hash01(seg.index * 7 + j) - 0.5) * 0.6, -0.25);
    const cap = captionOf(env, seg.photoIds[layout.order[j]]);
    if (cap) {
      ctx.globalAlpha *= easeOutCubic((st.u - (st.reveal ? 0.3 : st.tin * 0.25 + j * stagger + 0.5)) / 0.8);
      drawCellCaption(env, cap, cx - w / 2, cy - h / 2, w, h);
    }
    ctx.restore();
  });
}

export function drawCollageScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime): void {
  const imgs = seg.photoIds.map((id) => env.assets.image(id));
  const { y0, hh } = cellBand(env, seg);
  drawCells(env, seg, st, collageCells(aspectsOf(imgs), seg.variant, y0, hh), imgs, 0.3);
}

export function drawGridScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime): void {
  const imgs = seg.photoIds.map((id) => env.assets.image(id));
  const { y0, hh } = cellBand(env, seg);
  drawCells(env, seg, st, gridCells(aspectsOf(imgs), seg.variant, y0, hh), imgs, 0.2);
}

// ───────────────────────── 타원 액자 (카메오) ─────────────────────────

function ellipsePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
}

/**
 * 고전 초상화 액자처럼 사진을 타원으로 담고, 크림색 매트와 가는 장식선이 둘러싸는 장면.
 * 바깥 장식선은 위에서부터 한 바퀴 그려지고, 사진 문구는 액자 아래에 적힘
 */
export function drawOvalScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const id = seg.photoIds[0];
  const img = env.assets.image(id);
  drawBackdrop(env, id, m);
  const caption = captionOf(env, id);
  const ins = overlayInsets(theme);
  const aspect = img ? img.width / img.height : 0.8;
  const wide = aspect >= 1.25;
  // 문구가 있으면 아래에 자리를 남기고 액자를 조금 올림
  const capSpace = caption ? 120 : 0;
  const top = ins.top + 70;
  const bottom = H - ins.bottom - 70 - capSpace;
  const MAT = 22;
  const LINE = 44;
  const ry = Math.min(wide ? 330 : 392, (bottom - top) / 2 - LINE);
  const rx = ry * (wide ? 1.46 : 0.8);
  const cx = W / 2 + (seg.variant % 2 ? 1 : -1) * 8;
  const cy = (top + bottom) / 2;

  const start = st.reveal ? -0.5 : st.tin * 0.2;
  const e = easeOutCubic((st.u - start) / 1.3);
  if (e <= 0) return;
  const breathe = 1 + 0.005 * Math.sin(st.u * 1.1);
  const s = (0.955 + 0.045 * e) * breathe;

  // 액자 뒤 은은한 빛
  const glow = ctx.createRadialGradient(cx, cy, ry * 0.3, cx, cy, ry * 1.75);
  glow.addColorStop(0, `rgba(${look.light},${(0.5 * e).toFixed(3)})`);
  glow.addColorStop(1, `rgba(${look.light},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha *= clamp01(e * 1.5);
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  // 매트 (그림자와 함께)
  ctx.save();
  ctx.shadowColor = 'rgba(50,28,32,0.34)';
  ctx.shadowBlur = 54 * k;
  ctx.shadowOffsetY = 20 * k;
  ctx.fillStyle = look.frame;
  ellipsePath(ctx, 0, 0, rx + MAT, ry + MAT);
  ctx.fill();
  ctx.restore();
  // 매트 위 가는 음각선
  ctx.save();
  ctx.strokeStyle = look.paperAccent;
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 1.6;
  ellipsePath(ctx, 0, 0, rx + MAT * 0.55, ry + MAT * 0.55);
  ctx.stroke();
  ctx.restore();
  // 사진
  if (img) {
    ctx.save();
    ellipsePath(ctx, 0, 0, rx, ry);
    ctx.clip();
    drawCover(ctx, img, -rx, -ry, rx * 2, ry * 2, m.s, m.ox * 0.5, m.oy * 0.5 - 0.15);
    // 가장자리를 살짝 어둡게 해 액자 안쪽으로 깊이감
    const inner = ctx.createRadialGradient(0, 0, Math.min(rx, ry) * 0.72, 0, 0, Math.max(rx, ry) * 1.02);
    inner.addColorStop(0, 'rgba(0,0,0,0)');
    inner.addColorStop(1, 'rgba(40,20,24,0.28)');
    ctx.fillStyle = inner;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ellipsePath(ctx, 0, 0, rx, ry);
  ctx.stroke();

  // 바깥 장식선: 맨 위에서 시작해 양쪽으로 한 바퀴 그려짐
  const draw = easeInOutCubic(clamp01((st.u - start - 0.25) / 1.7));
  if (draw > 0) {
    ctx.save();
    ctx.strokeStyle = look.frameLine;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(${look.light},0.9)`;
    ctx.shadowBlur = 14 * k;
    const R = [rx + LINE, ry + LINE] as const;
    for (const dir of [1, -1]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R[0], R[1], 0, -Math.PI / 2, -Math.PI / 2 + dir * Math.PI * draw, dir === -1);
      ctx.stroke();
    }
    // 위·아래 작은 마름모 장식
    const orn = smoothstep(0.1, 0.5, draw);
    for (const y of [-R[1], R[1]]) {
      const d = 9 * orn;
      if (d <= 0.2) continue;
      ctx.fillStyle = look.frameLine;
      ctx.beginPath();
      ctx.moveTo(0, y - d);
      ctx.lineTo(d * 0.8, y);
      ctx.lineTo(0, y + d);
      ctx.lineTo(-d * 0.8, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();

  if (caption) {
    const ce = easeOutCubic((st.u - start - 0.9) / 0.9);
    if (ce > 0) {
      ctx.save();
      ctx.globalAlpha *= ce;
      ctx.fillStyle = backdropTextColor(env);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = cy + (ry + LINE) * s + 74 + (1 - ce) * 14;
      const fit = fitLine(ctx, caption, 1100, (sz) => fontSpec(theme.fonts.hand, sz), 62);
      ctx.fillText(fit.text, cx, y);
      ctx.restore();
    }
  }
}

// ───────────────────────── 매거진 (사진 + 감성 문구) ─────────────────────────

export function drawMagazineScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const f = theme.fonts;
  ctx.fillStyle = look.paper;
  ctx.fillRect(0, 0, W, H);
  const paperGlow = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.9);
  paperGlow.addColorStop(0, 'rgba(255,255,255,0.45)');
  paperGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = paperGlow;
  ctx.fillRect(0, 0, W, H);

  const id = seg.photoIds[0];
  const img = env.assets.image(id);
  const ins = overlayInsets(theme);
  // 사진·글은 레터박스 안쪽, 캠코더·디카 화면 글자(모서리의 REC·날짜)와 액자 테두리가 겹치지 않는 범위에
  const topIn = Math.max(ins.top, ins.hudTop);
  const bottomIn = Math.max(ins.bottom, ins.hud);
  const landscape = img ? img.width / img.height >= 1.2 : false;
  const maxH = H - topIn - bottomIn - (ins.hudTop ? 16 : 90);
  const ph = Math.min(landscape ? 720 : 900, maxH);
  const pw = (landscape ? 1000 : 800) * (ph / (landscape ? 720 : 900));
  const left = seg.variant % 2 === 0;
  const px = left ? 110 : W - 110 - pw;
  const py = topIn + (H - topIn - bottomIn - ph) / 2;
  const e = easeOutCubic((st.u - (st.reveal ? -0.6 : st.tin * 0.2)) / 1.1);
  const dx = (1 - e) * (left ? -40 : 40);
  if (img) {
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 1.3);
    ctx.shadowColor = 'rgba(40,24,20,0.28)';
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 14 * k;
    ctx.fillStyle = look.frame;
    ctx.fillRect(px + dx - 14, py - 14, pw + 28, ph + 28);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 1.3);
    drawCoverClipped(ctx, img, px + dx, py, pw, ph, 1 + (m.s - 1) * 0.6, m.ox * 0.4, -0.2);
    ctx.restore();
  }

  // 글 영역
  const tx0 = left ? px + pw + 100 : 110;
  const tw = left ? W - tx0 - 110 : px - 100 - 110;
  const tcx = tx0 + tw / 2;
  const quote = seg.quote ?? '';
  ctx.font = fontSpec(f.body, 54, f.bodyWeight);
  const lines = wrapText(quote, tw, (s) => ctx.measureText(s).width).slice(0, 5);
  // 글 아래 작은 줄: 사진 문구가 있으면 그것, 없으면 (연도가 바뀌는 장면일 때) 연도
  const small = captionOf(env, id) || (seg.year ? String(seg.year) : '');
  const labelH = theme.titleStyle === 'script' ? 110 : 60;
  const lineH = 84;
  const total = labelH + 40 + lines.length * lineH + (small ? 70 : 0);
  let y = (topIn + H - bottomIn) / 2 - total / 2;
  const item = (at: number, h: number, draw: (cy: number) => void) => {
    const a = easeOutCubic((st.u - st.tin * 0.3 - at) / 1.0);
    if (a > 0.002) {
      ctx.save();
      ctx.globalAlpha *= a;
      draw(y + h / 2 + (1 - a) * 22);
      ctx.restore();
    }
    y += h;
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  item(0.2, labelH, (cy) => {
    ctx.fillStyle = look.paperAccent;
    if (theme.titleStyle === 'script') {
      ctx.font = fontSpec(f.title, 92, f.titleWeight, f.titleItalic);
      ctx.fillText(look.magazineLabel, tcx, cy + 6);
    } else {
      ctx.font = fontSpec(f.latin, 34, 500);
      fillSpaced(ctx, look.magazineLabel.toUpperCase(), tcx, cy, 12);
    }
  });
  item(0.45, 40, (cy) => {
    ctx.strokeStyle = look.paperAccent;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tcx - 70, cy);
    ctx.lineTo(tcx + 70, cy);
    ctx.stroke();
  });
  lines.forEach((line, i) => {
    item(0.7 + i * 0.22, lineH, (cy) => {
      ctx.fillStyle = look.paperText;
      ctx.font = fontSpec(f.body, 54, f.bodyWeight);
      ctx.fillText(line, tcx, cy);
    });
  });
  if (small) {
    item(0.9 + lines.length * 0.22, 70, (cy) => {
      ctx.fillStyle = look.paperMuted;
      const fit = fitLine(ctx, small, tw, (s) => fontSpec(f.latin, s, 500, true), 34);
      ctx.fillText(fit.text, tcx, cy + 12);
    });
  }
}

// ───────────────────────── 필름 스트립 ─────────────────────────

export function drawFilmstripScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme } = env;
  drawBackdrop(env, seg.photoIds[0], m);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  const tiltBase = theme.look.stripTilt;
  const tilt = deg(tiltBase * (seg.variant % 2 === 1 ? -1 : 1));
  const bandH = 600;
  const frameH = 430;
  const gap = 46;
  const imgs = seg.photoIds.map((id) => env.assets.image(id));
  const widths = imgs.map((img) => frameH * Math.min(1.55, Math.max(0.72, img ? img.width / img.height : 1.5)));
  const centers: number[] = [];
  let acc = 0;
  widths.forEach((w, j) => {
    centers.push(acc + w / 2);
    acc += w + (j < widths.length - 1 ? gap : 0);
  });
  // 오른쪽에서 왼쪽으로 일정한 속도로 흐름: 첫 칸 중심이 화면 68% → 마지막 칸 중심이 32%
  const q = clamp01(st.u / st.dur);
  const off = W * 0.68 - centers[0] + (W * 0.32 - centers[centers.length - 1] - (W * 0.68 - centers[0])) * q;
  const y0 = H / 2 - bandH / 2;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(tilt);
  ctx.translate(-W / 2, -H / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 40 * env.k;
  ctx.fillStyle = '#15110e';
  ctx.fillRect(-320, y0, W + 640, bandH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  // 구멍
  const pitch = 62;
  const holeStart = -320 + ((((off % pitch) + pitch) % pitch) - pitch);
  ctx.fillStyle = 'rgba(236,226,206,0.88)';
  for (let x = holeStart; x < W + 320; x += pitch) {
    roundRectPath(ctx, x, y0 + 22, 34, 22, 5);
    ctx.fill();
    roundRectPath(ctx, x, y0 + bandH - 44, 34, 22, 5);
    ctx.fill();
  }
  // 사진 칸
  const fy = H / 2 - frameH / 2;
  imgs.forEach((img, j) => {
    const x = off + centers[j] - widths[j] / 2;
    if (x > W + 300 || x + widths[j] < -300) return;
    ctx.fillStyle = '#0b0908';
    ctx.fillRect(x - 6, fy - 6, widths[j] + 12, frameH + 12);
    if (img) drawCoverClipped(ctx, img, x, fy, widths[j], frameH, 1.02, 0, -0.2);
    const cap = captionOf(env, seg.photoIds[j]);
    if (cap && img) drawCellCaption(env, cap, x, fy, widths[j], frameH);
    // 필름 가장자리 번호
    ctx.fillStyle = theme.look.stripInk;
    ctx.font = fontSpec(theme.fonts.latin, 26, 500);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${seg.index * 4 + j + 1}  ▸`, x + 6, y0 + bandH - 70);
    ctx.fillText(`${seg.index * 4 + j + 1}A`, x + widths[j] - 60, y0 + 70);
  });
  ctx.restore();
}

// ───────────────────────── 연도 챕터 ─────────────────────────

/** 촬영 연도가 바뀌는 장면 왼쪽 아래에 연도 표시 (레터박스·캠코더 표시 위로 올려 가려지지 않게) */
export function drawYearChapter(env: SceneEnv, year: number, st: SceneTime): void {
  const { ctx, theme, k } = env;
  const start = st.tin + 0.15;
  const a = smoothstep(start, start + 0.7, st.u) * (1 - smoothstep(start + 2.9, start + 3.7, st.u));
  if (a <= 0.002) return;
  ctx.save();
  const lift = Math.max(128, overlayInsets(theme).textBottom + 40);
  const scrim = ctx.createRadialGradient(0, H - lift + 128, 0, 0, H - lift + 128, 760);
  scrim.addColorStop(0, `rgba(0,0,0,${(0.42 * a).toFixed(3)})`);
  scrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha *= a;
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = 20 * k;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x = 120;
  const base = H - lift + (1 - a) * 16;
  const script = theme.titleStyle === 'script';
  ctx.fillStyle = theme.colors.accent;
  if (script) {
    ctx.font = fontSpec(theme.fonts.title, 64, theme.fonts.titleWeight);
    ctx.fillText('Our story', x + 4, base - 150);
  } else {
    ctx.font = fontSpec(theme.fonts.latin, 28, 500);
    ctx.fillText('O U R   S T O R Y', x + 6, base - 160);
  }
  ctx.fillStyle = theme.colors.text;
  ctx.font = fontSpec(theme.fonts.latin, 150, 500);
  ctx.fillText(String(year), x, base);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = theme.colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 6, base + 34);
  ctx.lineTo(x + 6 + 240 * a, base + 34);
  ctx.stroke();
  ctx.restore();
}
