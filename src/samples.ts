// 스타일 예시 영상용 샘플 사진: 저작권 걱정 없는 웨딩 일러스트를 캔버스로 즉석에서 그림

import { createCanvas, get2d } from './design';
import { mulberry32 } from './random';

export interface SamplePhoto {
  id: string;
  canvas: HTMLCanvasElement;
  aspect: number;
  /** 폴라로이드 날짜 등에 쓰는 가짜 촬영일 */
  date: number;
}

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function vertical(g: G, h: number, stops: [number, string][]): CanvasGradient {
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) grad.addColorStop(o, c);
  return grad;
}

function glowCircle(g: G, x: number, y: number, r: number, core: string, halo: string, haloR: number): void {
  const halo1 = g.createRadialGradient(x, y, r * 0.5, x, y, haloR);
  halo1.addColorStop(0, halo);
  halo1.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo1;
  g.fillRect(x - haloR, y - haloR, haloR * 2, haloR * 2);
  const c = g.createRadialGradient(x, y, 0, x, y, r);
  c.addColorStop(0, '#ffffff');
  c.addColorStop(0.6, core);
  c.addColorStop(1, core);
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** 부드러운 언덕 */
function hill(g: G, w: number, h: number, baseY: number, amp: number, color: string | CanvasGradient, phase: number, waves = 2): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(0, baseY);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = baseY - Math.sin((i / steps) * Math.PI * waves + phase) * amp - Math.sin((i / steps) * Math.PI * 5 + phase * 2) * amp * 0.18;
    g.lineTo(x, y);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

function bokeh(g: G, w: number, h: number, n: number, colors: string[], seed: number, rMin: number, rMax: number, yMin = 0, yMax = 1): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = (yMin + rnd() * (yMax - yMin)) * h;
    const r = rMin + rnd() * (rMax - rMin);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const c = colors[i % colors.length];
    grad.addColorStop(0, c);
    grad.addColorStop(0.7, c);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.25 + rnd() * 0.45;
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** 손을 잡은 신랑·신부 실루엣. s: 크기 배율 (신랑 키 ≈ 300·s) */
function couple(g: G, x: number, base: number, s: number, color: string, veil: string, bouquet = true): void {
  g.save();
  const gx = x - 34 * s;
  const bx = x + 34 * s;
  // 면사포 (뒤)
  g.fillStyle = veil;
  g.beginPath();
  g.moveTo(bx + 4 * s, base - 272 * s);
  g.bezierCurveTo(bx + 64 * s, base - 220 * s, bx + 56 * s, base - 120 * s, bx + 104 * s, base - 26 * s);
  g.lineTo(bx + 44 * s, base - 50 * s);
  g.bezierCurveTo(bx + 24 * s, base - 150 * s, bx + 12 * s, base - 220 * s, bx - 6 * s, base - 262 * s);
  g.closePath();
  g.fill();
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  // 신랑
  g.beginPath();
  g.arc(gx, base - 282 * s, 17 * s, 0, TAU);
  g.fill();
  g.fillRect(gx - 6 * s, base - 270 * s, 12 * s, 18 * s);
  g.beginPath();
  g.moveTo(gx - 34 * s, base - 250 * s);
  g.quadraticCurveTo(gx, base - 266 * s, gx + 34 * s, base - 250 * s);
  g.lineTo(gx + 28 * s, base - 148 * s);
  g.lineTo(gx + 22 * s, base);
  g.lineTo(gx + 5 * s, base);
  g.lineTo(gx, base - 118 * s);
  g.lineTo(gx - 5 * s, base);
  g.lineTo(gx - 22 * s, base);
  g.lineTo(gx - 28 * s, base - 148 * s);
  g.closePath();
  g.fill();
  g.lineWidth = 11 * s;
  g.beginPath();
  g.moveTo(gx - 31 * s, base - 242 * s);
  g.quadraticCurveTo(gx - 42 * s, base - 196 * s, gx - 34 * s, base - 160 * s);
  g.stroke();
  // 신부
  g.beginPath();
  g.arc(bx, base - 258 * s, 15.5 * s, 0, TAU);
  g.fill();
  g.beginPath();
  g.arc(bx + 10 * s, base - 268 * s, 8.5 * s, 0, TAU);
  g.fill();
  g.fillRect(bx - 5 * s, base - 248 * s, 10 * s, 14 * s);
  g.beginPath();
  g.moveTo(bx - 22 * s, base - 236 * s);
  g.quadraticCurveTo(bx, base - 244 * s, bx + 22 * s, base - 236 * s);
  g.lineTo(bx + 14 * s, base - 172 * s);
  g.lineTo(bx - 14 * s, base - 172 * s);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(bx - 14 * s, base - 178 * s);
  g.bezierCurveTo(bx - 40 * s, base - 100 * s, bx - 72 * s, base - 30 * s, bx - 80 * s, base);
  g.lineTo(bx + 108 * s, base);
  g.bezierCurveTo(bx + 72 * s, base - 22 * s, bx + 40 * s, base - 100 * s, bx + 14 * s, base - 178 * s);
  g.closePath();
  g.fill();
  // 맞잡은 손
  g.lineWidth = 11 * s;
  g.beginPath();
  g.moveTo(gx + 30 * s, base - 242 * s);
  g.quadraticCurveTo(gx + 46 * s, base - 200 * s, x, base - 178 * s);
  g.stroke();
  g.lineWidth = 9 * s;
  g.beginPath();
  g.moveTo(bx - 19 * s, base - 230 * s);
  g.quadraticCurveTo(bx - 30 * s, base - 196 * s, x + 2 * s, base - 180 * s);
  g.stroke();
  if (bouquet) {
    g.lineWidth = 8 * s;
    g.beginPath();
    g.moveTo(bx + 19 * s, base - 230 * s);
    g.quadraticCurveTo(bx + 30 * s, base - 196 * s, bx + 20 * s, base - 176 * s);
    g.stroke();
    const cols = ['#f7d3da', '#fff3ee', '#f1b9c4', '#fde6d8', '#e9a6b4'];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.arc(bx + 20 * s + Math.cos(a) * 9 * s, base - 172 * s + Math.sin(a) * 7 * s, 7 * s, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

function paintBeach(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h * 0.64, [
    [0, '#5d4b93'],
    [0.38, '#d98fb0'],
    [0.75, '#f7bfa6'],
    [1, '#fde0b2'],
  ]);
  g.fillRect(0, 0, w, h * 0.64);
  glowCircle(g, w * 0.64, h * 0.6, w * 0.065, '#fff1d0', 'rgba(255,226,180,0.7)', w * 0.42);
  g.fillStyle = vertical(g, h, [
    [0.62, '#a986b9'],
    [1, '#433466'],
  ]);
  g.fillRect(0, h * 0.62, w, h * 0.38);
  // 물결에 비친 햇빛
  const rnd = mulberry32(7);
  for (let i = 0; i < 70; i++) {
    const y = h * (0.63 + rnd() * 0.25);
    const spread = (y - h * 0.62) * 0.9 + 20;
    const x = w * 0.64 + (rnd() - 0.5) * spread;
    g.fillStyle = `rgba(255,230,200,${(0.5 - (y / h - 0.62) * 1.6).toFixed(3)})`;
    g.fillRect(x, y, 20 + rnd() * 60, 3);
  }
  // 젖은 모래
  g.fillStyle = vertical(g, h, [
    [0.84, 'rgba(238,184,160,0.0)'],
    [0.88, 'rgba(226,168,150,0.9)'],
    [1, '#b77b83'],
  ]);
  g.fillRect(0, h * 0.84, w, h * 0.16);
  couple(g, w * 0.36, h * 0.93, (h * 0.46) / 300, 'rgba(38,22,44,0.94)', 'rgba(255,245,250,0.55)');
  // 새
  g.strokeStyle = 'rgba(60,40,70,0.7)';
  g.lineWidth = 3;
  for (const [bx, by, bs] of [
    [0.72, 0.2, 18],
    [0.77, 0.25, 13],
    [0.68, 0.27, 11],
  ]) {
    g.beginPath();
    g.moveTo(w * bx - bs, h * by);
    g.quadraticCurveTo(w * bx - bs / 2, h * by - bs * 0.6, w * bx, h * by);
    g.quadraticCurveTo(w * bx + bs / 2, h * by - bs * 0.6, w * bx + bs, h * by);
    g.stroke();
  }
}

function paintField(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#f8d9e0'],
    [0.45, '#fde9dc'],
    [0.62, '#fff4e4'],
  ]);
  g.fillRect(0, 0, w, h);
  glowCircle(g, w * 0.74, h * 0.2, w * 0.07, '#fff6e2', 'rgba(255,236,210,0.8)', w * 0.6);
  hill(g, w, h, h * 0.6, h * 0.035, '#e2c3cf', 0.6, 1.5);
  hill(g, w, h, h * 0.7, h * 0.04, '#bfd09b', 2.1, 1.2);
  hill(g, w, h, h * 0.8, h * 0.03, '#98b06f', 4.2, 1.8);
  const rnd = mulberry32(21);
  const cols = ['#ffffff', '#ffd6df', '#fff0b5', '#f7b6c6'];
  for (let i = 0; i < 260; i++) {
    const y = h * (0.74 + rnd() * 0.26);
    const x = rnd() * w;
    const r = 2 + (y / h - 0.72) * 22 * rnd();
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  couple(g, w * 0.44, h * 0.94, (h * 0.5) / 300, 'rgba(70,40,58,0.92)', 'rgba(255,255,255,0.7)');
}

function paintRings(g: G, w: number, h: number): void {
  const bg = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.75);
  bg.addColorStop(0, '#fdf0f2');
  bg.addColorStop(1, '#e6b3c0');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  bokeh(g, w, h, 22, ['rgba(255,255,255,0.9)', 'rgba(255,214,226,0.9)', 'rgba(255,236,210,0.9)'], 5, w * 0.02, w * 0.07, 0, 0.55);
  // 바닥 그림자
  const sh = g.createRadialGradient(w * 0.5, h * 0.72, 0, w * 0.5, h * 0.72, w * 0.36);
  sh.addColorStop(0, 'rgba(120,60,80,0.28)');
  sh.addColorStop(1, 'rgba(120,60,80,0)');
  g.fillStyle = sh;
  g.fillRect(0, h * 0.5, w, h * 0.5);
  const gold = (x0: number, y0: number, x1: number, y1: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#fff3c9');
    gr.addColorStop(0.35, '#e2b866');
    gr.addColorStop(0.7, '#b58436');
    gr.addColorStop(1, '#f5d98f');
    return gr;
  };
  // 누워 있는 반지
  g.lineWidth = w * 0.042;
  g.strokeStyle = gold(w * 0.2, h * 0.6, w * 0.6, h * 0.75);
  g.beginPath();
  g.ellipse(w * 0.42, h * 0.66, w * 0.19, w * 0.065, -0.08, 0, TAU);
  g.stroke();
  // 서 있는 반지
  g.lineWidth = w * 0.036;
  g.strokeStyle = gold(w * 0.5, h * 0.3, w * 0.75, h * 0.7);
  g.beginPath();
  g.ellipse(w * 0.6, h * 0.5, w * 0.12, w * 0.155, 0.25, 0, TAU);
  g.stroke();
  // 다이아몬드
  const dx = w * 0.57;
  const dy = h * 0.335;
  const ds = w * 0.045;
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(160,190,220,0.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(dx - ds, dy);
  g.lineTo(dx - ds * 0.5, dy - ds * 0.7);
  g.lineTo(dx + ds * 0.5, dy - ds * 0.7);
  g.lineTo(dx + ds, dy);
  g.lineTo(dx, dy + ds * 1.1);
  g.closePath();
  g.fill();
  g.stroke();
  glowCircle(g, dx - ds * 0.2, dy - ds * 0.2, ds * 0.18, '#ffffff', 'rgba(255,255,255,0.9)', ds * 1.8);
  // 하이라이트
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = w * 0.008;
  g.beginPath();
  g.ellipse(w * 0.42, h * 0.66, w * 0.19, w * 0.065, -0.08, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();
}

function rose(g: G, x: number, y: number, r: number, base: string, dark: string): void {
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.strokeStyle = dark;
  g.lineWidth = Math.max(1.5, r * 0.06);
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const rr = r * (0.85 - i * 0.2);
    const a0 = i * 1.3;
    g.beginPath();
    g.arc(x + Math.cos(a0) * r * 0.05, y + Math.sin(a0) * r * 0.05, rr, a0, a0 + Math.PI * 1.2);
    g.stroke();
  }
}

function paintBouquet(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#f8f1e8'],
    [1, '#e7d3c6'],
  ]);
  g.fillRect(0, 0, w, h);
  const light = g.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, w * 0.9);
  light.addColorStop(0, 'rgba(255,255,255,0.8)');
  light.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  // 줄기
  g.strokeStyle = '#6f8a57';
  g.lineWidth = w * 0.014;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(w * 0.5 + i * w * 0.02, h * 0.58);
    g.lineTo(w * 0.5 + i * w * 0.012, h * 0.96);
    g.stroke();
  }
  // 잎
  const leaf = (x: number, y: number, a: number, s: number, c: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(0, 0, s, s * 0.38, 0, 0, TAU);
    g.fill();
    g.restore();
  };
  const rnd = mulberry32(33);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    leaf(w * 0.5 + Math.cos(a) * w * 0.3, h * 0.44 + Math.sin(a) * w * 0.28, a, w * (0.08 + rnd() * 0.05), i % 2 ? '#8fae72' : '#7a9860');
  }
  // 장미
  const roses: [number, number, number, string, string][] = [
    [0.5, 0.4, 0.13, '#f6c8cf', '#d98a9a'],
    [0.32, 0.46, 0.11, '#fdf1e7', '#e2c2ad'],
    [0.68, 0.45, 0.115, '#f8d2b8', '#dd9e7c'],
    [0.42, 0.28, 0.1, '#fbe3e6', '#e0a6b1'],
    [0.62, 0.29, 0.1, '#fef6ee', '#dfc3ad'],
    [0.5, 0.54, 0.1, '#e8a4b2', '#bf6d80'],
    [0.26, 0.33, 0.085, '#f8d2b8', '#dd9e7c'],
    [0.75, 0.34, 0.085, '#f6c8cf', '#d98a9a'],
  ];
  for (const [x, y, r, b, d] of roses) rose(g, w * x, h * y, w * r, b, d);
  // 안개꽃
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU;
    const rr = w * (0.2 + rnd() * 0.2);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.arc(w * 0.5 + Math.cos(a) * rr, h * 0.41 + Math.sin(a) * rr * 0.8, 3 + rnd() * 4, 0, TAU);
    g.fill();
  }
  // 리본
  g.fillStyle = '#f3d3da';
  g.fillRect(w * 0.42, h * 0.7, w * 0.16, h * 0.05);
  for (const s of [-1, 1]) {
    g.save();
    g.translate(w * 0.5, h * 0.725);
    g.rotate(s * 0.5);
    g.beginPath();
    g.ellipse(s * w * 0.1, 0, w * 0.1, w * 0.045, 0, 0, TAU);
    g.fill();
    g.restore();
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.73);
    g.lineTo(w * 0.5 + s * w * 0.09, h * 0.86);
    g.lineTo(w * 0.5 + s * w * 0.05, h * 0.87);
    g.closePath();
    g.fill();
  }
}

