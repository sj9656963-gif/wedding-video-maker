// 추가 배치: 큰 글자 포스터, 스티커 콜라주, 전시 액자(갤러리), 아치 프레임

import type { DrawableImage } from './assets';
import { DESIGN_H as H, DESIGN_W as W, clamp01, createCanvas, easeOutCubic, get2d } from './design';
import { captionOf, drawCover, drawCoverClipped, fitLine, isDark, roundRectPath, type SceneEnv, type SceneTime } from './draw-utils';
import { backdropTextColor, drawBackdrop } from './layouts';
import { hash01 } from './random';
import { fontSpec, type Theme } from './themes';
import type { PhotoSegment } from './types';

type MotionSt = { s: number; ox: number; oy: number };
const deg = (d: number) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

/** 굵은 강조 글꼴로 쓸 문구의 글꼴: 한글이 섞이면 한글 본문 글꼴의 이름 굵기로 (영문 전용 글꼴에는 한글이 없음) */
function displayFont(theme: Theme, text: string, size: number): string {
  const f = theme.fonts;
  return HANGUL.test(text) ? fontSpec(f.body, size, f.nameWeight) : fontSpec(f.display, size, f.displayWeight);
}

/** 살짝 튕기며 멈추는 움직임 */
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const v = clamp01(x) - 1;
  return 1 + c3 * v * v * v + c1 * v * v;
}

const halftoneCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern | null>>();
/** 망점 무늬 (인쇄물 느낌) */
function halftone(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | null {
  let m = halftoneCache.get(ctx);
  if (!m) {
    m = new Map();
    halftoneCache.set(ctx, m);
  }
  if (!m.has(color)) {
    const c = createCanvas(22, 22);
    const g = get2d(c, false);
    g.fillStyle = color;
    for (const [x, y] of [
      [5.5, 5.5],
      [16.5, 16.5],
    ]) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, TAU);
      g.fill();
    }
    m.set(color, ctx.createPattern(c, 'repeat'));
  }
  return m.get(color) ?? null;
}

function posterGround(env: SceneEnv, st: SceneTime): void {
  const { ctx, theme } = env;
  const look = theme.look;
  ctx.fillStyle = look.posterBg;
  ctx.fillRect(0, 0, W, H);
  if (!look.halftone) return;
  const p = halftone(ctx, look.halftone);
  if (!p) return;
  ctx.save();
  const drift = (st.u * 14) % 22;
  ctx.translate(drift, drift * 0.5);
  ctx.fillStyle = p;
  ctx.fillRect(-22, -22, W + 44, H + 44);
  ctx.restore();
}

