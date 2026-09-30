// 스타일 예시 영상: 샘플 사진으로 각 스타일의 대표 연출을 15~19초 길이로 반복 재생

import { makeBlur, type DrawableImage, type RenderAssets } from './assets';
import { DESIGN_H, DESIGN_W, createCanvas } from './design';
import { Renderer, type RenderContext } from './renderer';
import { getSamples, type SamplePhoto } from './samples';
import type { LayoutKey, Theme, ThemeId } from './themes';
import { LAYOUT_SPECS } from './timeline';
import type { PhotoSegment, SceneLayout, Segment, Timeline, TitleSegment, TransitionType, WeddingInfo } from './types';

interface DemoScene {
  key: LayoutKey | 'magazine';
  photos: string[];
  transition: TransitionType;
  label: string;
  quote?: string;
  year?: number;
  variant?: number;
}

interface DemoSpec {
  intro: string;
  outro: string;
  /** 포스터(스타일 카드 그림)로 쓸 장면 번호 */
  poster: number;
  scenes: DemoScene[];
}

export const DEMOS: Record<ThemeId, DemoSpec> = {
  romantic: {
    intro: 'beach',
    outro: 'hills',
    poster: 1,
    scenes: [
      { key: 'polaroid3', photos: ['field', 'rings', 'bouquet'], transition: 'veil', label: '베일 전환 · 폴라로이드' },
      { key: 'oval', photos: ['arch'], transition: 'petals', label: '꽃잎 전환 · 타원 액자' },
      { key: 'collage', photos: ['city', 'cake', 'beach'], transition: 'light', label: '빛 번짐 전환 · 콜라주' },
      { key: 'pair', photos: ['field', 'bouquet'], transition: 'blur', label: '몽환 전환 · 두 장 나란히' },
    ],
  },
  classic: {
    intro: 'beach',
    outro: 'hills',
    poster: 2,
    scenes: [
      { key: 'cover', photos: ['hills'], transition: 'crossfade', label: '천천히 다가가는 사진 · 연도 표시', year: 2019 },
      { key: 'contain', photos: ['bouquet'], transition: 'light', label: '빛 번짐 전환 · 액자형' },
      { key: 'collage', photos: ['field', 'city', 'cake'], transition: 'crossfade', label: '디졸브 · 콜라주' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'blur', label: '몽환 전환 · 두 장 나란히' },
    ],
  },
  modern: {
    intro: 'city',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'grid', photos: ['beach', 'hills', 'city', 'rings'], transition: 'push', label: '밀어내기 · 모자이크' },
      { key: 'filmstrip', photos: ['beach', 'field', 'hills', 'cake'], transition: 'wipe', label: '와이프 전환 · 필름 스트립' },
      { key: 'collage', photos: ['arch', 'bouquet', 'field'], transition: 'zoom', label: '줌 전환 · 콜라주' },
      { key: 'pair', photos: ['bouquet', 'cake'], transition: 'wipe', label: '와이프 전환 · 두 장 나란히' },
    ],
  },
  film: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'filmstrip', photos: ['beach', 'city', 'hills', 'field'], transition: 'light', label: '빛 새어 듦 · 필름 스트립' },
      { key: 'polaroid2', photos: ['bouquet', 'rings'], transition: 'dip-black', label: '암전 · 폴라로이드' },
      { key: 'cover', photos: ['beach'], transition: 'light', label: '필름 그레인 · 연도 표시', year: 2019 },
      { key: 'pair', photos: ['arch', 'field'], transition: 'crossfade', label: '디졸브 · 두 장 나란히' },
    ],
  },
  street: {
    intro: 'city',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'poster', photos: ['field'], transition: 'glitch', label: '글리치 전환 · 타이포 포스터' },
      { key: 'sticker3', photos: ['rings', 'bouquet', 'cake'], transition: 'push', label: '스티커 콜라주' },
      { key: 'grid', photos: ['beach', 'hills', 'city', 'arch'], transition: 'blinds', label: '블라인드 전환 · 모자이크' },
      { key: 'cover', photos: ['city'], transition: 'zoom', label: '줌 전환 · 촬영 표시' },
    ],
  },
  neon: {
    intro: 'city',
    outro: 'beach',
    poster: 2,
    scenes: [
      { key: 'cover', photos: ['city'], transition: 'flare', label: '렌즈 플레어 전환' },
      { key: 'filmstrip', photos: ['beach', 'field', 'hills', 'cake'], transition: 'glitch', label: '글리치 · 필름 스트립' },
      { key: 'poster', photos: ['bouquet'], transition: 'flare', label: '네온 포스터' },
      { key: 'pair', photos: ['arch', 'field'], transition: 'crossfade', label: '디졸브 · 두 장 나란히' },
    ],
  },
  camcorder: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'cover', photos: ['beach'], transition: 'tracking', label: '테이프 트래킹 전환 · REC 화면' },
      { key: 'contain', photos: ['field'], transition: 'glitch', label: '촬영 날짜 표시' },
      { key: 'polaroid2', photos: ['rings', 'bouquet'], transition: 'tracking', label: '폴라로이드' },
      { key: 'cover', photos: ['hills'], transition: 'dip-black', label: '연도 표시', year: 2019 },
    ],
  },
  cinema: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'cover', photos: ['hills'], transition: 'flare', label: '렌즈 플레어 · 레터박스', year: 2019 },
      { key: 'contain', photos: ['bouquet'], transition: 'crossfade', label: '액자형' },
      { key: 'cover', photos: ['city'], transition: 'dip-black', label: '암전' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'blur', label: '몽환 전환 · 두 장 나란히' },
    ],
  },
  garden: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'arch', photos: ['arch'], transition: 'petals', label: '나뭇잎 전환 · 아치 프레임' },
      { key: 'polaroid3', photos: ['field', 'bouquet', 'cake'], transition: 'ink', label: '잉크 번짐 전환 · 폴라로이드' },
      { key: 'collage', photos: ['beach', 'rings', 'city'], transition: 'light', label: '빛 번짐 · 콜라주' },
      { key: 'pair', photos: ['bouquet', 'field'], transition: 'blur', label: '몽환 전환 · 두 장 나란히' },
    ],
  },
  gallery: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'gallery3', photos: ['field', 'bouquet', 'arch'], transition: 'blinds', label: '블라인드 전환 · 전시 액자' },
      { key: 'gallery1', photos: ['rings'], transition: 'wipe', label: '작품 라벨' },
      { key: 'gallery2', photos: ['cake', 'field'], transition: 'push', label: '두 작품 나란히' },
      { key: 'grid', photos: ['beach', 'hills', 'city', 'rings'], transition: 'crossfade', label: '디졸브 · 모자이크' },
    ],
  },
};