function paintCity(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#0e1233'],
    [0.5, '#2b2658'],
    [0.72, '#56356a'],
    [1, '#1a1330'],
  ]);
  g.fillRect(0, 0, w, h);
  bokeh(g, w, h, 46, ['rgba(255,214,150,0.9)', 'rgba(255,170,200,0.9)', 'rgba(255,240,210,0.9)'], 12, w * 0.008, w * 0.035, 0.35, 0.8);
  // 빌딩
  const rnd = mulberry32(44);
  let x = 0;
  while (x < w) {
    const bw = w * (0.04 + rnd() * 0.07);
    const bh = h * (0.15 + rnd() * 0.3);
    g.fillStyle = '#15102a';
    g.fillRect(x, h * 0.74 - bh, bw, bh);
    g.fillStyle = 'rgba(255,214,140,0.55)';
    for (let wy = h * 0.74 - bh + 12; wy < h * 0.72; wy += 22) {
      for (let wx = x + 8; wx < x + bw - 10; wx += 18) if (rnd() < 0.3) g.fillRect(wx, wy, 7, 10);
    }
    x += bw + 4;
  }
  g.fillStyle = '#0c0a19';
  g.fillRect(0, h * 0.74, w, h * 0.26);
  // 가로등
  const lx = w * 0.72;
  g.fillStyle = '#0c0a19';
  g.fillRect(lx - 5, h * 0.42, 10, h * 0.5);
  glowCircle(g, lx, h * 0.41, w * 0.012, '#ffe7b8', 'rgba(255,214,150,0.55)', w * 0.25);
  couple(g, w * 0.46, h * 0.93, (h * 0.44) / 300, 'rgba(10,8,22,0.96)', 'rgba(255,240,245,0.35)');
}

