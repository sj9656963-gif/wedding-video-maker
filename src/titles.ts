// 오프닝·엔딩 문구 디자인 (클래식 외 7종): 청첩장 카드, 무비 크레딧, 키네틱, 네온사인, 캠코더, 리스, 전시 포스터.
// u = 구간 시작 후 경과 시간, f = 등장 속도 배율(짧은 예시 영상은 1보다 작음)

import { DESIGN_H as H, DESIGN_W as W, clamp01, easeInOutSine, easeOutCubic, type DrawTarget } from './design';
import { drawHeart } from './draw-utils';
import { formatKoreanDate } from './format';
import { easeOutBack } from './layouts-extra';
import { hash01 } from './random';
import { wrapText } from './text-layout';
import { fontSpec, type Theme, type ThemeLook } from './themes';
import { arch, bubbly, cover, hanji, monogram, postcard, storybook, sunburst } from './titles-extra';
import type { WeddingInfo } from './types';

export const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
const CX = W / 2;
const TAU = Math.PI * 2;
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** 이름 사이 'and'에 쓰는 필기체 (처음부터 등록된 글꼴) */
const SCRIPT_FAMILY = 'Great Vibes';

export interface TextEnv extends DrawTarget {
  theme: Theme;
}

export type Align = 'center' | 'left' | 'right';

/** 주어진 폭에 맞도록 글꼴 크기를 줄여 ctx.font에 설정하고 크기를 돌려줌 */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, make: (size: number) => string, size: number): number {
  ctx.font = make(size);
  const w = ctx.measureText(text).width;
  if (w > maxWidth) {
    size = Math.max(12, size * (maxWidth / w));
    ctx.font = make(size);
  }
  return size;
}

/** 자간을 둔 글자 (정렬 지원). 그린 폭을 돌려줌 */
export function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: Align = 'center'): number {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

/** 구분선 가운데 장식 */
export function drawOrnament(ctx: CanvasRenderingContext2D, kind: ThemeLook['ornament'], cx: number, cy: number, color: string): void {
  ctx.fillStyle = color;
  switch (kind) {
    case 'heart':
      drawHeart(ctx, cx, cy, 18, color);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case 'leaf':
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + s * 7, cy);
        ctx.rotate(s * -0.55);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 4.2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const r = i % 2 === 0 ? 11 : 3.2;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'line':
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, TAU);
      ctx.fill();
      break;
    case 'flower':
      // 꽃잎 다섯 장
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 6.4, cy + Math.sin(a) * 6.4, 5.6, 4.6, a, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      break;
    case 'bow':
      // 리본: 양쪽 고리와 가운데 매듭, 늘어진 끈
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx + s * 6, cy - 12, cx + s * 20, cy - 10, cx + s * 17, cy);
        ctx.bezierCurveTo(cx + s * 20, cy + 10, cx + s * 6, cy + 12, cx, cy);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 2);
        ctx.lineTo(cx + s * 9, cy + 15);
        ctx.lineTo(cx + s * 4, cy + 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, TAU);
      ctx.fill();
      break;
    case 'rings':
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      for (const dx of [-5.5, 5.5]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + 1, 8, 0, TAU);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 5.5, cy - 8.5);
      ctx.lineTo(cx - 3, cy - 12);
      ctx.lineTo(cx - 8, cy - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy + 7);
      ctx.lineTo(cx - 14, cy - 7);
      ctx.lineTo(cx - 7, cy - 1);
      ctx.lineTo(cx, cy - 11);
      ctx.lineTo(cx + 7, cy - 1);
      ctx.lineTo(cx + 14, cy - 7);
      ctx.lineTo(cx + 13, cy + 7);
      ctx.closePath();
      ctx.fill();
      for (const x of [-14, 0, 14]) {
        ctx.beginPath();
        ctx.arc(cx + x, cy + (x === 0 ? -12.5 : -8), 2.2, 0, TAU);
        ctx.fill();
      }
      break;
    case 'none':
      break;
  }
}

export function drawDividerAt(ctx: CanvasRenderingContext2D, look: ThemeLook, cx: number, cy: number, color: string, half = 170): void {
  /** 가운데 장식 크기 (꾸미기에서 고른 장식이 알아보이도록 조금 크게) */
  const S = 1.5;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.85;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (look.ornament === 'none') {
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx + half, cy);
  } else {
    const gap = (look.ornament === 'bow' || look.ornament === 'crown' || look.ornament === 'rings' ? 30 : 24) * S;
    ctx.moveTo(cx - half, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + half, cy);
  }
  ctx.stroke();
  ctx.translate(cx, cy);
  ctx.scale(S, S);
  drawOrnament(ctx, look.ornament, 0, 0, color);
  ctx.restore();
}

