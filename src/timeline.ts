// 타임라인 계산: 사진 목록 + 목표 길이 + 스타일 → 오프닝 / 사진 장면 / 엔딩 구간과 배치·전환·움직임.
// DOM에 의존하지 않는 순수 모듈이므로 단위 테스트 대상.

import { mulberry32, pickWeighted } from './random';
import type { LayoutKey, SceneStyle } from './themes';
import type {
  Motion,
  MotionType,
  PhotoSegment,
  SceneLayout,
  Segment,
  Timeline,
  TitleSegment,
  Transition,
  TransitionType,
} from './types';

export const MIN_VIDEO_DURATION = 180; // 3분
export const MAX_VIDEO_DURATION = 300; // 5분
export const DEFAULT_INTRO_DURATION = 10;
export const DEFAULT_OUTRO_DURATION = 14;
/** 장면 하나의 최소 표시 시간(전환 포함). 이보다 짧아지면 사진이 너무 많은 것으로 판단 */
export const MIN_SCENE_DURATION = 2.6;
/** 장면이 이보다 길어지면 사진을 반복해 템포를 유지 */
export const MAX_SCENE_DURATION = 9;
/** 반복할 때 목표로 하는 장면 길이 */
export const REPEAT_SCENE_DURATION = 6.5;
/** 기본 장면이 이보다 짧아지면 한 화면에 담는 사진 수를 늘림 */
export const COMFORT_SCENE_DURATION = 4.6;
/** '자동 길이'에서 사진 한 장당 목표 시간 */
export const AUTO_SECONDS_PER_PHOTO = 3.5;
export const MIN_TRANSITION = 0.4;
export const MAX_TITLE_TRANSITION = 1.6;
/** 가로/세로 비율이 이 값 미만이면 세로 사진 */
export const PORTRAIT_MAX_ASPECT = 0.9;
/** 가로/세로 비율이 이 값 이상이면 화면 가득(cover) 배치 */
export const COVER_MIN_ASPECT = 1.3;
/** 이 값 미만이면 세로·정사각형 계열 (두 장 나란히 배치 가능) */
export const TALL_MAX_ASPECT = 1.1;
export const ZOOM_AMOUNT = 0.12;
/** 문구가 있는 장면은 읽을 시간을 조금 더 줌 */
export const QUOTE_WEIGHT = 1.4;
/** 장면당 평균 사진 수 상한 */
export const MAX_RATIO = 3.2;

export interface PhotoRef {
  id: string;
  aspect: number;
  /** 촬영 연도 (연도 챕터 표시용) */
  year?: number | null;
}

export type PlanKey = LayoutKey | 'magazine';

export interface ScenePlan {
  photoIds: string[];
  layout: SceneLayout;
  key: PlanKey;
  weight: number;
  variant: number;
  quote?: string;
  year?: number;
  repeat?: boolean;
}

interface LayoutSpec {
  layout: SceneLayout;
  count: number;
  /** 장면 길이 배율 (여러 장일수록 길게) */
  weight: number;
}

export const LAYOUT_SPECS: Record<LayoutKey, LayoutSpec> = {
  cover: { layout: 'cover', count: 1, weight: 1 },
  contain: { layout: 'contain', count: 1, weight: 1 },
  pair: { layout: 'pair', count: 2, weight: 1.3 },
  polaroid1: { layout: 'polaroid', count: 1, weight: 1.05 },
  polaroid2: { layout: 'polaroid', count: 2, weight: 1.3 },
  polaroid3: { layout: 'polaroid', count: 3, weight: 1.55 },
  collage: { layout: 'collage', count: 3, weight: 1.55 },
  grid: { layout: 'grid', count: 4, weight: 1.75 },
  oval: { layout: 'oval', count: 1, weight: 1.1 },
  filmstrip: { layout: 'filmstrip', count: 4, weight: 1.85 },
  poster: { layout: 'poster', count: 1, weight: 1.15 },
  sticker2: { layout: 'sticker', count: 2, weight: 1.35 },
  sticker3: { layout: 'sticker', count: 3, weight: 1.6 },
  gallery1: { layout: 'gallery', count: 1, weight: 1.1 },
  gallery2: { layout: 'gallery', count: 2, weight: 1.35 },
  gallery3: { layout: 'gallery', count: 3, weight: 1.6 },
  arch: { layout: 'arch', count: 1, weight: 1.1 },
};

