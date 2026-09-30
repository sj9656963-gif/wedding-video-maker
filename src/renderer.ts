// 프레임 렌더러: 시각 t의 한 장면을 캔버스에 그림 (장면·전환 → 색보정 → 빛 번짐 → 파티클 → 문구 → 그레인 → 페이드)

import type { RenderAssets } from './assets';
import {
  DESIGN_H as H,
  DESIGN_W as W,
  clamp01,
  createCanvas,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  get2d,
  lerp,
  smoothstep,
} from './design';
import type { SceneEnv } from './draw-utils';
import { drawIntroText, drawOutroText } from './draw-text';
import { Effects } from './effects';
import { drawOverlays } from './overlays';
import { hash01 } from './random';
import { drawSegmentVisual } from './scene-draw';
import type { Theme } from './themes';
import { activeSegments } from './timeline';
import type { Segment, Timeline, WeddingInfo } from './types';

export interface RenderContext {
  timeline: Timeline;
  theme: Theme;
  info: WeddingInfo;
  assets: RenderAssets;
  /** 사진 촬영 시각 (캠코더·디카 화면 표시용) */
  photoDate?: (id: string) => number | null;
  /** 사용자가 사진에 넣은 문구 */
  caption?: (id: string) => string;
  /** 오프닝·엔딩 문구 등장 속도 배율 (짧은 예시 영상용, 기본 1) */
  textPace?: number;
}