/** 두 개의 고리가 겹친 반지 모양 (이름 사이) */
function drawRingsJoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.075);
  const r = size * 0.3;
  for (const dx of [-r * 0.55, r * 0.55]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + size * 0.04, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** 무한대 기호 (∞) */
function drawInfinity(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.beginPath();
  const a = size * 0.36;
  for (let i = 0; i <= 64; i++) {
    const th = (i / 64) * TAU;
    const d = 1 + Math.sin(th) * Math.sin(th);
    const x = (a * Math.cos(th)) / d;
    const y = (a * Math.sin(th) * Math.cos(th)) / d;
    if (i === 0) ctx.moveTo(cx + x, cy + y);
    else ctx.lineTo(cx + x, cy + y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** "신랑 ♥ 신부" 한 줄. 이어 주는 기호는 스타일 설정(하트/&/×)을 따름 */
export function drawNamesRow(
  env: TextEnv,
  info: WeddingInfo,
  x: number,
  cy: number,
  size: number,
  make: (s: number) => string,
  color: string,
  joinColor: string,
  align: Align = 'center',
  maxW = 1600,
): void {
  const { ctx, theme } = env;
  const g = info.groom.trim();
  const b = info.bride.trim();
  if (!g && !b) return;
  // 정렬·글꼴·색을 바꾸므로, 뒤에 그리는 글(날짜·안내 문구 등)이 영향받지 않게 되돌려 놓음
  ctx.save();
  ctx.fillStyle = color;
  if (!g || !b) {
    ctx.textAlign = align;
    fitFont(ctx, g || b, maxW, make, size);
    ctx.fillText(g || b, x, cy);
    ctx.restore();
    return;
  }
  ctx.font = make(size);
  const join = theme.look.nameJoin;
  // 'and'는 글자라 조금 넓게
  const jw = (s: number) => s * (join === 'and' ? 1.25 : join === 'dot' ? 0.3 : join === 'infinity' || join === 'rings' ? 0.8 : 0.55);
  const gapOf = (s: number) => s * (join === 'dot' ? 0.32 : 0.4);
  let gw = ctx.measureText(g).width;
  let bw = ctx.measureText(b).width;
  let total = gw + bw + jw(size) + gapOf(size) * 2;
  if (total > maxW) {
    size *= maxW / total;
    ctx.font = make(size);
    gw = ctx.measureText(g).width;
    bw = ctx.measureText(b).width;
    total = gw + bw + jw(size) + gapOf(size) * 2;
  }
  const jwS = jw(size);
  const gapS = gapOf(size);
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  ctx.fillText(g, x0, cy);
  ctx.fillText(b, x0 + gw + gapS * 2 + jwS, cy);
  const jx = x0 + gw + gapS + jwS / 2;
  drawNameJoin(env, jx, cy, size, joinColor);
  ctx.restore();
}

/** 이름 사이 기호 하나 (가운데 jx, cy). size = 이름 글자 크기 */
export function drawNameJoin(env: TextEnv, jx: number, cy: number, size: number, joinColor: string): void {
  const { ctx, theme } = env;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = joinColor;
  switch (theme.look.nameJoin) {
    case 'heart':
      drawHeart(ctx, jx, cy + size * 0.02, size * 0.42, joinColor);
      break;
    case 'amp':
      ctx.font = fontSpec(theme.fonts.latin, size * 0.95, 500, true);
      ctx.fillText('&', jx, cy);
      break;
    case 'cross':
      ctx.font = fontSpec(theme.fonts.latin, size * 0.9, 500);
      ctx.fillText('×', jx, cy);
      break;
    case 'and':
      ctx.font = fontSpec(SCRIPT_FAMILY, size * 0.78);
      ctx.fillText('and', jx, cy + size * 0.04);
      break;
    case 'dot':
      ctx.beginPath();
      ctx.arc(jx, cy, Math.max(3, size * 0.07), 0, TAU);
      ctx.fill();
      break;
    case 'rings':
      drawRingsJoin(ctx, jx, cy, size, joinColor);
      break;
    case 'infinity':
      drawInfinity(ctx, jx, cy, size, joinColor);
      break;
  }
  ctx.restore();
}

export interface DateParts {
  dot: string;
  week: string;
  time: string;
  year: string;
  month: number;
  day: number;
}
export function dateParts(info: WeddingInfo): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(info.date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let time = '';
  const tm = /^(\d{2}):(\d{2})$/.exec(info.time);
  if (tm) {
    const h = Number(tm[1]);
    time = `${h < 12 ? 'AM' : 'PM'} ${h % 12 || 12}:${tm[2]}`;
  }
  return { dot: `${m[1]}. ${m[2]}. ${m[3]}`, week: WEEK[d.getDay()], time, year: m[1], month: Number(m[2]), day: Number(m[3]) };
}

/** 오프닝 제목 또는 엔딩 제목 (비어 있으면 스타일 기본 문구) */
export function titleOf(env: TextEnv, info: WeddingInfo, outro: boolean): string {
  return outro ? (info.outroTitle ?? '').trim() || env.theme.outroScript : info.introTitle.trim() || env.theme.introScript;
}

/** 한글 제목·이름 글꼴 */
export function nameFont(theme: Theme): (s: number) => string {
  const f = theme.fonts;
  return (s) => fontSpec(f.name, s, f.nameWeight);
}

/** 영문 제목을 굵은 강조 글꼴로 쓰는 디자인(키네틱 등): 사용자가 제목 글꼴을 골랐으면 그 글꼴 */
export function displayTitleFont(theme: Theme): (s: number) => string {
  const f = theme.fonts;
  return f.titleCustom ? (s) => fontSpec(f.title, s, f.titleWeight, f.titleItalic) : (s) => fontSpec(f.display, s, f.displayWeight);
}

export function messageLines(ctx: CanvasRenderingContext2D, info: WeddingInfo, font: string, maxW: number, max: number): string[] {
  const message = info.outroMessage.trim();
  if (!message) return [];
  ctx.font = font;
  return wrapText(message, maxW, (s) => ctx.measureText(s).width)
    .filter((l) => l.trim())
    .slice(0, max);
}

/** 등장 정도 (0~1) */
export function appear(u: number, at: number, len: number): number {
  return easeOutCubic((u - at) / len);
}

export function softShadow(env: TextEnv, blur = 16): void {
  const { ctx, theme, k } = env;
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * k;
  // 꾸미기 '진한 그림자': 번짐을 줄이고 오른쪽 아래로 떨어뜨려 글자 윤곽이 또렷하게
  if (theme.custom.textEffect === 'strong') {
    ctx.shadowBlur = Math.max(5, blur * 0.4) * k;
    ctx.shadowOffsetX = 3 * k;
    ctx.shadowOffsetY = 5 * k;
  }
}

// ───────────────────────── 청첩장 카드 ─────────────────────────

function invitation(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const fs = theme.fonts;
  const nameF = nameFont(theme);
  const cw = 900;
  const ch = outro ? 660 : 620;
  const e = appear(u, 0.15 * f, 1.1 * Math.max(0.6, f));
  if (e <= 0) return;
  const cy = H / 2 + (1 - e) * 50;
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = base * e;
  ctx.translate(CX, cy);
  ctx.rotate((1 - e) * -0.035);
  const sc = 0.95 + 0.05 * e;
  ctx.scale(sc, sc);
  ctx.translate(-CX, -cy);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60 * k;
  ctx.shadowOffsetY = 24 * k;
  ctx.fillStyle = look.paper;
  ctx.fillRect(CX - cw / 2, cy - ch / 2, cw, ch);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = look.paperAccent;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(CX - cw / 2 + 24, cy - ch / 2 + 24, cw - 48, ch - 48);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(CX - cw / 2 + 32, cy - ch / 2 + 32, cw - 64, ch - 64);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const item = (at: number, draw: () => void) => {
    const a = appear(u, at * f, 0.9 * Math.max(0.6, f));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(0, (1 - a) * 14);
    draw();
    ctx.restore();
  };
  const title = titleOf(env, info, outro);
  const drawTitleText = (y: number, size: number) => {
    ctx.fillStyle = look.paperAccent;
    if (HANGUL.test(title)) fitFont(ctx, title, 740, nameF, size * 0.62);
    else if (theme.titleStyle === 'script') fitFont(ctx, title, 740, (s) => fontSpec(fs.title, s, fs.titleWeight, fs.titleItalic), size);
    else {
      const up = title.toUpperCase();
      const s = fitFont(ctx, up, 700, (x) => fontSpec(fs.title, x, fs.titleWeight, fs.titleItalic), size * 0.5);
      spaced(ctx, up, CX, y, s * 0.24);
      return;
    }
    ctx.fillText(title, CX, y);
  };
  const serif = (s: number, w = fs.bodyWeight) => fontSpec(fs.body, s, w);
  if (!outro) {
    item(0.7, () => {
      ctx.font = fontSpec(fs.latin, 24, 500);
      ctx.fillStyle = look.paperMuted;
      spaced(ctx, 'WEDDING INVITATION', CX, cy - 222, 7);
    });
    item(1.0, () => drawTitleText(cy - 132, 96));
    item(1.3, () => drawDividerAt(ctx, look, CX, cy - 56, look.paperAccent, 150));
    item(1.6, () => drawNamesRow(env, info, CX, cy + 16, 56, nameF, look.paperText, look.paperAccent, 'center', 740));
    const date = formatKoreanDate(info.date, info.time);
    if (date)
      item(2.0, () => {
        ctx.fillStyle = look.paperText;
        fitFont(ctx, date, 760, (s) => serif(s), 30);
        ctx.fillText(date, CX, cy + 100);
      });
    const venue = info.venue.trim();
    if (venue)
      item(2.3, () => {
        ctx.fillStyle = look.paperMuted;
        fitFont(ctx, venue, 760, (s) => serif(s), 28);
        ctx.fillText(venue, CX, cy + 150);
      });
  } else {
    item(0.8, () => drawTitleText(cy - 200, 96));
    item(1.1, () => drawDividerAt(ctx, look, CX, cy - 128, look.paperAccent, 150));
    const lines = messageLines(ctx, info, serif(34), 720, 4);
    let y = cy - 64;
    lines.forEach((line, i) => {
      const ly = y;
      item(1.5 + i * 0.2, () => {
        ctx.fillStyle = look.paperText;
        ctx.font = serif(34);
        ctx.fillText(line, CX, ly);
      });
      y += 54;
    });
    item(2.4, () => drawNamesRow(env, info, CX, y + 26, 44, nameF, look.paperText, look.paperAccent, 'center', 740));
    const notice = info.outroNotice.trim();
    if (notice)
      item(3.0, () => {
        ctx.fillStyle = look.paperAccent;
        fitFont(ctx, notice, 740, (s) => serif(s, fs.bodyBold), 30);
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        ctx.fillText(notice, CX, cy + ch / 2 - 78);
      });
  }
  ctx.restore();
}

// ───────────────────────── 무비 크레딧 ─────────────────────────

function movie(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const sp = Math.max(0.55, f);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  softShadow(env, 14);
  const base = ctx.globalAlpha;
  const label = (text: string, y: number, a: number) => {
    if (a <= 0) return;
    ctx.globalAlpha = base * a * 0.9;
    ctx.fillStyle = c.sub;
    ctx.font = fontSpec(fs.latin, 26, 500);
    spaced(ctx, text, CX, y, 9);
  };
  const bigTitle = (text: string, y: number, a: number, size: number) => {
    if (a <= 0) return;
    ctx.globalAlpha = base * a;
    ctx.fillStyle = c.accent;
    if (HANGUL.test(text)) {
      fitFont(ctx, text, 1500, nameFont(theme), size * 0.72);
      ctx.fillText(text, CX, y);
      return;
    }
    const up = text.toUpperCase();
    const s = fitFont(ctx, up, 1300, (x) => fontSpec(fs.title, x, fs.titleWeight, fs.titleItalic), size);
    // 자간이 넓게 퍼졌다가 모이는 영화 타이틀 느낌
    spaced(ctx, up, CX, y, s * (0.2 + 0.4 * (1 - a)));
  };
  const rule = (y: number, a: number, half: number) => {
    if (a <= 0) return;
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = base * 0.7;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(CX - half * a, y);
    ctx.lineTo(CX + half * a, y);
    ctx.stroke();
    ctx.restore();
  };
  const body = (s: number, w = fs.bodyWeight) => fontSpec(fs.body, s, w);
  if (!outro) {
    label('A  WEDDING  FILM', H / 2 - 200, appear(u, 0.3 * f, 1.1 * sp));
    const ta = appear(u, 0.8 * f, 1.8 * sp);
    bigTitle(titleOf(env, info, false), H / 2 - 100, ta, 104);
    rule(H / 2 - 28, ta, 300);
    label('STARRING', H / 2 + 30, appear(u, 1.6 * f, 1 * sp));
    const na = appear(u, 1.9 * f, 1.1 * sp);
    if (na > 0) {
      ctx.globalAlpha = base * na;
      drawNamesRow(env, info, CX, H / 2 + 96, 60, nameFont(theme), c.text, c.accent);
    }
    const d = dateParts(info);
    const credit = [d ? `${d.dot} ${d.week}` : '', d?.time ?? '', info.venue.trim()].filter(Boolean).join('   |   ');
    const ca = appear(u, 2.5 * f, 1.1 * sp);
    if (credit && ca > 0) {
      ctx.globalAlpha = base * ca * 0.92;
      ctx.fillStyle = c.sub;
      fitFont(ctx, credit, 1500, (s) => body(s), 30);
      ctx.fillText(credit, CX, H / 2 + 200);
    }
  } else {
    // 엔딩 크레딧처럼 천천히 위로
    ctx.translate(0, -Math.min(u, 14) * 4);
    const lines = messageLines(ctx, info, body(42), 1400, 4);
    const top = H / 2 - 150 - lines.length * 18;
    const ta = appear(u, 1.2 * f, 1.6 * sp);
    bigTitle(titleOf(env, info, true), top, ta, 84);
    rule(top + 62, ta, 220);
    let y = top + 130;
    lines.forEach((line, i) => {
      const a = appear(u, (2 + i * 0.25) * f, 1.1 * sp);
      if (a > 0) {
        ctx.globalAlpha = base * a;
        ctx.fillStyle = c.text;
        ctx.font = body(42);
        ctx.fillText(line, CX, y);
      }
      y += 64;
    });
    label('STARRING', y + 20, appear(u, 3 * f, 1 * sp));
    const na = appear(u, 3.3 * f, 1 * sp);
    if (na > 0) {
      ctx.globalAlpha = base * na;
      drawNamesRow(env, info, CX, y + 84, 52, nameFont(theme), c.text, c.accent);
    }
    const notice = info.outroNotice.trim();
    const no = appear(u, 4 * f, 1 * sp);
    if (notice && no > 0) {
      ctx.globalAlpha = base * no * (0.8 + 0.2 * Math.sin(u * 2.2));
      ctx.fillStyle = c.accent;
      fitFont(ctx, notice, 1400, (s) => body(s), 34);
      ctx.fillText(notice, CX, y + 170);
    }
  }
  ctx.restore();
}

// ───────────────────────── 키네틱 ─────────────────────────

/** 단어를 최대 n줄로 묶음 (짧은 이웃끼리 먼저) */
function splitLines(text: string, maxLines: number): string[] {
  const lines = text.split(/\s+/).filter(Boolean);
  while (lines.length > maxLines) {
    let best = 0;
    for (let i = 1; i < lines.length - 1; i++) {
      if (lines[i].length + lines[i + 1].length < lines[best].length + lines[best + 1].length) best = i;
    }
    lines.splice(best, 2, `${lines[best]} ${lines[best + 1]}`);
  }
  return lines.length ? lines : [text];
}

function kinetic(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const title = titleOf(env, info, outro);
  const hangul = HANGUL.test(title);
  // 필기체를 직접 골랐으면 대문자로 바꾸지 않음 (필기체 대문자는 읽기 어려움)
  const upper = !hangul && !(fs.titleCustom && theme.titleStyle === 'script');
  const lines = splitLines(upper ? title.toUpperCase() : title, 3);
  const latinMake = displayTitleFont(theme);
  const make = hangul ? nameFont(theme) : latinMake;
  const targetW = lines.length === 1 ? 1100 : 1180;
  const sizes = lines.map((l) => {
    ctx.font = make(100);
    const w = ctx.measureText(l).width || 1;
    return Math.min(lines.length >= 3 ? 190 : 250, (100 * targetW) / w);
  });
  const lineH = sizes.map((s) => s * 0.94);
  const msg = outro ? messageLines(ctx, info, fontSpec(fs.body, 42, fs.bodyWeight), 1500, 3) : [];
  const notice = outro ? info.outroNotice.trim() : '';
  const extraH = outro ? 110 + msg.length * 62 + (notice ? 74 : 0) : 190;
  const total = lineH.reduce((a, b) => a + b, 0) + extraH;
  let y = H / 2 - total / 2;
  const base = ctx.globalAlpha;
  const hi = lines.length - 1;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const at = (0.3 + i * 0.22) * f;
    const e = easeOutBack((u - at) / (0.5 * Math.max(0.6, f)));
    const a = clamp01((u - at) / 0.18);
    const cy = y + lineH[i] / 2;
    y += lineH[i];
    if (a <= 0) return;
    const dir = i % 2 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = base * a;
    ctx.translate(CX + dir * (1 - e) * 900, cy);
    ctx.transform(1, 0, -0.22 * (1 - Math.min(1, e)) * dir, 1, 0, 0);
    ctx.font = make(sizes[i]);
    const w = ctx.measureText(line).width;
    if (i === hi) {
      const be = easeOutCubic((u - at - 0.12) / 0.4);
      ctx.fillStyle = c.accent;
      ctx.fillRect(-w / 2 - 26, -sizes[i] * 0.47, (w + 52) * be, sizes[i] * 0.94);
      ctx.fillStyle = '#111111';
    } else {
      ctx.fillStyle = c.text;
    }
    ctx.fillText(line, 0, sizes[i] * 0.05);
    ctx.restore();
  });
  const at2 = (0.3 + lines.length * 0.22 + 0.2) * f;
  const body = nameFont(theme);
  if (!outro) {
    const na = appear(u, at2, 0.6 * Math.max(0.6, f));
    if (na > 0) {
      ctx.globalAlpha = base * na;
      drawNamesRow(env, info, CX, y + 70 + (1 - na) * 30, 82, (s) => body(s), c.text, c.accent);
    }
    const d = dateParts(info);
    const line = [d ? `${d.dot} ${d.week}` : '', d?.time ?? '', info.venue.trim()].filter(Boolean).join('  /  ');
    const da = appear(u, at2 + 0.3 * f, 0.6 * Math.max(0.6, f));
    if (line && da > 0) {
      ctx.globalAlpha = base * da;
      ctx.fillStyle = c.sub;
      fitFont(ctx, line, 1500, (s) => fontSpec(fs.body, s, fs.bodyWeight), 38);
      ctx.fillText(line, CX, y + 158);
    }
  } else {
    let my = y + 60;
    msg.forEach((m, i) => {
      const a = appear(u, at2 + i * 0.2 * f, 0.6);
      if (a > 0) {
        ctx.globalAlpha = base * a;
        ctx.fillStyle = c.text;
        ctx.font = fontSpec(fs.body, 42, fs.bodyWeight);
        ctx.fillText(m, CX, my);
      }
      my += 62;
    });
    const na = appear(u, at2 + 0.8 * f, 0.6);
    if (na > 0) {
      ctx.globalAlpha = base * na;
      drawNamesRow(env, info, CX, my + 30, 58, (s) => body(s), c.accent, c.text);
    }
    const no = appear(u, at2 + 1.3 * f, 0.6);
    if (notice && no > 0) {
      ctx.globalAlpha = base * no * (0.8 + 0.2 * Math.sin(u * 2.2));
      ctx.fillStyle = c.sub;
      fitFont(ctx, notice, 1400, (s) => fontSpec(fs.body, s, fs.bodyWeight), 34);
      ctx.fillText(notice, CX, my + 104);
    }
  }
  ctx.restore();
}

// ───────────────────────── 네온사인 ─────────────────────────

/** 켜지는 순간 깜빡이다가 은은하게 떨림 */
function neonOn(u: number, at: number, seed: number): number {
  if (u < at) return 0;
  const l = u - at;
  if (l < 0.9) {
    const r = hash01(Math.floor(l * 22) * 7 + seed);
    return r > 0.42 ? 0.55 + 0.45 * r : 0.06;
  }
  return 0.93 + 0.07 * Math.sin(u * 13 + seed);
}

function neonPaint(env: TextEnv, on: number, glow: string, paint: (core: boolean) => void): void {
  if (on <= 0.01) return;
  const { ctx, k } = env;
  ctx.save();
  ctx.globalAlpha *= on;
  ctx.shadowColor = glow;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 48 * k;
  paint(false);
  ctx.shadowBlur = 16 * k;
  paint(false);
  ctx.shadowBlur = 4 * k;
  paint(true);
  ctx.restore();
}

function neon(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const title = titleOf(env, info, outro);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleFont = (s: number) =>
    HANGUL.test(title)
      ? nameFont(theme)(s * 0.6)
      : theme.titleStyle === 'script'
        ? fontSpec(fs.title, s, fs.titleWeight, fs.titleItalic)
        : fontSpec(fs.title, s * 0.55, fs.titleWeight, fs.titleItalic);
  const lines = outro ? messageLines(ctx, info, fontSpec(fs.body, 40, fs.bodyWeight), 1400, 4) : [];
  const ty = outro ? H / 2 - 170 - lines.length * 22 : H / 2 - 150;
  const tOn = neonOn(u, 0.35 * f, 3);
  fitFont(ctx, title, 1500, titleFont, 160);
  const tFont = ctx.font;
  neonPaint(env, tOn, c.accent, (core) => {
    ctx.font = tFont;
    ctx.fillStyle = core ? 'rgba(255,255,255,0.92)' : c.accent;
    ctx.fillText(title, CX, ty);
  });
  const hOn = neonOn(u, 0.9 * f, 11);
  neonPaint(env, hOn, c.accent, (core) => {
    // 서로 겹친 두 반지 모양 네온
    ctx.lineWidth = core ? 2.5 : 5;
    ctx.strokeStyle = core ? '#ffffff' : c.accent;
    for (const dx of [-15, 15]) {
      ctx.beginPath();
      ctx.arc(CX + dx, ty + 118, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  let y = ty + 205;
  if (outro) {
    lines.forEach((line, i) => {
      const a = appear(u, (1.4 + i * 0.22) * f, 0.9);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = 12 * env.k;
        ctx.fillStyle = c.text;
        ctx.font = fontSpec(fs.body, 40, fs.bodyWeight);
        ctx.fillText(line, CX, y);
        ctx.restore();
      }
      y += 60;
    });
    y += 20;
  }
  const nOn = neonOn(u, (outro ? 2.6 : 1.4) * f, 23);
  neonPaint(env, nOn, c.accent, (core) => {
    drawNamesRow(env, info, CX, y, outro ? 56 : 76, nameFont(theme), core ? '#ffffff' : c.accent, core ? '#ffffff' : c.accent);
  });
  const sub = outro ? info.outroNotice.trim() : [formatKoreanDate(info.date, info.time), info.venue.trim()].filter(Boolean).join('  ·  ');
  const sa = appear(u, (outro ? 3.2 : 2.1) * f, 1);
  if (sub && sa > 0) {
    ctx.save();
    ctx.globalAlpha *= sa * (outro ? 0.8 + 0.2 * Math.sin(u * 2.2) : 1);
    ctx.shadowColor = outro ? c.accent : 'rgba(255,255,255,0.7)';
    ctx.shadowBlur = 14 * env.k;
    ctx.fillStyle = outro ? c.accent : c.sub;
    fitFont(ctx, sub, 1500, (s) => fontSpec(fs.body, s, fs.bodyWeight), 34);
    ctx.fillText(sub, CX, y + 96);
    ctx.restore();
  }
  ctx.restore();
}

// ───────────────────────── 캠코더 (타자기) ─────────────────────────

interface TypeLine {
  text: string;
  make: (s: number) => string;
  size: number;
  h: number;
  y: number;
}

function camcorder(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const title = titleOf(env, info, outro);
  const hangulTitle = HANGUL.test(title);
  const mono = (s: number) => fontSpec(fs.mono, s);
  const body = (w: number) => (s: number) => fontSpec(fs.body, s, w);
  const nameF = nameFont(theme);
  const lines: TypeLine[] = [
    { text: hangulTitle ? title : title.toUpperCase(), make: hangulTitle ? nameF : mono, size: hangulTitle ? 84 : 124, h: 150, y: 0 },
  ];
  const add = (text: string, make: (s: number) => string, size: number, h: number) => lines.push({ text, make, size, h, y: 0 });
  const g = info.groom.trim();
  const b = info.bride.trim();
  const names = g && b ? `${g} & ${b}` : g || b;
  if (!outro) {
    if (names) add(names, nameF, 70, 100);
    const d = dateParts(info);
    if (d) add(`${d.dot} ${d.week}${d.time ? ` ${d.time}` : ''}`, mono, 62, 90);
    if (info.venue.trim()) add(info.venue.trim(), body(fs.bodyWeight), 40, 70);
  } else {
    for (const m of messageLines(ctx, info, fontSpec(fs.body, 40, fs.bodyWeight), 1400, 3)) add(m, body(fs.bodyWeight), 40, 64);
    if (names) add(names, nameF, 56, 96);
    if (info.outroNotice.trim()) add(info.outroNotice.trim(), body(fs.bodyWeight), 36, 70);
  }
  const total = lines.reduce((a, l) => a + l.h, 0);
  let y = H / 2 - total / 2;
  for (const l of lines) {
    l.y = y + l.h / 2;
    y += l.h;
  }
  // 짧은 예시 영상(f < 1)에서는 더 빨리 쳐서 장면 가운데쯤 글이 다 보이게 (실제 영상 f = 1은 그대로)
  const cps = 17 / Math.max(0.3, f);
  const linePause = 0.25 * Math.max(0.4, Math.min(1, f));
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetX = 4 * k;
  ctx.shadowOffsetY = 4 * k;
  let start = 0.4 * f;
  let cursor: { x: number; y: number; h: number } | null = null;
  for (const l of lines) {
    const chars = Array.from(l.text);
    const size = fitFont(ctx, l.text, 1700, l.make, l.size);
    const full = ctx.measureText(l.text).width;
    const n = Math.floor((u - start) * cps);
    if (n <= 0) break;
    const shown = chars.slice(0, Math.min(chars.length, n)).join('');
    const x = CX - full / 2;
    ctx.fillStyle = c.text;
    ctx.fillText(shown, x, l.y);
    cursor = { x: x + ctx.measureText(shown).width + 8, y: l.y, h: size * 0.78 };
    if (n < chars.length) break;
    start += chars.length / cps + linePause;
  }
  if (cursor && Math.floor(u * 2.2) % 2 === 0) {
    ctx.fillStyle = c.text;
    ctx.fillRect(cursor.x, cursor.y - cursor.h / 2, cursor.h * 0.55, cursor.h);
  }
  ctx.restore();
}

// ───────────────────────── 리스 (나뭇잎 화관) ─────────────────────────

function wreathRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, progress: number, leaf: string, berry: string): void {
  if (progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = leaf;
  ctx.globalAlpha *= 0.8;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * progress);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 - Math.PI * progress, true);
  ctx.stroke();
  ctx.restore();
  const N = 24;
  const size = R / 11;
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const grow = clamp01((progress - frac) * 9);
    if (grow <= 0) break;
    for (const side of [1, -1]) {
      const ang = -Math.PI / 2 + side * Math.PI * frac;
      const px = cx + Math.cos(ang) * R;
      const py = cy + Math.sin(ang) * R;
      const tangent = ang + (side * Math.PI) / 2;
      for (const [off, tilt] of [
        [1.12, 0.55],
        [0.88, -0.55],
      ]) {
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * R * off, cy + Math.sin(ang) * R * off);
        ctx.rotate(tangent + tilt * side);
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.25 * grow, size * 0.5 * grow, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (i % 4 === 2) {
        ctx.fillStyle = berry;
        ctx.beginPath();
        ctx.arc(px + Math.cos(ang) * size * 1.6, py + Math.sin(ang) * size * 1.6, size * 0.28 * grow, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function wreath(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const title = titleOf(env, info, outro);
  const titleFont = (s: number) => (HANGUL.test(title) ? nameFont(theme)(s * 0.6) : fontSpec(fs.title, s, fs.titleWeight, fs.titleItalic));
  const body = (s: number, w = fs.bodyWeight) => fontSpec(fs.body, s, w);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  softShadow(env, 14);
  const at = (t: number, len = 1) => {
    const a = appear(u, t * f, len * sp);
    ctx.globalAlpha = base * a;
    return a;
  };
  if (!outro) {
    const R = 250;
    const cy = H / 2 + 34;
    if (at(0.3) > 0) {
      ctx.fillStyle = c.accent;
      fitFont(ctx, title, 1400, titleFont, 104);
      ctx.fillText(title, CX, cy - R - 100);
    }
    ctx.globalAlpha = base;
    wreathRing(ctx, CX, cy, R, easeInOutSine((u - 0.5 * f) / (1.9 * sp)), c.accent, '#ffffff');
    const g = info.groom.trim();
    const b = info.bride.trim();
    if (g && at(1.3) > 0) {
      ctx.fillStyle = c.text;
      fitFont(ctx, g, 360, nameFont(theme), 60);
      ctx.fillText(g, CX, b ? cy - 62 : cy);
    }
    if (g && b && at(1.5) > 0) {
      ctx.fillStyle = c.accent;
      ctx.font = fontSpec(fs.latin, 54, 500, true);
      ctx.fillText('&', CX, cy + 2);
    }
    if (b && at(1.7) > 0) {
      ctx.fillStyle = c.text;
      fitFont(ctx, b, 360, nameFont(theme), 60);
      ctx.fillText(b, CX, g ? cy + 66 : cy);
    }
    const date = formatKoreanDate(info.date, info.time);
    if (date && at(2.2) > 0) {
      ctx.fillStyle = c.sub;
      fitFont(ctx, date, 1500, (s) => body(s), 34);
      ctx.fillText(date, CX, cy + R + 72);
    }
    if (info.venue.trim() && at(2.5) > 0) {
      ctx.fillStyle = c.sub;
      fitFont(ctx, info.venue.trim(), 1500, (s) => body(s), 30);
      ctx.fillText(info.venue.trim(), CX, cy + R + 122);
    }
  } else {
    const R = 150;
    const cy = H / 2 - 190;
    ctx.globalAlpha = base;
    wreathRing(ctx, CX, cy, R, easeInOutSine((u - 1 * f) / (1.6 * sp)), c.accent, '#ffffff');
    if (at(1.4) > 0) {
      ctx.fillStyle = c.accent;
      // 고리 안쪽 잎 사이 빈 폭(약 237px)보다 좁게 맞춰 필기체 끝획이 잎에 닿지 않게
      fitFont(ctx, title, 220, titleFont, 76);
      ctx.fillText(title, CX, cy + 4);
    }
    const lines = messageLines(ctx, info, body(42), 1400, 3);
    let y = H / 2 + 36;
    lines.forEach((line, i) => {
      if (at(2 + i * 0.25) > 0) {
        ctx.fillStyle = c.text;
        ctx.font = body(42);
        ctx.fillText(line, CX, y);
      }
      y += 64;
    });
    if (at(3) > 0) drawNamesRow(env, info, CX, y + 24, 50, nameFont(theme), c.text, c.accent);
    const notice = info.outroNotice.trim();
    if (notice && at(3.8) > 0) {
      ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
      ctx.fillStyle = c.accent;
      fitFont(ctx, notice, 1400, (s) => body(s), 34);
      ctx.fillText(notice, CX, y + 110);
    }
  }
  ctx.restore();
}

// ───────────────────────── 전시 포스터 ─────────────────────────

function exhibition(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const fs = theme.fonts;
  const c = theme.colors;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const x0 = 170;
  // 글이 올라갈 왼쪽을 어둡게
  const pa = appear(u, 0, 1.2 * sp);
  ctx.save();
  ctx.globalAlpha = base * pa;
  const grad = ctx.createLinearGradient(0, 0, W * 0.72, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  softShadow(env, 10);
  /** 왼쪽에서 오른쪽으로 닦아내듯 드러냄 */
  const wipe = (at: number, y: number, h: number, draw: () => void) => {
    const e = appear(u, at * f, 1.1 * sp);
    if (e <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 30, y - h / 2, (W - x0) * e, h);
    ctx.clip();
    ctx.globalAlpha = base * Math.min(1, e * 1.4);
    draw();
    ctx.restore();
  };
  const title = titleOf(env, info, outro);
  const titleFont = (s: number) => (HANGUL.test(title) ? nameFont(theme)(s * 0.62) : fontSpec(fs.title, s, fs.titleWeight, fs.titleCustom ? fs.titleItalic : true));
  const body = (s: number, w = fs.bodyWeight) => fontSpec(fs.body, s, w);
  const label = (text: string, y: number) => {
    ctx.fillStyle = c.sub;
    ctx.font = fontSpec(fs.latin, 24, 500);
    const w = spaced(ctx, text, x0, y, 6, 'left');
    ctx.fillRect(x0 + w + 24, y, 90, 1.5);
  };
  if (!outro) {
    wipe(0.3, H / 2 - 232, 50, () => label('EXHIBITION', H / 2 - 232));
    wipe(0.6, H / 2 - 118, 200, () => {
      ctx.fillStyle = c.text;
      fitFont(ctx, title, 1200, titleFont, 170);
      ctx.fillText(title, x0 - 6, H / 2 - 118);
    });
    wipe(1.2, H / 2 + 12, 90, () => drawNamesRow(env, info, x0, H / 2 + 12, 58, nameFont(theme), c.text, c.accent, 'left', 1100));
    const d = dateParts(info);
    const rows: [string, string][] = [];
    if (d) rows.push(['DATE', `${d.dot} ${d.week}${d.time ? `  ${d.time}` : ''}`]);
    if (info.venue.trim()) rows.push(['VENUE', info.venue.trim()]);
    rows.forEach(([k2, v], i) => {
      const y = H / 2 + 110 + i * 56;
      wipe(1.7 + i * 0.25, y, 50, () => {
        ctx.fillStyle = c.sub;
        ctx.font = fontSpec(fs.latin, 22, 500);
        spaced(ctx, k2, x0, y, 5, 'left');
        ctx.fillStyle = c.text;
        fitFont(ctx, v, 1000, (s) => body(s), 32);
        ctx.fillText(v, x0 + 150, y);
      });
    });
    const year = d?.year;
    const ya = appear(u, 1.5 * f, 1.6 * sp);
    if (year && ya > 0) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = base * ya * 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.textAlign = 'right';
      ctx.font = fontSpec(fs.latin, 300, 500);
      ctx.strokeText(year, W - 110 + (1 - ya) * 60, H - 190);
      ctx.restore();
    }
  } else {
    wipe(0.9, H / 2 - 262, 50, () => label('WITH GRATITUDE', H / 2 - 262));
    wipe(1.2, H / 2 - 160, 190, () => {
      ctx.fillStyle = c.text;
      fitFont(ctx, title, 1200, titleFont, 160);
      ctx.fillText(title, x0 - 6, H / 2 - 160);
    });
    const lines = messageLines(ctx, info, body(40), 1100, 4);
    let y = H / 2 - 40;
    lines.forEach((line, i) => {
      const ly = y;
      wipe(1.9 + i * 0.22, ly, 64, () => {
        ctx.fillStyle = c.text;
        ctx.font = body(40);
        ctx.fillText(line, x0, ly);
      });
      y += 60;
    });
    wipe(2.9, y + 30, 80, () => drawNamesRow(env, info, x0, y + 30, 50, nameFont(theme), c.text, c.accent, 'left', 1100));
    const notice = info.outroNotice.trim();
    if (notice)
      wipe(3.6, y + 112, 60, () => {
        ctx.fillStyle = c.accent;
        fitFont(ctx, notice, 1100, (s) => body(s), 32);
        ctx.fillText(notice, x0, y + 112);
      });
  }
  ctx.restore();
}

/** 오프닝·엔딩 글자 크기 배율을 화면 가운데 기준으로 적용 */
export function withTextScale(env: TextEnv, fn: () => void): void {
  const s = env.theme.textScale;
  if (!s || s === 1) {
    fn();
    return;
  }
  const { ctx } = env;
  ctx.save();
  ctx.translate(CX, H / 2);
  ctx.scale(s, s);
  ctx.translate(-CX, -H / 2);
  fn();
  ctx.restore();
}

/** 클래식 외 디자인의 오프닝 문구 */
export function drawDesignedIntro(env: TextEnv, info: WeddingInfo, u: number, dur: number, pace: number): void {
  const f = Math.min(1, pace);
  const fadeOut = 1 - clamp01((u - (dur - 2.9 * f)) / (1.2 * f));
  if (fadeOut <= 0) return;
  env.ctx.save();
  env.ctx.globalAlpha = fadeOut;
  withTextScale(env, () => draw(env, info, u, f, false));
  env.ctx.restore();
}

/** 클래식 외 디자인의 엔딩 문구 */
export function drawDesignedOutro(env: TextEnv, info: WeddingInfo, u: number, pace: number): void {
  env.ctx.save();
  env.ctx.globalAlpha = 1;
  withTextScale(env, () => draw(env, info, u, Math.min(1, pace), true));
  env.ctx.restore();
}

function draw(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  switch (env.theme.titleDesign) {
    case 'invitation':
      invitation(env, info, u, f, outro);
      break;
    case 'movie':
      movie(env, info, u, f, outro);
      break;
    case 'kinetic':
      kinetic(env, info, u, f, outro);
      break;
    case 'neon':
      neon(env, info, u, f, outro);
      break;
    case 'camcorder':
      camcorder(env, info, u, f, outro);
      break;
    case 'wreath':
      wreath(env, info, u, f, outro);
      break;
    case 'exhibition':
      exhibition(env, info, u, f, outro);
      break;
    case 'bubbly':
      bubbly(env, info, u, f, outro);
      break;
    case 'hanji':
      hanji(env, info, u, f, outro);
      break;
    case 'cover':
      cover(env, info, u, f, outro);
      break;
    case 'storybook':
      storybook(env, info, u, f, outro);
      break;
    case 'monogram':
      monogram(env, info, u, f, outro);
      break;
    case 'postcard':
      postcard(env, info, u, f, outro);
      break;
    case 'sunburst':
      sunburst(env, info, u, f, outro);
      break;
    case 'arch':
      arch(env, info, u, f, outro);
      break;
    case 'classic':
      break;
  }
}

/** 디자인 문구에 쓰이는 고정 글자 (글꼴 미리 불러오기용) */
export const DESIGN_TEXTS = [
  'A WEDDING FILM STARRING WEDDING INVITATION EXHIBITION DATE VENUE WITH GRATITUDE',
  'REC SP AM PM NO. WEDDING FILM Untitled OUR DAY',
  WEEK.join(' '),
  'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC',
  "0123456789 ' . : / | & × · -",
  'and',
];