const INTRO = 4;
const SCENE = 3.3;
const OUTRO = 3.6;
const TR = 1.0;
/** 반복 재생 경계에서 검은 화면으로 살짝 끊는 시간 */
const LOOP_FADE = 0.45;

export interface DemoCue {
  start: number;
  label: string;
}

export interface DemoTimeline {
  timeline: Timeline;
  cues: DemoCue[];
  /** 포스터용 시각 */
  posterTime: number;
}

export function buildDemoTimeline(themeId: ThemeId): DemoTimeline {
  const spec = DEMOS[themeId];
  const segments: Segment[] = [];
  const cues: DemoCue[] = [{ start: 0, label: '오프닝 타이틀' }];
  const intro: TitleSegment = {
    kind: 'intro',
    start: 0,
    end: INTRO,
    transitionIn: null,
    motion: { type: 'zoom-in', fx: 0, fy: -0.2 },
    photoId: spec.intro,
  };
  segments.push(intro);
  let prevEnd = INTRO;
  let posterTime = INTRO / 2;
  spec.scenes.forEach((sc, i) => {
    const layout: SceneLayout = sc.key === 'magazine' ? 'magazine' : LAYOUT_SPECS[sc.key].layout;
    const start = prevEnd - TR;
    const end = start + SCENE * (layout === 'magazine' ? 1.2 : 1);
    const seg: PhotoSegment = {
      kind: 'photo',
      index: i,
      start,
      end,
      transitionIn: { type: sc.transition, duration: TR, direction: 1 },
      motion: { type: i % 2 ? 'zoom-out' : 'zoom-in', fx: 0.2, fy: -0.25 },
      photoIds: sc.photos,
      layout,
      variant: sc.variant ?? i,
      repeat: false,
    };
    if (sc.quote) seg.quote = sc.quote;
    if (sc.year !== undefined) seg.year = sc.year;
    segments.push(seg);
    cues.push({ start: start + TR * 0.3, label: sc.label });
    // 포스터는 등장 연출이 끝난 뒤, 다음 장면 전환이 시작되기 전 순간으로
    if (i === spec.poster) posterTime = Math.min(start + TR + 1.6, end - TR - 0.15);
    prevEnd = end;
  });
  const outroStart = prevEnd - TR;
  segments.push({
    kind: 'outro',
    start: outroStart,
    end: outroStart + OUTRO,
    transitionIn: { type: 'crossfade', duration: TR, direction: 1 },
    motion: { type: 'zoom-out', fx: 0, fy: -0.2 },
    photoId: spec.outro,
  });
  cues.push({ start: outroStart + TR * 0.3, label: '엔딩 인사' });
  const duration = outroStart + OUTRO;
  const photoSegs = segments.filter((s): s is PhotoSegment => s.kind === 'photo');
  return {
    timeline: {
      duration,
      segments,
      sceneDuration: SCENE,
      averageSceneDuration: SCENE,
      transitionDuration: TR,
      titleTransitionDuration: TR,
      photoCount: new Set(photoSegs.flatMap((s) => s.photoIds)).size,
      sceneCount: photoSegs.length,
      repeatedScenes: 0,
      quoteCount: photoSegs.filter((s) => s.quote).length,
      layoutCount: new Set(photoSegs.map((s) => s.layout)).size,
    },
    cues,
    posterTime,
  };
}