/** 스타일을 지정하지 않았을 때: 가로는 화면 가득, 세로는 액자·두 장 나란히 */
export const DEFAULT_SCENE_STYLE: SceneStyle = { weights: { cover: 3, contain: 1, pair: 2 }, minAvg: 1 };

export interface PlanOptions {
  style?: SceneStyle;
  /** false면 한 화면에 사진 한 장씩만 */
  group?: boolean;
  /** 장면당 평균 사진 수 목표 (기본: 스타일의 minAvg) */
  ratio?: number;
  seed?: number;
}

export interface TimelineInput {
  photos: readonly PhotoRef[];
  /** 목표 길이(초). 3~5분 범위로 보정됨 */
  targetDuration: number;
  /** 테마의 기본 전환 시간(초) */
  transitionDuration: number;
  transitionTypes: readonly { type: TransitionType; weight: number }[];
  /** 장면 연출 (배치 종류와 비율). 없으면 기본 배치 */
  sceneStyle?: SceneStyle;
  /** 여러 장을 한 화면에 모아 보여주기 */
  groupPhotos: boolean;
  /** 영상 중간에 넣을 감성 문구 */
  quotes?: readonly string[];
  seed: number;
  coverId?: string | null;
  outroPhotoId?: string | null;
  introDuration?: number;
  outroDuration?: number;
}

export type TimelineErrorCode = 'no-photos' | 'too-many';