/** 네 갈래 반짝이 낙서 */
function doodleStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function squiggle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, progress: number): void {
  if (progress <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = Math.max(2, Math.round(24 * progress));
  for (let i = 0; i <= n; i++) {
    const u = (i / 24) * w;
    ctx.lineTo(x + u, y + Math.sin((i / 24) * TAU * 2.5) * 16);
  }
  ctx.stroke();
  ctx.restore();
}

/** 흰 테두리·그림자가 있는 사진 카드 (회전·크기 포함). label이 있으면 카드 아래 가장자리에 작은 이름표를 붙임 */
function photoCard(
  env: SceneEnv,
  img: DrawableImage,
  cx: number,
  cy: number,
  w: number,
  h: number,
  rot: number,
  border: number,
  radius: number,
  zoom: number,
  label = '',
): void {
  const { ctx, theme, k } = env;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 34 * k;
  ctx.shadowOffsetY = 14 * k;
  ctx.fillStyle = theme.look.frame;
  roundRectPath(ctx, -w / 2 - border, -h / 2 - border, w + border * 2, h + border * 2, radius + border);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.clip();
  drawCover(ctx, img, -w / 2, -h / 2, w, h, zoom, 0, -0.2);
  ctx.restore();
  if (label) {
    const look = theme.look;
    const size = Math.max(26, Math.min(40, w * 0.075));
    const fit = fitLine(ctx, label, w * 0.86, (s) => displayFont(theme, label, s), size);
    const lh = fit.size * 1.7;
    const lw = fit.width + fit.size * 1.3;
    const ly = h / 2 + border - lh * 0.45;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 10 * k;
    ctx.shadowOffsetY = 4 * k;
    ctx.fillStyle = look.posterInk;
    roundRectPath(ctx, -lw / 2, ly, lw, lh, lh / 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = look.posterBg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit.text, 0, ly + lh / 2 + 1);
  }
  ctx.restore();
}

// ───────────────────────── 포스터 ─────────────────────────

export function drawPosterScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme } = env;
  const look = theme.look;
  posterGround(env, st);
  const word = (seg.year !== undefined ? String(seg.year) : look.posterWord).toUpperCase();
  const flip = seg.variant % 2 === 1 ? -1 : 1;

  // 뒤에서 흐르는 큰 글자 두 줄 (한 줄은 채움, 한 줄은 외곽선)
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(deg(-7 * flip));
  ctx.font = fontSpec(theme.fonts.display, 430, theme.fonts.displayWeight);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const unit = ctx.measureText(`${word} `).width || 400;
  const reps = Math.ceil((W * 1.6) / unit) + 2;
  const line = Array.from({ length: reps }, () => word).join(' ');
  const shift = (st.u * 70) % unit;
  ctx.fillStyle = look.posterInk;
  ctx.globalAlpha = 0.95;
  ctx.fillText(line, -W * 0.8 - shift, -250);
  ctx.strokeStyle = look.posterInk;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.8;
  ctx.strokeText(line, -W * 0.8 - unit + shift, 250);
  ctx.restore();

  const img = env.assets.image(seg.photoIds[0]);
  if (!img) return;
  const a = Math.min(1.35, Math.max(0.68, img.width / img.height));
  let h = H * 0.7;
  let w = h * a;
  if (w > W * 0.5) {
    w = W * 0.5;
    h = w / a;
  }
  const e = st.reveal ? 1 : easeOutBack((st.u - st.tin * 0.3) / 0.75);
  const s = 1.22 - 0.22 * e;
  const rot = deg((3.5 - (1 - e) * 8) * flip);
  const cx = W / 2 + 60 * flip;
  const cy = H / 2 + 6 + Math.sin(st.u * 0.8) * 4;
  ctx.save();
  ctx.globalAlpha *= clamp01(e * 1.6);
  photoCard(env, img, cx, cy, w * s, h * s, rot, 16, 6, 1 + (m.s - 1) * 0.6);
  ctx.restore();

  // 사진 문구를 넣었으면 스티커 라벨로 (날짜를 자동으로 붙이지 않음)
  const tag = captionOf(env, seg.photoIds[0]);
  const te = easeOutBack((st.u - (st.reveal ? 0.2 : st.tin * 0.3 + 0.35)) / 0.6);
  if (tag && te > 0) {
    ctx.save();
    ctx.translate(cx - (w / 2) * flip - 10 * flip, cy + h / 2 - 30);
    ctx.rotate(deg(-9 * flip));
    ctx.scale(te, te);
    const fit = fitLine(ctx, tag, 560, (sz) => displayFont(theme, tag, sz), 46);
    const tw = fit.width + 56;
    ctx.fillStyle = look.posterInk;
    roundRectPath(ctx, -tw / 2, -40, tw, 80, 40);
    ctx.fill();
    ctx.fillStyle = look.posterBg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit.text, 0, 3);
    ctx.restore();
  }
  const de = clamp01((st.u - 0.3) / 0.8);
  if (de > 0) {
    doodleStar(ctx, cx + (w / 2 + 70) * flip, cy - h / 2 + 40, 42 * easeOutBack(de), look.posterInk, st.u * 0.6);
    doodleStar(ctx, cx + (w / 2 + 130) * flip, cy - h / 2 + 150, 22 * easeOutBack(de), look.posterInk, -st.u * 0.8);
  }
}

