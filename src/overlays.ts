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
  const { ctx, theme } = env;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
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
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6 * env.k;
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
    }
  }
  // 화면 표시(HUD)는 잔상·주사선 위에 또렷하게
  for (const o of env.theme.overlays) {
    if (o === 'letterbox') letterbox(env, t);
    else if (o === 'camcorder') camcorder(env, t, seg);
    else if (o === 'datestamp') datestamp(env, seg);
  }
}