/** 샘플 사진을 렌더러에 제공 */
export class SampleAssets implements RenderAssets {
  private readonly blurs = new Map<string, HTMLCanvasElement>();
  constructor(private readonly samples: Map<string, SamplePhoto>) {}

  image(id: string): DrawableImage | null {
    const s = this.samples.get(id);
    return s ? { image: s.canvas, width: s.canvas.width, height: s.canvas.height } : null;
  }

  blur(id: string): DrawableImage | null {
    let b = this.blurs.get(id);
    if (!b) {
      const s = this.samples.get(id);
      if (!s) return null;
      b = makeBlur(s.canvas);
      this.blurs.set(id, b);
    }
    return { image: b, width: b.width, height: b.height };
  }

  date(id: string): number | null {
    return this.samples.get(id)?.date ?? null;
  }
}

let sharedAssets: SampleAssets | null = null;
export function sampleAssets(): SampleAssets {
  sharedAssets ??= new SampleAssets(getSamples());
  return sharedAssets;
}

/** 샘플 사진의 작은 정사각형 그림 (홈 화면 장식용 JPEG data URL) */
export function sampleThumb(id: string, size = 300): string | undefined {
  const img = sampleAssets().image(id);
  if (!img) return undefined;
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  if (!g) return undefined;
  g.imageSmoothingQuality = 'high';
  const s = Math.max(size / img.width, size / img.height);
  const w = img.width * s;
  const h = img.height * s;
  // 인물이 있는 가운데 아래쪽이 보이도록 살짝 아래를 기준으로 자름
  g.drawImage(img.image, (size - w) / 2, (size - h) * 0.6, w, h);
  const url = c.toDataURL('image/jpeg', 0.84);
  c.width = c.height = 0;
  return url;
}

/** 예시 영상에 쓸 문구: 사용자가 입력한 이름·날짜가 있으면 그대로 사용 */
export function demoInfo(user: WeddingInfo): WeddingInfo {
  return {
    groom: user.groom.trim() || '민준',
    bride: user.bride.trim() || '서연',
    date: user.date || '2026-10-24',
    time: '',
    venue: '',
    introTitle: user.introTitle,
    outroMessage: '귀한 걸음 해 주셔서 감사합니다',
    outroNotice: '',
    quotes: '',
  };
}

