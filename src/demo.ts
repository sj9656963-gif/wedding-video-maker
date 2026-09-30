// 스타일 예시 영상: 샘플 사진으로 각 스타일의 대표 연출을 17~22초 길이로 반복 재생.
// 꾸미기에서 고른 전환·속도와 입력한 문구(이름·제목·인사말·중간 문구)가 그대로 반영되고,
// 무엇을 바꿨는지에 따라 해당 장면(오프닝·장면·전환·사진 문구·엔딩)으로 바로 이동해 보여 줌.

import { makeBlur, type DrawableImage, type RenderAssets } from './assets';
import { DESIGN_H, DESIGN_W, createCanvas } from './design';
import { hash01 } from './random';
import { Renderer, type RenderContext } from './renderer';
import { getSamples, type SamplePhoto } from './samples';
import { transitionName, type LayoutKey, type Theme, type ThemeId } from './themes';
import { LAYOUT_SPECS } from './timeline';
import type { PhotoSegment, SceneLayout, Segment, Timeline, TitleSegment, TransitionType, WeddingInfo } from './types';

interface DemoScene {
  key: LayoutKey | 'magazine';
  photos: string[];
  transition: TransitionType;
  /** 장면 설명 (전환 이름과 함께 표시) */
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
  classic: {
    intro: 'beach',
    outro: 'hills',
    poster: 2,
    scenes: [
      { key: 'cover', photos: ['hills'], transition: 'crossfade', label: '천천히 다가가는 사진 · 연도', year: 2019 },
      { key: 'contain', photos: ['bouquet'], transition: 'light', label: '액자형' },
      { key: 'collage', photos: ['field', 'city', 'cake'], transition: 'crossfade', label: '콜라주' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'blur', label: '두 장 나란히' },
    ],
  },
  romantic: {
    intro: 'beach',
    outro: 'hills',
    poster: 1,
    scenes: [
      { key: 'polaroid3', photos: ['field', 'rings', 'bouquet'], transition: 'veil', label: '폴라로이드' },
      { key: 'oval', photos: ['arch'], transition: 'petals', label: '타원 액자' },
      { key: 'collage', photos: ['city', 'cake', 'beach'], transition: 'light', label: '콜라주' },
      { key: 'pair', photos: ['field', 'bouquet'], transition: 'blur', label: '두 장 나란히' },
    ],
  },
  lovely: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'sticker3', photos: ['rings', 'bouquet', 'cake'], transition: 'rise', label: '스티커 콜라주' },
      { key: 'polaroid2', photos: ['field', 'arch'], transition: 'sparkle', label: '폴라로이드' },
      { key: 'oval', photos: ['bouquet'], transition: 'petals', label: '타원 액자' },
      { key: 'pair', photos: ['field', 'cake'], transition: 'rise', label: '두 장 나란히' },
    ],
  },
  cinema: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'cover', photos: ['hills'], transition: 'flare', label: '레터박스 · 연도', year: 2019 },
      { key: 'contain', photos: ['bouquet'], transition: 'crossfade', label: '액자형' },
      { key: 'cover', photos: ['city'], transition: 'dip-black', label: '영화 장면' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'blur', label: '두 장 나란히' },
    ],
  },
  garden: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'arch', photos: ['arch'], transition: 'petals', label: '아치 프레임' },
      { key: 'polaroid3', photos: ['field', 'bouquet', 'cake'], transition: 'ink', label: '폴라로이드' },
      { key: 'collage', photos: ['beach', 'rings', 'city'], transition: 'light', label: '콜라주' },
      { key: 'pair', photos: ['bouquet', 'field'], transition: 'blur', label: '두 장 나란히' },
    ],
  },
  fairytale: {
    intro: 'city',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'oval', photos: ['arch'], transition: 'sparkle', label: '타원 액자' },
      { key: 'cover', photos: ['hills'], transition: 'blur', label: '천천히 다가가는 사진 · 연도', year: 2019 },
      { key: 'polaroid2', photos: ['field', 'bouquet'], transition: 'iris', label: '폴라로이드' },
      { key: 'arch', photos: ['bouquet'], transition: 'rise', label: '아치 프레임' },
    ],
  },
  royal: {
    intro: 'hills',
    outro: 'beach',
    poster: 1,
    scenes: [
      { key: 'contain', photos: ['bouquet'], transition: 'light', label: '액자형' },
      { key: 'gallery1', photos: ['rings'], transition: 'sparkle', label: '전시 액자' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'crossfade', label: '두 장 나란히' },
      { key: 'oval', photos: ['cake'], transition: 'flare', label: '타원 액자' },
    ],
  },
  traditional: {
    intro: 'hills',
    outro: 'beach',
    poster: 1,
    scenes: [
      { key: 'cover', photos: ['beach'], transition: 'ink', label: '화면 가득' },
      { key: 'contain', photos: ['bouquet'], transition: 'split', label: '액자형' },
      { key: 'pair', photos: ['field', 'arch'], transition: 'petals', label: '두 장 나란히' },
      { key: 'gallery1', photos: ['rings'], transition: 'light', label: '전시 액자' },
    ],
  },
  editorial: {
    intro: 'city',
    outro: 'beach',
    poster: 1,
    scenes: [
      { key: 'cover', photos: ['hills'], transition: 'slide', label: '화보 한 장' },
      { key: 'grid', photos: ['beach', 'field', 'city', 'rings'], transition: 'flash', label: '모자이크' },
      { key: 'poster', photos: ['bouquet'], transition: 'split', label: '타이포 포스터' },
      { key: 'pair', photos: ['arch', 'cake'], transition: 'wipe', label: '두 장 나란히' },
    ],
  },
  street: {
    intro: 'city',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'poster', photos: ['field'], transition: 'glitch', label: '타이포 포스터' },
      { key: 'sticker3', photos: ['rings', 'bouquet', 'cake'], transition: 'push', label: '스티커 콜라주' },
      { key: 'grid', photos: ['beach', 'hills', 'city', 'arch'], transition: 'blinds', label: '모자이크' },
      { key: 'cover', photos: ['city'], transition: 'zoom', label: '촬영 표시' },
    ],
  },
  neon: {
    intro: 'city',
    outro: 'beach',
    poster: 2,
    scenes: [
      { key: 'cover', photos: ['city'], transition: 'flare', label: '네온 빛' },
      { key: 'filmstrip', photos: ['beach', 'field', 'hills', 'cake'], transition: 'glitch', label: '필름 스트립' },
      { key: 'poster', photos: ['bouquet'], transition: 'flare', label: '네온 포스터' },
      { key: 'pair', photos: ['arch', 'field'], transition: 'crossfade', label: '두 장 나란히' },
    ],
  },
  summer: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'polaroid3', photos: ['field', 'rings', 'cake'], transition: 'slide', label: '폴라로이드' },
      { key: 'cover', photos: ['beach'], transition: 'light', label: '햇살 가득' },
      { key: 'collage', photos: ['city', 'bouquet', 'arch'], transition: 'push', label: '콜라주' },
      { key: 'sticker2', photos: ['rings', 'field'], transition: 'rise', label: '스티커' },
    ],
  },
  retro: {
    intro: 'hills',
    outro: 'city',
    poster: 1,
    scenes: [
      { key: 'filmstrip', photos: ['beach', 'field', 'hills', 'cake'], transition: 'filmburn', label: '필름 스트립' },
      { key: 'poster', photos: ['bouquet'], transition: 'zoom', label: '타이포 포스터' },
      { key: 'polaroid2', photos: ['rings', 'arch'], transition: 'push', label: '폴라로이드' },
      { key: 'cover', photos: ['city'], transition: 'filmburn', label: '연도 표시', year: 2020 },
    ],
  },
  camcorder: {
    intro: 'beach',
    outro: 'hills',
    poster: 0,
    scenes: [
      { key: 'cover', photos: ['beach'], transition: 'tracking', label: 'REC 화면' },
      { key: 'contain', photos: ['field'], transition: 'glitch', label: '촬영 날짜 표시' },
      { key: 'polaroid2', photos: ['rings', 'bouquet'], transition: 'tracking', label: '폴라로이드' },
      { key: 'cover', photos: ['hills'], transition: 'dip-black', label: '연도 표시', year: 2019 },
    ],
  },
  film: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'filmstrip', photos: ['beach', 'city', 'hills', 'field'], transition: 'light', label: '필름 스트립' },
      { key: 'polaroid2', photos: ['bouquet', 'rings'], transition: 'dip-black', label: '폴라로이드' },
      { key: 'cover', photos: ['beach'], transition: 'light', label: '필름 그레인 · 연도', year: 2019 },
      { key: 'pair', photos: ['arch', 'field'], transition: 'crossfade', label: '두 장 나란히' },
    ],
  },
  modern: {
    intro: 'city',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'grid', photos: ['beach', 'hills', 'city', 'rings'], transition: 'push', label: '모자이크' },
      { key: 'filmstrip', photos: ['beach', 'field', 'hills', 'cake'], transition: 'wipe', label: '필름 스트립' },
      { key: 'collage', photos: ['arch', 'bouquet', 'field'], transition: 'zoom', label: '콜라주' },
      { key: 'pair', photos: ['bouquet', 'cake'], transition: 'wipe', label: '두 장 나란히' },
    ],
  },
  gallery: {
    intro: 'hills',
    outro: 'beach',
    poster: 0,
    scenes: [
      { key: 'gallery3', photos: ['field', 'bouquet', 'arch'], transition: 'blinds', label: '전시 액자' },
      { key: 'gallery1', photos: ['rings'], transition: 'wipe', label: '작품 라벨' },
      { key: 'gallery2', photos: ['cake', 'field'], transition: 'push', label: '두 작품 나란히' },
      { key: 'grid', photos: ['beach', 'hills', 'city', 'rings'], transition: 'crossfade', label: '모자이크' },
    ],
  },
};