// ───────────────────────── 스티커 ─────────────────────────

const STICKER_SLOTS: Record<number, { x: number; y: number; r: number; w: number }[]> = {
  2: [
    { x: -340, y: 14, r: -7, w: 600 },
    { x: 350, y: -18, r: 6, w: 600 },
  ],
  3: [
    { x: -575, y: 36, r: -8, w: 480 },
    { x: 0, y: -34, r: 4, w: 480 },
    { x: 575, y: 22, r: -5, w: 480 },
  ],
};

export function drawStickerScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme } = env;
  const look = theme.look;
  posterGround(env, st);
  const n = Math.min(3, Math.max(2, seg.photoIds.length));
  const slots = STICKER_SLOTS[n];
  const flip = seg.variant % 2 === 1 ? -1 : 1;
  const de = clamp01((st.u - 0.2) / 1.2);
  squiggle(ctx, 140, 150, 380, look.posterInk, de);
  squiggle(ctx, W - 560, H - 130, 420, look.posterInk, de);
  for (let j = 0; j < n; j++) {
    const id = seg.photoIds[j];
    const img = env.assets.image(id);
    if (!img) continue;
    const slot = slots[j];
    const at = st.reveal ? j * 0.12 - 0.3 : st.tin * 0.3 + j * 0.26;
    const e = easeOutBack((st.u - at) / 0.55);
    if (e <= 0) continue;
    const a = Math.min(1.25, Math.max(0.78, img.width / img.height));
    const w = slot.w;
    const h = Math.min(H * 0.74, w / a);
    const float = Math.sin(st.u * 0.9 + j * 2.1);
    const s = e;
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 2);
    photoCard(
      env,
      img,
      W / 2 + slot.x * flip + float * 3,
      H / 2 + slot.y + float * 5,
      w * s,
      h * s,
      deg(slot.r * flip + float * 0.6),
      18,
      30,
      1 + (m.s - 1) * 0.5,
      captionOf(env, id),
    );
    ctx.restore();
  }
  if (de > 0) {
    const r = (i: number) => hash01(seg.index * 31 + i);
    for (let i = 0; i < 4; i++) {
      doodleStar(ctx, 120 + r(i) * (W - 240), i % 2 ? 90 + r(i + 9) * 90 : H - 110 - r(i + 9) * 80, (18 + r(i + 4) * 26) * easeOutBack(de), look.posterInk, st.u * (r(i + 7) - 0.5) * 2);
    }
  }
}

// ───────────────────────── 갤러리 ─────────────────────────

const GALLERY_H: Record<number, number> = { 1: 0.6, 2: 0.54, 3: 0.46 };

