// 테마 효과: 색보정, 비네팅, 떠다니는 효과(꽃잎·하트·나뭇잎·눈·컨페티)와 보케·별빛, 필름 그레인·깜빡임·빛번짐.
// 모든 효과는 시각 t만으로 결정되므로 미리보기와 내보내기 결과가 같다.

import { DESIGN_H as H, DESIGN_W as W, createCanvas, get2d } from './design';
import { hash01, mulberry32 } from './random';
import type { ParticleKind, Theme } from './themes';

const TAU = Math.PI * 2;

function makeNoiseTile(size: number, seed: number): HTMLCanvasElement {
  const c = createCanvas(size, size);
  const g = get2d(c, false);
  const img = g.createImageData(size, size);
  const rnd = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rnd() + rnd() - 1) * 120;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function sprite(size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = createCanvas(size, size);
  const g = get2d(c, false);
  paint(g, size);
  return c;
}

function makePetal(edge: string, center: string): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const r = s * 0.42;
    g.translate(s / 2, s / 2);
    g.beginPath();
    g.moveTo(0, r);
    g.bezierCurveTo(r * 1.05, r * 0.35, r * 0.78, -r * 0.95, r * 0.14, -r * 0.84);
    g.lineTo(0, -r * 0.6); // 벚꽃잎 끝의 오목한 홈
    g.lineTo(-r * 0.14, -r * 0.84);
    g.bezierCurveTo(-r * 0.78, -r * 0.95, -r * 1.05, r * 0.35, 0, r);
    g.closePath();
    const grad = g.createRadialGradient(0, r * 0.7, 1, 0, 0, r * 1.25);
    grad.addColorStop(0, center);
    grad.addColorStop(1, edge);
    g.fillStyle = grad;
    g.fill();
  });
}

function makeLeaf(color: string): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const r = s * 0.44;
    g.translate(s / 2, s / 2);
    g.rotate(0.5);
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.78, -r * 0.2, 0, r);
    g.quadraticCurveTo(-r * 0.78, -r * 0.2, 0, -r);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 0.35;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -r * 0.85);
    g.lineTo(0, r * 0.95);
    g.stroke();
  });
}

function makeHeartSprite(color: string): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const h = s / 2;
    const k = s * 0.4;
    g.beginPath();
    g.moveTo(h, h + k * 0.9);
    g.bezierCurveTo(h - k * 1.35, h + k * 0.05, h - k * 0.75, h - k * 1.1, h, h - k * 0.38);
    g.bezierCurveTo(h + k * 0.75, h - k * 1.1, h + k * 1.35, h + k * 0.05, h, h + k * 0.9);
    g.closePath();
    const grad = g.createRadialGradient(h - k * 0.3, h - k * 0.35, 1, h, h, k * 1.3);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill();
  });
}

function makeSnow(): HTMLCanvasElement {
  return sprite(48, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

function makeConfetti(color: string, round: boolean): HTMLCanvasElement {
  return sprite(40, (g, s) => {
    g.fillStyle = color;
    if (round) {
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.3, 0, TAU);
      g.fill();
    } else {
      g.fillRect(s * 0.18, s * 0.34, s * 0.64, s * 0.32);
    }
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(s * 0.18, s * 0.34, s * 0.64, s * 0.08);
  });
}

function makeBokeh(rgb: string): HTMLCanvasElement {
  return sprite(128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${rgb},0.85)`);
    grad.addColorStop(0.62, `rgba(${rgb},0.55)`);
    grad.addColorStop(0.86, `rgba(${rgb},0.7)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

/** 반짝이는 별빛 (가운데 빛 + 네 갈래 광선) */
function makeSparkle(): HTMLCanvasElement {
  return sprite(96, (g, s) => {
    const h = s / 2;
    const glow = g.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.18, 'rgba(255,240,246,0.75)');
    glow.addColorStop(0.5, 'rgba(255,215,228,0.15)');
    glow.addColorStop(1, 'rgba(255,215,228,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    for (const [w, hh] of [
      [2.2, h * 0.95],
      [h * 0.95, 2.2],
    ]) {
      const grad = g.createRadialGradient(h, h, 0, h, h, Math.max(w, hh));
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(h, h, w, hh, 0, 0, TAU);
      g.fill();
    }
  });
}

