// 테마 효과: 색보정(따뜻하게·색 입히기·채도·대비·페이드), 비네팅, 떠다니는 효과 15종과 보케·별빛,
// 필름 그레인·깜빡임·빛 새어 듦·빛번짐. 모든 효과는 시각 t만으로 결정되므로 미리보기와 내보내기 결과가 같다.

import { DESIGN_H as H, DESIGN_W as W, createCanvas, get2d } from './design';
import { hash01, mulberry32 } from './random';
import type { ParticleKind, Theme } from './themes';

const TAU = Math.PI * 2;
type Kind = Exclude<ParticleKind, 'none'>;

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

/** 둥근 장미 꽃잎: 가장자리가 짙고 가운데가 밝음 */
function makeRosePetal(color: string): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const r = s * 0.42;
    g.translate(s / 2, s / 2);
    g.beginPath();
    g.moveTo(0, r * 0.95);
    g.bezierCurveTo(r * 1.15, r * 0.55, r * 0.95, -r * 0.95, 0, -r * 0.82);
    g.bezierCurveTo(-r * 0.95, -r * 0.95, -r * 1.15, r * 0.55, 0, r * 0.95);
    g.closePath();
    const grad = g.createRadialGradient(-r * 0.15, -r * 0.2, 1, 0, 0, r * 1.15);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill();
    g.globalAlpha = 0.25;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-r * 0.5, -r * 0.55);
    g.quadraticCurveTo(0, -r * 0.7, r * 0.5, -r * 0.55);
    g.stroke();
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

/** 다섯 갈래 단풍잎 */
function makeMaple(color: string): HTMLCanvasElement {
  return sprite(72, (g, s) => {
    const R = s * 0.44;
    g.translate(s / 2, s / 2 - s * 0.04);
    g.beginPath();
    const n = 5;
    for (let i = 0; i <= n * 4; i++) {
      const a = -Math.PI / 2 + (i / (n * 4)) * TAU;
      const k = i % 4;
      // 잎 끝(0) · 톱니(2) · 오목한 곳(1,3)
      const r = k === 0 ? R : k === 2 ? R * 0.72 : R * 0.42;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * (a > 0 && a < Math.PI ? 0.82 : 1);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.globalAlpha = 0.35;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      g.beginPath();
      g.moveTo(0, R * 0.1);
      g.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = color;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, R * 0.2);
    g.lineTo(R * 0.12, R * 0.95);
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

/** 은은한 빛을 두른 다섯 꼭지 별 (밝은 화면에서도 보이도록 가장자리를 살짝 진하게) */
function makeStar(color: string): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const h = s / 2;
    const glow = g.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, 'rgba(255,248,220,0.6)');
    glow.addColorStop(0.5, 'rgba(255,230,160,0.14)');
    glow.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    g.translate(h, h);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 === 0 ? s * 0.3 : s * 0.13;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(170,110,20,0.55)';
    g.lineWidth = 2.2;
    g.stroke();
    const fill = g.createRadialGradient(-s * 0.05, -s * 0.06, 0, 0, 0, s * 0.3);
    fill.addColorStop(0, '#fffbe8');
    fill.addColorStop(0.5, color);
    fill.addColorStop(1, color);
    g.fillStyle = fill;
    g.fill();
  });
}

/** 반짝이는 가루: 가운데가 밝은 작은 마름모 (가장자리를 살짝 진하게) */
function makeGlitter(color: string): HTMLCanvasElement {
  return sprite(32, (g, s) => {
    const h = s / 2;
    const glow = g.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, 'rgba(255,255,255,0.7)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    g.beginPath();
    g.moveTo(h, 2);
    g.lineTo(h + s * 0.22, h);
    g.lineTo(h, s - 2);
    g.lineTo(h - s * 0.22, h);
    g.closePath();
    g.strokeStyle = 'rgba(150,100,20,0.5)';
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = color;
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(h, h, s * 0.08, 0, TAU);
    g.fill();
  });
}