function context(theme: Theme, info: WeddingInfo, tl: Timeline): RenderContext {
  const assets = sampleAssets();
  return { timeline: tl, theme, info, assets, photoDate: (id) => assets.date(id), textPace: 0.42 };
}

function drawLoopFade(ctx: CanvasRenderingContext2D, t: number, duration: number, k: number): void {
  const a = Math.max(1 - t / LOOP_FADE, (t - (duration - LOOP_FADE)) / LOOP_FADE);
  if (a <= 0) return;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = `rgba(0,0,0,${Math.min(1, a).toFixed(3)})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
}

/** 스타일 카드용 정지 화면 (data URL) */
export function renderPoster(theme: Theme, info: WeddingInfo, width = 480, height = 270): string {
  const canvas = createCanvas(width, height);
  const renderer = new Renderer(canvas, false);
  const demo = buildDemoTimeline(theme.id);
  renderer.render(demo.posterTime, context(theme, info, demo.timeline));
  const url = canvas.toDataURL('image/jpeg', 0.86);
  canvas.width = canvas.height = 0;
  return url;
}

export class StyleDemo {
  private readonly renderer: Renderer;
  private demo: DemoTimeline | null = null;
  private rc: RenderContext | null = null;
  private raf = 0;
  private playing = false;
  private t = 0;
  private last = 0;
  private lastDraw = 0;
  private cue = -1;
  /** 현재 보여주는 연출 이름이 바뀔 때 */
  onCue: ((label: string, index: number, total: number) => void) | null = null;
  /** 한 바퀴 다 재생하고 처음으로 돌아갈 때 */
  onLoop: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas, false);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  setTheme(theme: Theme, info: WeddingInfo, restart = true): void {
    this.demo = buildDemoTimeline(theme.id);
    this.rc = context(theme, info, this.demo.timeline);
    if (restart) this.t = 0;
    this.cue = -1;
    this.draw(this.idleTime());
  }

  /** 문구만 바뀐 경우 (재생 위치 유지) */
  setInfo(info: WeddingInfo): void {
    if (!this.rc) return;
    this.rc = { ...this.rc, info };
    if (!this.playing) this.draw(this.idleTime());
  }

  /** 재생 전(처음 위치)에는 검은 첫 프레임 대신 대표 장면을 보여줌 */
  private idleTime(): number {
    return !this.playing && this.t === 0 && this.demo ? this.demo.posterTime : this.t;
  }

  /** 멈춘 상태에서 대표 장면을 보여줌 */
  showPoster(): void {
    if (!this.demo) return;
    this.t = this.demo.posterTime;
    this.draw();
  }

  /** 특정 시각으로 이동해 그림 */
  seek(t: number): void {
    if (!this.demo) return;
    this.t = Math.max(0, Math.min(t, this.demo.timeline.duration - 0.01));
    this.draw();
  }

  get duration(): number {
    return this.demo?.timeline.duration ?? 0;
  }

  get cues(): readonly DemoCue[] {
    return this.demo?.cues ?? [];
  }

  play(): void {
    if (this.playing || !this.demo) return;
    this.playing = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  private tick = (now: number): void => {
    if (!this.playing || !this.demo) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const next = this.t + dt;
    if (next >= this.demo.timeline.duration && this.onLoop) {
      this.t = 0;
      this.onLoop();
    } else {
      this.t = next % this.demo.timeline.duration;
    }
    // 초당 30장 정도로 그려 CPU 사용을 줄임
    if (now - this.lastDraw >= 30) {
      this.lastDraw = now;
      this.draw();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private draw(at = this.t): void {
    if (!this.demo || !this.rc) return;
    this.renderer.render(at, this.rc);
    drawLoopFade(this.renderer.ctx, at, this.demo.timeline.duration, this.canvas.width / DESIGN_W);
    const cues = this.demo.cues;
    let idx = 0;
    for (let i = 0; i < cues.length; i++) if (cues[i].start <= at) idx = i;
    if (idx !== this.cue) {
      this.cue = idx;
      this.onCue?.(cues[idx].label, idx, cues.length);
    }
  }

  dispose(): void {
    this.pause();
  }
}
