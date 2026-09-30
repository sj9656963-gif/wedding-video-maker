// 새 오프닝·엔딩 디자인 7종: 버블(러블리), 한지 낙관(전통 혼례), 매거진 커버(화보), 동화책(별빛 동화),
// 모노그램(로열), 여행 엽서(썸머 비치), 레트로 선셋(레트로).
// u = 구간 시작 후 경과 시간, f = 등장 속도 배율(짧은 예시 영상은 1보다 작음). 모두 1920×1080 디자인 좌표.

import { DESIGN_H as H, DESIGN_W as W, clamp01, easeInOutSine, easeOutCubic } from './design';
import { roundRectPath } from './draw-utils';
import { formatKoreanDate } from './format';
import { easeOutBack } from './layouts-extra';
import { hash01 } from './random';
import { fontSpec, type Theme } from './themes';
import {
  HANGUL,
  appear,
  dateParts,
  displayTitleFont,
  drawDividerAt,
  drawNameJoin,
  drawNamesRow,
  drawOrnament,
  fitFont,
  messageLines,
  nameFont,
  softShadow,
  spaced,
  titleOf,
  type Align,
  type TextEnv,
} from './titles';
import type { WeddingInfo } from './types';

const CX = W / 2;
const TAU = Math.PI * 2;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 디자인에 고정으로 들어가는 글자 (글꼴 미리 불러오기용) */
export const EXTRA_TEXTS = [
  "WE'RE GETTING MARRIED",
  '백년가약 혼례',
  'THE LOVE STORY OF SPECIAL ISSUE VOL. 01 EDITION WEDDING Wedding THANK YOU WITH LOVE',
  'Once upon a time and they lived happily ever after',
  'THE WEDDING OF',
  'POST CARD Greetings from GREETINGS FROM LOVE from.',
  '“”',
];

// ───────────────────────── 공용 ─────────────────────────

interface Face {
  text: string;
  make: (s: number) => string;
  caps: boolean;
  kr: boolean;
}

/** 제목 글꼴: 한글이면 제목·이름 글꼴, 영문은 영문 제목 글꼴(대문자 스타일이면 대문자) */
function titleFace(theme: Theme, raw: string): Face {
  const f = theme.fonts;
  if (HANGUL.test(raw)) return { text: raw, make: nameFont(theme), caps: false, kr: true };
  const caps = theme.titleStyle === 'caps';
  return { text: caps ? raw.toUpperCase() : raw, make: (s) => fontSpec(f.title, s, f.titleWeight, f.titleItalic), caps, kr: false };
}

/** 필기체 기준 크기를 글꼴 종류에 맞게 */
function faceSize(face: Face, size: number): number {
  return face.kr ? size * 0.62 : face.caps ? size * 0.55 : size;
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = Array.from(text);
  return chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
}

/** 제목 한 줄: 폭에 맞춰 줄여 그리고, 그린 폭을 돌려줌. dx·dy는 겹 그림자용 */
function drawFace(ctx: CanvasRenderingContext2D, face: Face, x: number, y: number, maxW: number, size: number, align: Align = 'center'): number {
  const s = fitFont(ctx, face.text, face.caps ? maxW * 0.84 : maxW, face.make, faceSize(face, size));
  if (face.caps) return spaced(ctx, face.text, x, y, s * 0.18, align);
  ctx.textAlign = align;
  ctx.fillText(face.text, x, y);
  return ctx.measureText(face.text).width;
}

/** 첫 글자 (한글 음절·영문 대문자) */
function initial(name: string): string {
  const ch = Array.from(name.trim())[0] ?? '';
  return /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
}

function bodyFont(theme: Theme, bold = false): (s: number) => string {
  const f = theme.fonts;
  return (s) => fontSpec(f.body, s, bold ? f.bodyBold : f.bodyWeight);
}