function paintArch(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#f1f3e6'],
    [1, '#d6e1c5'],
  ]);
  g.fillRect(0, 0, w, h);
  // 길
  g.fillStyle = '#ecdfcb';
  g.beginPath();
  g.moveTo(w * 0.36, h * 0.8);
  g.lineTo(w * 0.64, h * 0.8);
  g.lineTo(w * 0.95, h);
  g.lineTo(w * 0.05, h);
  g.closePath();
  g.fill();
  // 아치
  const cx = w * 0.5;
  const top = h * 0.3;
  const r = w * 0.32;
  g.strokeStyle = '#b9c9a0';
  g.lineWidth = w * 0.07;
  g.beginPath();
  g.moveTo(cx - r, h * 0.82);
  g.lineTo(cx - r, top + r);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(cx + r, h * 0.82);
  g.stroke();
  const rnd = mulberry32(55);
  const cols = ['#ffffff', '#f7c6d0', '#fbe0cf', '#f3a9ba', '#fff4e6'];
  for (let i = 0; i < 150; i++) {
    const q = rnd();
    let px: number;
    let py: number;
    if (q < 0.25) {
      px = cx - r;
      py = top + r + rnd() * (h * 0.82 - top - r);
    } else if (q < 0.5) {
      px = cx + r;
      py = top + r + rnd() * (h * 0.82 - top - r);
    } else {
      const a = Math.PI + rnd() * Math.PI;
      px = cx + Math.cos(a) * r;
      py = top + r + Math.sin(a) * r;
    }
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(px + (rnd() - 0.5) * w * 0.06, py + (rnd() - 0.5) * w * 0.05, w * (0.012 + rnd() * 0.018), 0, TAU);
    g.fill();
  }
  couple(g, cx - w * 0.02, h * 0.83, (h * 0.34) / 300, 'rgba(58,44,58,0.92)', 'rgba(255,255,255,0.75)');
}

