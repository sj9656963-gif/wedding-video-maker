// 실시간 미리보기 플레이어: requestAnimationFrame으로 그리고, 배경음악은 Web Audio로 동기 재생

import { needsInRange, type ResolutionCache } from './assets';
import { DESIGN_H as H, DESIGN_W as W } from './design';
import { SAMPLE_RATE } from './music';
import { Renderer, START_FADE, type RenderContext } from './renderer';

/** 재생 전 표지로 보여 줄 시각(초): 오프닝 제목이 다 나온 뒤 */
const POSTER_TIME = 4.5;

export interface PreviewAudio {
  /** 믹스가 바뀌었는지 판별하는 키 */
  key: string;
  /** 키가 바뀌었을 때만 호출되어 믹스를 만듦 (큰 배열을 중복 보관하지 않기 위해 지연 생성) */
  load: () => [Float32Array, Float32Array];
}

export class PreviewPlayer {
  private readonly renderer: Renderer;
  private raf = 0;
  private playing = false;
  private loadingAudio = false;
  private t = 0;
  private audioCtx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private bufferKey = '';
  private clockBase = 0;
  private offsetBase = 0;
  private useAudioClock = false;
  private playToken = 0;
  /** 재생 위치/상태가 바뀔 때마다 호출 */
  onUpdate: ((t: number, duration: number, playing: boolean, loading: boolean) => void) | null = null;
  /** 음악을 준비하지 못했을 때 */
  onAudioError: ((message: string) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cache: ResolutionCache,
    private readonly getContext: () => RenderContext | null,
    private readonly getAudio: () => Promise<PreviewAudio | null>,
    private readonly placeholder: string,
  ) {
    this.renderer = new Renderer(canvas);
    cache.onLoad = () => {
      if (!this.playing) this.requestDraw();
    };
    this.requestDraw();
  }