/** 네 갈래 반짝이 */
function twinkleStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.3;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** 다섯 꼭지 별 */
function star5(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.42;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** 왼쪽에서 오른쪽으로 닦아내듯(붓으로 쓰듯) 드러냄 */
function reveal(ctx: CanvasRenderingContext2D, x0: number, y: number, w: number, h: number, e: number, draw: () => void): void {
  if (e <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y - h / 2, w * e, h);
  ctx.clip();
  draw();
  ctx.restore();
}

// ───────────────────────── 버블 (러블리) ─────────────────────────

/** 굵은 테두리를 두른 스티커 같은 글자 */
function stickerText(env: TextEnv, text: string, x: number, y: number, size: number, fill: string, outline: string): void {
  const { ctx, theme, k } = env;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = 18 * k;
  ctx.shadowOffsetY = 6 * k;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(6, size * 0.16);
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 글자가 하나씩 통통 떨어지며 자리 잡는 제목 */
function bouncyTitle(env: TextEnv, face: Face, cy: number, size0: number, u: number, f: number, base: number): void {
  const { ctx, theme } = env;
  const c = theme.colors;
  const sp = Math.max(0.55, f);
  const size = fitFont(ctx, face.text, 1500, face.make, faceSize(face, size0));
  // 이어 쓰는 필기체를 직접 골랐으면 글자를 나누지 않고 한 번에
  const perChar = face.kr || !theme.fonts.titleCustom;
  if (!perChar) {
    const e = easeOutBack((u - 0.45 * f) / (0.6 * sp));
    const a = clamp01((u - 0.45 * f) / 0.2);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * a;
    ctx.translate(CX, cy);
    ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
    ctx.textAlign = 'center';
    stickerText(env, face.text, 0, 0, size, c.text, c.accent);
    ctx.restore();
    return;
  }
  const chars = Array.from(face.text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const spacing = face.caps ? size * 0.06 : 0;
  const total = widths.reduce((s, w) => s + w, 0) + spacing * Math.max(0, chars.length - 1);
  let x = CX - total / 2;
  chars.forEach((ch, i) => {
    const at = (0.45 + i * 0.045) * f;
    const e = easeOutBack((u - at) / (0.45 * sp));
    const a = clamp01((u - at) / 0.15);
    const cx = x + widths[i] / 2;
    x += widths[i] + spacing;
    if (a <= 0 || ch === ' ') return;
    ctx.save();
    ctx.globalAlpha = base * a;
    ctx.translate(cx, cy - (1 - Math.min(1, e)) * 50 + Math.sin(u * 2.4 + i * 0.7) * 3);
    ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
    ctx.textAlign = 'center';
    stickerText(env, ch, 0, 0, size, c.text, c.accent);
    ctx.restore();
  });
}

/** 말랑한 이름표 두 개와 그 사이 기호 */
function namePills(env: TextEnv, info: WeddingInfo, cy: number, size: number, at: number, u: number, f: number, base: number): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const sp = Math.max(0.55, f);
  const items = [info.groom.trim(), info.bride.trim()].filter(Boolean);
  if (!items.length) return;
  const make = nameFont(theme);
  ctx.font = make(size);
  const padX = size * 0.62;
  const ph = size * 1.55;
  let widths = items.map((n) => Math.min(620, ctx.measureText(n).width) + padX * 2);
  const joinW = items.length === 2 ? size * 1.15 : 0;
  let total = widths.reduce((s, w) => s + w, 0) + joinW;
  const scale = total > 1600 ? 1600 / total : 1;
  widths = widths.map((w) => w * scale);
  total *= scale;
  let x = CX - total / 2;
  items.forEach((name, i) => {
    const e = easeOutBack((u - (at + i * 0.28) * f) / (0.5 * sp));
    const w = widths[i];
    const cx = x + w / 2;
    x += w + (i === 0 ? joinW * scale : 0);
    if (e <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * clamp01(e * 2);
    ctx.translate(cx, cy);
    ctx.scale(e * scale, e * scale);
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 20 * k;
    ctx.shadowOffsetY = 8 * k;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    roundRectPath(ctx, -w / scale / 2, -ph / 2, w / scale, ph, ph / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = look.paperAccent;
    ctx.textAlign = 'center';
    fitFont(ctx, name, w / scale - padX * 1.6, make, size);
    ctx.fillText(name, 0, size * 0.04);
    ctx.restore();
  });
  if (items.length === 2) {
    const e = easeOutBack((u - (at + 0.14) * f) / (0.5 * sp));
    if (e > 0) {
      const jx = CX - total / 2 + widths[0] + (joinW * scale) / 2;
      ctx.save();
      ctx.globalAlpha = base * clamp01(e * 2);
      ctx.translate(jx, cy);
      ctx.scale(e, e);
      drawNameJoin(env, 0, 0, size * scale, '#ffffff');
      ctx.restore();
    }
  }
}

/** 둥실 떠 있는 비눗방울 장식 (가운데 글자는 비워 둠) */
function floatBubbles(ctx: CanvasRenderingContext2D, u: number, a: number): void {
  if (a <= 0) return;
  ctx.save();
  for (let i = 0; i < 10; i++) {
    const r = (q: number) => hash01(i * 37 + 900 + q);
    const ang = (i / 10) * TAU + r(1) * 0.4;
    const x = CX + Math.cos(ang) * (720 + r(2) * 90);
    const y = H / 2 + Math.sin(ang) * (380 + r(3) * 40) + Math.sin(u * (0.7 + r(4) * 0.6) + i) * 14;
    const rad = 16 + r(5) * 34;
    ctx.globalAlpha = a * (0.5 + 0.35 * r(6));
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(x - rad * 0.38, y - rad * 0.4, rad * 0.22, rad * 0.11, -0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function bubbly(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const c = theme.colors;
  const look = theme.look;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  floatBubbles(ctx, u, base * appear(u, 0.1 * f, 1.2 * sp));
  const face = titleFace(theme, titleOf(env, info, outro));
  const body = bodyFont(theme);
  if (!outro) {
    // 맨 위 말풍선 같은 알림표
    const pa = easeOutBack((u - 0.2 * f) / (0.5 * sp));
    if (pa > 0) {
      const label = "WE'RE GETTING MARRIED";
      ctx.save();
      ctx.globalAlpha = base * clamp01(pa * 2);
      ctx.translate(CX, H / 2 - 250);
      ctx.scale(pa, pa);
      ctx.font = fontSpec(theme.fonts.latin, 26, 600);
      const w = spacedWidth(ctx, label, 4);
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 14 * k;
      ctx.shadowOffsetY = 5 * k;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRectPath(ctx, -w / 2 - 32, -29, w + 64, 58, 29);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = look.paperAccent;
      spaced(ctx, label, 0, 2, 4);
      ctx.restore();
    }
    bouncyTitle(env, face, H / 2 - 100, 150, u, f, base);
    namePills(env, info, H / 2 + 70, 60, 1.05, u, f, base);
    const date = formatKoreanDate(info.date, info.time);
    const da = appear(u, 1.8 * f, 0.8 * sp);
    if (date && da > 0) {
      ctx.save();
      ctx.globalAlpha = base * da;
      softShadow(env, 12);
      ctx.fillStyle = c.text;
      const s = fitFont(ctx, date, 1300, body, 36);
      ctx.fillText(date, CX, H / 2 + 188);
      const w = ctx.measureText(date).width;
      ctx.fillStyle = c.accent;
      twinkleStar(ctx, CX - w / 2 - 36, H / 2 + 186, s * 0.45);
      twinkleStar(ctx, CX + w / 2 + 36, H / 2 + 186, s * 0.45);
      ctx.restore();
    }
    const venue = info.venue.trim();
    const va = appear(u, 2.1 * f, 0.8 * sp);
    if (venue && va > 0) {
      ctx.save();
      ctx.globalAlpha = base * va;
      softShadow(env, 12);
      ctx.fillStyle = c.sub;
      fitFont(ctx, venue, 1300, body, 30);
      ctx.fillText(venue, CX, H / 2 + 240);
      ctx.restore();
    }
  } else {
    bouncyTitle(env, face, H / 2 - 230, 130, u, f, base);
    const lines = messageLines(ctx, info, body(40), 1400, 3);
    let y = H / 2 - 90;
    lines.forEach((line, i) => {
      const a = appear(u, (1.4 + i * 0.22) * f, 0.8 * sp);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = base * a;
        softShadow(env, 12);
        ctx.fillStyle = c.text;
        ctx.font = body(40);
        ctx.fillText(line, CX, y + (1 - a) * 14);
        ctx.restore();
      }
      y += 62;
    });
    namePills(env, info, y + 50, 48, 2.4, u, f, base);
    const notice = info.outroNotice.trim();
    const na = appear(u, 3.2 * f, 0.8 * sp);
    if (notice && na > 0) {
      ctx.save();
      ctx.globalAlpha = base * na * (0.8 + 0.2 * Math.sin(u * 2.2));
      softShadow(env, 12);
      ctx.fillStyle = c.accent;
      fitFont(ctx, notice, 1400, bodyFont(theme, true), 34);
      ctx.fillText(notice, CX, y + 150);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ───────────────────────── 한지 낙관 (전통 혼례) ─────────────────────────

/** 한지 결 (섬유질과 얼룩) */
function paperFibers(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const r = (q: number) => hash01(i * 13 + 4200 + q);
    const px = x + r(1) * w;
    const py = y + r(2) * h;
    const len = 12 + r(3) * 42;
    const ang = r(4) * TAU;
    ctx.strokeStyle = r(5) < 0.5 ? 'rgba(130,95,55,0.08)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.8 + r(6) * 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + Math.cos(ang + 0.6) * len * 0.5, py + Math.sin(ang + 0.6) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    ctx.stroke();
  }
  // 가장자리가 살짝 누렇게
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(160,120,60,0)');
  g.addColorStop(1, 'rgba(160,120,60,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** 전통 구름무늬 (소용돌이 + 봉우리) */
function cloudMotif(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, sx: 1 | -1, sy: 1 | -1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * TAU * 1.2 + Math.PI;
    const r = s * 0.04 + s * 0.2 * (i / 40);
    const px = s * 0.26 + Math.cos(th) * r;
    const py = s * 0.34 + Math.sin(th) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, s * 0.62);
  ctx.bezierCurveTo(-s * 0.06, s * 0.1, s * 0.46, -s * 0.02, s * 0.52, s * 0.24);
  ctx.bezierCurveTo(s * 0.62, s * 0.02, s * 0.98, s * 0.06, s * 0.92, s * 0.36);
  ctx.bezierCurveTo(s * 1.16, s * 0.36, s * 1.18, s * 0.62, s * 0.96, s * 0.64);
  ctx.lineTo(s * 0.1, s * 0.64);
  ctx.stroke();
  ctx.restore();
}

/** 붉은 낙관(도장): 두 사람 이름의 첫 글자 */
function seal(env: TextEnv, info: WeddingInfo, x: number, y: number, size: number, a: number): void {
  if (a <= 0) return;
  const { ctx, theme } = env;
  const look = theme.look;
  let chars = [initial(info.groom), initial(info.bride)].filter(Boolean);
  if (chars.length === 0) chars = ['혼', '례'];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  const s = 1 + 0.45 * (1 - a);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp01(a * 1.4) * 0.93;
  ctx.fillStyle = look.paperAccent;
  roundRectPath(ctx, -size / 2, -size / 2, size, size, size * 0.12);
  ctx.fill();
  // 닳은 가장자리
  ctx.fillStyle = look.paper;
  for (let i = 0; i < 18; i++) {
    const r = (q: number) => hash01(i * 7 + 777 + q);
    const side = Math.floor(r(1) * 4);
    const t = (r(2) - 0.5) * size;
    const px = side === 0 ? t : side === 1 ? size / 2 : side === 2 ? t : -size / 2;
    const py = side === 0 ? -size / 2 : side === 1 ? t : side === 2 ? size / 2 : t;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + r(3) * 3, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = look.paper;
  ctx.lineWidth = 3;
  roundRectPath(ctx, -size / 2 + 10, -size / 2 + 10, size - 20, size - 20, size * 0.08);
  ctx.stroke();
  ctx.fillStyle = look.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const make = nameFont(theme);
  if (chars.length === 1) {
    fitFont(ctx, chars[0], size * 0.6, make, size * 0.52);
    ctx.fillText(chars[0], 0, size * 0.02);
  } else {
    fitFont(ctx, chars[0], size * 0.6, make, size * 0.34);
    ctx.fillText(chars[0], 0, -size * 0.18);
    ctx.fillText(chars[1], 0, size * 0.2);
  }
  ctx.restore();
}

export function hanji(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const cw = outro ? 1020 : 1080;
  const ch = outro ? 700 : 700;
  const e = appear(u, 0.1 * f, 1.1 * sp);
  if (e <= 0) return;
  const cy = H / 2 + (1 - e) * 36;
  const x0 = CX - cw / 2;
  const y0 = cy - ch / 2;
  ctx.save();
  ctx.globalAlpha = base * e;
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 50 * k;
  ctx.shadowOffsetY = 20 * k;
  ctx.fillStyle = look.paper;
  ctx.fillRect(x0, y0, cw, ch);
  ctx.shadowColor = 'transparent';
  paperFibers(ctx, x0, y0, cw, ch);
  ctx.strokeStyle = look.paperAccent;
  ctx.globalAlpha = base * e * 0.85;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x0 + 26, y0 + 26, cw - 52, ch - 52);
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 36, y0 + 36, cw - 72, ch - 72);
  ctx.globalAlpha = base * e * 0.7;
  cloudMotif(ctx, x0 + 58, y0 + 52, 70, look.paperAccent, 1, 1);
  cloudMotif(ctx, x0 + cw - 58, y0 + 52, 70, look.paperAccent, -1, 1);
  cloudMotif(ctx, x0 + 58, y0 + ch - 52, 70, look.paperAccent, 1, -1);
  cloudMotif(ctx, x0 + cw - 58, y0 + ch - 52, 70, look.paperAccent, -1, -1);
  ctx.globalAlpha = base * e;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const item = (at: number, draw: (a: number) => void) => {
    const a = appear(u, at * f, 0.9 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * e * a;
    draw(a);
    ctx.restore();
  };
  const face = titleFace(theme, titleOf(env, info, outro));
  const body = bodyFont(theme);
  /** 제목을 붓으로 쓰듯 왼쪽부터 드러냄 */
  const brushTitle = (y: number, size: number, at: number) => {
    const we = easeInOutSine((u - at * f) / (1.1 * sp));
    if (we <= 0) return;
    ctx.save();
    ctx.fillStyle = look.paperText;
    const s = fitFont(ctx, face.text, cw - 200, face.make, faceSize(face, size));
    const w = face.caps ? spacedWidth(ctx, face.text, s * 0.18) : ctx.measureText(face.text).width;
    reveal(ctx, CX - w / 2 - 20, y, w + 40, s * 1.6, we, () => drawFace(ctx, face, CX, y, cw - 200, size));
    ctx.restore();
  };
  if (!outro) {
    item(0.5, () => {
      ctx.fillStyle = look.paperMuted;
      ctx.font = body(28);
      spaced(ctx, '백년가약', CX, cy - 250, 14);
    });
    brushTitle(cy - 150, 150, 0.7);
    item(1.3, () => drawDividerAt(ctx, look, CX, cy - 66, look.paperAccent, 170));
    item(1.6, () => drawNamesRow(env, info, CX, cy + 14, 64, nameFont(theme), look.paperText, look.paperAccent, 'center', 820));
    const date = formatKoreanDate(info.date, info.time);
    if (date)
      item(1.9, () => {
        ctx.fillStyle = look.paperText;
        fitFont(ctx, date, 820, body, 32);
        ctx.fillText(date, CX, cy + 104);
      });
    const venue = info.venue.trim();
    if (venue)
      item(2.1, () => {
        ctx.fillStyle = look.paperMuted;
        fitFont(ctx, venue, 820, body, 28);
        ctx.fillText(venue, CX, cy + 154);
      });
  } else {
    brushTitle(cy - 200, 150, 0.8);
    item(1.3, () => drawDividerAt(ctx, look, CX, cy - 118, look.paperAccent, 160));
    const lines = messageLines(ctx, info, body(34), cw - 260, 4);
    let y = cy - 50;
    lines.forEach((line, i) => {
      const ly = y;
      item(1.6 + i * 0.2, () => {
        ctx.fillStyle = look.paperText;
        ctx.font = body(34);
        ctx.fillText(line, CX, ly);
      });
      y += 54;
    });
    item(2.4, () => drawNamesRow(env, info, CX, y + 28, 48, nameFont(theme), look.paperText, look.paperAccent, 'center', 760));
    const notice = info.outroNotice.trim();
    if (notice)
      item(3, () => {
        ctx.fillStyle = look.paperAccent;
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        fitFont(ctx, notice, cw - 300, bodyFont(theme, true), 30);
        ctx.fillText(notice, CX, cy + ch / 2 - 92);
      });
  }
  const stamp = easeOutCubic((u - (outro ? 2.8 : 2.3) * f) / (0.5 * sp));
  ctx.globalAlpha = base * e;
  seal(env, info, x0 + cw - 150, y0 + ch - 150, 118, stamp);
  ctx.restore();
}

// ───────────────────────── 매거진 커버 (화보) ─────────────────────────

function barcode(ctx: CanvasRenderingContext2D, x: number, y: number, digits: string, font: string): void {
  const w = 230;
  const h = 132;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#111111';
  let bx = x + 16;
  let i = 0;
  while (bx < x + w - 18) {
    const r = hash01(i * 11 + 31);
    const bw = 2 + Math.floor(r * 4);
    if (i % 2 === 0) ctx.fillRect(bx, y + 14, bw, h - 50);
    bx += bw + 1 + Math.floor(hash01(i * 5 + 3) * 3);
    i++;
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(digits, x + w / 2, y + h - 20);
  ctx.restore();
}

export function cover(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const c = theme.colors;
  const fs = theme.fonts;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const d = dateParts(info);
  ctx.save();
  // 글이 올라갈 위쪽·왼쪽을 어둡게
  const sa = appear(u, 0, 1 * sp);
  ctx.globalAlpha = base * sa;
  const top = ctx.createLinearGradient(0, 0, 0, 460);
  top.addColorStop(0, 'rgba(0,0,0,0.5)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 460);
  const left = ctx.createLinearGradient(0, 0, W * 0.62, 0);
  left.addColorStop(0, 'rgba(0,0,0,0.45)');
  left.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 440, W, H - 440);
  ctx.textBaseline = 'middle';
  softShadow(env, 14);
  // 제호
  const mast = outro ? 'THANK YOU' : fs.titleCustom && theme.titleStyle === 'script' ? 'Wedding' : 'WEDDING';
  const ma = appear(u, 0.15 * f, 1.2 * sp);
  if (ma > 0) {
    ctx.save();
    ctx.globalAlpha = base * ma;
    ctx.fillStyle = c.text;
    const make = displayTitleFont(theme);
    const s = fitFont(ctx, mast, W - 340, make, outro ? 200 : 270);
    ctx.translate(0, (1 - ma) * -30);
    spaced(ctx, mast, CX, outro ? 196 : 232, s * 0.03);
    ctx.restore();
  }
  // 발행 정보 줄
  const ia = appear(u, 0.6 * f, 1 * sp);
  if (ia > 0) {
    ctx.save();
    ctx.globalAlpha = base * ia * 0.92;
    ctx.shadowColor = 'transparent';
    const yl = outro ? 312 : 376;
    ctx.fillStyle = c.text;
    ctx.fillRect(160, yl - 28, (W - 320) * ia, 1.6);
    ctx.fillRect(160, yl + 28, (W - 320) * ia, 1.6);
    ctx.font = fontSpec(fs.latin, 24, 500);
    const right = d ? `${MONTHS[d.month - 1]} ${d.year}` : 'FOREVER';
    spaced(ctx, outro ? 'WITH LOVE' : 'SPECIAL ISSUE', 170, yl + 1, 6, 'left');
    spaced(ctx, 'VOL. 01', CX, yl + 1, 6);
    spaced(ctx, right, W - 170, yl + 1, 6, 'right');
    ctx.restore();
  }
  const x0 = 150;
  const slide = (at: number, draw: () => void) => {
    const a = appear(u, at * f, 0.9 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * a;
    ctx.translate((1 - a) * -40, 0);
    draw();
    ctx.restore();
  };
  const g = info.groom.trim();
  const b = info.bride.trim();
  const make = nameFont(theme);
  const body = bodyFont(theme);
  if (!outro) {
    slide(1, () => {
      ctx.fillStyle = c.accent;
      ctx.font = fontSpec(fs.latin, 26, 600);
      spaced(ctx, 'THE LOVE STORY OF', x0, 520, 5, 'left');
    });
    if (g || b) {
      slide(1.25, () => {
        ctx.fillStyle = c.text;
        ctx.textAlign = 'left';
        fitFont(ctx, g || b, 900, make, 112);
        ctx.fillText(g || b, x0 - 4, 612);
      });
      if (g && b)
        slide(1.45, () => {
          ctx.textAlign = 'left';
          ctx.fillStyle = c.accent;
          ctx.font = fontSpec(fs.latin, 96, 500, true);
          ctx.fillText('&', x0, 730);
          const aw = ctx.measureText('& ').width;
          ctx.fillStyle = c.text;
          fitFont(ctx, b, 900 - aw, make, 112);
          ctx.fillText(b, x0 + aw + 6, 730);
        });
    }
    const face = titleFace(theme, titleOf(env, info, false));
    slide(1.7, () => {
      ctx.fillStyle = c.accent;
      drawFace(ctx, face, x0, 842, 900, 76, 'left');
    });
    const lines = [formatKoreanDate(info.date, info.time), info.venue.trim()].filter(Boolean);
    lines.forEach((line, i) =>
      slide(2 + i * 0.2, () => {
        ctx.fillStyle = c.sub;
        ctx.textAlign = 'left';
        fitFont(ctx, line, 900, body, 32);
        ctx.fillText(line, x0, 918 + i * 48);
      }),
    );
    // 오른쪽 둥근 딱지
    const be = easeOutBack((u - 1.6 * f) / (0.5 * sp));
    if (be > 0) {
      ctx.save();
      ctx.globalAlpha = base * clamp01(be * 2);
      ctx.translate(W - 300, 600);
      ctx.rotate(-0.18);
      ctx.scale(be, be);
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 18 * k;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(0, 0, 94, 0, TAU);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = fontSpec(fs.latin, 26, 600);
      spaced(ctx, 'SPECIAL', 0, -16, 3);
      spaced(ctx, 'EDITION', 0, 20, 3);
      ctx.restore();
    }
  } else {
    const qa = appear(u, 1 * f, 0.9 * sp);
    if (qa > 0) {
      ctx.save();
      ctx.globalAlpha = base * qa * 0.9;
      ctx.fillStyle = c.accent;
      ctx.textAlign = 'left';
      ctx.font = fontSpec(fs.latin, 240, 500);
      ctx.fillText('“', x0 - 20, 470);
      ctx.restore();
    }
    const lines = messageLines(ctx, info, body(44), 1150, 4);
    let y = 520;
    lines.forEach((line, i) => {
      const ly = y;
      slide(1.3 + i * 0.22, () => {
        ctx.fillStyle = c.text;
        ctx.textAlign = 'left';
        ctx.font = body(44);
        ctx.fillText(line, x0, ly);
      });
      y += 68;
    });
    slide(2.3, () => drawNamesRow(env, info, x0, y + 34, 58, make, c.text, c.accent, 'left', 1100));
    const notice = info.outroNotice.trim();
    if (notice)
      slide(2.9, () => {
        ctx.fillStyle = c.accent;
        ctx.textAlign = 'left';
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        fitFont(ctx, notice, 1100, bodyFont(theme, true), 34);
        ctx.fillText(notice, x0, y + 118);
      });
  }
  const bca = appear(u, 2.2 * f, 0.8 * sp);
  if (bca > 0) {
    ctx.save();
    ctx.globalAlpha = base * bca;
    ctx.shadowColor = 'transparent';
    const digits = d ? `${d.year.slice(2)} ${String(d.month).padStart(2, '0')}${String(d.day).padStart(2, '0')} 0001` : '26 1024 0001';
    barcode(ctx, W - 380, H - 250, digits, fontSpec(fs.latin, 20, 500));
    ctx.restore();
  }
  ctx.restore();
}

// ───────────────────────── 동화책 (별빛 동화) ─────────────────────────

function crescent(env: TextEnv, x: number, y: number, r: number): void {
  const { ctx, theme, k } = env;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(x + r * 0.45, y - r * 0.22, r * 0.86, 0, TAU, true);
  ctx.clip();
  ctx.shadowColor = theme.colors.accent;
  ctx.shadowBlur = 40 * k;
  ctx.fillStyle = theme.colors.accent;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function storybook(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const c = theme.colors;
  const fs = theme.fonts;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 초승달
  const ma = appear(u, 0.1 * f, 1.4 * sp);
  if (ma > 0) {
    ctx.save();
    ctx.globalAlpha = base * ma;
    ctx.translate(0, (1 - ma) * 24 + Math.sin(u * 0.8) * 4);
    crescent(env, CX + (outro ? 500 : 430), outro ? H / 2 - 330 : H / 2 - 290, outro ? 54 : 72);
    ctx.restore();
  }
  // 반짝이는 별
  ctx.save();
  ctx.fillStyle = c.accent;
  ctx.shadowColor = c.accent;
  ctx.shadowBlur = 12 * k;
  for (let i = 0; i < 11; i++) {
    const r = (q: number) => hash01(i * 23 + 600 + q);
    const a = appear(u, (0.3 + i * 0.08) * f, 0.6 * sp);
    if (a <= 0) continue;
    const ang = (i / 11) * TAU + r(1) * 0.35;
    const x = CX + Math.cos(ang) * (700 + r(2) * 120);
    const y = H / 2 + Math.sin(ang) * (360 + r(3) * 60);
    const tw = 0.55 + 0.45 * Math.sin(u * (1.4 + r(4) * 1.6) + r(5) * TAU);
    ctx.globalAlpha = base * a * tw;
    star5(ctx, x, y, 8 + r(6) * 12);
  }
  ctx.restore();
  const body = bodyFont(theme);
  const face = titleFace(theme, titleOf(env, info, outro));
  const item = (at: number, draw: (a: number) => void) => {
    const a = appear(u, at * f, 1 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * a;
    softShadow(env, 16);
    draw(a);
    ctx.restore();
  };
  if (!outro) {
    // 별자리: 점선이 이어지며 그려짐
    const pts: [number, number][] = [
      [CX - 660, H / 2 - 300],
      [CX - 575, H / 2 - 236],
      [CX - 480, H / 2 - 290],
      [CX - 392, H / 2 - 222],
      [CX - 300, H / 2 - 276],
    ];
    const cp = clamp01((u - 0.5 * f) / (1.5 * sp));
    if (cp > 0) {
      ctx.save();
      ctx.globalAlpha = base * 0.8;
      ctx.strokeStyle = c.accent;
      ctx.fillStyle = c.accent;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 9]);
      const segs = pts.length - 1;
      const upto = cp * segs;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= segs; i++) {
        const q = clamp01(upto - (i - 1));
        if (q <= 0) break;
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        ctx.lineTo(ax + (bx - ax) * q, ay + (by - ay) * q);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach(([x, y], i) => {
        if (i <= upto + 0.01) star5(ctx, x, y, i === 2 ? 11 : 7);
      });
      ctx.restore();
    }
    item(0.5, () => {
      ctx.fillStyle = c.sub;
      ctx.font = fontSpec(fs.latin, 38, 500, true);
      ctx.fillText('Once upon a time', CX, H / 2 - 176);
    });
    item(0.8, (a) => {
      ctx.fillStyle = c.accent;
      drawFace(ctx, face, CX, H / 2 - 66 + (1 - a) * 20, 1500, 128);
    });
    item(1.4, () => drawNamesRow(env, info, CX, H / 2 + 72, 66, nameFont(theme), c.text, c.accent, 'center', 1500));
    const date = formatKoreanDate(info.date, info.time);
    if (date)
      item(1.8, () => {
        ctx.fillStyle = c.sub;
        fitFont(ctx, date, 1400, body, 34);
        ctx.fillText(date, CX, H / 2 + 164);
      });
    const venue = info.venue.trim();
    if (venue)
      item(2, () => {
        ctx.fillStyle = c.sub;
        fitFont(ctx, venue, 1400, body, 30);
        ctx.fillText(venue, CX, H / 2 + 212);
      });
  } else {
    item(0.8, () => {
      ctx.fillStyle = c.sub;
      ctx.font = fontSpec(fs.latin, 34, 500, true);
      ctx.fillText('and they lived happily ever after', CX, H / 2 - 290);
    });
    item(1.1, (a) => {
      ctx.fillStyle = c.accent;
      drawFace(ctx, face, CX, H / 2 - 196 + (1 - a) * 18, 1500, 112);
    });
    const lines = messageLines(ctx, info, body(40), 1400, 3);
    let y = H / 2 - 76;
    lines.forEach((line, i) => {
      const ly = y;
      item(1.7 + i * 0.22, () => {
        ctx.fillStyle = c.text;
        ctx.font = body(40);
        ctx.fillText(line, CX, ly);
      });
      y += 62;
    });
    item(2.6, () => drawNamesRow(env, info, CX, y + 34, 52, nameFont(theme), c.text, c.accent));
    const notice = info.outroNotice.trim();
    if (notice)
      item(3.2, () => {
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        ctx.fillStyle = c.accent;
        fitFont(ctx, notice, 1400, body, 34);
        ctx.fillText(notice, CX, y + 118);
      });
  }
  ctx.restore();
}

// ───────────────────────── 모노그램 (로열) ─────────────────────────

/** 문장 아래를 감싸는 월계수 가지 (p = 자라난 정도) */
function laurel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, p: number, color: string): void {
  if (p <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const span = 1.55;
  for (const side of [1, -1]) {
    ctx.beginPath();
    const a0 = Math.PI / 2 - side * 0.22;
    const a1 = Math.PI / 2 - side * (0.22 + span * p);
    ctx.arc(cx, cy, r, a0, a1, side === 1);
    ctx.stroke();
    for (let i = 0; i <= 11; i++) {
      const frac = i / 11;
      const grow = clamp01((p - frac * 0.92) * 7);
      if (grow <= 0) break;
      const ang = Math.PI / 2 - side * (0.22 + span * frac);
      for (const [off, tilt] of [
        [1.1, 0.6],
        [0.9, -0.6],
      ] as const) {
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * r * off, cy + Math.sin(ang) * r * off);
        ctx.rotate(ang - (side * Math.PI) / 2 + tilt * side);
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * grow, 6 * grow, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

export function monogram(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const c = theme.colors;
  const fs = theme.fonts;
  const look = theme.look;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const R = outro ? 96 : 126;
  // 엔딩은 문장을 조금 올리고 제목을 내려, 필기체 제목의 위쪽 획이 월계수 잎에 닿지 않게
  const ccy = outro ? H / 2 - 280 : H / 2 - 210;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  softShadow(env, 14);
  // 두 겹 원이 그려짐
  const ra = easeInOutSine((u - 0.2 * f) / (1.5 * sp));
  if (ra > 0) {
    ctx.save();
    ctx.globalAlpha = base;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, ccy, R, -Math.PI / 2, -Math.PI / 2 + TAU * ra);
    ctx.stroke();
    ctx.globalAlpha = base * 0.7;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(CX, ccy, R - 12, -Math.PI / 2, -Math.PI / 2 - TAU * ra, true);
    ctx.stroke();
    // 원을 따라 도는 반짝임
    if (ra >= 1) {
      const a = -Math.PI / 2 + ((u * 1.1) % TAU);
      const gx = CX + Math.cos(a) * R;
      const gy = ccy + Math.sin(a) * R;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 26);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = base;
      ctx.fillStyle = g;
      ctx.fillRect(gx - 26, gy - 26, 52, 52);
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = base;
  laurel(ctx, CX, ccy, R + 26, clamp01((u - 0.6 * f) / (1.4 * sp)), c.accent);
  ctx.restore();
  const ce = easeOutBack((u - 1.2 * f) / (0.6 * sp));
  if (ce > 0) {
    ctx.save();
    ctx.globalAlpha = base * clamp01(ce * 2);
    ctx.translate(CX, ccy - R - 34);
    ctx.scale(2.3 * ce, 2.3 * ce);
    drawOrnament(ctx, 'crown', 0, 0, c.accent);
    ctx.restore();
  }
  // 이니셜
  const ia = appear(u, 0.9 * f, 1 * sp);
  const inits = [initial(info.groom), initial(info.bride)].filter(Boolean);
  if (ia > 0 && inits.length) {
    ctx.save();
    ctx.globalAlpha = base * ia;
    const latin = inits.every((x) => !HANGUL.test(x));
    const make = latin ? (s: number) => fontSpec(fs.title, s, fs.titleWeight, fs.titleItalic) : nameFont(theme);
    const size = (latin ? 1.05 : 0.62) * R;
    ctx.fillStyle = c.text;
    if (inits.length === 1) {
      ctx.font = make(size * 1.2);
      ctx.fillText(inits[0], CX, ccy + 4);
    } else {
      ctx.font = make(size);
      ctx.fillText(inits[0], CX - R * 0.4, ccy + 2);
      ctx.fillText(inits[1], CX + R * 0.4, ccy + 2);
      ctx.fillStyle = c.accent;
      ctx.font = fontSpec(fs.latin, R * 0.34, 500, true);
      ctx.fillText('&', CX, ccy + 4);
    }
    ctx.restore();
  }
  const face = titleFace(theme, titleOf(env, info, outro));
  const body = bodyFont(theme);
  const item = (at: number, draw: (a: number) => void) => {
    const a = appear(u, at * f, 1 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * a;
    draw(a);
    ctx.restore();
  };
  if (!outro) {
    item(1.3, (a) => {
      ctx.fillStyle = c.accent;
      drawFace(ctx, face, CX, H / 2 + 36 + (1 - a) * 14, 1400, 80);
    });
    item(1.6, () => {
      ctx.fillStyle = c.sub;
      ctx.font = fontSpec(fs.latin, 24, 500);
      spaced(ctx, 'THE WEDDING OF', CX, H / 2 + 100, 8);
    });
    item(1.8, () => drawNamesRow(env, info, CX, H / 2 + 160, 70, nameFont(theme), c.text, c.accent, 'center', 1500));
    item(2, () => drawDividerAt(ctx, look, CX, H / 2 + 222, c.accent, 180));
    const lines = [formatKoreanDate(info.date, info.time), info.venue.trim()].filter(Boolean);
    lines.forEach((line, i) =>
      item(2.2 + i * 0.2, () => {
        ctx.fillStyle = c.sub;
        fitFont(ctx, line, 1400, body, i === 0 ? 32 : 28);
        ctx.fillText(line, CX, H / 2 + 268 + i * 44);
      }),
    );
  } else {
    item(1.3, (a) => {
      ctx.fillStyle = c.accent;
      drawFace(ctx, face, CX, H / 2 - 76 + (1 - a) * 14, 1400, 92);
    });
    const lines = messageLines(ctx, info, body(40), 1400, 3);
    let y = H / 2 + 20;
    lines.forEach((line, i) => {
      const ly = y;
      item(1.8 + i * 0.22, () => {
        ctx.fillStyle = c.text;
        ctx.font = body(40);
        ctx.fillText(line, CX, ly);
      });
      y += 60;
    });
    item(2.6, () => drawNamesRow(env, info, CX, y + 36, 52, nameFont(theme), c.text, c.accent));
    const notice = info.outroNotice.trim();
    if (notice)
      item(3.2, () => {
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        ctx.fillStyle = c.accent;
        fitFont(ctx, notice, 1400, body, 34);
        ctx.fillText(notice, CX, y + 118);
      });
  }
  ctx.restore();
}

// ───────────────────────── 여행 엽서 (썸머 비치) ─────────────────────────

function stamp(ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number, w: number, h: number, year: string): void {
  const look = theme.look;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.05);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 6;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent';
  // 톱니 모양 가장자리 (종이 색 구멍)
  ctx.fillStyle = look.paper;
  const step = 15;
  for (let px = -w / 2; px <= w / 2 + 0.1; px += step) {
    for (const py of [-h / 2, h / 2]) {
      ctx.beginPath();
      ctx.arc(px, py, 4.6, 0, TAU);
      ctx.fill();
    }
  }
  for (let py = -h / 2; py <= h / 2 + 0.1; py += step) {
    for (const px of [-w / 2, w / 2]) {
      ctx.beginPath();
      ctx.arc(px, py, 4.6, 0, TAU);
      ctx.fill();
    }
  }
  const iw = w - 30;
  const ih = h - 30;
  ctx.fillStyle = look.posterBg;
  ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
  // 해와 물결
  ctx.fillStyle = look.posterInk;
  ctx.beginPath();
  ctx.arc(iw * 0.18, -ih * 0.18, iw * 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = look.paperAccent;
  ctx.lineWidth = 3;
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const px = -iw / 2 + (i / 20) * iw;
      const py = ih * 0.1 + j * ih * 0.13 + Math.sin(i * 0.9 + j) * 4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = look.paperText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = fontSpec(theme.fonts.latin, 20, 600);
  ctx.fillText('LOVE', -iw / 2 + 10, -ih / 2 + 18);
  ctx.textAlign = 'right';
  ctx.fillText(year, iw / 2 - 10, ih / 2 - 16);
  ctx.restore();
}

function postmark(ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number, r: number, line1: string): void {
  const color = theme.look.paperMuted;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 10, 0, TAU);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fontSpec(theme.fonts.latin, 20, 600);
  ctx.fillText(line1, 0, -10);
  ctx.font = fontSpec(theme.fonts.latin, 16, 600);
  spaced(ctx, 'WEDDING', 0, 16, 3);
  // 소인 물결 (우표 위로)
  ctx.lineWidth = 2.4;
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const px = r * 0.9 + i * 7;
      const py = -18 + j * 18 + Math.sin(i * 0.7) * 5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 엽서 위아래 가장자리 항공우편 줄무늬 */
function airmail(ctx: CanvasRenderingContext2D, theme: Theme, x0: number, y: number, w: number): void {
  const colors = [theme.look.paperAccent, theme.look.posterInk];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y - 7, w, 14);
  ctx.clip();
  for (let i = 0, x = x0 - 20; x < x0 + w + 20; i++, x += 34) {
    ctx.fillStyle = colors[i % 2];
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x + 16, y - 7);
    ctx.lineTo(x + 32, y - 7);
    ctx.lineTo(x + 16, y + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function postcard(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const fs = theme.fonts;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const cw = 1280;
  const ch = 780;
  const e = easeOutBack((u - 0.1 * f) / (0.9 * sp));
  const ea = clamp01((u - 0.1 * f) / (0.35 * sp));
  if (ea <= 0) return;
  const cy = H / 2 + 10 + (1 - Math.min(1, e)) * 140;
  ctx.save();
  ctx.globalAlpha = base * ea;
  ctx.translate(CX, cy);
  ctx.rotate(((-2.2 - (1 - e) * 6) * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 50 * k;
  ctx.shadowOffsetY = 20 * k;
  ctx.fillStyle = look.paper;
  roundRectPath(ctx, -cw / 2, -ch / 2, cw, ch, 12);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  airmail(ctx, theme, -cw / 2 + 12, -ch / 2 + 16, cw - 24);
  airmail(ctx, theme, -cw / 2 + 12, ch / 2 - 16, cw - 24);
  ctx.globalAlpha = base * ea * 0.45;
  ctx.strokeStyle = look.paperMuted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, -ch / 2 + 130);
  ctx.lineTo(40, ch / 2 - 90);
  ctx.stroke();
  ctx.globalAlpha = base * ea;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = look.paperMuted;
  ctx.font = fontSpec(fs.latin, 26, 600);
  spaced(ctx, 'POST CARD', 0, -ch / 2 + 74, 10);
  const item = (at: number, draw: () => void) => {
    const a = appear(u, at * f, 0.9 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * ea * a;
    draw();
    ctx.restore();
  };
  const lx = -cw / 2 + 80;
  const colW = 520;
  const face = titleFace(theme, titleOf(env, info, outro));
  const hand = (s: number) => fontSpec(fs.hand, s);
  if (!outro) {
    item(0.6, () => {
      ctx.fillStyle = look.paperMuted;
      if (theme.titleStyle === 'script' && !HANGUL.test(face.text)) {
        ctx.textAlign = 'left';
        fitFont(ctx, 'Greetings from', colW, (s) => fontSpec(fs.title, s, fs.titleWeight, fs.titleItalic), 46);
        ctx.fillText('Greetings from', lx, -220);
      } else {
        ctx.font = fontSpec(fs.latin, 24, 600);
        spaced(ctx, 'GREETINGS FROM', lx, -220, 6, 'left');
      }
    });
    item(0.9, () => {
      ctx.fillStyle = look.paperAccent;
      drawFace(ctx, face, lx, -110, colW, 120, 'left');
    });
    item(1.3, () => drawNamesRow(env, info, lx, 30, 60, nameFont(theme), look.paperText, look.paperAccent, 'left', colW));
  } else {
    item(0.9, () => {
      ctx.fillStyle = look.paperAccent;
      drawFace(ctx, face, lx, -200, colW, 110, 'left');
    });
    const lines = messageLines(ctx, info, hand(46), colW, 4);
    lines.forEach((line, i) =>
      item(1.4 + i * 0.22, () => {
        ctx.fillStyle = look.caption;
        ctx.textAlign = 'left';
        fitFont(ctx, line, colW, hand, 46);
        ctx.fillText(line, lx, -80 + i * 70);
      }),
    );
  }
  // 오른쪽: 우표·소인·주소 줄
  const d = dateParts(info);
  item(0.5, () => stamp(ctx, theme, 470, -210, 160, 190, d?.year ?? '2026'));
  const pm = easeOutCubic((u - 1.6 * f) / (0.45 * sp));
  if (pm > 0) {
    ctx.save();
    ctx.globalAlpha = base * ea * clamp01(pm * 1.5) * 0.85;
    ctx.translate(320, -150);
    const s = 1 + 0.35 * (1 - pm);
    ctx.scale(s, s);
    postmark(ctx, theme, 0, 0, 78, d ? `${d.year}.${String(d.month).padStart(2, '0')}.${String(d.day).padStart(2, '0')}` : 'LOVE');
    ctx.restore();
  }
  const g = info.groom.trim();
  const b = info.bride.trim();
  const names = g && b ? `${g} & ${b}` : g || b;
  const rows = outro
    ? [names ? `from. ${names}` : '', info.outroNotice.trim()].filter(Boolean)
    : [formatKoreanDate(info.date, info.time), info.venue.trim()].filter(Boolean);
  const rx = 110;
  const rw = 460;
  [40, 130, 220].forEach((ly, i) => {
    ctx.save();
    ctx.globalAlpha = base * ea * 0.5;
    ctx.strokeStyle = look.paperMuted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx, ly + 26);
    ctx.lineTo(rx + rw, ly + 26);
    ctx.stroke();
    ctx.restore();
    const text = rows[i];
    if (!text) return;
    const we = easeInOutSine((u - (2 + i * 0.35) * f) / (0.8 * sp));
    ctx.save();
    ctx.globalAlpha = base * ea;
    ctx.fillStyle = look.caption;
    ctx.textAlign = 'left';
    const s = fitFont(ctx, text, rw, hand, 44);
    reveal(ctx, rx - 6, ly, rw + 12, s * 1.6, we, () => ctx.fillText(text, rx, ly));
    ctx.restore();
  });
  ctx.restore();
}

// ───────────────────────── 레트로 선셋 ─────────────────────────

const RETRO_BANDS = ['#ffd36e', '#ffa24a', '#f07a3a', '#dd5a35', '#c1443a', '#9c3342'];

/** 겹겹이 어긋난 그림자가 있는 70년대 글자 */
function retroText(ctx: CanvasRenderingContext2D, depth: number, front: string, draw: () => void): void {
  const layers = ['#5b1f2a', '#c1443a', '#ffa24a'];
  ctx.save();
  ctx.shadowColor = 'transparent';
  for (let i = layers.length; i >= 1; i--) {
    ctx.save();
    ctx.translate(i * depth, i * depth);
    ctx.fillStyle = layers[i - 1];
    draw();
    ctx.restore();
  }
  ctx.fillStyle = front;
  draw();
  ctx.restore();
}

export function sunburst(env: TextEnv, info: WeddingInfo, u: number, f: number, outro: boolean): void {
  const { ctx, theme } = env;
  const c = theme.colors;
  const sp = Math.max(0.55, f);
  const base = ctx.globalAlpha;
  const R = outro ? 220 : 330;
  const scy = outro ? H / 2 - 170 : H / 2 + 20;
  const horizon = scy + R * 0.66;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 뒤로 퍼지는 햇살
  const ra = appear(u, 0.1 * f, 1.2 * sp);
  if (ra > 0) {
    ctx.save();
    ctx.globalAlpha = base * ra * 0.2;
    ctx.translate(CX, scy);
    ctx.rotate(u * 0.05);
    ctx.fillStyle = c.accent;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 1500, a, a + TAU / 48);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // 수평선 위로 떠오르는 줄무늬 해
  const sa = easeOutCubic((u - 0.2 * f) / (1.3 * sp));
  if (sa > 0) {
    ctx.save();
    ctx.globalAlpha = base * Math.min(1, sa * 1.4);
    ctx.beginPath();
    ctx.rect(0, 0, W, horizon);
    ctx.clip();
    const dy = (1 - sa) * R * 1.3;
    const top = scy + dy - R;
    ctx.beginPath();
    ctx.arc(CX, scy + dy, R, 0, TAU);
    ctx.clip();
    const g = ctx.createLinearGradient(0, top, 0, top + R * 0.95);
    g.addColorStop(0, RETRO_BANDS[0]);
    g.addColorStop(1, RETRO_BANDS[1]);
    ctx.fillStyle = g;
    ctx.fillRect(CX - R, top, R * 2, R * 0.95);
    let y = top + R * 0.95 + R * 0.05;
    for (let j = 0; j < 7 && y < scy + dy + R; j++) {
      const h = R * 0.12 * (1 - j * 0.11);
      ctx.fillStyle = RETRO_BANDS[Math.min(RETRO_BANDS.length - 1, j + 1)];
      ctx.fillRect(CX - R, y, R * 2, h);
      y += h + R * 0.04 + j * R * 0.012;
    }
    ctx.restore();
    // 수평선 아래 가는 줄
    ctx.save();
    ctx.globalAlpha = base * sa * 0.7;
    ctx.fillStyle = c.accent;
    for (let j = 0; j < 3; j++) ctx.fillRect(CX - R * (1.5 - j * 0.3), horizon + 12 + j * 16, R * 2 * (1.5 - j * 0.3), 3 - j * 0.6);
    ctx.restore();
  }
  const face = titleFace(theme, titleOf(env, info, outro));
  const body = bodyFont(theme);
  const ta = easeOutBack((u - 0.7 * f) / (0.6 * sp));
  const tAlpha = clamp01((u - 0.7 * f) / (0.25 * sp));
  if (tAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = base * tAlpha;
    const ty = outro ? scy - 10 : H / 2 - 50;
    ctx.translate(CX, ty);
    const s = 0.85 + 0.15 * ta;
    ctx.scale(s, s);
    retroText(ctx, 7 * Math.min(1, ta), c.text, () => drawFace(ctx, face, 0, 0, 1500, outro ? 124 : 156));
    ctx.restore();
  }
  const item = (at: number, draw: () => void) => {
    const a = appear(u, at * f, 0.9 * sp);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = base * a;
    draw();
    ctx.restore();
  };
  const names = () => {
    const g = info.groom.trim();
    const b = info.bride.trim();
    return g && b ? `${g} & ${b}` : g || b;
  };
  if (!outro) {
    const n = names();
    if (n)
      item(1.3, () =>
        retroText(ctx, 4, c.text, () => {
          fitFont(ctx, n, 1400, nameFont(theme), 70);
          ctx.fillText(n, CX, H / 2 + 148);
        }),
      );
    const lines = [formatKoreanDate(info.date, info.time), info.venue.trim()].filter(Boolean);
    lines.forEach((line, i) =>
      item(1.7 + i * 0.2, () => {
        softShadow(env, 10);
        ctx.fillStyle = c.sub;
        fitFont(ctx, line, 1400, body, i === 0 ? 34 : 30);
        ctx.fillText(line, CX, H / 2 + 238 + i * 46);
      }),
    );
  } else {
    const lines = messageLines(ctx, info, body(40), 1400, 3);
    let y = horizon + 96;
    lines.forEach((line, i) => {
      const ly = y;
      item(1.5 + i * 0.22, () => {
        softShadow(env, 10);
        ctx.fillStyle = c.text;
        ctx.font = body(40);
        ctx.fillText(line, CX, ly);
      });
      y += 60;
    });
    const n = names();
    if (n)
      item(2.4, () =>
        retroText(ctx, 3, c.text, () => {
          fitFont(ctx, n, 1400, nameFont(theme), 54);
          ctx.fillText(n, CX, y + 30);
        }),
      );
    const notice = info.outroNotice.trim();
    if (notice)
      item(3, () => {
        softShadow(env, 10);
        ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(u * 2.2);
        ctx.fillStyle = c.accent;
        fitFont(ctx, notice, 1400, body, 34);
        ctx.fillText(notice, CX, y + 112);
      });
  }
  ctx.restore();
}