/** 예시 사진에 붙는 문구 (사진 문구·손글씨 글꼴이 어떻게 보이는지 보여 줌) */
export const DEMO_CAPTIONS: Readonly<Record<string, string>> = {
  field: '봄 소풍',
  rings: '우리의 약속',
  cake: '첫 기념일',
};
const CAPTION_LAYOUTS = new Set<SceneLayout>(['polaroid', 'sticker', 'gallery', 'oval', 'arch']);
/** '다양하게 섞기'를 골랐을 때 예시에서 차례로 보여 줄 전환 */
const MIX_DEMO: readonly TransitionType[] = ['slide', 'sparkle', 'split', 'clock', 'veil', 'light', 'mosaic', 'rise', 'iris', 'filmburn'];
const SPEED_FACTOR = { fast: 0.65, slow: 1.4 } as const;

const INTRO = 4;
const SCENE = 3.3;
const OUTRO = 4.4;
const TR = 1.0;
/** 반복 재생 경계에서 검은 화면으로 살짝 끊는 시간 */
const LOOP_FADE = 0.45;

export interface DemoCue {
  start: number;
  label: string;
}

/** 꾸미기에서 바꾼 항목이 가장 잘 보이는 곳 */
export type DemoFocus = 'intro' | 'scene' | 'transition' | 'caption' | 'outro' | 'quote';