/** 가장자리만 무지갯빛으로 반짝이는 비눗방울 (밝은 화면에서도 테두리가 보이게) */
function makeBubble(): HTMLCanvasElement {
  return sprite(96, (g, s) => {
    const h = s / 2;
    const r = s * 0.46;
    const rim = g.createRadialGradient(h, h, 0, h, h, r);
    rim.addColorStop(0, 'rgba(255,255,255,0.05)');
    rim.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    rim.addColorStop(0.86, 'rgba(170,215,255,0.62)');
    rim.addColorStop(0.95, 'rgba(255,190,235,0.7)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(h, h, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(90,130,180,0.4)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(h, h, r * 0.965, 0, TAU);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(h - r * 0.42, h - r * 0.45, r * 0.2, r * 0.1, -0.7, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.arc(h + r * 0.45, h + r * 0.4, r * 0.06, 0, TAU);
    g.fill();
  });
}

/** 날개 네 장의 나비 (가운데가 몸통) */
function makeButterfly(color: string): HTMLCanvasElement {
  return sprite(80, (g, s) => {
    const h = s / 2;
    g.translate(h, h);
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side, 1);
      const grad = g.createRadialGradient(s * 0.08, 0, 1, s * 0.2, -s * 0.1, s * 0.42);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, color);
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -s * 0.02);
      g.bezierCurveTo(s * 0.12, -s * 0.42, s * 0.48, -s * 0.4, s * 0.4, -s * 0.08);
      g.bezierCurveTo(s * 0.36, s * 0.02, s * 0.16, s * 0.04, 0, s * 0.02);
      g.fill();
      g.beginPath();
      g.moveTo(0, s * 0.03);
      g.bezierCurveTo(s * 0.2, s * 0.06, s * 0.34, s * 0.3, s * 0.18, s * 0.34);
      g.bezierCurveTo(s * 0.08, s * 0.36, s * 0.03, s * 0.2, 0, s * 0.08);
      g.fill();
      g.restore();
    }
    g.fillStyle = 'rgba(60,40,40,0.85)';
    g.beginPath();
    g.ellipse(0, s * 0.02, s * 0.025, s * 0.17, 0, 0, TAU);
    g.fill();
  });
}

/** 하얀 깃털 (밝은 하늘 위에서도 모양이 보이도록 한쪽에 옅은 그늘과 윤곽선) */
function makeFeather(): HTMLCanvasElement {
  return sprite(96, (g, s) => {
    g.translate(s / 2, s / 2);
    g.rotate(-0.6);
    const L = s * 0.46;
    const grad = g.createLinearGradient(0, -s * 0.18, 0, s * 0.16);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(0.55, 'rgba(246,244,241,0.95)');
    grad.addColorStop(1, 'rgba(206,200,195,0.92)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-L, 0);
    g.bezierCurveTo(-L * 0.4, -s * 0.2, L * 0.6, -s * 0.16, L, -s * 0.01);
    g.bezierCurveTo(L * 0.6, s * 0.12, -L * 0.4, s * 0.16, -L, 0);
    g.fill();
    g.strokeStyle = 'rgba(110,100,96,0.55)';
    g.lineWidth = 1.6;
    g.stroke();
    // 깃대
    g.strokeStyle = 'rgba(150,140,134,0.95)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(-L * 1.12, 0.6);
    g.lineTo(L, -0.5);
    g.stroke();
    // 깃가지
    g.strokeStyle = 'rgba(160,152,146,0.5)';
    g.lineWidth = 0.9;
    for (let i = -6; i <= 6; i++) {
      const x = (i / 7) * L * 0.8;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + s * 0.06, -s * 0.11);
      g.moveTo(x, 0);
      g.lineTo(x + s * 0.06, s * 0.1);
      g.stroke();
    }
  });
}

/** 줄 달린 풍선 */
function makeBalloon(color: string): HTMLCanvasElement {
  return sprite(96, (g, s) => {
    const cx = s / 2;
    const cy = s * 0.34;
    const rx = s * 0.22;
    const ry = s * 0.27;
    const grad = g.createRadialGradient(cx - rx * 0.4, cy - ry * 0.45, 1, cx, cy, ry * 1.2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(cx - s * 0.03, cy + ry + s * 0.025);
    g.lineTo(cx + s * 0.03, cy + ry + s * 0.025);
    g.lineTo(cx, cy + ry - s * 0.01);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx, cy + ry + s * 0.025);
    g.bezierCurveTo(cx + s * 0.06, cy + ry + s * 0.14, cx - s * 0.06, cy + ry + s * 0.24, cx + s * 0.02, s * 0.98);
    g.stroke();
  });
}