export class TimelineError extends Error {
  constructor(
    message: string,
    readonly code: TimelineErrorCode,
    readonly maxPhotos?: number,
  ) {
    super(message);
    this.name = 'TimelineError';
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function clampDuration(sec: number): number {
  if (!Number.isFinite(sec)) return MIN_VIDEO_DURATION;
  return clamp(sec, MIN_VIDEO_DURATION, MAX_VIDEO_DURATION);
}

export function isPortrait(aspect: number): boolean {
  return aspect < PORTRAIT_MAX_ASPECT;
}

export function layoutForAspect(aspect: number): 'cover' | 'contain' {
  return aspect >= COVER_MIN_ASPECT ? 'cover' : 'contain';
}

/** 기본 오프닝 사진: 화면을 꽉 채우기 좋은 첫 가로 사진 (없으면 첫 사진) */
export function defaultCoverId(photos: readonly PhotoRef[]): string | null {
  return (photos.find((p) => p.aspect >= COVER_MIN_ASPECT) ?? photos[0])?.id ?? null;
}

/** 기본 엔딩 사진: 마지막 가로 사진 (없으면 마지막 사진) */
export function defaultOutroId(photos: readonly PhotoRef[]): string | null {
  for (let i = photos.length - 1; i >= 0; i--) if (photos[i].aspect >= COVER_MIN_ASPECT) return photos[i].id;
  return photos[photos.length - 1]?.id ?? null;
}

/** 사용자가 고른 사진이 목록에 있으면 그것, 아니면 기본값 */
export function effectiveCoverId(photos: readonly PhotoRef[], chosen: string | null | undefined): string | null {
  return chosen && photos.some((p) => p.id === chosen) ? chosen : defaultCoverId(photos);
}

export function effectiveOutroId(photos: readonly PhotoRef[], chosen: string | null | undefined): string | null {
  return chosen && photos.some((p) => p.id === chosen) ? chosen : defaultOutroId(photos);
}

/** 배치와 사진 비율이 얼마나 잘 맞는지 (0이면 사용 불가) */
function fitFactor(key: LayoutKey, aspects: readonly number[]): number {
  const land = aspects.filter((a) => a >= COVER_MIN_ASPECT).length;
  const tall = aspects.filter((a) => a < TALL_MAX_ASPECT).length;
  const a0 = aspects[0];
  switch (key) {
    case 'cover':
      return a0 >= COVER_MIN_ASPECT ? 1 : 0;
    case 'contain':
      return a0 >= COVER_MIN_ASPECT ? 0.3 : 1;
    case 'pair':
      return tall === 2 ? 1 : 0;
    case 'oval':
      return a0 < 1.25 ? 1.1 : 0.5;
    case 'polaroid1':
      return a0 < 1.25 ? 1 : 0.55;
    case 'polaroid2':
    case 'polaroid3':
    case 'filmstrip':
      return 1;
    case 'collage':
      return land >= 1 || tall >= 2 ? 1 : 0.7;
    case 'grid':
      return land >= 3 || tall >= 3 ? 1 : 0.5;
    case 'poster':
      return a0 < 1.25 ? 1.1 : 0.6;
    case 'arch':
      return a0 < 1.1 ? 1.15 : 0.45;
    case 'gallery1':
    case 'sticker2':
    case 'sticker3':
    case 'gallery3':
      return 1;
    case 'gallery2':
      return tall === 2 ? 1.1 : 0.75;
  }
}

/**
 * 사진을 순서대로 장면에 나눠 담음. 스타일의 선호도·사진 비율·직전 배치와의 중복·평균 사진 수 목표를
 * 함께 고려해 무작위(시드 고정)로 고름. 모든 사진은 순서대로 정확히 한 번씩 들어감.
 */
export function planScenes(photos: readonly PhotoRef[], options: PlanOptions = {}): ScenePlan[] {
  const style = options.style ?? DEFAULT_SCENE_STYLE;
  const group = options.group ?? true;
  const ratio = Math.max(1, options.ratio ?? style.minAvg);
  const rnd = mulberry32((options.seed ?? 1) ^ 0x2c1b3c6d);
  const keys = (Object.keys(style.weights) as LayoutKey[]).filter(
    (k) => (style.weights[k] ?? 0) > 0 && (group || LAYOUT_SPECS[k].count === 1),
  );
  const scenes: ScenePlan[] = [];
  const n = photos.length;
  /** 배치별로 마지막으로 쓴 장면 번호 (오래 안 나온 배치를 조금씩 더 밀어줌) */
  const lastUsed = new Map<LayoutKey, number>();
  let used = 0;
  let i = 0;
  while (i < n) {
    const remaining = n - i;
    const idx = scenes.length;
    const last = scenes[idx - 1];
    const last2 = scenes[idx - 2];
    const candidates: { value: LayoutKey; weight: number }[] = [];
    for (const key of keys) {
      const spec = LAYOUT_SPECS[key];
      if (spec.count > remaining) continue;
      const aspects = photos.slice(i, i + spec.count).map((p) => p.aspect);
      let w = (style.weights[key] ?? 0) * fitFactor(key, aspects);
      if (w <= 0) continue;
      if (last) {
        if (last.key === key) w *= key === 'cover' ? 0.55 : 0.1;
        else if (last.layout === spec.layout) w *= 0.3;
      }
      if (last2 && last2.key === key && key !== 'cover') w *= 0.55;
      // 오래 나오지 않은 배치일수록 가능성을 높여 스타일의 대표 연출이 골고루 등장 (상한을 둬 과하지 않게)
      const gap = idx - (lastUsed.get(key) ?? -4);
      if (key !== 'cover' && gap > 6) w *= Math.min(3.2, 1 + (gap - 6) * 0.45);
      // 첫 장면은 한 장을 크게 보여줘 오프닝과 자연스럽게 이어지도록
      if (idx === 0) w *= spec.count === 1 ? (key === 'cover' ? 4 : 1.5) : 0.25;
      // 마지막 장면(엔딩 직전)도 한 장 배치를 선호
      if (spec.count === remaining) w *= spec.count === 1 ? 1.5 : 0.6;
      // 장면당 평균 사진 수가 목표에 가깝게 유지되도록 (4장 배치는 한 번에 오차가 크게 생기므로 조금 너그럽게).
      // 다양성 가중치에 상한이 있어 오차가 커지면 한 장 배치 쪽으로 확실히 되돌아옴
      const e = used + spec.count - ratio * (idx + 1);
      w *= Math.exp(-(e * e) / (spec.count >= 4 ? 4.2 : 2.9));
      candidates.push({ value: key, weight: w });
    }
    const key: LayoutKey =
      candidates.length > 0 ? pickWeighted(candidates, rnd) : photos[i].aspect >= COVER_MIN_ASPECT ? 'cover' : 'contain';
    const spec = LAYOUT_SPECS[key];
    lastUsed.set(key, idx);
    scenes.push({
      photoIds: photos.slice(i, i + spec.count).map((p) => p.id),
      layout: spec.layout,
      key,
      weight: spec.weight,
      variant: Math.floor(rnd() * 4),
    });
    used += spec.count;
    i += spec.count;
  }
  return scenes;
}

/** 촬영 연도가 바뀌는 장면에 연도 표시 (촬영일 순서로 정렬된 경우에만) */
export function assignYears(scenes: ScenePlan[], photos: readonly PhotoRef[]): void {
  const years = photos.map((p) => p.year).filter((y): y is number => typeof y === 'number' && Number.isFinite(y));
  if (years.length < Math.max(3, photos.length * 0.6)) return;
  if (new Set(years).size < 2) return;
  for (let i = 1; i < years.length; i++) if (years[i] < years[i - 1]) return;
  const byId = new Map(photos.map((p) => [p.id, p.year ?? null]));
  let current: number | null = null;
  for (const sc of scenes) {
    const y = sc.photoIds.map((id) => byId.get(id)).find((v): v is number => typeof v === 'number');
    if (y === undefined) continue;
    if (y !== current) {
      sc.year = y;
      current = y;
    }
  }
}

/** 감성 문구를 영상 전체에 고르게 배치. 한 장짜리 장면을 '사진 + 글' 장면으로 바꿈 */
export function assignQuotes(scenes: ScenePlan[], quotes: readonly string[]): number {
  const list = quotes.map((q) => q.trim()).filter(Boolean);
  const n = scenes.length;
  const q = Math.min(list.length, Math.floor((n - 2) / 5));
  if (q <= 0) return 0;
  const taken = new Set<number>();
  let placed = 0;
  for (let j = 0; j < q; j++) {
    const target = Math.round(((j + 1) * n) / (q + 1));
    let best = -1;
    for (let off = 0; off <= 3 && best < 0; off++) {
      for (const idx of off === 0 ? [target] : [target + off, target - off]) {
        if (idx < 1 || idx > n - 2 || taken.has(idx) || taken.has(idx - 1) || taken.has(idx + 1)) continue;
        if (scenes[idx].photoIds.length !== 1) continue;
        best = idx;
        break;
      }
    }
    if (best < 0) continue;
    taken.add(best);
    const sc = scenes[best];
    sc.key = 'magazine';
    sc.layout = 'magazine';
    sc.weight = Math.max(sc.weight, QUOTE_WEIGHT);
    sc.quote = list[placed];
    placed++;
  }
  return placed;
}

function titleTransitionTarget(themeTransition: number): number {
  return Math.min(MAX_TITLE_TRANSITION, Math.max(themeTransition, 1.4));
}

interface Solution {
  /** 가중치 1 장면의 표시 시간 */
  unit: number;
  /** 사진 장면 간 전환 시간 */
  d: number;
  /** 인트로→첫 장면, 마지막 장면→엔딩 전환 시간 */
  dt: number;
}

/**
 * 전체 길이 식: T = intro + outro + unit·ΣW − 2·dt − (N−1)·d
 * 전환 시간은 장면 길이에 비례해 줄어들 수 있으므로(짧은 장면에 긴 전환 방지) 고정점 반복으로 풂.
 */
function solve(
  total: number,
  intro: number,
  outro: number,
  weights: readonly number[],
  themeTransition: number,
): Solution {
  const n = weights.length;
  const sumW = weights.reduce((s, w) => s + w, 0);
  const minW = Math.min(...weights);
  const titleTarget = titleTransitionTarget(themeTransition);
  let d = themeTransition;
  let dt = titleTarget;
  let unit = 0;
  for (let i = 0; i < 100; i++) {
    unit = (total - intro - outro + 2 * dt + (n - 1) * d) / sumW;
    const minScene = unit * minW;
    const nd = Math.max(MIN_TRANSITION, Math.min(themeTransition, 0.3 * minScene));
    const ndt = Math.max(nd, Math.min(titleTarget, 0.4 * minScene));
    if (Math.abs(nd - d) < 1e-10 && Math.abs(ndt - dt) < 1e-10) break;
    d = nd;
    dt = ndt;
  }
  return { unit, d, dt };
}

interface FullPlan {
  scenes: ScenePlan[];
  /** 반복 없이 모든 사진을 한 번씩 보여주는 장면 수 */
  story: number;
  sol: Solution;
}

const weightsOf = (list: readonly ScenePlan[]) => list.map((s) => s.weight);

function planStory(input: TimelineInput, ratio: number): ScenePlan[] {
  const scenes = planScenes(input.photos, {
    style: input.sceneStyle,
    group: input.groupPhotos,
    ratio,
    seed: input.seed,
  });
  assignYears(scenes, input.photos);
  assignQuotes(scenes, input.quotes ?? []);
  return scenes;
}

/** 장면 구성과 시간 배분. 사진이 너무 많으면 null */
function makePlan(input: TimelineInput): FullPlan | null {
  const total = clampDuration(input.targetDuration);
  const intro = input.introDuration ?? DEFAULT_INTRO_DURATION;
  const outro = input.outroDuration ?? DEFAULT_OUTRO_DURATION;
  const d = input.transitionDuration;
  if (input.photos.length === 0) return { scenes: [], story: 0, sol: { unit: 0, d, dt: d } };
  const style = input.sceneStyle ?? DEFAULT_SCENE_STYLE;

  let ratio = input.groupPhotos ? Math.max(1, style.minAvg) : 1;
  let scenes = planStory(input, ratio);
  let sol = solve(total, intro, outro, weightsOf(scenes), d);
  // 사진이 많아 장면이 짧아지면 한 화면에 담는 사진 수를 늘림
  while (input.groupPhotos && sol.unit < COMFORT_SCENE_DURATION && ratio < MAX_RATIO) {
    ratio = Math.min(MAX_RATIO, ratio + 0.25);
    scenes = planStory(input, ratio);
    sol = solve(total, intro, outro, weightsOf(scenes), d);
  }
  if (sol.unit * Math.min(...weightsOf(scenes)) < MIN_SCENE_DURATION - 1e-9) return null;

  const story = scenes.length;
  // 사진이 적어 장면이 너무 길어지면, 다른 배치로 한 번 더 보여줘 템포 유지
  if (sol.unit * Math.max(...weightsOf(scenes)) > MAX_SCENE_DURATION) {
    const list = [...scenes];
    let extra: ScenePlan[] = [];
    let pass = 1;
    let s = sol;
    while (s.unit > REPEAT_SCENE_DURATION) {
      if (extra.length === 0) {
        extra = planScenes(input.photos, {
          style: input.sceneStyle,
          group: input.groupPhotos,
          ratio,
          seed: input.seed + 7919 * pass++,
        }).map((sc) => ({ ...sc, repeat: true }));
      }
      list.push(extra.shift()!);
      s = solve(total, intro, outro, weightsOf(list), d);
    }
    scenes = list;
    sol = s;
  }
  return { scenes, story, sol };
}

/** 현재 설정에서 넣을 수 있는 최대 사진 수(앞에서부터 순서 기준) */
export function maxPhotosFor(input: TimelineInput): number {
  const photos = input.photos;
  if (makePlan(input)) return photos.length;
  let lo = 0;
  let hi = photos.length; // lo는 항상 가능, hi는 불가능
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (makePlan({ ...input, photos: photos.slice(0, mid) })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** '자동' 모드의 영상 길이: 사진 한 장당 약 3.5초, 3~5분 범위로 보정 */
export function autoDuration(photoCount: number): number {
  if (photoCount <= 0) return MIN_VIDEO_DURATION;
  return clampDuration(Math.round(DEFAULT_INTRO_DURATION + DEFAULT_OUTRO_DURATION + photoCount * AUTO_SECONDS_PER_PHOTO));
}

const COVER_MOTIONS: readonly { value: MotionType; weight: number }[] = [
  { value: 'zoom-in', weight: 3 },
  { value: 'zoom-out', weight: 3 },
  { value: 'pan-left', weight: 2 },
  { value: 'pan-right', weight: 2 },
  { value: 'pan-up', weight: 1.2 },
  { value: 'pan-down', weight: 1.2 },
];

function pickMotion(layout: SceneLayout, prev: MotionType | null, rnd: () => number): Motion {
  let type: MotionType;
  if (layout === 'cover') {
    const options = COVER_MOTIONS.filter((m) => m.value !== prev);
    type = pickWeighted(options, rnd);
  } else {
    // 그 밖의 배치는 잔잔한 확대·축소만 교대로 사용
    type = prev === 'zoom-in' ? 'zoom-out' : prev === 'zoom-out' ? 'zoom-in' : rnd() < 0.5 ? 'zoom-in' : 'zoom-out';
  }
  // 얼굴이 주로 위쪽에 있으므로 세로 초점은 약간 위로 치우치게
  const fx = (rnd() * 2 - 1) * 0.5;
  const fy = rnd() * 0.7 - 0.6;
  return { type, fx, fy };
}

function pickTransition(
  types: readonly { type: TransitionType; weight: number }[],
  prev: TransitionType | null,
  rnd: () => number,
): TransitionType {
  if (types.length === 0) return 'crossfade';
  const options = types.map((t) => {
    let w = t.weight;
    // 같은 특수 전환이 연달아 나오지 않도록
    if (t.type === prev && t.type !== 'crossfade') w *= 0.12;
    return { value: t.type, weight: w };
  });
  return pickWeighted(options, rnd);
}

/** 사진 목록과 설정으로 전체 타임라인 생성 */
export function buildTimeline(input: TimelineInput): Timeline {
  const photos = input.photos;
  if (photos.length === 0) {
    throw new TimelineError('사진을 한 장 이상 추가해 주세요.', 'no-photos');
  }
  const plan = makePlan(input);
  if (!plan) {
    const maxPhotos = maxPhotosFor(input);
    throw new TimelineError(
      `사진이 너무 많아요. 선택한 길이에는 최대 ${maxPhotos}장까지 넣을 수 있어요. (현재 ${photos.length}장)`,
      'too-many',
      maxPhotos,
    );
  }
  const { scenes, story, sol } = plan;
  const total = clampDuration(input.targetDuration);
  const intro = input.introDuration ?? DEFAULT_INTRO_DURATION;

  const rnd = mulberry32(input.seed);
  const coverId = effectiveCoverId(photos, input.coverId);
  const outroId = effectiveOutroId(photos, input.outroPhotoId);

  const segments: Segment[] = [];
  const introSeg: TitleSegment = {
    kind: 'intro',
    start: 0,
    end: intro,
    transitionIn: null,
    motion: { type: 'zoom-in', fx: 0, fy: -0.2 },
    photoId: coverId,
  };
  segments.push(introSeg);

  let prevEnd = intro;
  let prevMotion: MotionType | null = null;
  let prevTransition: TransitionType | null = null;
  let pushDir: 1 | -1 = 1;
  scenes.forEach((sc, i) => {
    const tin = i === 0 ? sol.dt : sol.d;
    const start = prevEnd - tin;
    const end = start + sol.unit * sc.weight;
    let transition: Transition;
    if (i === 0) {
      transition = { type: 'crossfade', duration: tin, direction: 1 };
    } else {
      const type = pickTransition(input.transitionTypes, prevTransition, rnd);
      let direction: 1 | -1 = 1;
      if (type === 'push' || type === 'wipe' || type === 'veil') {
        direction = pushDir;
        pushDir = pushDir === 1 ? -1 : 1;
      }
      transition = { type, duration: tin, direction };
      prevTransition = type;
    }
    const motion = pickMotion(sc.layout, prevMotion, rnd);
    prevMotion = motion.type;
    const seg: PhotoSegment = {
      kind: 'photo',
      index: i,
      start,
      end,
      transitionIn: transition,
      motion,
      photoIds: sc.photoIds,
      layout: sc.layout,
      variant: sc.variant,
      repeat: sc.repeat ?? false,
    };
    if (sc.quote) seg.quote = sc.quote;
    if (sc.year !== undefined) seg.year = sc.year;
    segments.push(seg);
    prevEnd = end;
  });

  const outroSeg: TitleSegment = {
    kind: 'outro',
    start: prevEnd - sol.dt,
    // 부동소수 오차 제거: 끝은 정확히 목표 길이
    end: total,
    transitionIn: { type: 'crossfade', duration: sol.dt, direction: 1 },
    motion: { type: 'zoom-out', fx: 0, fy: -0.2 },
    photoId: outroId,
  };
  segments.push(outroSeg);

  linkSamePhotoMotion(introSeg, segments[1] as PhotoSegment, 'after');
  linkSamePhotoMotion(outroSeg, segments[segments.length - 2] as PhotoSegment, 'before');
  // 장면이 하나뿐이라 양쪽에 모두 연결된 경우 오프닝도 최종 구간을 공유
  const firstScene = segments[1] as PhotoSegment;
  if (introSeg.motionSpan && firstScene.motionSpan && introSeg.motionSpan !== firstScene.motionSpan) {
    introSeg.motionSpan = firstScene.motionSpan;
  }

  const photoSegs = segments.filter((s): s is PhotoSegment => s.kind === 'photo');
  const avg = photoSegs.reduce((s, seg) => s + (seg.end - seg.start), 0) / Math.max(1, photoSegs.length);
  return {
    duration: total,
    segments,
    sceneDuration: sol.unit,
    averageSceneDuration: avg,
    transitionDuration: sol.d,
    titleTransitionDuration: sol.dt,
    photoCount: photos.length,
    sceneCount: scenes.length,
    repeatedScenes: scenes.length - story,
    quoteCount: photoSegs.filter((s) => s.quote).length,
    layoutCount: new Set(photoSegs.map((s) => s.layout)).size,
  };
}

/**
 * 오프닝/엔딩 배경 사진이 바로 옆 장면(화면 가득 배치)과 같으면 움직임을 하나로 이어 붙임.
 * 그렇지 않으면 같은 사진이 다른 배율로 겹쳐 보이는 '이중 노출'이 생김.
 */
function linkSamePhotoMotion(title: TitleSegment, scene: PhotoSegment, side: 'after' | 'before'): void {
  if (scene.layout !== 'cover' || scene.photoIds.length !== 1 || scene.photoIds[0] !== title.photoId) return;
  const sceneSpan = scene.motionSpan ?? { start: scene.start, end: scene.end };
  const span =
    side === 'after' ? { start: title.start, end: sceneSpan.end } : { start: sceneSpan.start, end: title.end };
  title.motion = scene.motion;
  title.motionSpan = span;
  scene.motionSpan = span;
}

/** 시각 t에 보이는 구간들. 전환 중이면 [나가는 구간, 들어오는 구간] */
export function activeSegments(timeline: Timeline, t: number): [Segment] | [Segment, Segment] {
  const segs = timeline.segments;
  // start <= t 인 마지막 구간을 이진 탐색
  let lo = 0;
  let hi = segs.length - 1;
  if (t <= segs[0].start) return [segs[0]];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  const cur = segs[lo];
  const prev = segs[lo - 1];
  if (prev && t < prev.end) return [prev, cur];
  return [cur];
}

/** 구간 [t0, t1]에 등장하는 사진 id 목록 (미리 불러오기용) */
export function photoIdsInRange(timeline: Timeline, t0: number, t1: number): string[] {
  const ids: string[] = [];
  for (const seg of timeline.segments) {
    if (seg.start > t1) break;
    if (seg.end < t0) continue;
    if (seg.kind === 'photo') ids.push(...seg.photoIds);
    else if (seg.photoId) ids.push(seg.photoId);
  }
  return [...new Set(ids)];
}

/** 구간 진행도 p(0~1)에서의 켄번스 상태: s=확대 배율, ox/oy=여유 공간 대비 위치(-1~1) */
export function motionState(m: Motion, p: number): { s: number; ox: number; oy: number } {
  const q = clamp(p, 0, 1);
  switch (m.type) {
    case 'zoom-in':
      return { s: 1 + ZOOM_AMOUNT * q, ox: m.fx, oy: m.fy };
    case 'zoom-out':
      return { s: 1 + ZOOM_AMOUNT * (1 - q), ox: m.fx, oy: m.fy };
    case 'pan-right':
      return { s: 1.1, ox: lerp(-0.85, 0.85, q), oy: m.fy * 0.5 };
    case 'pan-left':
      return { s: 1.1, ox: lerp(0.85, -0.85, q), oy: m.fy * 0.5 };
    case 'pan-down':
      return { s: 1.08, ox: m.fx * 0.5, oy: lerp(-0.85, 0.85, q) };
    case 'pan-up':
      return { s: 1.08, ox: m.fx * 0.5, oy: lerp(0.85, -0.85, q) };
  }
}