  get currentTime(): number {
    return this.t;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private duration(): number {
    return this.getContext()?.timeline.duration ?? 0;
  }

  async play(): Promise<void> {
    const rc = this.getContext();
    if (!rc || this.playing) return;
    if (this.t >= rc.timeline.duration - 0.05) this.t = 0;
    const token = ++this.playToken;
    this.playing = true;
    this.loadingAudio = true;
    this.emit();
    try {
      // 사용자 클릭 직후(동기 구간)에 만들어야 자동재생 정책에 걸리지 않음
      this.audioCtx ??= new AudioContext({ sampleRate: SAMPLE_RATE });
      await this.audioCtx.resume();
      const audio = await this.getAudio();
      if (token !== this.playToken) return;
      if (audio) {
        if (audio.key !== this.bufferKey || !this.buffer) {
          const [left, right] = audio.load();
          const buf = this.audioCtx.createBuffer(2, Math.max(1, left.length), SAMPLE_RATE);
          buf.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
          buf.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
          this.buffer = buf;
          this.bufferKey = audio.key;
        }
      } else {
        this.buffer = null;
        this.bufferKey = '';
      }
    } catch (e) {
      this.buffer = null;
      this.onAudioError?.(e instanceof Error ? e.message : '음악을 재생할 수 없어요.');
    }
    if (token !== this.playToken) return;
    this.loadingAudio = false;
    this.startClock();
    this.schedule();
  }

  private startClock(): void {
    this.stopSource();
    this.offsetBase = this.t;
    this.useAudioClock = false;
    if (this.audioCtx && this.buffer && this.t < this.buffer.duration) {
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.buffer;
      src.connect(this.audioCtx.destination);
      src.start(0, this.t);
      this.source = src;
      this.clockBase = this.audioCtx.currentTime;
      this.useAudioClock = true;
    } else {
      this.clockBase = performance.now() / 1000;
    }
  }

  private now(): number {
    if (this.useAudioClock && this.audioCtx) return this.offsetBase + (this.audioCtx.currentTime - this.clockBase);
    return this.offsetBase + (performance.now() / 1000 - this.clockBase);
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* 이미 정지됨 */
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  pause(): void {
    if (!this.playing) return;
    if (!this.loadingAudio) this.t = Math.min(this.now(), this.duration());
    this.playToken++;
    this.playing = false;
    this.loadingAudio = false;
    this.stopSource();
    this.schedule();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  seek(t: number): void {
    this.t = Math.max(0, Math.min(t, this.duration()));
    if (this.playing && !this.loadingAudio) this.startClock();
    this.schedule();
  }

  /** 설정이 바뀌었을 때 호출: 길이를 넘어가면 보정하고 다시 그림. 음악이 바뀌면 재생을 다시 시작 */
  refresh(audioChanged = false): void {
    const d = this.duration();
    if (this.t > d) this.t = d;
    if (audioChanged && this.playing) {
      this.pause();
      void this.play();
      return;
    }
    this.schedule();
  }

  requestDraw(): void {
    this.schedule();
  }

  /** 다음 애니메이션 프레임에 한 번만 그리도록 예약 (재생 중이면 매 프레임 이어서 예약) */
  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    this.raf = 0;
    if (this.playing && !this.loadingAudio) {
      const d = this.duration();
      this.t = this.now();
      if (this.t >= d) {
        this.t = d;
        this.playToken++;
        this.playing = false;
        this.stopSource();
        this.draw();
        return;
      }
      this.draw();
      this.schedule();
      return;
    }
    this.draw();
  };

  private draw(): void {
    const rc = this.getContext();
    if (!rc) {
      this.drawPlaceholder();
      this.emit();
      return;
    }
    const t = this.frameTime(rc);
    this.cache.prefetch(needsInRange(rc.timeline, t - 0.5, t + 7));
    this.renderer.render(t, rc);
    this.emit();
  }

  /**
   * 그릴 시각. 영상은 검은 화면에서 밝아지며 시작하므로, 재생 전 0초에 멈춰 있으면
   * 오프닝 제목이 다 나온 장면을 표지처럼 보여 줌 (재생은 그대로 0초부터)
   */
  private frameTime(rc: RenderContext): number {
    if (this.playing || this.t > 0) return this.t;
    const first = rc.timeline.segments[0];
    const end = first ? first.end : rc.timeline.duration;
    return Math.min(POSTER_TIME, Math.max(START_FADE, end - 0.6), rc.timeline.duration);
  }

  /** 사진이 없을 때: 사이트 색(밝은/어두운 화면)에 맞춘 빈 화면 */
  private drawPlaceholder(): void {
    const { ctx, canvas } = this.renderer;
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const css = getComputedStyle(canvas);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, token('--surface-2', '#2b2420'));
    g.addColorStop(1, token('--bg-2', '#1f1a17'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const accent = token('--accent', '#eb97a7');
    // 은은한 빛
    ctx.save();
    ctx.globalAlpha = document.documentElement.dataset.theme === 'light' ? 0.07 : 0.14;
    const glow = ctx.createRadialGradient(W / 2, H / 2 - 40, 0, W / 2, H / 2 - 40, H * 0.55);
    glow.addColorStop(0, accent);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // 사진 아이콘
    const iw = 150;
    const ih = 112;
    const ix = W / 2 - iw / 2;
    const iy = H / 2 - 150;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.roundRect(ix, iy, iw, ih, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix + 22, iy + ih - 22);
    ctx.lineTo(ix + 62, iy + 52);
    ctx.lineTo(ix + 92, iy + 80);
    ctx.lineTo(ix + 108, iy + 64);
    ctx.lineTo(ix + iw - 22, iy + ih - 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix + iw - 42, iy + 36, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = token('--muted', 'rgba(255,248,236,0.85)');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 58px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
    ctx.fillText(this.placeholder, W / 2, H / 2 + 64);
  }

  private emit(): void {
    this.onUpdate?.(this.t, this.duration(), this.playing, this.loadingAudio);
  }

  dispose(): void {
    this.pause();
    this.stopSource();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }
}