const DEFAULT_COLORS: Record<Exclude<ParticleKind, 'none'>, string[]> = {
  petals: ['#ffbfd0', '#ffadc2', '#ffd4df'],
  hearts: ['#ff8fab', '#ffb3c6', '#ff6f91'],
  leaves: ['#7fa35a', '#9dbb6e', '#5f8a45', '#b7cc86'],
  snow: ['#ffffff'],
  confetti: ['#ff3d8b', '#e8ff3a', '#3ee8ff', '#ffffff', '#ff9a3c'],
};

/** 떠다니는 방식 (1920×1080 기준 px, 초) */
interface FieldSpec {
  size: [number, number];
  /** 초당 떨어지는 거리 (음수면 위로 떠오름) */
  fall: [number, number];
  sway: number;
  spin: number;
  flip: number;
  alpha: [number, number];
}
const FIELD: Record<Exclude<ParticleKind, 'none'>, FieldSpec> = {
  petals: { size: [20, 48], fall: [55, 125], sway: 55, spin: 1.5, flip: 1.6, alpha: [0.62, 0.95] },
  leaves: { size: [26, 52], fall: [45, 95], sway: 80, spin: 1.1, flip: 1.2, alpha: [0.7, 0.95] },
  hearts: { size: [18, 46], fall: [-70, -35], sway: 40, spin: 0.25, flip: 0, alpha: [0.45, 0.85] },
  snow: { size: [5, 20], fall: [28, 70], sway: 30, spin: 0, flip: 0, alpha: [0.5, 0.95] },
  confetti: { size: [16, 30], fall: [80, 150], sway: 35, spin: 3.2, flip: 3.5, alpha: [0.85, 1] },
};

export class Effects {
  private grain: CanvasPattern[] = [];
  private sprites = new Map<string, HTMLCanvasElement[]>();
  private bokeh: HTMLCanvasElement | null = null;
  private bokehColor = '';
  private sparkle: HTMLCanvasElement | null = null;
  private glowCanvas: HTMLCanvasElement | null = null;
  private glowCtx: CanvasRenderingContext2D | null = null;
  private glowFilter = false;
  private vignetteGrad: CanvasGradient | null = null;
  private vignetteAmount = -1;

  constructor(private ctx: CanvasRenderingContext2D) {}