/** 영상 시작/끝의 검은 화면 페이드 길이(초) */
export const START_FADE = 1.5;
export const END_FADE = 2.5;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly k: number;
  private readonly effects: Effects;
  private readonly layers: Layer[] = [];
  /** 베일 전환용 저해상도 가림막·빛 (필요할 때 만듦) */
  private veil: { mask: Layer; light: Layer; maskData: ImageData; lightData: ImageData } | null = null;
  private scratchLayer: Layer | null = null;
  private readonly supportsFilter: boolean;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly fades = true,
  ) {
    this.ctx = get2d(canvas);
    this.k = canvas.width / W;
    this.effects = new Effects(this.ctx);
    this.supportsFilter = typeof (this.ctx as { filter?: unknown }).filter === 'string';
  }

  render(t: number, rc: RenderContext): void {
    const { ctx, k } = this;
    const { theme, info, timeline } = rc;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const env: SceneEnv = { ctx, k, theme, assets: rc.assets, caption: rc.caption };

    const act = activeSegments(timeline, t);
    if (act.length === 1) drawSegmentVisual(env, act[0], t);
    else this.drawTransition(env, act[0], act[1], t);

    this.effects.colorGrade(theme);
    this.effects.glow(theme);
    this.effects.vignette(theme);
    // 꽃잎·빛망울은 문구 아래에 그려 글자가 가려지지 않도록
    this.effects.particles(theme, t);
    if (act.length === 2 && act[1].transitionIn) {
      const tr = act[1].transitionIn;
      const p = clamp01((t - act[1].start) / tr.duration);
      const seed = act[1].kind === 'photo' ? act[1].index : 0;
      if (tr.type === 'petals') this.effects.petalBurst(p, tr.direction, seed, theme);
      else if (tr.type === 'sparkle') this.effects.sparkleBurst(p, seed, theme.look.light);
    }

    const textEnv = { ctx, k, theme };
    const pace = rc.textPace ?? 1;
    for (const seg of act) {
      if (seg.kind === 'intro') drawIntroText(textEnv, info, t - seg.start, seg.end - seg.start, pace);
      else if (seg.kind === 'outro') drawOutroText(textEnv, info, t - seg.start, pace);
    }

    if (theme.overlays.length > 0) {
      // 전환 중이면 절반을 넘긴 쪽 장면의 정보(날짜·번호)를 표시
      const tr = act.length === 2 ? act[1].transitionIn : null;
      const main = act.length === 2 && tr && (t - act[1].start) / tr.duration > 0.5 ? act[1] : act[0];
      drawOverlays({ ctx, k, theme, info, effects: this.effects, photoDate: rc.photoDate }, t, main);
    }

    this.effects.filmGrain(theme, t);
    this.effects.filmFlicker(theme, t);
    this.effects.lightLeak(theme, t);

    if (!this.fades) return;
    const black = Math.max(
      1 - easeInOutSine(t / START_FADE),
      easeInOutSine((t - (timeline.duration - END_FADE)) / END_FADE),
    );
    if (black > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black).toFixed(4)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private layer(i: number): Layer {
    let l = this.layers[i];
    if (!l || l.canvas.width !== this.canvas.width || l.canvas.height !== this.canvas.height) {
      const canvas = createCanvas(this.canvas.width, this.canvas.height);
      // 원형·사선 전환은 레이어를 부분적으로 투명하게 깎아내므로 알파 채널이 필요
      l = { canvas, ctx: get2d(canvas, false) };
      this.layers[i] = l;
    }
    return l;
  }

  /** 구간을 레이어에 그림 (디자인 좌표) */
  private renderToLayer(i: number, env: SceneEnv, seg: Segment, t: number): Layer {
    const l = this.layer(i);
    const c = l.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    c.clearRect(0, 0, l.canvas.width, l.canvas.height);
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    drawSegmentVisual({ ...env, ctx: c }, seg, t);
    return l;
  }

  /**
   * 베일 전환의 가림막(새 장면이 보일 곳)과 베일 빛을 1/4 해상도로 픽셀마다 계산.
   * 가로 띠마다 그라데이션을 칠하면 띠 경계가 가는 줄무늬로 남아서, 부드러운 값을 직접 계산해 확대해 씀.
   * glow가 0이면 빛은 계산하지 않음.
   */
  private veilMaps(rgb: string, d: 1 | -1, e: number, glow: number, t: number): { mask: HTMLCanvasElement; light: HTMLCanvasElement } {
    const w = Math.max(1, Math.ceil(this.canvas.width / 4));
    const h = Math.max(1, Math.ceil(this.canvas.height / 4));
    let v = this.veil;
    if (!v || v.maskData.width !== w || v.maskData.height !== h) {
      const make = (): Layer => {
        const canvas = createCanvas(w, h);
        return { canvas, ctx: get2d(canvas, false) };
      };
      const mask = make();
      const light = make();
      v = { mask, light, maskData: mask.ctx.createImageData(w, h), lightData: light.ctx.createImageData(w, h) };
      this.veil = v;
    }
    const soft = 300; // 경계가 번지는 폭
    const amp = 78; // 물결 크기
    const reach = soft + amp * 1.5;
    const edge = lerp(-reach, W + reach, e);
    const [lr, lg, lb] = rgb.split(',').map(Number);
    const md = v.maskData.data;
    const ld = v.lightData.data;
    const sx = W / w;
    const sy = H / h;
    for (let j = 0; j < h; j++) {
      const y = (j + 0.5) * sy;
      // 경계 위치: 두 물결을 겹쳐 천이 흐르는 듯 불규칙하게, 시간에 따라 천천히 일렁임
      const wave = edge + Math.sin(y / 230 + t * 1.1) * amp + Math.sin(y / 97 - t * 1.9) * amp * 0.3;
      const pos = d === 1 ? wave : W - wave;
      // 천의 결처럼 세로 방향으로 빛의 세기가 조금씩 달라짐
      const sheen = glow * (0.82 + 0.18 * Math.sin(y / 53 + t * 1.7));
      for (let i = 0, o = j * w * 4; i < w; i++, o += 4) {
        // 진행 방향 기준 경계까지 거리 (음수 = 베일이 이미 지나간 쪽)
        const s = d * ((i + 0.5) * sx - pos);
        const u = clamp01(s / soft + 0.5);
        md[o + 3] = 255 * (1 - u * u * (3 - 2 * u));
        if (glow > 0) {
          // 경계 바로 앞의 밝은 심지 + 지나간 쪽으로 넓게 번지는 은은한 빛
          const c = (s - 8) / 34;
          const b = (s + 40) / 120;
          ld[o] = lr;
          ld[o + 1] = lg;
          ld[o + 2] = lb;
          ld[o + 3] = 255 * sheen * (0.34 * Math.exp(-c * c) + 0.12 * Math.exp(-b * b));
        }
      }
    }
    v.mask.ctx.putImageData(v.maskData, 0, 0);
    if (glow > 0) v.light.ctx.putImageData(v.lightData, 0, 0);
    return { mask: v.mask.canvas, light: v.light.canvas };
  }

  private drawTransition(env: SceneEnv, prev: Segment, cur: Segment, t: number): void {
    const tr = cur.transitionIn;
    const { ctx, k } = env;
    if (!tr) {
      drawSegmentVisual(env, cur, t);
      return;
    }
    const p = clamp01((t - cur.start) / tr.duration);
    switch (tr.type) {
      case 'crossfade':
      case 'petals':
        drawSegmentVisual(env, prev, t);
        this.composite(env, cur, t, easeInOutSine(p));
        break;
      case 'dip-white':
      case 'dip-black': {
        const rgb = tr.type === 'dip-white' ? '255,255,255' : '0,0,0';
        let a: number;
        if (p < 0.5) {
          drawSegmentVisual(env, prev, t);
          a = easeInOutSine(p * 2);
        } else {
          drawSegmentVisual(env, cur, t);
          a = easeInOutSine((1 - p) * 2);
        }
        ctx.fillStyle = `rgba(${rgb},${a.toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'push': {
        const e = easeInOutCubic(p);
        const d = tr.direction;
        this.drawShifted(env, prev, t, -d * W * e);
        this.drawShifted(env, cur, t, d * W * (1 - e));
        break;
      }
      case 'zoom': {
        const e = easeInOutCubic(p);
        // 들어오는 장면은 살짝 확대된 상태에서 제자리로, 나가는 장면은 확대되며 사라짐
        const s = 1.12 - 0.12 * e;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        drawSegmentVisual(env, cur, t);
        ctx.restore();
        this.composite(env, prev, t, 1 - e, 1 + 0.3 * e);
        break;
      }
      case 'veil': {
        // 빛을 머금은 얇은 베일이 물결치며 화면을 가로질러 지나가고, 그 뒤로 다음 장면이 드러남
        const e = easeInOutSine(p);
        drawSegmentVisual(env, prev, t);
        const l = this.renderToLayer(0, env, cur, t);
        const glow = Math.sin(Math.PI * e);
        const rgb = env.theme.look.light;
        const maps = this.veilMaps(rgb, tr.direction, e, glow > 0.01 ? glow : 0, t);
        // 가림막으로 베일이 지나간 쪽만 새 장면이 보이게
        const lc = l.ctx;
        lc.save();
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.globalCompositeOperation = 'destination-in';
        lc.drawImage(maps.mask, 0, 0, l.canvas.width, l.canvas.height);
        lc.restore();
        this.drawLayer(env, l, 1);
        // 베일 자체: 경계를 따라 은은하게 빛나는 얇은 천
        if (glow > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(maps.light, 0, 0, W, H);
          ctx.fillStyle = `rgba(${rgb},${(0.05 * glow).toFixed(4)})`;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
        break;
      }
      case 'iris': {
        const e = easeInOutCubic(p);
        drawSegmentVisual(env, prev, t);
        const l = this.renderToLayer(0, env, cur, t);
        const f = 140;
        const R = e * (Math.hypot(W / 2, H / 2) + f);
        const lc = l.ctx;
        lc.save();
        lc.globalCompositeOperation = 'destination-in';
        const g = lc.createRadialGradient(W / 2, H / 2, Math.max(0, R - f), W / 2, H / 2, R + 0.01);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = g;
        lc.fillRect(0, 0, W, H);
        lc.restore();
        this.drawLayer(env, l, 1);
        break;
      }
      case 'wipe': {
        const e = easeInOutSine(p);
        drawSegmentVisual(env, prev, t);
        const l = this.renderToLayer(0, env, cur, t);
        const f = 260;
        const ang = (14 * Math.PI) / 180;
        const dx = Math.cos(ang) * tr.direction;
        const dy = Math.sin(ang);
        // 화면 꼭짓점의 투영 범위에서 부드러운 경계가 지나가도록
        const proj = [0, W].flatMap((x) => [0, H].map((y) => x * dx + y * dy));
        const c = lerp(Math.min(...proj) - f, Math.max(...proj) + f, e);
        const lc = l.ctx;
        lc.save();
        lc.globalCompositeOperation = 'destination-in';
        const g = lc.createLinearGradient(dx * (c - f), dy * (c - f), dx * (c + f), dy * (c + f));
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = g;
        lc.fillRect(0, 0, W, H);
        lc.restore();
        this.drawLayer(env, l, 1);
        break;
      }
      case 'blur': {
        if (!this.supportsFilter) {
          drawSegmentVisual(env, prev, t);
          this.composite(env, cur, t, easeInOutSine(p));
          break;
        }
        const a = this.renderToLayer(0, env, prev, t);
        const b = this.renderToLayer(1, env, cur, t);
        const maxBlur = 22 * k;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = `blur(${(maxBlur * smoothstep(0, 0.65, p)).toFixed(2)}px)`;
        ctx.drawImage(a.canvas, 0, 0);
        ctx.filter = `blur(${(maxBlur * (1 - smoothstep(0.35, 1, p))).toFixed(2)}px)`;
        ctx.globalAlpha = smoothstep(0.2, 0.8, p);
        ctx.drawImage(b.canvas, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(${env.theme.look.light},${(0.16 * Math.sin(Math.PI * p)).toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        break;
      }
      case 'light': {
        drawSegmentVisual(env, prev, t);
        this.composite(env, cur, t, easeInOutSine(p));
        // 빛이 화면을 쓸고 지나감
        const flash = Math.sin(Math.PI * p);
        const x = lerp(-0.25 * W, 1.25 * W, easeInOutSine(p));
        const rgb = env.theme.look.light;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const [ox, oy, r, a] of [
          [0, 0.35, 0.62, 0.85],
          [-0.3, 0.82, 0.45, 0.5],
        ] as const) {
          const cx = x + ox * W;
          const cy = oy * H;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * W);
          g.addColorStop(0, `rgba(${rgb},${(a * flash).toFixed(4)})`);
          g.addColorStop(0.45, `rgba(${rgb},${(a * 0.45 * flash).toFixed(4)})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.fillStyle = `rgba(${rgb},${(0.12 * flash).toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        break;
      }
      case 'flare': {
        drawSegmentVisual(env, prev, t);
        this.composite(env, cur, t, easeInOutSine(p));
        this.drawFlare(env, p);
        break;
      }
      case 'glitch': {
        const a = this.renderToLayer(0, env, prev, t);
        const b = this.renderToLayer(1, env, cur, t);
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const amp = Math.sin(Math.PI * p);
        const frame = Math.floor(t * 30);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(p < 0.5 ? a.canvas : b.canvas, 0, 0);
        // 가로 띠가 좌우로 어긋나며 앞뒤 장면이 뒤섞임
        let y = 0;
        for (let i = 0; i < 22 && y < ch; i++) {
          const r = (q: number) => hash01(frame * 97 + i * 13 + q);
          const h = Math.max(2, Math.round(ch * (0.01 + r(1) * 0.08)));
          if (r(2) < 0.6 * amp + 0.08) {
            const src = r(3) < smoothstep(0.3, 0.7, p) ? b : a;
            const dx = Math.round((r(4) - 0.5) * cw * 0.18 * amp);
            ctx.drawImage(src.canvas, 0, y, cw, h, dx, y, cw, h);
            if (r(5) < 0.4 * amp) {
              ctx.globalCompositeOperation = 'screen';
              ctx.fillStyle = r(6) < 0.5 ? 'rgba(255,0,110,0.34)' : 'rgba(0,255,230,0.28)';
              ctx.fillRect(0, y, cw, h);
              ctx.globalCompositeOperation = 'source-over';
            }
          }
          y += h + Math.round(r(7) * ch * 0.05);
        }
        ctx.restore();
        break;
      }
      case 'tracking': {
        const e = easeInOutCubic(p);
        const off = e * H;
        this.drawShiftedY(env, prev, t, -off);
        this.drawShiftedY(env, cur, t, H - off);
        const seam = H - off;
        const amp = Math.sin(Math.PI * p);
        const noise = this.effects.noisePattern(Math.floor(t * 30));
        ctx.save();
        if (noise) {
          ctx.globalAlpha = 0.35 + 0.5 * amp;
          ctx.fillStyle = noise;
          ctx.fillRect(0, seam - 46, W, 92);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 7; i++) {
          const r = (q: number) => hash01(Math.floor(t * 30) * 41 + i * 7 + q);
          ctx.globalAlpha = amp * (0.3 + r(1) * 0.5);
          ctx.fillRect(r(2) * W * 0.3, seam + (r(3) - 0.5) * 260, W * (0.4 + r(4) * 0.6), 3 + r(5) * 7);
        }
        ctx.restore();
        break;
      }
      case 'ink': {
        drawSegmentVisual(env, prev, t);
        const l = this.renderToLayer(0, env, cur, t);
        const lc = l.ctx;
        const e = easeInOutCubic(p);
        const seed = cur.kind === 'photo' ? cur.index : 3;
        lc.save();
        lc.globalCompositeOperation = 'destination-in';
        if (this.supportsFilter) lc.filter = `blur(${(16 * k).toFixed(1)}px)`;
        lc.fillStyle = '#000000';
        lc.beginPath();
        // 번지는 잉크 방울 세 개 (시간차)
        [
          [0.3, 0.42, 0],
          [0.7, 0.6, 0.14],
          [0.52, 0.2, 0.26],
        ].forEach(([bx, by, delay], j) => {
          const local = clamp01((e - delay) / (1 - delay));
          if (local <= 0) return;
          const R = Math.pow(local, 1.25) * 2300;
          const s = (q: number) => hash01(seed * 17 + j * 5 + q) * Math.PI * 2;
          for (let i = 0; i <= 72; i++) {
            const th = (i / 72) * Math.PI * 2;
            const r = R * (1 + 0.14 * Math.sin(3 * th + s(1)) + 0.08 * Math.sin(5 * th + s(2) + p * 2) + 0.05 * Math.sin(11 * th + s(3)));
            const x = bx * W + Math.cos(th) * r;
            const y = by * H + Math.sin(th) * r;
            if (i === 0) lc.moveTo(x, y);
            else lc.lineTo(x, y);
          }
          lc.closePath();
        });
        lc.fill();
        lc.restore();
        this.drawLayer(env, l, 1);
        break;
      }
      case 'blinds': {
        drawSegmentVisual(env, prev, t);
        const n = 9;
        const sw = W / n;
        ctx.save();
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < n; i++) {
          const idx = tr.direction === 1 ? i : n - 1 - i;
          const local = easeInOutCubic(clamp01(p * 1.6 - idx * (0.6 / (n - 1))));
          if (local <= 0) continue;
          const w = sw * local;
          ctx.rect(i * sw + (sw - w) / 2, 0, w + 0.5, H);
          any = true;
        }
        if (any) {
          ctx.clip();
          drawSegmentVisual(env, cur, t);
        }
        ctx.restore();
        break;
      }
      case 'slide': {
        // 새 장면이 옆에서 미끄러져 들어와 덮고, 이전 장면은 조금 밀리며 어두워짐
        const e = easeInOutCubic(p);
        const d = tr.direction;
        this.drawShifted(env, prev, t, -d * W * 0.28 * e);
        ctx.fillStyle = `rgba(0,0,0,${(0.4 * e).toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
        const x = d * W * (1 - e);
        const lead = d === 1 ? x : x + W;
        const sw = 90;
        const g = ctx.createLinearGradient(lead, 0, lead - d * sw, 0);
        g.addColorStop(0, `rgba(0,0,0,${(0.38 * Math.sin(Math.PI * p)).toFixed(4)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(lead, lead - d * sw), 0, sw, H);
        this.drawShifted(env, cur, t, x);
        break;
      }
      case 'split': {
        // 가운데서 양쪽으로 문이 열리며 뒤에 있던 새 장면이 드러남
        const e = easeInOutCubic(p);
        const s = 1.06 - 0.06 * e;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        drawSegmentVisual(env, cur, t);
        ctx.restore();
        const a = this.renderToLayer(0, env, prev, t);
        const cw = a.canvas.width;
        const ch = a.canvas.height;
        const off = (W / 2) * e;
        ctx.drawImage(a.canvas, 0, 0, cw / 2, ch, -off, 0, W / 2, H);
        ctx.drawImage(a.canvas, cw / 2, 0, cw / 2, ch, W / 2 + off, 0, W / 2, H);
        const shade = 0.45 * Math.sin(Math.PI * p);
        for (const side of [-1, 1] as const) {
          const edge = W / 2 + side * off;
          const g = ctx.createLinearGradient(edge, 0, edge + side * 60, 0);
          g.addColorStop(0, `rgba(0,0,0,${shade.toFixed(4)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(side === 1 ? edge : edge - 60, 0, 60, H);
        }
        break;
      }
      case 'flash': {
        // 카메라 플래시처럼 순간 하얗게 번쩍인 뒤 새 장면이 살짝 당겨지며 자리 잡음
        const peak = 0.4;
        let a: number;
        if (p < peak) {
          drawSegmentVisual(env, prev, t);
          a = Math.pow(p / peak, 2);
        } else {
          const q = (p - peak) / (1 - peak);
          const s = 1 + 0.05 * (1 - easeOutCubic(q));
          ctx.save();
          ctx.translate(W / 2, H / 2);
          ctx.scale(s, s);
          ctx.translate(-W / 2, -H / 2);
          drawSegmentVisual(env, cur, t);
          ctx.restore();
          a = Math.pow(1 - q, 1.6);
        }
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'mosaic': {
        // 화면이 큰 픽셀로 흩어졌다가 새 장면으로 다시 선명해짐
        const src = p < 0.5 ? prev : cur;
        const q = p < 0.5 ? p / 0.5 : (1 - p) / 0.5;
        const block = 2 + 58 * easeInOutCubic(q);
        if (block <= 3) {
          drawSegmentVisual(env, src, t);
          break;
        }
        const l = this.renderToLayer(0, env, src, t);
        const sw = Math.max(1, Math.round(W / block));
        const sh = Math.max(1, Math.round(H / block));
        const m = this.scratch(sw, sh);
        m.ctx.setTransform(1, 0, 0, 1, 0, 0);
        m.ctx.drawImage(l.canvas, 0, 0, sw, sh);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(m.canvas, 0, 0, sw, sh, 0, 0, W, H);
        ctx.restore();
        break;
      }
      case 'sparkle':
        // 디졸브 + 반짝이 (반짝이는 효과 단계에서 그림)
        drawSegmentVisual(env, prev, t);
        this.composite(env, cur, t, easeInOutSine(p));
        break;
      case 'filmburn': {
        // 필름이 타들어 가듯 한쪽 가장자리에서 뜨거운 빛이 번졌다가 새 장면이 드러남
        drawSegmentVisual(env, prev, t);
        this.composite(env, cur, t, smoothstep(0.35, 0.72, p));
        const burn = Math.sin(Math.PI * p);
        if (burn > 0.001) {
          const seed = cur.kind === 'photo' ? cur.index : 5;
          const cx = hash01(seed * 3 + 1) < 0.5 ? W * 0.08 : W * 0.92;
          const cy = H * (0.2 + 0.6 * hash01(seed * 3 + 2));
          const R = lerp(260, W * 1.25, easeInOutSine(p));
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
          g.addColorStop(0, `rgba(255,250,235,${burn.toFixed(4)})`);
          g.addColorStop(0.3, `rgba(255,176,70,${(0.85 * burn).toFixed(4)})`);
          g.addColorStop(0.65, `rgba(210,70,20,${(0.5 * burn).toFixed(4)})`);
          g.addColorStop(1, 'rgba(120,20,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = `rgba(255,140,60,${(0.22 * burn).toFixed(4)})`;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
        break;
      }
      case 'rise': {
        // 새 장면이 살짝 확대된 채 아래에서 떠오르며 또렷해짐 (화면 끝이 비지 않을 만큼만)
        drawSegmentVisual(env, prev, t);
        const e = easeOutCubic(p);
        const l = this.renderToLayer(0, env, cur, t);
        const s = 1.08 - 0.08 * e;
        const lift = 40 * (1 - e);
        ctx.save();
        ctx.globalAlpha = smoothstep(0, 0.75, p);
        ctx.drawImage(l.canvas, (W - W * s) / 2, (H - H * s) / 2 + lift, W * s, H * s);
        ctx.restore();
        break;
      }
      case 'clock': {
        // 시계 바늘처럼 (이름대로 항상 시계 방향으로) 한 바퀴 돌며 새 장면을 드러냄
        drawSegmentVisual(env, prev, t);
        const e = easeInOutSine(p);
        const a0 = -Math.PI / 2;
        const a1 = a0 + e * Math.PI * 2;
        const R = Math.hypot(W, H);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(W / 2, H / 2);
        ctx.arc(W / 2, H / 2, R, a0, a1, false);
        ctx.closePath();
        ctx.clip();
        drawSegmentVisual(env, cur, t);
        ctx.restore();
        const glow = Math.sin(Math.PI * p);
        if (glow > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = `rgba(${env.theme.look.light},${(0.8 * glow).toFixed(4)})`;
          ctx.lineWidth = 4;
          ctx.shadowColor = `rgba(${env.theme.look.light},0.9)`;
          ctx.shadowBlur = 24 * k;
          ctx.beginPath();
          ctx.moveTo(W / 2, H / 2);
          ctx.lineTo(W / 2 + Math.cos(a1) * R, H / 2 + Math.sin(a1) * R);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
    }
  }

  /** 모자이크 전환용 작은 캔버스 */
  private scratch(w: number, h: number): Layer {
    let s = this.scratchLayer;
    if (!s || s.canvas.width !== w || s.canvas.height !== h) {
      const canvas = createCanvas(w, h);
      s = { canvas, ctx: get2d(canvas) };
      this.scratchLayer = s;
    }
    return s;
  }

  /** 가로로 길게 번지는 렌즈 플레어 (시네마·네온) */
  private drawFlare(env: SceneEnv, p: number): void {
    const { ctx } = env;
    const flash = Math.sin(Math.PI * p);
    if (flash <= 0.001) return;
    const rgb = env.theme.look.light;
    const x = lerp(-0.15 * W, 1.15 * W, easeInOutSine(p));
    const y = H * 0.42;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // 넓게 퍼지는 가로 빛
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.1);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.85);
    halo.addColorStop(0, `rgba(${rgb},${(0.6 * flash).toFixed(4)})`);
    halo.addColorStop(0.4, `rgba(${rgb},${(0.2 * flash).toFixed(4)})`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(-W, -W, W * 2, W * 2);
    ctx.restore();
    // 가운데 선
    const line = ctx.createLinearGradient(x - W * 0.8, 0, x + W * 0.8, 0);
    line.addColorStop(0, 'rgba(255,255,255,0)');
    line.addColorStop(0.5, `rgba(255,255,255,${(0.95 * flash).toFixed(4)})`);
    line.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = line;
    ctx.fillRect(0, y - 2.5, W, 5);
    // 광원
    const core = ctx.createRadialGradient(x, y, 0, x, y, 240);
    core.addColorStop(0, `rgba(255,255,255,${(0.9 * flash).toFixed(4)})`);
    core.addColorStop(0.3, `rgba(${rgb},${(0.45 * flash).toFixed(4)})`);
    core.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = core;
    ctx.fillRect(x - 240, y - 240, 480, 480);
    // 화면 가운데를 지나는 고스트
    for (const [fct, r, a] of [
      [0.5, 70, 0.22],
      [1.1, 34, 0.32],
      [1.6, 110, 0.14],
    ]) {
      const gx = W / 2 - (x - W / 2) * fct;
      const gy = H / 2 - (y - H / 2) * fct;
      const g = ctx.createRadialGradient(gx, gy, r * 0.55, gx, gy, r);
      g.addColorStop(0, `rgba(${rgb},${(a * 0.4 * flash).toFixed(4)})`);
      g.addColorStop(0.85, `rgba(${rgb},${(a * flash).toFixed(4)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    ctx.fillStyle = `rgba(${rgb},${(0.1 * flash).toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  private drawShiftedY(env: SceneEnv, seg: Segment, t: number, dy: number): void {
    const { ctx } = env;
    if (Math.abs(dy) >= H) return;
    ctx.save();
    ctx.translate(0, dy);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    drawSegmentVisual(env, seg, t);
    ctx.restore();
  }

  private drawLayer(env: SceneEnv, l: Layer, alpha: number, scale = 1): void {
    const { ctx } = env;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (scale !== 1) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
    }
    ctx.drawImage(l.canvas, 0, 0, W, H);
    ctx.restore();
  }

  private drawShifted(env: SceneEnv, seg: Segment, t: number, dx: number): void {
    const { ctx } = env;
    if (Math.abs(dx) >= W) return;
    ctx.save();
    ctx.translate(dx, 0);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    drawSegmentVisual(env, seg, t);
    ctx.restore();
  }

  /** 구간을 별도 레이어에 그린 뒤 투명도/확대를 적용해 합성 */
  private composite(env: SceneEnv, seg: Segment, t: number, alpha: number, scale = 1): void {
    if (alpha <= 0.001) return;
    if (alpha >= 0.999 && scale === 1) {
      drawSegmentVisual(env, seg, t);
      return;
    }
    const l = this.renderToLayer(0, env, seg, t);
    this.drawLayer(env, l, alpha, scale);
  }
}