export function drawGalleryScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const n = Math.min(3, Math.max(1, seg.photoIds.length));
  // 벽과 바닥
  ctx.fillStyle = look.wall;
  ctx.fillRect(0, 0, W, H);
  const floorY = H * 0.88;
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.1)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(0.87, 'rgba(0,0,0,0.05)');
  shade.addColorStop(0.88, 'rgba(0,0,0,0.16)');
  shade.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, floorY, W, 3);

  const imgs = seg.photoIds.slice(0, n).map((id) => env.assets.image(id));
  const fh = H * GALLERY_H[n];
  const border = 16;
  const sizes = imgs.map((img) => {
    const a = img ? Math.min(1.5, Math.max(0.66, img.width / img.height)) : 0.8;
    const matPad = fh * 0.09;
    const ph = fh - (matPad + border) * 2;
    const pw = ph * a;
    return { pw, ph, matPad, w: pw + (matPad + border) * 2, h: fh };
  });
  const gap = n === 1 ? 0 : 110;
  const total = sizes.reduce((s, z) => s + z.w, 0) + gap * (n - 1);
  const scale = total > W * 0.86 ? (W * 0.86) / total : 1;
  // 천천히 옆으로 걷는 듯한 카메라
  const pan = (0.5 - st.p) * 50;
  let x = W / 2 - (total * scale) / 2 + pan;
  const cy = H * 0.44;
  const darkWall = isDark(look.wall);
  sizes.forEach((z, j) => {
    const img = imgs[j];
    const w = z.w * scale;
    const h = z.h * scale;
    const cx = x + w / 2;
    x += w + gap * scale;
    if (!img) return;
    const at = st.reveal ? -0.4 + j * 0.1 : st.tin * 0.3 + j * 0.3;
    const e = easeOutCubic((st.u - at) / 1);
    if (e <= 0) return;
    const y = cy + (1 - e) * 36;
    ctx.save();
    ctx.globalAlpha *= e;
    // 조명
    ctx.globalCompositeOperation = 'screen';
    const spot = ctx.createRadialGradient(cx, y - h * 0.62, 10, cx, y - h * 0.1, h * 0.95);
    spot.addColorStop(0, 'rgba(255,246,228,0.32)');
    spot.addColorStop(1, 'rgba(255,246,228,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(cx - h, y - h * 1.2, h * 2, h * 2.2);
    ctx.globalCompositeOperation = 'source-over';
    // 액자
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 30 * k;
    ctx.shadowOffsetY = 18 * k;
    ctx.fillStyle = look.frameWood;
    ctx.fillRect(cx - w / 2, y - h / 2, w, h);
    ctx.shadowColor = 'transparent';
    const b = border * scale;
    ctx.fillStyle = look.mat;
    ctx.fillRect(cx - w / 2 + b, y - h / 2 + b, w - b * 2, h - b * 2);
    const pw = z.pw * scale;
    const ph = z.ph * scale;
    drawCoverClipped(ctx, img, cx - pw / 2, y - ph / 2, pw, ph, 1.02 + st.p * 0.03, 0, -0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - pw / 2, y - ph / 2, pw, ph);
    // 작품 라벨: 번호와 (넣었다면) 사진 문구를 작품 제목처럼. 밝은 벽은 흰 카드, 어두운 벽은 벽에 바로 글자
    const le = easeOutCubic((st.u - at - 0.5) / 0.8);
    if (le > 0) {
      ctx.globalAlpha *= le;
      const title = captionOf(env, seg.photoIds[j]);
      const no = `No. ${String(seg.index + 1).padStart(2, '0')}${n > 1 ? `-${j + 1}` : ''}`;
      ctx.font = fontSpec(theme.fonts.latin, 24, 500, true);
      const noW = ctx.measureText(no).width;
      // 사진 문구는 TV 화면에서도 읽히도록 충분히 크게 (옆 액자 라벨과 겹치지 않는 폭 안에서)
      const maxW = Math.min(600, Math.max(300, w + 60)) - 40;
      const fit = title ? fitLine(ctx, title, maxW, (s) => fontSpec(theme.fonts.body, s, theme.fonts.nameWeight), 30, 0.7) : null;
      const lw = Math.max(190, noW + 40, (fit?.width ?? 0) + 40);
      const lh = fit ? 100 : 52;
      const lx = cx + w / 2 - lw * Math.min(1, scale + 0.2);
      const ly = y + h / 2 + 34;
      if (!darkWall) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 8 * k;
        ctx.fillRect(lx, ly, lw, lh);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = darkWall ? look.labelInk : '#1b1a18';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = fontSpec(theme.fonts.latin, 24, 500, true);
      ctx.fillText(no, lx + 20, ly + 27);
      if (fit) {
        ctx.font = fontSpec(theme.fonts.body, fit.size, theme.fonts.nameWeight);
        ctx.globalAlpha *= 0.86;
        ctx.fillText(fit.text, lx + 20, ly + 68);
      }
    }
    ctx.restore();
  });
}

// ───────────────────────── 아치 ─────────────────────────

function archPath(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number): void {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, top + h);
  ctx.lineTo(cx - r, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, top + h);
  ctx.closePath();
}