function paintHills(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#f2b98a'],
    [0.55, '#fbe2b5'],
    [0.7, '#fff0d2'],
  ]);
  g.fillRect(0, 0, w, h);
  glowCircle(g, w * 0.28, h * 0.56, w * 0.055, '#fff4d8', 'rgba(255,230,180,0.85)', w * 0.5);
  hill(g, w, h, h * 0.62, h * 0.05, 'rgba(226,170,120,0.85)', 0.3, 1.3);
  hill(g, w, h, h * 0.72, h * 0.06, '#c98a58', 2.3, 1.1);
  hill(g, w, h, h * 0.82, h * 0.09, '#8a5536', 0.9, 0.9);
  const rnd = mulberry32(66);
  g.strokeStyle = 'rgba(70,40,24,0.7)';
  g.lineWidth = 2;
  for (let i = 0; i < 160; i++) {
    const x = rnd() * w;
    const y = h * (0.86 + rnd() * 0.14);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 8, y - 10 - rnd() * 16);
    g.stroke();
  }
  couple(g, w * 0.66, h * 0.76, (h * 0.3) / 300, 'rgba(52,28,20,0.95)', 'rgba(255,245,235,0.6)');
}

function paintCake(g: G, w: number, h: number): void {
  g.fillStyle = vertical(g, h, [
    [0, '#f5e9e4'],
    [1, '#e3c9c3'],
  ]);
  g.fillRect(0, 0, w, h);
  bokeh(g, w, h, 18, ['rgba(255,236,210,0.9)', 'rgba(255,255,255,0.9)'], 77, w * 0.02, w * 0.06, 0, 0.45);
  g.fillStyle = '#e8d3ca';
  g.fillRect(0, h * 0.82, w, h * 0.18);
  // 받침
  g.fillStyle = '#d9c2b6';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.8, w * 0.36, h * 0.025, 0, 0, TAU);
  g.fill();
  const tiers: [number, number, number][] = [
    [0.62, 0.78, 0.15],
    [0.46, 0.63, 0.13],
    [0.3, 0.5, 0.12],
  ];
  for (const [tw, bottom, th] of tiers) {
    const x = w * (0.5 - tw / 2);
    const y = h * (bottom - th);
    const grad = g.createLinearGradient(x, 0, x + w * tw, 0);
    grad.addColorStop(0, '#efe4dc');
    grad.addColorStop(0.35, '#fffbf6');
    grad.addColorStop(1, '#e6d8cf');
    g.fillStyle = grad;
    g.fillRect(x, y, w * tw, h * th);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let px = x + 10; px < x + w * tw - 5; px += 18) {
      g.beginPath();
      g.arc(px, h * bottom - 6, 5, 0, TAU);
      g.fill();
    }
  }
  // 흘러내리는 꽃 장식
  const rnd = mulberry32(88);
  for (let i = 0; i < 16; i++) {
    const q = i / 15;
    const x = w * (0.62 - q * 0.22 + (rnd() - 0.5) * 0.05);
    const y = h * (0.34 + q * 0.42);
    rose(g, x, y, w * (0.03 + rnd() * 0.02), i % 3 ? '#f6c8cf' : '#fdf1e7', i % 3 ? '#d98a9a' : '#e2c2ad');
  }
  // 토퍼: 가는 막대 위에 맞물린 두 금반지
  const hx = w * 0.5;
  const hy = h * 0.325;
  const s = w * 0.05;
  const r = s * 0.62;
  const d = s * 0.4;
  const gold = g.createLinearGradient(hx - s, hy - s, hx + s, hy + s);
  gold.addColorStop(0, '#f3d596');
  gold.addColorStop(0.5, '#c8954e');
  gold.addColorStop(1, '#e9c47c');
  g.strokeStyle = '#c9a063';
  g.lineWidth = s * 0.09;
  g.beginPath();
  g.moveTo(hx, hy + r * 0.8);
  g.lineTo(hx, h * 0.38);
  g.stroke();
  g.strokeStyle = gold;
  g.lineWidth = s * 0.19;
  g.lineCap = 'round';
  const ring = (x: number, a0 = 0, a1 = TAU) => {
    g.beginPath();
    g.arc(x, hy, r, a0, a1);
    g.stroke();
  };
  ring(hx - d);
  ring(hx + d);
  // 아래쪽 교차점에서 왼쪽 반지가 앞으로 지나가게 다시 그려 서로 걸린 것처럼
  const cross = Math.atan2(Math.sqrt(r * r - d * d), d);
  ring(hx - d, cross - 0.32, cross + 0.32);
  // 반짝이는 금속 느낌의 얇은 빛
  g.strokeStyle = 'rgba(255,248,228,0.85)';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.arc(hx - d, hy, r, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();
  g.beginPath();
  g.arc(hx + d, hy, r, Math.PI * 1.55, Math.PI * 1.85);
  g.stroke();
  g.lineCap = 'butt';
}