  /** 따뜻한 색감, 색 입히기, 채도 낮추기 */
  colorGrade(theme: Theme): void {
    const { ctx } = this;
    const e = theme.effects;
    if (e.warm <= 0 && !e.tint && e.desaturate <= 0) return;
    ctx.save();
    if (e.desaturate > 0) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = e.desaturate;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, W, H);
    }
    if (e.warm > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = e.warm;
      ctx.fillStyle = '#ff9a4a';
      ctx.fillRect(0, 0, W, H);
    }
    if (e.tint) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.tint;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  vignette(theme: Theme): void {
    const amount = theme.effects.vignette;
    if (amount <= 0) return;
    const { ctx } = this;
    if (!this.vignetteGrad || this.vignetteAmount !== amount) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, Math.hypot(W / 2, H / 2) * 1.02);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, `rgba(0,0,0,${(amount * 0.35).toFixed(3)})`);
      g.addColorStop(1, `rgba(0,0,0,${amount.toFixed(3)})`);
      this.vignetteGrad = g;
      this.vignetteAmount = amount;
    }
    ctx.save();
    ctx.fillStyle = this.vignetteGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 떠다니는 효과·보케(빛망울)·별빛 */
  particles(theme: Theme, t: number): void {
    const e = theme.effects;
    if (e.bokeh > 0) this.drawBokeh(e.bokeh, e.bokehColor, t);
    if (e.sparkles > 0) this.drawSparkles(e.sparkles, t);
    if (e.particle !== 'none' && e.particles > 0) this.drawField(e.particle, e.particleColors, e.particles, t);
  }

  private spritesFor(kind: Exclude<ParticleKind, 'none'>, colors: string[] | null): HTMLCanvasElement[] {
    const list = colors && colors.length > 0 ? colors : DEFAULT_COLORS[kind];
    const key = `${kind}|${list.join(',')}`;
    let s = this.sprites.get(key);
    if (!s) {
      switch (kind) {
        case 'petals':
          s = list.map((c, i) => makePetal(c, i % 2 ? '#fff6f8' : '#ffffff'));
          break;
        case 'leaves':
          s = list.map((c) => makeLeaf(c));
          break;
        case 'hearts':
          s = list.map((c) => makeHeartSprite(c));
          break;
        case 'snow':
          s = [makeSnow()];
          break;
        case 'confetti':
          s = list.flatMap((c, i) => [makeConfetti(c, false), ...(i % 2 ? [makeConfetti(c, true)] : [])]);
          break;
      }
      this.sprites.set(key, s);
    }
    return s;
  }

  private drawSprite(img: HTMLCanvasElement, x: number, y: number, size: number, rot: number, flip: number): void {
    const { ctx } = this;
    const sx = (flip < 0 ? -1 : 1) * Math.max(0.22, Math.abs(flip));
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sx, 1);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.scale(1 / sx, 1);
    ctx.rotate(-rot);
    ctx.translate(-x, -y);
  }

  private drawField(kind: Exclude<ParticleKind, 'none'>, colors: string[] | null, count: number, t: number): void {
    const { ctx } = this;
    const sprites = this.spritesFor(kind, colors);
    const f = FIELD[kind];
    ctx.save();
    for (let i = 0; i < count; i++) {
      const r = (k: number) => hash01(i * 17 + k);
      const size = f.size[0] + r(1) * (f.size[1] - f.size[0]);
      // 큰 것(가까운 것)이 더 빨리 움직여 깊이감
      const depth = (size - f.size[0]) / (f.size[1] - f.size[0] || 1);
      const fall = f.fall[0] + (f.fall[1] - f.fall[0]) * (0.35 * r(2) + 0.65 * depth);
      const spanY = H + 160;
      let y = (r(3) * spanY + t * Math.abs(fall)) % spanY;
      y = fall >= 0 ? y - 80 : H + 80 - y;
      const spanX = W + 200;
      const sway = Math.sin(t * (0.5 + r(6) * 0.7) + r(7) * TAU) * f.sway * (0.45 + r(6) * 0.55);
      const x = ((r(5) * spanX + t * (10 + r(4) * 20)) % spanX) - 100 + sway;
      const rot = r(8) * TAU + t * (r(9) - 0.5) * f.spin;
      const flip = f.flip > 0 ? Math.cos(t * (0.9 + r(4) * f.flip) + r(2) * TAU) : 1;
      let a = f.alpha[0] + r(10) * (f.alpha[1] - f.alpha[0]);
      // 떠오르는 하트는 위로 갈수록 사라짐
      if (fall < 0) a *= Math.min(1, Math.max(0, y / (H * 0.55)));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      this.drawSprite(sprites[i % sprites.length], x, y, size, rot, flip);
    }
    ctx.restore();
  }

  /** 전환용: 스타일의 효과가 한꺼번에 화면을 가로질러 흩날림. p = 전환 진행도(0~1) */
  petalBurst(p: number, dir: 1 | -1, seed: number, theme: Theme): void {
    if (p <= 0 || p >= 1) return;
    const kind = theme.effects.particle;
    if (kind === 'none') return;
    const { ctx } = this;
    const sprites = this.spritesFor(kind, theme.effects.particleColors);
    const env = Math.sin(Math.PI * p);
    const small = kind === 'snow' ? 0.6 : 1;
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const r = (k: number) => hash01(seed * 131 + i * 23 + k);
      const size = (26 + r(1) * 40) * small;
      const speed = 0.75 + r(2) * 0.6;
      const travel = (p * speed + r(3) * 0.35) * (W + 900);
      const x0 = -450 + travel - r(4) * 300;
      const x = dir === 1 ? x0 : W - x0;
      const y = r(5) * (H + 200) - 100 + Math.sin(p * 6 + r(6) * TAU) * 60 + (p - 0.5) * 220 * (r(7) - 0.3);
      if (x < -120 || x > W + 120) continue;
      ctx.globalAlpha = env * (0.65 + r(8) * 0.35);
      this.drawSprite(sprites[i % sprites.length], x, y, size, r(9) * TAU + p * 6 * (r(10) - 0.5), Math.cos(p * 9 + r(11) * TAU));
    }
    ctx.restore();
  }

  private drawSparkles(count: number, t: number): void {
    const { ctx } = this;
    if (!this.sparkle) this.sparkle = makeSparkle();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
      const r = (k: number) => hash01(i * 53 + 5000 + k);
      const tw = Math.sin(t * (1.1 + r(1) * 1.8) + r(2) * TAU);
      const a = Math.pow(Math.max(0, tw), 6) * (0.55 + r(3) * 0.45);
      if (a < 0.02) continue;
      const size = 26 + r(4) * 46;
      const x = r(5) * W + Math.sin(t * 0.07 + i) * 20;
      const y = r(6) * H * 0.95 + Math.cos(t * 0.05 + i) * 14;
      ctx.globalAlpha = a;
      ctx.drawImage(this.sparkle, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  /** 뽀샤시한 빛 번짐: 현재 화면을 작게 흐려서 밝게 겹침 */
  glow(theme: Theme): void {
    const amount = theme.effects.glow;
    if (amount <= 0) return;
    const { ctx } = this;
    const src = ctx.canvas;
    if (!this.glowCanvas) {
      this.glowCanvas = createCanvas(Math.max(2, Math.round(src.width / 4)), Math.max(2, Math.round(src.height / 4)));
      this.glowCtx = get2d(this.glowCanvas);
      this.glowFilter = typeof (this.glowCtx as { filter?: unknown }).filter === 'string';
    }
    const g = this.glowCtx!;
    const gc = this.glowCanvas;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.glowFilter) g.filter = 'blur(5px)';
    g.drawImage(src, 0, 0, gc.width, gc.height);
    g.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = amount;
    ctx.drawImage(gc, 0, 0, W, H);
    ctx.restore();
  }

  private drawBokeh(count: number, rgb: string, t: number): void {
    const { ctx } = this;
    if (!this.bokeh || this.bokehColor !== rgb) {
      this.bokeh = makeBokeh(rgb);
      this.bokehColor = rgb;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
      const r = (k: number) => hash01(i * 31 + 1000 + k);
      const radius = 28 + r(1) * 72;
      const speed = 7 + r(2) * 14;
      const spanY = H + radius * 2 + 40;
      const y = H + radius + 20 - ((r(3) * spanY + t * speed) % spanY);
      const x = r(4) * W + Math.sin(t * 0.18 * (1 + r(5)) + r(6) * TAU) * 45;
      const alpha = (0.07 + r(5) * 0.12) * (0.6 + 0.4 * Math.sin(t * (0.45 + r(6)) + r(1) * TAU));
      if (alpha <= 0.003) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.bokeh, x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  /** 그레인 무늬 (전환·오버레이에서도 사용) */
  noisePattern(i = 0): CanvasPattern | null {
    if (this.grain.length === 0) {
      for (let j = 0; j < 4; j++) {
        const p = this.ctx.createPattern(makeNoiseTile(256, 101 + j), 'repeat');
        if (p) this.grain.push(p);
      }
    }
    return this.grain.length ? this.grain[i % this.grain.length] : null;
  }

  /** 필름 그레인 (초당 24번 바뀜) */
  filmGrain(theme: Theme, t: number): void {
    const amount = theme.effects.grain;
    if (amount <= 0) return;
    const { ctx } = this;
    const f = Math.floor(t * 24);
    const pattern = this.noisePattern(f);
    if (!pattern) return;
    const ox = Math.floor(hash01(f * 2 + 1) * 256);
    const oy = Math.floor(hash01(f * 2 + 2) * 256);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(1, amount * 2.2);
    ctx.fillStyle = pattern;
    ctx.translate(-ox, -oy);
    ctx.fillRect(ox, oy, W, H);
    ctx.restore();
  }

  /** 필름 특유의 밝기 흔들림과 가장자리 빛번짐 */
  filmFlicker(theme: Theme, t: number): void {
    if (!theme.effects.flicker) return;
    const { ctx } = this;
    const f = Math.floor(t * 24);
    const n = (hash01(f + 7777) - 0.5) * 0.045 + Math.sin(t * 1.7) * 0.012;
    ctx.save();
    if (n > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,244,225,${n.toFixed(4)})`;
    } else {
      ctx.fillStyle = `rgba(20,10,0,${(-n).toFixed(4)})`;
    }
    ctx.fillRect(0, 0, W, H);

    const leak = 0.2 * Math.pow(Math.max(0, Math.sin(t * 0.17 + 0.8)), 3);
    if (leak > 0.004) {
      const cx = W * (0.92 + 0.06 * Math.sin(t * 0.11));
      const cy = H * (0.18 + 0.2 * Math.sin(t * 0.07 + 2));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
      g.addColorStop(0, 'rgba(255,160,80,1)');
      g.addColorStop(0.5, 'rgba(255,120,50,0.45)');
      g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = leak;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
