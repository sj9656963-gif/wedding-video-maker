// 영상 전체에 덧씌우는 장치: 시네마 레터박스, 캠코더 화면 표시(REC·카운터·날짜), 디카 날짜 스탬프,
// VHS 주사선·잔상, 스트릿 촬영 표시, 8mm 필름 게이트. 시각 t와 지금 보이는 장면(촬영 시각·장면 번호)으로 결정됨.

import { DESIGN_H as H, DESIGN_W as W, clamp01, createCanvas, easeInOutSine, get2d } from './design';
import type { Effects } from './effects';
import { hash01 } from './random';
import { fontSpec, type Theme } from './themes';
import type { Segment, WeddingInfo } from './types';

const TAU = Math.PI * 2;
/** 2.39:1 화면비의 위아래 검은 띠 높이 (1080 기준) */
export const LETTERBOX = 138;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 화면 장치에 가려지지 않도록 비워 둘 영역 (1080 기준 px) */
export interface OverlayInsets {
  /** 사진을 레터박스 안쪽에 두기 위한 위·아래 여백 */
  top: number;
  bottom: number;
  /** 사진 문구·연도 글자가 레터박스·캠코더 표시와 겹치지 않도록 아래쪽에 비워 둘 높이 */
  textBottom: number;
  /** 아래 모서리 화면 글자(캠코더 카운터·날짜, 디카 날짜 스탬프)가 차지하는 높이. 문구가 달린 칸·액자는 이 위에서 끝나게 */
  hud: number;
  /** 위 모서리 화면 글자(캠코더 REC·배터리)가 차지하는 높이 */
  hudTop: number;
}

export function overlayInsets(theme: Theme): OverlayInsets {
  const o = theme.overlays;
  const box = o.includes('letterbox') ? LETTERBOX : 0;
  let textBottom = box ? box + 22 : 0;
  // 캠코더 카운터·날짜(아래쪽 976 부근)와 디카 날짜 스탬프(990 부근) 위로
  if (o.includes('camcorder') || o.includes('datestamp')) textBottom = Math.max(textBottom, 150);
  if (o.includes('gate')) textBottom = Math.max(textBottom, 40);
  if (o.includes('lace') || o.includes('pearls') || o.includes('deco')) textBottom = Math.max(textBottom, 50);
  // 캠코더 날짜·시각 두 줄의 윗부분(887 부근), 디카 날짜 스탬프 윗부분(930 부근)보다 위
  let hud = 0;
  if (o.includes('camcorder')) hud = 210;
  else if (o.includes('datestamp')) hud = 165;
  // 캠코더 REC·배터리 줄(77~135) 아래
  const hudTop = o.includes('camcorder') ? 150 : 0;
  return { top: box, bottom: box, textBottom, hud, hudTop };
}

export interface OverlayEnv {
  ctx: CanvasRenderingContext2D;
  k: number;
  theme: Theme;
  info: WeddingInfo;
  effects: Effects;
  photoDate?: (id: string) => number | null;
}

const scanlineCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>();
function scanlines(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!scanlineCache.has(ctx)) {
    const c = createCanvas(4, 4);
    const g = get2d(c, false);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 1, 4, 1);
    scanlineCache.set(ctx, ctx.createPattern(c, 'repeat'));
  }
  return scanlineCache.get(ctx) ?? null;
}

/** 장면이 담고 있는 시각: 사진 촬영 시각, 없으면 예식 일시. time은 시각 정보가 있을 때만 */
function sceneMoment(env: OverlayEnv, seg: Segment): { d: Date; time: boolean } | null {
  if (seg.kind === 'photo') {
    const ms = env.photoDate?.(seg.photoIds[0]);
    if (ms !== null && ms !== undefined && Number.isFinite(ms)) {
      const d = new Date(ms);
      return { d, time: d.getHours() + d.getMinutes() + d.getSeconds() > 0 };
    }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(env.info.date);
  if (!m) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec(env.info.time);
  return { d: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), tm ? Number(tm[1]) : 0, tm ? Number(tm[2]) : 0), time: !!tm };
}

function hudShadow(env: OverlayEnv): void {
  const { ctx, k } = env;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4 * k;
  ctx.shadowOffsetX = 3 * k;
  ctx.shadowOffsetY = 3 * k;
}

function letterbox(env: OverlayEnv, t: number): void {
  const { ctx } = env;
  const h = LETTERBOX * (0.3 + 0.7 * easeInOutSine(clamp01((t - 0.2) / 2.4)));
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, h);
  ctx.fillRect(0, H - h, W, h);
}