/** 줄기를 따라 잎이 돋아나는 식물 장식. progress 0~1 */
function sprig(ctx: CanvasRenderingContext2D, pts: [number, number][], progress: number, stem: string, leaf: string, side: 1 | -1): void {
  const n = pts.length;
  const upto = Math.max(1, Math.floor((n - 1) * progress));
  ctx.save();
  ctx.strokeStyle = stem;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= upto; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  for (let i = 2; i <= upto; i += 3) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (const s of [1, -1]) {
      const grow = clamp01((progress * (n - 1) - i) / 4);
      if (grow <= 0) continue;
      ctx.save();
      ctx.translate(x1, y1);
      ctx.rotate(ang + s * side * 0.9);
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(18 * grow, 0, 20 * grow, 8 * grow, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawArchScene(env: SceneEnv, seg: PhotoSegment, st: SceneTime, m: MotionSt): void {
  const { ctx, theme, k } = env;
  const look = theme.look;
  const id = seg.photoIds[0];
  drawBackdrop(env, id, m);
  const img = env.assets.image(id);
  if (!img) return;
  const aw = 600;
  const ah = 820;
  const cx = W / 2 + (seg.variant % 2 ? 1 : -1) * 20;
  const top = H / 2 - ah / 2 - 18;
  const e = st.reveal ? 1 : easeOutCubic((st.u - st.tin * 0.25) / 1.1);
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 40);
  const b = 16;
  ctx.shadowColor = 'rgba(40,40,30,0.3)';
  ctx.shadowBlur = 40 * k;
  ctx.shadowOffsetY = 16 * k;
  ctx.fillStyle = look.frame;
  archPath(ctx, cx, top - b, aw + b * 2, ah + b * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  archPath(ctx, cx, top, aw, ah);
  ctx.clip();
  drawCover(ctx, img, cx - aw / 2, top, aw, ah, m.s, m.ox * 0.5, m.oy * 0.5 - 0.1);
  ctx.restore();
  ctx.strokeStyle = look.paperAccent;
  ctx.globalAlpha *= 0.7;
  ctx.lineWidth = 2;
  archPath(ctx, cx, top - b - 14, aw + (b + 14) * 2, ah + (b + 14) * 2);
  ctx.stroke();
  ctx.restore();

  // 아치 양옆으로 자라는 줄기
  const g = easeOutCubic((st.u - (st.reveal ? 0 : st.tin * 0.3) - 0.3) / 1.8);
  if (g > 0) {
    const r = aw / 2 + b + 36;
    const arcCy = top + aw / 2;
    // 아치 옆면을 따라 올라가다 둥근 윗부분을 따라 휘어짐
    const pts = (side: 1 | -1): [number, number][] => {
      const out: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        if (u < 0.45) {
          out.push([cx + side * r, top + ah + 10 - (u / 0.45) * (ah + 10 - aw / 2)]);
        } else {
          const th = ((u - 0.45) / 0.55) * Math.PI * 0.4;
          out.push([cx + side * Math.cos(th) * r, arcCy - Math.sin(th) * r]);
        }
      }
      return out;
    };
    sprig(ctx, pts(1), g, look.paperAccent, look.tape ?? look.paperAccent, 1);
    sprig(ctx, pts(-1), g, look.paperAccent, look.tape ?? look.paperAccent, -1);
  }
  // 아치 아래에는 사용자가 넣은 문구만 (날짜를 자동으로 적지 않음)
  const cap = captionOf(env, id);
  const ce = easeOutCubic((st.u - 0.9) / 0.9);
  if (cap && ce > 0) {
    ctx.save();
    ctx.globalAlpha *= ce;
    ctx.fillStyle = backdropTextColor(env);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = fitLine(ctx, cap, 900, (s) => fontSpec(theme.fonts.hand, s), 58);
    ctx.fillText(fit.text, cx, top + ah + 62);
    ctx.restore();
  }
}