/** 'rgba(r,g,b,a)'·'#rrggbb' → [r,g,b] */
function rgbOf(color: string): [number, number, number] | null {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const hx = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hx) return null;
  const n = parseInt(hx[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const FIREFLY_DEFAULT = 'rgba(236,250,96,1)';

/** 반딧불: 가운데가 밝은 연두·노랑 빛 (밝은 화면에서도 색으로 보이게 가운데를 진하게). 다른 색이면 빛무리도 그 색으로 */
function makeFirefly(color: string): HTMLCanvasElement {
  const rgb = color === FIREFLY_DEFAULT ? null : rgbOf(color);
  const halo = rgb ? rgb.map((v) => Math.round(v * 0.88)).join(',') : '206,238,70';
  const outer = rgb ? rgb.join(',') : '210,240,110';
  return sprite(48, (g, s) => {
    const h = s / 2;
    const grad = g.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, 'rgba(255,255,225,1)');
    grad.addColorStop(0.14, color);
    grad.addColorStop(0.3, `rgba(${halo},0.55)`);
    grad.addColorStop(0.62, `rgba(${outer},0.14)`);
    grad.addColorStop(1, `rgba(${outer},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

/** 음표 (♪ 한 개 또는 ♫ 두 개). 밝은 화면에서도 보이도록 아래에 옅은 테두리를 먼저 그림 */
function makeNote(color: string, double: boolean): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const paint = (fill: string, extra: number) => {
      g.fillStyle = fill;
      g.strokeStyle = fill;
      g.lineWidth = s * 0.05 + extra;
      const head = (x: number, y: number) => {
        g.beginPath();
        g.ellipse(x, y, s * 0.1 + extra / 2, s * 0.075 + extra / 2, -0.4, 0, TAU);
        g.fill();
      };
      if (double) {
        head(s * 0.28, s * 0.74);
        head(s * 0.7, s * 0.66);
        g.beginPath();
        g.moveTo(s * 0.37, s * 0.72);
        g.lineTo(s * 0.37, s * 0.22);
        g.lineTo(s * 0.79, s * 0.14);
        g.lineTo(s * 0.79, s * 0.64);
        g.stroke();
        g.lineWidth = s * 0.08 + extra;
        g.beginPath();
        g.moveTo(s * 0.37, s * 0.25);
        g.lineTo(s * 0.79, s * 0.17);
        g.stroke();
      } else {
        head(s * 0.4, s * 0.72);
        g.beginPath();
        g.moveTo(s * 0.49, s * 0.7);
        g.lineTo(s * 0.49, s * 0.14);
        g.stroke();
        g.beginPath();
        g.moveTo(s * 0.49, s * 0.14);
        g.bezierCurveTo(s * 0.62, s * 0.24, s * 0.74, s * 0.3, s * 0.66, s * 0.48);
        g.stroke();
      }
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    paint('rgba(80,55,45,0.35)', 3);
    paint(color, 0);
  });
}

/**
 * 금박 조각: 구겨진 듯 모서리가 불규칙한 얇은 금속 조각.
 * 앞면은 사선으로 밝게 빛나고 뒷면은 어두워서, 돌며 떨어질 때 번쩍이며 반짝임
 */
function makeGoldLeaf(color: string, seed: number, back: boolean): HTMLCanvasElement {
  return sprite(64, (g, s) => {
    const c = s / 2;
    const n = 7;
    const flake = new Path2D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (hash01(seed * 31 + i) - 0.5) * 0.6;
      const r = s * (0.24 + 0.2 * hash01(seed * 17 + i * 3));
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r * 0.82;
      if (i === 0) flake.moveTo(x, y);
      else flake.lineTo(x, y);
    }
    flake.closePath();
    g.fillStyle = color;
    g.fill(flake);
    g.save();
    g.clip(flake);
    const sheen = g.createLinearGradient(0, s * 0.12, s, s * 0.88);
    if (back) {
      sheen.addColorStop(0, 'rgba(110,70,0,0.26)');
      sheen.addColorStop(1, 'rgba(70,40,0,0.14)');
    } else {
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.42, 'rgba(255,250,222,0.9)');
      sheen.addColorStop(0.56, 'rgba(255,255,255,0.12)');
      sheen.addColorStop(1, 'rgba(120,70,0,0.28)');
    }
    g.fillStyle = sheen;
    g.fillRect(0, 0, s, s);
    // 구겨진 주름
    g.strokeStyle = back ? 'rgba(96,60,4,0.32)' : 'rgba(140,92,16,0.4)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(c + (hash01(seed * 7 + i * 5) - 0.5) * s * 0.5, c + (hash01(seed * 7 + i * 5 + 1) - 0.5) * s * 0.5);
      g.lineTo(c + (hash01(seed * 7 + i * 5 + 2) - 0.5) * s * 0.6, c + (hash01(seed * 7 + i * 5 + 3) - 0.5) * s * 0.6);
      g.stroke();
    }
    g.restore();
    // 어두운 테두리 (밝은 화면에서도 조각 모양이 보이게)
    g.strokeStyle = back ? 'rgba(104,66,6,0.5)' : 'rgba(118,76,8,0.55)';
    g.lineWidth = 1.4;
    g.stroke(flake);
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

const DEFAULT_COLORS: Record<Kind, string[]> = {
  petals: ['#ffbfd0', '#ffadc2', '#ffd4df'],
  roses: ['#d8324f', '#e8546e', '#b81f3c', '#f07a8e'],
  hearts: ['#ff8fab', '#ffb3c6', '#ff6f91'],
  leaves: ['#7fa35a', '#9dbb6e', '#5f8a45', '#b7cc86'],
  maple: ['#d9412b', '#e8702e', '#f2a93b', '#c2302a'],
  snow: ['#ffffff'],
  confetti: ['#ff3d8b', '#e8ff3a', '#3ee8ff', '#ffffff', '#ff9a3c'],
  stars: ['#ffd65a', '#ffe38a', '#f7c33c'],
  glitter: ['#f5c542', '#ffd66e', '#e8b12e', '#fff1c1'],
  goldleaf: ['#e2b84f', '#f0cd6a', '#cf9f3c', '#f6dc8c'],
  bubbles: ['#ffffff'],
  butterflies: ['#ff9fc4', '#8fc9ff', '#ffe27a', '#c9b0ff'],
  feathers: ['#ffffff'],
  balloons: ['#ff9fbd', '#9fd8ff', '#ffe08a', '#c5b3ff', '#a8f0d0'],
  fireflies: ['rgba(236,250,96,1)'],
  notes: ['#ffffff', '#fff1d6'],
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
  /** 반짝임 빠르기 (투명도가 오르내림) */
  twinkle?: number;
  /** 떨어지지 않고 제자리 근처를 떠돎 (반딧불·나비) */
  wander?: number;
  /** 밝게 겹침 (빛나는 효과) */
  screen?: boolean;
  /** 기울기만 살짝 (풍선·음표·비눗방울) */
  upright?: boolean;
  /** 날갯짓 빠르기 */
  flutter?: number;
}
const FIELD: Record<Kind, FieldSpec> = {
  petals: { size: [20, 48], fall: [55, 125], sway: 55, spin: 1.5, flip: 1.6, alpha: [0.62, 0.95] },
  roses: { size: [22, 50], fall: [50, 110], sway: 55, spin: 1.4, flip: 1.5, alpha: [0.72, 0.96] },
  leaves: { size: [26, 52], fall: [45, 95], sway: 80, spin: 1.1, flip: 1.2, alpha: [0.7, 0.95] },
  maple: { size: [30, 58], fall: [45, 100], sway: 85, spin: 1.5, flip: 1.2, alpha: [0.78, 0.97] },
  hearts: { size: [18, 46], fall: [-70, -35], sway: 40, spin: 0.25, flip: 0, alpha: [0.45, 0.85] },
  snow: { size: [5, 20], fall: [28, 70], sway: 30, spin: 0, flip: 0, alpha: [0.5, 0.95] },
  confetti: { size: [16, 30], fall: [80, 150], sway: 35, spin: 3.2, flip: 3.5, alpha: [0.85, 1] },
  stars: { size: [18, 42], fall: [16, 42], sway: 22, spin: 0.3, flip: 0, alpha: [0.7, 1], twinkle: 2.2 },
  glitter: { size: [9, 22], fall: [22, 55], sway: 26, spin: 0.8, flip: 0, alpha: [0.65, 1], twinkle: 4 },
  // 금박은 뒤집히며 떨어져 앞면(밝게)과 뒷면(어둡게)이 번갈아 보임
  goldleaf: { size: [20, 44], fall: [26, 62], sway: 70, spin: 1.3, flip: 2.4, alpha: [0.86, 1] },
  bubbles: { size: [30, 88], fall: [-58, -26], sway: 42, spin: 0, flip: 0, alpha: [0.7, 0.95], upright: true },
  butterflies: { size: [52, 88], fall: [0, 0], sway: 0, spin: 0, flip: 0, alpha: [0.9, 1], wander: 230, flutter: 9, upright: true },
  // 깃털은 뒤집히며 얇은 선처럼 보이지 않도록 돌기만 함
  feathers: { size: [58, 100], fall: [22, 48], sway: 110, spin: 0.9, flip: 0, alpha: [0.85, 0.98] },
  balloons: { size: [80, 132], fall: [-55, -30], sway: 22, spin: 0, flip: 0, alpha: [0.9, 1], upright: true },
  // 밝은 장면에서도 보이도록 보통 합성 (빛 자체가 밝은 연두·노랑이라 어두운 장면에서는 빛나 보임)
  fireflies: { size: [24, 46], fall: [0, 0], sway: 0, spin: 0, flip: 0, alpha: [0.55, 1], twinkle: 1.6, wander: 150 },
  notes: { size: [32, 56], fall: [-46, -22], sway: 36, spin: 0, flip: 0, alpha: [0.75, 0.97], upright: true },
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

  /** 대비, 채도, 따뜻한 색감, 색조·색 입히기, 밝은 곳/어두운 곳 색 나누기, 빈티지 페이드 */
  colorGrade(theme: Theme): void {
    const { ctx } = this;
    const e = theme.effects;
    const hue = e.hue && e.hueAmount > 0;
    if (e.warm <= 0 && !e.tint && !hue && !e.highlights && !e.shadows && e.desaturate <= 0 && e.fade <= 0 && e.vivid <= 0 && e.contrast <= 0) return;
    ctx.save();
    if (e.contrast > 0) {
      // 화면을 자기 자신과 soft-light로 겹치면 어두운 곳은 더 어둡게, 밝은 곳은 더 밝게
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = Math.min(1, e.contrast);
      ctx.drawImage(ctx.canvas, 0, 0, W, H);
    }
    if (e.desaturate > 0) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(1, e.desaturate);
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, W, H);
    }
    if (e.vivid > 0) {
      // 채도가 가장 높은 색과 saturation으로 섞어 색을 또렷하게 (회색은 그대로)
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = Math.min(0.6, e.vivid);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
    }
    if (e.warm > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = e.warm;
      ctx.fillStyle = '#ff9a4a';
      ctx.fillRect(0, 0, W, H);
    }
    if (hue) {
      // 밝기는 그대로, 색만 그 색 쪽으로 (노을처럼 원래 색이 강해도 필터 이름대로 보임)
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = Math.min(1, e.hueAmount);
      ctx.fillStyle = e.hue!;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.tint) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.tint;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.highlights) {
      // 곱하기: 밝은 곳일수록 이 색을 띰
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.highlights;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.shadows) {
      // 스크린: 어두운 곳일수록 이 색으로 살짝 들뜸
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.shadows;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.fade > 0) {
      // 어두운 곳만 살짝 들어 올려 물 빠진 필름처럼
      const v = Math.round(Math.min(0.35, e.fade) * 255);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${v},${Math.round(v * 0.97)},${Math.round(v * 0.93)})`;
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

  private spritesFor(kind: Kind, colors: string[] | null): HTMLCanvasElement[] {
    const list = colors && colors.length > 0 ? colors : DEFAULT_COLORS[kind];
    const key = `${kind}|${list.join(',')}`;
    const hit = this.sprites.get(key);
    if (hit) return hit;
    let s: HTMLCanvasElement[];
    switch (kind) {
      case 'petals':
        s = list.map((c, i) => makePetal(c, i % 2 ? '#fff6f8' : '#ffffff'));
        break;
      case 'roses':
        s = list.map((c) => makeRosePetal(c));
        break;
      case 'leaves':
        s = list.map((c) => makeLeaf(c));
        break;
      case 'maple':
        s = list.map((c) => makeMaple(c));
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
      case 'stars':
        s = list.map((c) => makeStar(c));
        break;
      case 'glitter':
        s = list.map((c) => makeGlitter(c));
        break;
      case 'goldleaf':
        // [앞면, 뒷면] 짝으로 (drawField가 뒤집힌 정도에 따라 고름)
        s = list.flatMap((c, i) => [makeGoldLeaf(c, i + 1, false), makeGoldLeaf(c, i + 1, true)]);
        break;
      case 'bubbles':
        s = [makeBubble()];
        break;
      case 'butterflies':
        s = list.map((c) => makeButterfly(c));
        break;
      case 'feathers':
        s = [makeFeather()];
        break;
      case 'balloons':
        s = list.map((c) => makeBalloon(c));
        break;
      case 'fireflies':
        s = list.map((c) => makeFirefly(c));
        break;
      case 'notes':
        s = list.flatMap((c) => [makeNote(c, false), makeNote(c, true)]);
        break;
    }
    this.sprites.set(key, s);
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

  private drawField(kind: Kind, colors: string[] | null, count: number, t: number): void {
    const { ctx } = this;
    const sprites = this.spritesFor(kind, colors);
    const f = FIELD[kind];
    ctx.save();
    if (f.screen) ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
      const r = (k: number) => hash01(i * 17 + k);
      const size = f.size[0] + r(1) * (f.size[1] - f.size[0]);
      // 큰 것(가까운 것)이 더 빨리 움직여 깊이감
      const depth = (size - f.size[0]) / (f.size[1] - f.size[0] || 1);
      let x: number;
      let y: number;
      let fall = 0;
      if (f.wander) {
        // 제자리 근처를 천천히 맴돔 (두 가지 흔들림을 겹쳐 불규칙하게)
        const A = f.wander * (0.6 + 0.4 * r(6));
        x = r(5) * W + Math.sin(t * (0.1 + r(7) * 0.16) + r(8) * TAU) * A + Math.sin(t * (0.37 + r(9) * 0.3) + r(2) * TAU) * A * 0.25;
        y = r(3) * H + Math.cos(t * (0.09 + r(4) * 0.14) + r(10) * TAU) * A * 0.55 + Math.sin(t * (0.31 + r(11) * 0.2)) * A * 0.18;
      } else {
        fall = f.fall[0] + (f.fall[1] - f.fall[0]) * (0.35 * r(2) + 0.65 * depth);
        const spanY = H + 160;
        y = (r(3) * spanY + t * Math.abs(fall)) % spanY;
        y = fall >= 0 ? y - 80 : H + 80 - y;
        const spanX = W + 200;
        const sway = Math.sin(t * (0.5 + r(6) * 0.7) + r(7) * TAU) * f.sway * (0.45 + r(6) * 0.55);
        x = ((r(5) * spanX + t * (10 + r(4) * 20)) % spanX) - 100 + sway;
      }
      const rot = f.upright ? Math.sin(t * (0.6 + r(9) * 0.5) + r(8) * TAU) * 0.16 : r(8) * TAU + t * (r(9) - 0.5) * f.spin;
      let flip = 1;
      if (f.flutter) flip = Math.cos(t * f.flutter * (0.8 + 0.4 * r(4)) + r(2) * TAU);
      else if (f.flip > 0) flip = Math.cos(t * (0.9 + r(4) * f.flip) + r(2) * TAU);
      let a = f.alpha[0] + r(10) * (f.alpha[1] - f.alpha[0]);
      if (f.twinkle) a *= 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * f.twinkle * (0.7 + 0.6 * r(11)) + r(12) * TAU));
      // 떠오르는 것은 위로 갈수록 사라짐 (풍선은 끝까지)
      if (fall < 0 && kind !== 'balloons') a *= Math.min(1, Math.max(0, y / (H * 0.55)));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      // 금박: 뒤집힌 쪽이면 어두운 뒷면 (돌며 번쩍이는 느낌)
      const img = kind === 'goldleaf' ? sprites[(i % (sprites.length >> 1)) * 2 + (flip < 0 ? 1 : 0)] : sprites[i % sprites.length];
      this.drawSprite(img, x, y, size, rot, flip);
    }
    ctx.restore();
  }

  /** 전환용: 스타일의 효과가 한꺼번에 화면을 가로질러 흩날림 (효과가 없는 스타일이면 꽃잎). p = 전환 진행도(0~1) */
  petalBurst(p: number, dir: 1 | -1, seed: number, theme: Theme): void {
    if (p <= 0 || p >= 1) return;
    const own = theme.effects.particle;
    const kind: Kind = own === 'none' ? 'petals' : own;
    const { ctx } = this;
    const sprites = this.spritesFor(kind, own === 'none' ? null : theme.effects.particleColors);
    const env = Math.sin(Math.PI * p);
    const f = FIELD[kind];
    const small = kind === 'snow' || kind === 'glitter' || kind === 'fireflies' ? 0.6 : kind === 'balloons' ? 1.4 : 1;
    ctx.save();
    if (f.screen) ctx.globalCompositeOperation = 'screen';
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
      const rot = f.upright ? Math.sin(p * 5 + r(9) * TAU) * 0.2 : r(9) * TAU + p * 6 * (r(10) - 0.5);
      const flip = f.flutter ? Math.cos(p * 40 + r(11) * TAU) : Math.cos(p * 9 + r(11) * TAU);
      this.drawSprite(sprites[i % sprites.length], x, y, size, rot, f.upright && !f.flutter ? 1 : flip);
    }
    ctx.restore();
  }

  /** 전환용: 반짝이가 화면 곳곳에서 차례로 반짝임. p = 전환 진행도(0~1) */
  sparkleBurst(p: number, seed: number, rgb: string): void {
    if (p <= 0 || p >= 1) return;
    const { ctx } = this;
    if (!this.sparkle) this.sparkle = makeSparkle();
    const env = Math.sin(Math.PI * p);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(${rgb},${(0.16 * env).toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) {
      const r = (k: number) => hash01(seed * 211 + i * 29 + k);
      const at = r(1) * 0.62;
      const life = 0.22 + r(2) * 0.22;
      const q = (p - at) / life;
      if (q <= 0 || q >= 1) continue;
      const size = 50 + r(3) * 150;
      const x = r(4) * W;
      const y = r(5) * H + (q - 0.5) * 50;
      ctx.globalAlpha = Math.sin(Math.PI * q) * (0.6 + 0.4 * r(6));
      ctx.drawImage(this.sparkle, x - size / 2, y - size / 2, size, size);
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

  /** 필름 특유의 밝기 흔들림 */
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
    ctx.restore();
  }

  /** 가장자리로 따뜻한 빛이 천천히 새어 들었다 사라짐 */
  lightLeak(theme: Theme, t: number): void {
    const amount = theme.effects.leak;
    if (amount <= 0) return;
    const leak = 0.2 * amount * Math.pow(Math.max(0, Math.sin(t * 0.17 + 0.8)), 3);
    if (leak <= 0.004) return;
    const { ctx } = this;
    const cx = W * (0.92 + 0.06 * Math.sin(t * 0.11));
    const cy = H * (0.18 + 0.2 * Math.sin(t * 0.07 + 2));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
    g.addColorStop(0, 'rgba(255,160,80,1)');
    g.addColorStop(0.5, 'rgba(255,120,50,0.45)');
    g.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = leak;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