function camcorder(env: OverlayEnv, t: number, seg: Segment): void {
  const { ctx, theme } = env;
  ctx.save();
  hudShadow(env);
  ctx.font = fontSpec(theme.fonts.mono, 58);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  // 왼쪽 위: 깜빡이는 REC
  if (Math.floor(t * 1.25) % 2 === 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(118, 104, 17, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('REC', 150, 106);
  // 오른쪽 위: 테이프 모드와 배터리
  ctx.textAlign = 'right';
  ctx.fillText('SP', W - 214, 106);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(W - 190, 88, 74, 36);
  ctx.fillRect(W - 116, 98, 8, 16);
  const bars = 3 - (Math.floor(t / 40) % 3 === 2 ? 1 : 0);
  for (let i = 0; i < bars; i++) ctx.fillRect(W - 183 + i * 22, 95, 16, 22);
  // 왼쪽 아래: 테이프 카운터
  const s = Math.floor(t);
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, 104, H - 104);
  // 오른쪽 아래: 촬영 날짜·시각
  const mo = sceneMoment(env, seg);
  if (mo) {
    const { d } = mo;
    const hr = d.getHours();
    ctx.textAlign = 'right';
    const dateY = mo.time ? H - 164 : H - 104;
    if (mo.time) ctx.fillText(`${hr < 12 ? 'AM' : 'PM'} ${hr % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`, W - 104, H - 104);
    ctx.fillText(`${MONTHS[d.getMonth()]}. ${d.getDate()} ${d.getFullYear()}`, W - 104, dateY);
  }
  // 뷰파인더 모서리
  ctx.shadowOffsetX = 2 * env.k;
  ctx.shadowOffsetY = 2 * env.k;
  ctx.lineWidth = 5;
  const m = 60;
  const L = 70;
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]) {
    ctx.moveTo(x + dx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * L);
  }
  ctx.stroke();
  ctx.restore();
}

function datestamp(env: OverlayEnv, seg: Segment): void {
  const { ctx, theme, k } = env;
  const mo = sceneMoment(env, seg);
  if (!mo) return;
  const { d } = mo;
  const text = `'${String(d.getFullYear()).slice(2)}  ${String(d.getMonth() + 1).padStart(2, ' ')}  ${String(d.getDate()).padStart(2, ' ')}`;
  ctx.save();
  ctx.font = fontSpec(theme.fonts.mono, 76);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffa142';
  ctx.shadowColor = 'rgba(255,110,30,0.9)';
  ctx.shadowBlur = 14 * k;
  ctx.fillText(text, W - 110, H - 90);
  ctx.shadowBlur = 3 * k;
  ctx.fillStyle = '#ffd09a';
  ctx.globalAlpha = 0.55;
  ctx.fillText(text, W - 110, H - 90);
  ctx.restore();
}