export interface DemoTimeline {
  timeline: Timeline;
  cues: DemoCue[];
  /** 포스터용 시각 */
  posterTime: number;
  /** 항목별로 바로 보여 줄 시각 */
  marks: Record<DemoFocus, number>;
}

function sceneTransition(theme: Theme, sc: DemoScene, i: number): TransitionType {
  const choice = theme.custom.transition;
  if (!choice) return sc.transition;
  if (choice === 'soft') return 'crossfade';
  if (choice === 'mix') return MIX_DEMO[(i + Math.floor(hash01(theme.id.length * 7) * MIX_DEMO.length)) % MIX_DEMO.length];
  return choice;
}

/** 영상 중간 문구의 첫 줄 (예시에는 한 줄만) */
function firstQuote(info?: WeddingInfo): string {
  return (info?.quotes ?? '')
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)[0] ?? '';
}

export function buildDemoTimeline(theme: Theme, info?: WeddingInfo): DemoTimeline {
  const spec = DEMOS[theme.id];
  const tr = TR * (theme.custom.speed ? SPEED_FACTOR[theme.custom.speed] : 1);
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
  const scenes = [...spec.scenes];
  const quote = firstQuote(info);
  // 중간 문구를 넣었으면 문구 장면(사진 + 글)을 하나 더 보여 줌
  if (quote) scenes.push({ key: 'magazine', photos: ['bouquet'], transition: 'crossfade', label: '영상 중간 문구', quote });
  let prevEnd = INTRO;
  let posterTime = INTRO / 2;
  const marks: Record<DemoFocus, number> = { intro: 2.35, scene: 0, transition: 0, caption: 0, outro: 0, quote: 0 };
  let captionAt = -1;
  let captionBetter = false;
  scenes.forEach((sc, i) => {
    const layout: SceneLayout = sc.key === 'magazine' ? 'magazine' : LAYOUT_SPECS[sc.key].layout;
    const start = prevEnd - tr;
    const end = start + SCENE * (layout === 'magazine' ? 1.25 : 1);
    const type = sc.key === 'magazine' ? sceneTransition(theme, spec.scenes[0], i) : sceneTransition(theme, sc, i);
    const seg: PhotoSegment = {
      kind: 'photo',
      index: i,
      start,
      end,
      transitionIn: { type, duration: tr, direction: i % 2 ? -1 : 1 },
      motion: { type: i % 2 ? 'zoom-out' : 'zoom-in', fx: 0.2, fy: -0.25 },
      photoIds: sc.photos,
      layout,
      variant: sc.variant ?? i,
      repeat: false,
    };
    if (sc.quote) seg.quote = sc.quote;
    if (sc.year !== undefined) seg.year = sc.year;
    segments.push(seg);
    cues.push({ start: start + tr * 0.3, label: `${transitionName(type)} · ${sc.label}` });
    // 포스터는 등장 연출이 끝난 뒤, 다음 장면 전환이 시작되기 전 순간으로
    if (i === spec.poster) posterTime = Math.min(start + tr + 1.6, end - tr - 0.15);
    const mid = Math.min(start + tr + 1.1, end - tr - 0.2);
    if (i === 0) marks.scene = mid;
    if (i === 1) marks.transition = Math.max(0, start - 0.3);
    if (sc.key === 'magazine') marks.quote = Math.min(start + tr + 1.6, end - tr - 0.1);
    const captioned = sc.photos.some((p) => DEMO_CAPTIONS[p]);
    if (captioned) {
      // 폴라로이드·스티커처럼 문구가 손글씨로 크게 보이는 배치를 우선
      const better = CAPTION_LAYOUTS.has(layout);
      if (captionAt < 0 || (better && !captionBetter)) {
        captionAt = i;
        captionBetter = better;
        marks.caption = Math.min(start + tr + 1.4, end - tr - 0.15);
      }
    }
    prevEnd = end;
  });
  if (captionAt < 0) marks.caption = marks.scene;
  if (!quote) marks.quote = marks.scene;
  const outroStart = prevEnd - tr;
  segments.push({
    kind: 'outro',
    start: outroStart,
    end: outroStart + OUTRO,
    transitionIn: { type: 'crossfade', duration: tr, direction: 1 },
    motion: { type: 'zoom-out', fx: 0, fy: -0.2 },
    photoId: spec.outro,
  });
  cues.push({ start: outroStart + tr * 0.3, label: '엔딩 인사' });
  marks.outro = outroStart + Math.min(OUTRO - 0.8, 2.7);
  const duration = outroStart + OUTRO;
  const photoSegs = segments.filter((s): s is PhotoSegment => s.kind === 'photo');
  return {
    timeline: {
      duration,
      segments,
      sceneDuration: SCENE,
      averageSceneDuration: SCENE,
      transitionDuration: tr,
      titleTransitionDuration: tr,
      photoCount: new Set(photoSegs.flatMap((s) => s.photoIds)).size,
      sceneCount: photoSegs.length,
      repeatedScenes: 0,
      quoteCount: photoSegs.filter((s) => s.quote).length,
      layoutCount: new Set(photoSegs.map((s) => s.layout)).size,
    },
    cues,
    posterTime,
    marks,
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

/** 예시 영상에 쓸 문구: 사용자가 입력한 문구가 있으면 그대로 사용 */
export function demoInfo(user: WeddingInfo): WeddingInfo {
  return {
    groom: user.groom.trim() || '민준',
    bride: user.bride.trim() || '서연',
    date: user.date || '2026-10-24',
    time: user.time,
    venue: user.venue,
    introTitle: user.introTitle,
    outroTitle: user.outroTitle,
    outroMessage: user.outroMessage.trim() ? user.outroMessage : '귀한 걸음 해 주셔서 감사합니다',
    outroNotice: user.outroNotice,
    quotes: user.quotes,
  };
}

function context(theme: Theme, info: WeddingInfo, tl: Timeline): RenderContext {
  const assets = sampleAssets();
  return { timeline: tl, theme, info, assets, photoDate: (id) => assets.date(id), caption: (id) => DEMO_CAPTIONS[id] ?? '', textPace: 0.42 };
}

function drawLoopFade(ctx: CanvasRenderingContext2D, t: number, duration: number, k: number): void {
  const a = Math.max(1 - t / LOOP_FADE, (t - (duration - LOOP_FADE)) / LOOP_FADE);
  if (a <= 0) return;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = `rgba(0,0,0,${Math.min(1, a).toFixed(3)})`;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
}

const posterRenderers = new Map<string, Renderer>();

/** 스타일 카드·오프닝 디자인 고르기용 정지 화면 (data URL). at = 'intro'면 오프닝 문구가 다 나온 순간 */
export function renderPoster(theme: Theme, info: WeddingInfo, width = 480, height = 270, at: 'poster' | 'intro' = 'poster'): string {
  const key = `${width}x${height}`;
  let r = posterRenderers.get(key);
  if (!r) {
    r = new Renderer(createCanvas(width, height), false);
    posterRenderers.set(key, r);
  }
  const demo = buildDemoTimeline(theme);
  r.render(at === 'intro' ? demo.marks.intro : demo.posterTime, context(theme, info, demo.timeline));
  return r.canvas.toDataURL('image/jpeg', 0.86);
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
  /** 이 시각(performance.now)까지 제자리에 멈춰 보여 줌 (0이면 멈추지 않음) */
  private holdUntil = 0;
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

  /** 스타일(테마)·문구 적용. restart=false면 재생 위치 유지 */
  setTheme(theme: Theme, info: WeddingInfo, restart = true): void {
    this.demo = buildDemoTimeline(theme, info);
    this.rc = context(theme, info, this.demo.timeline);
    if (restart) this.t = 0;
    else this.t = Math.min(this.t, this.demo.timeline.duration - 0.01);
    this.cue = -1;
    this.draw(this.idleTime());
  }

  /** 문구만 바뀐 경우 (재생 위치 유지). 중간 문구가 생기거나 없어지면 장면 구성도 다시 */
  setInfo(info: WeddingInfo): void {
    if (!this.rc) return;
    if (firstQuote(info) !== firstQuote(this.rc.info)) {
      this.setTheme(this.rc.theme, info, false);
      return;
    }
    this.rc = { ...this.rc, info };
    if (!this.playing || this.holding()) this.draw(this.idleTime());
  }

  /** 재생 전(처음 위치)에는 검은 첫 프레임 대신 대표 장면을 보여줌 */
  private idleTime(): number {
    return !this.playing && this.t === 0 && this.demo ? this.demo.posterTime : this.t;
  }

  private holding(now = performance.now()): boolean {
    return this.holdUntil > 0 && now < this.holdUntil;
  }

  /** 멈춘 상태에서 대표 장면을 보여줌 */
  showPoster(): void {
    if (!this.demo) return;
    this.t = this.demo.posterTime;
    this.draw();
  }

  /**
   * 바꾼 항목이 보이는 장면으로 바로 이동. holdMs 동안 그 화면에 멈춰 보여 준 뒤 이어서 재생
   * (Infinity면 release()까지 멈춤)
   */
  focus(target: DemoFocus, holdMs = 0): void {
    if (!this.demo) return;
    this.t = this.demo.marks[target];
    this.holdUntil = holdMs > 0 ? performance.now() + holdMs : 0;
    this.last = performance.now();
    this.cue = -1;
    this.draw();
  }

  /** focus()로 멈춰 둔 화면을 풀고 이어서 재생 */
  release(delayMs = 0): void {
    if (this.holdUntil === 0) return;
    this.holdUntil = delayMs > 0 ? performance.now() + delayMs : 0;
  }

  /** 지금 위치를 다시 그림 (글꼴을 받은 뒤 등) */
  redraw(): void {
    this.draw(this.idleTime());
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

  get marks(): Readonly<Record<DemoFocus, number>> | null {
    return this.demo?.marks ?? null;
  }

  get currentTime(): number {
    return this.t;
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
    if (this.holding(now)) {
      this.last = now;
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    this.holdUntil = 0;
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