const SPECS: { id: string; w: number; h: number; paint: (g: G, w: number, h: number) => void; date: [number, number, number] }[] = [
  { id: 'beach', w: 1440, h: 960, paint: paintBeach, date: [2019, 6, 14] },
  { id: 'field', w: 960, h: 1440, paint: paintField, date: [2019, 9, 21] },
  { id: 'rings', w: 1200, h: 1200, paint: paintRings, date: [2020, 2, 14] },
  { id: 'bouquet', w: 960, h: 1400, paint: paintBouquet, date: [2020, 5, 2] },
  { id: 'city', w: 1440, h: 960, paint: paintCity, date: [2020, 11, 28] },
  { id: 'arch', w: 960, h: 1440, paint: paintArch, date: [2021, 4, 10] },
  { id: 'hills', w: 1440, h: 960, paint: paintHills, date: [2021, 9, 18] },
  { id: 'cake', w: 960, h: 1400, paint: paintCake, date: [2021, 10, 3] },
];

let cache: Map<string, SamplePhoto> | null = null;

/** 샘플 사진 전체 (처음 한 번만 그림) */
export function getSamples(): Map<string, SamplePhoto> {
  if (cache) return cache;
  cache = new Map();
  for (const s of SPECS) {
    const canvas = createCanvas(s.w, s.h);
    const g = get2d(canvas);
    s.paint(g, s.w, s.h);
    cache.set(s.id, {
      id: s.id,
      canvas,
      aspect: s.w / s.h,
      date: new Date(s.date[0], s.date[1] - 1, s.date[2]).getTime(),
    });
  }
  return cache;
}