function vhs(env: OverlayEnv, t: number): void {
  const { ctx } = env;
  ctx.save();
  // 색 번짐 잔상 (오른쪽으로 살짝)
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.07;
  ctx.drawImage(ctx.canvas, 5, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.5;
  const sl = scanlines(ctx);
  if (sl) {
    ctx.fillStyle = sl;
    ctx.fillRect(0, 0, W, H);
  }
  // 천천히 내려가는 트래킹 잡음 띠
  const noise = env.effects.noisePattern(Math.floor(t * 24));
  if (noise) {
    const y = ((t * 70) % (H + 300)) - 150;
    const f = Math.floor(t * 24);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = noise;
    ctx.save();
    ctx.translate(-Math.floor(hash01(f) * 256), 0);
    ctx.fillRect(Math.floor(hash01(f) * 256), y, W, 7 + hash01(f + 3) * 8);
    ctx.restore();
    // 화면 아래쪽의 헤드 스위칭 잡음
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = noise;
    ctx.fillRect(0, H - 14, W, 14);
  }
  ctx.restore();
}

function marks(env: OverlayEnv, seg: Segment): void {
  if (seg.kind !== 'photo') return;
  const { ctx, theme, k } = env;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 3;
  // 라임색 배경·사진 가장자리 위에서도 읽히도록 진한 그림자 (캠코더 화면 글자처럼)
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 5 * k;
  ctx.shadowOffsetX = 2 * k;
  ctx.shadowOffsetY = 2 * k;
  const m = 46;
  const L = 34;
  ctx.beginPath();
  for (const [x, y] of [
    [m, m],
    [W - m, m],
    [m, H - m],
    [W - m, H - m],
  ]) {
    ctx.moveTo(x - L / 2, y);
    ctx.lineTo(x + L / 2, y);
    ctx.moveTo(x, y - L / 2);
    ctx.lineTo(x, y + L / 2);
  }
  ctx.stroke();
  ctx.font = fontSpec(theme.fonts.display, 30, theme.fonts.displayWeight);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6 * k;
  ctx.fillText(`NO.${String(seg.index + 1).padStart(2, '0')}`, m + 34, m + 2);
  ctx.textAlign = 'right';
  const year = /^(\d{4})/.exec(env.info.date)?.[1] ?? '';
  ctx.fillText(`WEDDING FILM${year ? ` ${year}` : ''}`, W - m - 34, H - m + 2);
  ctx.restore();
}

/** 8mm 영사기 필름 창: 둥근 모서리 검은 테두리가 살짝 흔들림 */
function gate(env: OverlayEnv, t: number): void {
  const { ctx } = env;
  const f = Math.floor(t * 18);
  const jx = (hash01(f * 3 + 1) - 0.5) * 3;
  const jy = (hash01(f * 3 + 2) - 0.5) * 3;
  const x = 30 + jx;
  const y = 26 + jy;
  const w = W - 60;
  const h = H - 52;
  const r = 70;
  ctx.save();
  ctx.fillStyle = '#060403';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill('evenodd');
  ctx.restore();
}

/** 얇은 두 줄 액자선과 모서리 마름모 */
function lineFrame(env: OverlayEnv, t: number): void {
  const { ctx, theme } = env;
  const a = easeInOutSine(clamp01((t - 0.3) / 1.6));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.82 * a;
  ctx.strokeStyle = theme.colors.accent;
  ctx.fillStyle = theme.colors.accent;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.lineWidth = 1;
  ctx.strokeRect(46, 46, W - 92, H - 92);
  for (const [x, y] of [
    [40, 40],
    [W - 40, 40],
    [40, H - 40],
    [W - 40, H - 40],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 9, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 네 모서리의 금빛 곡선 장식 */
function cornerFlourish(env: OverlayEnv, t: number): void {
  const { ctx, theme, k } = env;
  const a = easeInOutSine(clamp01((t - 0.3) / 1.6));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.9 * a;
  ctx.strokeStyle = theme.colors.accent;
  ctx.fillStyle = theme.colors.accent;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6 * k;
  const L = 170 * (0.6 + 0.4 * a);
  for (const [x, y, sx, sy] of [
    [44, 44, 1, 1],
    [W - 44, 44, -1, 1],
    [44, H - 44, 1, -1],
    [W - 44, H - 44, -1, -1],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, L);
    ctx.lineTo(0, 24);
    ctx.quadraticCurveTo(0, 0, 24, 0);
    ctx.lineTo(L, 0);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(13, L * 0.7);
    ctx.lineTo(13, 32);
    ctx.quadraticCurveTo(13, 13, 32, 13);
    ctx.lineTo(L * 0.7, 13);
    ctx.stroke();
    // 끝의 작은 소용돌이
    for (const [ex, ey, rot] of [
      [L, 0, 0],
      [0, L, Math.PI / 2],
    ] as const) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(rot);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 8, 8, -Math.PI / 2, Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(34, 24);
    ctx.lineTo(44, 34);
    ctx.lineTo(34, 44);
    ctx.lineTo(24, 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** 위아래 가장자리의 레이스 */
function lace(env: OverlayEnv, t: number): void {
  const { ctx } = env;
  const a = easeInOutSine(clamp01((t - 0.2) / 1.4));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const R = 22;
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) {
      ctx.translate(0, H);
      ctx.scale(1, -1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    for (let x = 0; x < W + R * 2; x += R * 2) {
      ctx.moveTo(x + R * 2, 10);
      ctx.arc(x + R, 10, R, 0, Math.PI);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    for (let x = 0; x < W + R * 2; x += R * 2) {
      ctx.beginPath();
      ctx.arc(x + R, 16, 6, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + R * 2, 36, 2.6, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.52, r * 0.36, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,235,160,0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** 왼쪽 위·오른쪽 아래 모서리의 꽃 장식 */
function flowerCorners(env: OverlayEnv, t: number): void {
  const { ctx, theme, k } = env;
  const a = easeInOutSine(clamp01((t - 0.2) / 1.6));
  if (a <= 0) return;
  const petal = theme.effects.particleColors?.[0] ?? '#ffd3dd';
  const petal2 = theme.colors.accent;
  const leaf = 'rgba(140,178,120,0.95)';
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8 * k;
  for (const [ox, oy, s] of [
    [0, 0, 1],
    [W, H, -1],
  ] as const) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.fillStyle = leaf;
    for (const [lx, ly, rot, len] of [
      [150, 24, 0.3, 46],
      [30, 170, 1.2, 44],
      [120, 110, 0.8, 36],
      [210, 60, -0.2, 34],
      [62, 232, 1.5, 32],
    ] as const) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot + Math.sin(t * 0.6 + lx) * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, len * 0.36, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    flower(ctx, 70, 70, 44, petal, Math.sin(t * 0.5) * 0.08);
    flower(ctx, 168, 44, 28, petal2, 0.4 + Math.sin(t * 0.55 + 1) * 0.08);
    flower(ctx, 44, 168, 30, petal2, 0.8 + Math.sin(t * 0.45 + 2) * 0.08);
    flower(ctx, 140, 140, 18, petal, 0.2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * 아르데코: 바깥 한 줄 + 모서리마다 계단처럼 두 번 꺾여 들어가는 안쪽 줄,
 * 모서리의 부채꼴 빛살, 위·아래 가운데의 마름모 장식 (1920년대 개츠비 느낌)
 */
function decoFrame(env: OverlayEnv, t: number): void {
  const { ctx, theme, k } = env;
  const a = easeInOutSine(clamp01((t - 0.3) / 1.6));
  if (a <= 0) return;
  const color = theme.colors.accent;
  ctx.save();
  ctx.globalAlpha = 0.9 * a;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'miter';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 5 * k;
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  // 안쪽 계단 테두리
  const m = 44;
  const d = 15;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(m, m + 2 * d);
  ctx.lineTo(m + d, m + 2 * d);
  ctx.lineTo(m + d, m + d);
  ctx.lineTo(m + 2 * d, m + d);
  ctx.lineTo(m + 2 * d, m);
  ctx.lineTo(W - m - 2 * d, m);
  ctx.lineTo(W - m - 2 * d, m + d);
  ctx.lineTo(W - m - d, m + d);
  ctx.lineTo(W - m - d, m + 2 * d);
  ctx.lineTo(W - m, m + 2 * d);
  ctx.lineTo(W - m, H - m - 2 * d);
  ctx.lineTo(W - m - d, H - m - 2 * d);
  ctx.lineTo(W - m - d, H - m - d);
  ctx.lineTo(W - m - 2 * d, H - m - d);
  ctx.lineTo(W - m - 2 * d, H - m);
  ctx.lineTo(m + 2 * d, H - m);
  ctx.lineTo(m + 2 * d, H - m - d);
  ctx.lineTo(m + d, H - m - d);
  ctx.lineTo(m + d, H - m - 2 * d);
  ctx.lineTo(m, H - m - 2 * d);
  ctx.closePath();
  ctx.stroke();
  // 모서리 부채꼴 빛살 (화면 안쪽으로 퍼짐)
  const L = 70 + 30 * a;
  for (const [x, y, sx, sy] of [
    [m + 2 * d, m + 2 * d, 1, 1],
    [W - m - 2 * d, m + 2 * d, -1, 1],
    [m + 2 * d, H - m - 2 * d, 1, -1],
    [W - m - 2 * d, H - m - 2 * d, -1, -1],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const ang = (i / 6) * (Math.PI / 2);
      const len = i % 2 === 0 ? L : L * 0.62;
      ctx.moveTo(Math.cos(ang) * 10, Math.sin(ang) * 10);
      ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 위·아래 가운데: 가로줄 사이 마름모
  for (const y of [m, H - m]) {
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(s * 20, -5);
      ctx.lineTo(s * 74, -5);
      ctx.moveTo(s * 20, 5);
      ctx.lineTo(s * 54, 5);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** 진주 한 알 (광택 있는 흰 구슬) */
function pearlSprite(): HTMLCanvasElement {
  const s = 64;
  const c = createCanvas(s, s);
  const g = get2d(c, false);
  const r = s / 2 - 2;
  const body = g.createRadialGradient(s * 0.38, s * 0.34, r * 0.08, s / 2, s / 2, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.35, '#f7f2ea');
  body.addColorStop(0.75, '#ddd3c6');
  body.addColorStop(1, '#b9ad9e');
  g.fillStyle = body;
  g.beginPath();
  g.arc(s / 2, s / 2, r, 0, TAU);
  g.fill();
  // 은은한 무지갯빛 (분홍·하늘)
  const iri = g.createLinearGradient(0, s, s, 0);
  iri.addColorStop(0, 'rgba(255,190,210,0.18)');
  iri.addColorStop(0.5, 'rgba(255,255,255,0)');
  iri.addColorStop(1, 'rgba(180,215,255,0.16)');
  g.fillStyle = iri;
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(s * 0.36, s * 0.3, r * 0.22, r * 0.14, -0.6, 0, TAU);
  g.fill();
  return c;
}

const pearlCache = new Map<string, HTMLCanvasElement>();

/** 진주 테두리를 화면 크기에 맞춰 한 번만 그려 둠 (매 프레임에는 그림 한 장만 얹음) */
function pearlLayer(k: number): HTMLCanvasElement {
  const cw = Math.round(W * k);
  const ch = Math.round(H * k);
  const key = `${cw}x${ch}`;
  const hit = pearlCache.get(key);
  if (hit) return hit;
  const c = createCanvas(cw, ch);
  const g = get2d(c, false);
  g.setTransform(k, 0, 0, k, 0, 0);
  const pearl = pearlSprite();
  g.shadowColor = 'rgba(0,0,0,0.38)';
  g.shadowBlur = 5 * k;
  g.shadowOffsetY = 2 * k;
  const inset = 34;
  const put = (x: number, y: number, r: number) => g.drawImage(pearl, x - r, y - r, r * 2, r * 2);
  // 네 변을 따라 같은 간격으로, 모서리는 큰 알
  const step = 22;
  const x0 = inset;
  const x1 = W - inset;
  const y0 = inset;
  const y1 = H - inset;
  for (const [ax, ay, bx, by] of [
    [x0, y0, x1, y0],
    [x1, y0, x1, y1],
    [x1, y1, x0, y1],
    [x0, y1, x0, y0],
  ]) {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.round(len / step);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      put(ax + (bx - ax) * f, ay + (by - ay) * f, i % 2 ? 7.4 : 6.2);
    }
  }
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    put(x, y, 12.5);
    // 모서리의 작은 진주 송이
    const sx = x === x0 ? 1 : -1;
    const sy = y === y0 ? 1 : -1;
    put(x + sx * 24, y + sy * 24, 8);
    put(x + sx * 38, y + sy * 13, 5.4);
    put(x + sx * 13, y + sy * 38, 5.4);
  }
  // 위 가운데 살짝 늘어진 진주 한 줄 (사진 윗부분에 닿지 않을 만큼만)
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    const x = W / 2 - 160 + 320 * f;
    const y = y0 + Math.sin(Math.PI * f) * 16;
    put(x, y, i === 6 ? 9 : 6.2);
  }
  if (pearlCache.size >= 6) pearlCache.delete(pearlCache.keys().next().value!);
  pearlCache.set(key, c);
  return c;
}

/** 진주 테두리: 네 변을 두른 진주 줄, 모서리 송이, 위 가운데 늘어진 줄. 빛 한 점이 진주를 따라 돎 */
function pearlBorder(env: OverlayEnv, t: number): void {
  const { ctx, k } = env;
  const a = easeInOutSine(clamp01((t - 0.2) / 1.5));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(pearlLayer(k), 0, 0, W, H);
  // 테두리를 따라 도는 반짝임 두 점
  const inset = 34;
  const per = 2 * (W + H - 4 * inset);
  ctx.globalCompositeOperation = 'screen';
  for (const off of [0, 0.5]) {
    let s = (((t * 160) / per + off) % 1) * per;
    let x: number;
    let y: number;
    const w = W - 2 * inset;
    const hh = H - 2 * inset;
    if (s < w) [x, y] = [inset + s, inset];
    else if ((s -= w) < hh) [x, y] = [W - inset, inset + s];
    else if ((s -= hh) < w) [x, y] = [W - inset - s, H - inset];
    else [x, y] = [inset, H - inset - (s - w)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 22, 44, 44);
  }
  ctx.restore();
}

/** seg = 지금 화면의 중심 구간 (전환 중이면 더 많이 보이는 쪽) */
export function drawOverlays(env: OverlayEnv, t: number, seg: Segment): void {
  for (const o of env.theme.overlays) {
    switch (o) {
      case 'vhs':
        vhs(env, t);
        break;
      case 'gate':
        gate(env, t);
        break;
      case 'marks':
        marks(env, seg);
        break;
      case 'frame':
        lineFrame(env, t);
        break;
      case 'corners':
        cornerFlourish(env, t);
        break;
      case 'lace':
        lace(env, t);
        break;
      case 'flowers':
        flowerCorners(env, t);
        break;
      case 'deco':
        decoFrame(env, t);
        break;
      case 'pearls':
        pearlBorder(env, t);
        break;
    }
  }
  // 화면 표시(HUD)는 잔상·주사선 위에 또렷하게
  for (const o of env.theme.overlays) {
    if (o === 'letterbox') letterbox(env, t);
    else if (o === 'camcorder') camcorder(env, t, seg);
    else if (o === 'datestamp') datestamp(env, seg);
  }
}
