// 영상 스타일(테마) 17종과 스타일 안의 양식(색·연출 변형), 사용자가 직접 고르는 꾸미기(글씨체·색감·효과·전환·장식).
// 스타일 = 기본 연출 묶음, 양식 = 스타일 위에 덮어쓰는 부분 설정(patch), 꾸미기 = 그 위에 덮어쓰는 사용자 선택.
// resolveTheme()이 셋을 합쳐서 돌려줌. DOM에 의존하지 않는 순수 모듈 (단위 테스트 대상).

import { fontById, fontScale, nearestWeight } from './font-catalog';
import type { TransitionType } from './types';

export type ThemeId =
  | 'classic'
  | 'romantic'
  | 'lovely'
  | 'cinema'
  | 'garden'
  | 'fairytale'
  | 'royal'
  | 'traditional'
  | 'editorial'
  | 'street'
  | 'neon'
  | 'summer'
  | 'retro'
  | 'camcorder'
  | 'film'
  | 'modern'
  | 'gallery';

/** 스타일 고르기용 분위기 분류 */
export type MoodId = 'lovely' | 'elegant' | 'dreamy' | 'hip' | 'vintage' | 'minimal' | 'natural' | 'korean';
export const MOODS: readonly { id: MoodId; name: string }[] = [
  { id: 'lovely', name: '사랑스러운' },
  { id: 'elegant', name: '우아한' },
  { id: 'dreamy', name: '몽환적인' },
  { id: 'hip', name: '힙한' },
  { id: 'vintage', name: '빈티지' },
  { id: 'minimal', name: '모던·미니멀' },
  { id: 'natural', name: '내추럴' },
  { id: 'korean', name: '한국적인' },
];

/** 오프닝·엔딩 문구 디자인 */
export type TitleDesign =
  | 'classic'
  | 'invitation'
  | 'movie'
  | 'kinetic'
  | 'neon'
  | 'camcorder'
  | 'wreath'
  | 'exhibition'
  | 'bubbly'
  | 'hanji'
  | 'cover'
  | 'storybook'
  | 'monogram'
  | 'postcard'
  | 'sunburst'
  | 'arch';
export const TITLE_DESIGNS: readonly { id: TitleDesign; name: string; desc: string }[] = [
  { id: 'classic', name: '클래식', desc: '필기체 제목과 이름이 차례로' },
  { id: 'arch', name: '아치 프레임', desc: '금빛 아치가 그려지고 그 안에 이름이' },
  { id: 'invitation', name: '청첩장', desc: '종이 카드가 떠오르듯' },
  { id: 'movie', name: '무비 크레딧', desc: '영화 오프닝처럼' },
  { id: 'kinetic', name: '키네틱', desc: '큰 글자가 튀어 들어오는' },
  { id: 'neon', name: '네온사인', desc: '깜빡이며 켜지는 네온' },
  { id: 'camcorder', name: '캠코더', desc: '타자 치듯 한 글자씩' },
  { id: 'wreath', name: '리스', desc: '나뭇잎 화관이 그려지는' },
  { id: 'exhibition', name: '전시 포스터', desc: '갤러리 전시 안내처럼' },
  { id: 'bubbly', name: '버블', desc: '통통 튀는 글자와 말랑한 이름표' },
  { id: 'hanji', name: '한지 낙관', desc: '한지 카드에 붉은 도장' },
  { id: 'cover', name: '매거진 커버', desc: '잡지 표지 같은 제호와 커버 문구' },
  { id: 'storybook', name: '동화책', desc: '초승달과 별자리가 그려지는' },
  { id: 'monogram', name: '모노그램', desc: '금빛 문장 안의 이니셜' },
  { id: 'postcard', name: '여행 엽서', desc: '우표와 소인이 찍힌 엽서' },
  { id: 'sunburst', name: '레트로 선셋', desc: '70년대 줄무늬 해와 겹 그림자' },
];

/** 화면 위를 떠다니는 효과 */
export type ParticleKind =
  | 'petals'
  | 'roses'
  | 'hearts'
  | 'leaves'
  | 'maple'
  | 'snow'
  | 'confetti'
  | 'stars'
  | 'glitter'
  | 'goldleaf'
  | 'bubbles'
  | 'butterflies'
  | 'feathers'
  | 'balloons'
  | 'fireflies'
  | 'notes'
  | 'none';
export const PARTICLES: readonly { id: ParticleKind; name: string }[] = [
  { id: 'petals', name: '꽃잎' },
  { id: 'roses', name: '장미 꽃잎' },
  { id: 'hearts', name: '하트' },
  { id: 'leaves', name: '나뭇잎' },
  { id: 'maple', name: '단풍잎' },
  { id: 'snow', name: '눈송이' },
  { id: 'confetti', name: '컨페티' },
  { id: 'stars', name: '별' },
  { id: 'glitter', name: '금가루' },
  { id: 'goldleaf', name: '금박' },
  { id: 'bubbles', name: '비눗방울' },
  { id: 'butterflies', name: '나비' },
  { id: 'feathers', name: '깃털' },
  { id: 'balloons', name: '풍선' },
  { id: 'fireflies', name: '반딧불' },
  { id: 'notes', name: '음표' },
  { id: 'none', name: '없음' },
];
const PARTICLE_COUNT: Record<ParticleKind, number> = {
  petals: 24,
  roses: 22,
  hearts: 14,
  leaves: 16,
  maple: 16,
  snow: 70,
  confetti: 26,
  stars: 22,
  glitter: 80,
  goldleaf: 24,
  bubbles: 16,
  butterflies: 10,
  feathers: 12,
  balloons: 9,
  fireflies: 30,
  notes: 14,
  none: 0,
};

/** 영상 전체에 덧씌우는 장치 (화면 테두리·장식 포함) */
export type OverlayKind = 'letterbox' | 'camcorder' | 'datestamp' | 'vhs' | 'marks' | 'gate' | 'frame' | 'corners' | 'lace' | 'flowers' | 'deco' | 'pearls';

/** 제목 아래 구분선 가운데 장식 */
export type Ornament = 'heart' | 'diamond' | 'leaf' | 'star' | 'line' | 'flower' | 'bow' | 'rings' | 'crown' | 'none';
/** 신랑·신부 이름 사이 기호 */
export type NameJoin = 'heart' | 'amp' | 'cross' | 'rings' | 'dot' | 'and' | 'infinity';

/** 전환 효과 이름 (꾸미기·예시 영상 안내용) */
export const TRANSITIONS: readonly { id: TransitionType; name: string }[] = [
  { id: 'crossfade', name: '디졸브' },
  { id: 'dip-white', name: '화이트 페이드' },
  { id: 'dip-black', name: '블랙 페이드' },
  { id: 'push', name: '밀어내기' },
  { id: 'slide', name: '슬라이드' },
  { id: 'zoom', name: '줌' },
  { id: 'veil', name: '베일' },
  { id: 'iris', name: '원형' },
  { id: 'wipe', name: '와이프' },
  { id: 'clock', name: '시계 방향' },
  { id: 'split', name: '문 열림' },
  { id: 'blinds', name: '블라인드' },
  { id: 'blur', name: '몽환 블러' },
  { id: 'light', name: '빛 번짐' },
  { id: 'shine', name: '빛줄기' },
  { id: 'flare', name: '렌즈 플레어' },
  { id: 'sparkle', name: '반짝임' },
  { id: 'petals', name: '흩날림' },
  { id: 'rise', name: '떠오르기' },
  { id: 'page', name: '앨범 넘김' },
  { id: 'flash', name: '플래시' },
  { id: 'filmburn', name: '필름 번' },
  { id: 'ink', name: '잉크 번짐' },
  { id: 'mosaic', name: '모자이크' },
  { id: 'glitch', name: '글리치' },
  { id: 'tracking', name: '테이프 트래킹' },
];

export function transitionName(id: TransitionType): string {
  return TRANSITIONS.find((t) => t.id === id)?.name ?? id;
}

/** 장면 배치 후보. polaroid·sticker·gallery는 장수별로 구분 */
export type LayoutKey =
  | 'cover'
  | 'contain'
  | 'pair'
  | 'polaroid1'
  | 'polaroid2'
  | 'polaroid3'
  | 'collage'
  | 'grid'
  | 'oval'
  | 'filmstrip'
  | 'poster'
  | 'sticker2'
  | 'sticker3'
  | 'gallery1'
  | 'gallery2'
  | 'gallery3'
  | 'arch';

export interface SceneStyle {
  /** 배치별 선호도 (없거나 0이면 사용하지 않음) */
  weights: Partial<Record<LayoutKey, number>>;
  /** 한 장면에 들어가는 평균 사진 수의 최소 목표 (여러 장 배치를 얼마나 섞을지) */
  minAvg: number;
}

export interface ThemeLook {
  /** 여러 장 배치의 배경 (흐린 사진 위에 덮는 색) */
  backdropBase: string;
  backdropWash: string;
  backdropBlurAlpha: number;
  /** 콜라주·모자이크 사이 여백 색 */
  gap: string;
  /** 매거진(글+사진) 장면의 종이 색과 글자 색 */
  paper: string;
  paperText: string;
  paperMuted: string;
  paperAccent: string;
  magazineLabel: string;
  /** 폴라로이드 테두리, 마스킹테이프, 사진 문구(손글씨) 색 */
  frame: string;
  tape: string | null;
  caption: string;
  /** 빛 번짐·플레어 전환 색 (r,g,b) */
  light: string;
  /** 타원 액자 바깥 장식선 색 */
  frameLine: string;
  /** 제목 아래 구분선 가운데 장식 */
  ornament: Ornament;
  /** 신랑·신부 이름 사이 */
  nameJoin: NameJoin;
  /** 필름 스트립 기울기(도)와 숫자 색 */
  stripTilt: number;
  stripInk: string;
  /** 포스터·스티커 배치: 큰 글자, 바탕색, 글자색, 망점 색 */
  posterWord: string;
  posterBg: string;
  posterInk: string;
  halftone: string | null;
  /** 갤러리 배치: 벽, 액자, 매트, 작품 라벨 글자 */
  wall: string;
  frameWood: string;
  mat: string;
  labelInk: string;
}

export interface ThemeEffects {
  vignette: number;
  grain: number;
  /** 따뜻한 색감 (0~1) */
  warm: number;
  desaturate: number;
  /** 떠다니는 효과 종류와 개수 */
  particle: ParticleKind;
  particles: number;
  /** 효과 색 (없으면 종류별 기본색) */
  particleColors: string[] | null;
  bokeh: number;
  bokehColor: string;
  /** 반짝이는 별빛 개수 */
  sparkles: number;
  /** 뽀샤시한 빛 번짐 (0~1) */
  glow: number;
  flicker: boolean;
  /** 색 입히기 (soft-light) */
  tint: string | null;
  /** 색조 입히기 ('color' 합성: 밝기는 그대로 두고 색만 이 색 쪽으로. 원래 색이 강한 사진에서도 이름대로 보임) */
  hue: string | null;
  /** hue 세기 (0~1) */
  hueAmount: number;
  /** 밝은 부분에 입힐 색 (multiply: 밝은 곳일수록 이 색을 띰, 흰색이면 변화 없음) */
  highlights: string | null;
  /** 어두운 부분에 입힐 색 (screen: 어두운 곳일수록 이 색으로 들뜸, 검정이면 변화 없음) */
  shadows: string | null;
  /** 어두운 부분을 살짝 띄운 빈티지 페이드 (0~0.3) */
  fade: number;
  /** 채도 높이기 (0~0.5) */
  vivid: number;
  /** 대비 높이기 (0~0.5) */
  contrast: number;
  /** 가장자리로 따뜻한 빛이 새어 드는 필름 효과 세기 (0이면 없음) */
  leak: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** 영문 표기 (카드·쇼케이스용) */
  label: string;
  description: string;
  /** 스타일 카드에 표시할 특징 */
  highlights: string[];
  moods: MoodId[];
  badge?: string;
  /** UI 카드 미리보기 색 */
  swatch: [string, string];
  fonts: {
    /** 영문 장식 제목 (스크립트 또는 대문자 세리프) */
    title: string;
    titleWeight: number;
    titleItalic: boolean;
    /** 한글 본문 */
    body: string;
    bodyWeight: number;
    /** 본문을 굵게 쓸 때 (안내 문구·작품 라벨 등) */
    bodyBold: number;
    /** 한글 제목과 신랑·신부 이름 글꼴과 굵기 */
    name: string;
    nameWeight: number;
    /** 영문/숫자 보조 */
    latin: string;
    /** 손글씨 (폴라로이드·아치 아래 사진 문구) */
    hand: string;
    /** 굵은 강조 글꼴 (포스터 큰 글자·키네틱 제목) */
    display: string;
    displayWeight: number;
    /** 고정폭 (캠코더 화면 표시) */
    mono: string;
    /** 사용자가 영문 제목 글꼴을 직접 골랐는지 (키네틱 등 굵은 글꼴 디자인도 그 글꼴로 씀) */
    titleCustom: boolean;
  };
  /** 클래식 제목에서 'script'는 필기체, 'caps'는 자간 넓은 대문자 */
  titleStyle: 'script' | 'caps';
  titleDesign: TitleDesign;
  introScript: string;
  outroScript: string;
  colors: {
    text: string;
    accent: string;
    sub: string;
    bg: string;
    /** 인트로/엔딩 배경 사진 위 어둡게 */
    titleDim: string;
    /** 세로 사진 뒤 흐린 배경 위 어둡게 */
    sceneDim: string;
    textShadow: string;
  };
  transitionDuration: number;
  transitions: { type: TransitionType; weight: number }[];
  scene: SceneStyle;
  look: ThemeLook;
  effects: ThemeEffects;
  overlays: OverlayKind[];
  /** 세로 사진 흰 테두리 두께(px, 1920 기준) */
  photoBorder: number;
  /** 오프닝·엔딩 글자 크기 배율 */
  textScale: number;
  /** 이 스타일에서 고를 수 있는 양식 (첫 번째가 기본) */
  variants: StyleVariant[];
  /** 적용된 양식 id */
  variantId: string;
  /** 적용된 꾸미기 (스타일 기본값이면 빈 객체) */
  custom: Readonly<Customization>;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type ThemePatch = DeepPartial<Omit<Theme, 'id' | 'variants' | 'variantId' | 'custom'>>;

export interface StyleVariant {
  id: string;
  name: string;
  swatch: [string, string];
  patch: ThemePatch;
  /** 새로 생긴 양식 (양식 카드에 NEW 표시) */
  isNew?: boolean;
  /** 예시 영상 장면마다 보여 줄 전환 (없으면 스타일 예시의 전환). 이 양식의 대표 전환을 바로 보여 주려고 */
  demo?: TransitionType[];
}

const SCRIPT = 'Great Vibes';
const SERIF_KR = 'Gowun Batang';
const MYEONGJO = 'Nanum Myeongjo';
const SANS_KR = 'Noto Sans KR';
const LATIN = 'Cormorant Garamond';
const HAND = 'Nanum Pen Script';
const PRETENDARD = 'Pretendard Variable';
const ANTON = 'Anton';
const BLACK_HAN = 'Black Han Sans';
const CINZEL = 'Cinzel';
const VT = 'VT323';
const CODING = 'Nanum Gothic Coding';

/** 객체는 재귀로 합치고 배열·값은 통째로 바꿈 */
function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const b = out[k];
    const both = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b);
    out[k] = both ? merge(b, v) : v;
  }
  return out as T;
}

const BASE: Theme = {
  id: 'classic',
  name: '',
  label: '',
  description: '',
  highlights: [],
  moods: [],
  swatch: ['#222222', '#dddddd'],
  fonts: {
    title: SCRIPT,
    titleWeight: 400,
    titleItalic: false,
    body: SERIF_KR,
    bodyWeight: 400,
    bodyBold: 700,
    name: SERIF_KR,
    nameWeight: 700,
    latin: LATIN,
    hand: HAND,
    display: ANTON,
    displayWeight: 400,
    mono: VT,
    titleCustom: false,
  },
  titleStyle: 'script',
  titleDesign: 'classic',
  introScript: 'Wedding Day',
  outroScript: 'Thank you',
  colors: {
    text: '#ffffff',
    accent: '#ffffff',
    sub: 'rgba(255,255,255,0.86)',
    bg: '#111111',
    titleDim: 'rgba(0,0,0,0.45)',
    sceneDim: 'rgba(0,0,0,0.35)',
    textShadow: 'rgba(0,0,0,0.55)',
  },
  transitionDuration: 1.2,
  transitions: [{ type: 'crossfade', weight: 1 }],
  scene: { weights: { cover: 3, contain: 1, pair: 2 }, minAvg: 1.2 },
  look: {
    backdropBase: '#161412',
    backdropWash: 'rgba(0,0,0,0.45)',
    backdropBlurAlpha: 0.8,
    gap: '#ffffff',
    paper: '#f5f2ec',
    paperText: '#1f1b17',
    paperMuted: '#857b70',
    paperAccent: '#8a6a3a',
    magazineLabel: 'Our Story',
    frame: '#ffffff',
    tape: null,
    caption: '#555555',
    light: '255,236,210',
    frameLine: '#ffffff',
    ornament: 'diamond',
    nameJoin: 'heart',
    stripTilt: -1.5,
    stripInk: 'rgba(232,160,72,0.9)',
    posterWord: 'LOVE',
    posterBg: '#f2ede6',
    posterInk: '#1a1a1a',
    halftone: null,
    wall: '#f1efeb',
    frameWood: '#1c1a18',
    mat: '#fbfaf7',
    labelInk: '#1c1a18',
  },
  effects: {
    vignette: 0.2,
    grain: 0,
    warm: 0,
    desaturate: 0,
    particle: 'none',
    particles: 0,
    particleColors: null,
    bokeh: 0,
    bokehColor: '255,255,255',
    sparkles: 0,
    glow: 0,
    flicker: false,
    tint: null,
    hue: null,
    hueAmount: 0,
    highlights: null,
    shadows: null,
    fade: 0,
    vivid: 0,
    contrast: 0,
    leak: 0,
  },
  overlays: [],
  photoBorder: 10,
  textScale: 1,
  variants: [],
  variantId: '',
  custom: {},
};

/** 이름 글꼴·굵은 본문을 따로 정하지 않은 스타일은 본문 글꼴을 그대로 씀 */
function define(p: ThemePatch & { id: ThemeId; variants: StyleVariant[] }): Theme {
  const { id, variants, ...rest } = p;
  const t = merge(BASE, rest);
  const fonts = {
    ...t.fonts,
    name: rest.fonts?.name ?? t.fonts.body,
    bodyBold: rest.fonts?.bodyBold ?? t.fonts.nameWeight,
  };
  return { ...t, fonts, id, variants, variantId: variants[0]?.id ?? '', custom: {} };
}

const ALL_THEMES: Theme[] = [
  define({
    id: 'romantic',
    name: '로맨틱',
    label: 'Romantic',
    description: '타원 액자와 폴라로이드, 꽃잎과 별빛이 흐르는 사랑스러운 연출',
    highlights: ['타원 액자', '폴라로이드', '베일·꽃잎 전환', '별빛·보케'],
    moods: ['lovely', 'dreamy'],
    swatch: ['#f7d6de', '#c9707f'],
    introScript: 'Our Wedding Day',
    colors: {
      accent: '#ffd3dd',
      sub: 'rgba(255,255,255,0.9)',
      bg: '#2a1419',
      titleDim: 'rgba(92,32,52,0.42)',
      sceneDim: 'rgba(110,40,62,0.26)',
      textShadow: 'rgba(90,20,45,0.65)',
    },
    transitions: [
      { type: 'crossfade', weight: 3 },
      { type: 'veil', weight: 1.3 },
      { type: 'light', weight: 1 },
      { type: 'blur', weight: 1 },
      { type: 'petals', weight: 1 },
      { type: 'iris', weight: 0.5 },
      { type: 'dip-white', weight: 0.4 },
    ],
    scene: {
      weights: { cover: 2.3, contain: 0.7, pair: 1.4, oval: 1.3, polaroid1: 0.5, polaroid2: 1.1, polaroid3: 1.2, collage: 1.2, grid: 0.8, arch: 0.5 },
      minAvg: 1.5,
    },
    look: {
      backdropBase: '#f5dbe1',
      backdropWash: 'rgba(255,226,234,0.5)',
      backdropBlurAlpha: 0.75,
      gap: '#fff5f6',
      paper: '#fbeff0',
      paperText: '#4a2a33',
      paperMuted: '#9a7079',
      paperAccent: '#c9707f',
      magazineLabel: 'Love Story',
      frame: '#fffdfb',
      tape: 'rgba(247,186,201,0.78)',
      caption: '#8b4f5d',
      light: '255,214,226',
      ornament: 'heart',
      posterBg: '#f7d9e0',
      posterInk: '#ffffff',
      halftone: 'rgba(201,112,127,0.22)',
      wall: '#f6ecee',
      frameWood: '#fffdfb',
      labelInk: '#6b3d48',
    },
    effects: {
      vignette: 0.18,
      particle: 'petals',
      particles: 24,
      bokeh: 7,
      bokehColor: '255,214,226',
      sparkles: 30,
      glow: 0.2,
      tint: 'rgba(255,170,190,0.2)',
    },
    variants: [
      { id: 'blossom', name: '벚꽃 핑크', swatch: ['#f7d6de', '#c9707f'], patch: {} },
      {
        id: 'lavender',
        name: '라벤더 드림',
        swatch: ['#e6ddf7', '#8f78c4'],
        patch: {
          colors: { accent: '#e7dcff', titleDim: 'rgba(60,40,100,0.42)', sceneDim: 'rgba(70,50,120,0.26)', textShadow: 'rgba(50,30,90,0.6)' },
          look: { backdropBase: '#e6def5', backdropWash: 'rgba(236,228,255,0.5)', gap: '#f8f5ff', paper: '#f4f0fb', paperText: '#352b4a', paperAccent: '#8f78c4', tape: 'rgba(200,184,240,0.8)', caption: '#5f4f86', light: '226,214,255', posterBg: '#e2d8f6', halftone: 'rgba(143,120,196,0.22)', wall: '#f1edf8' },
          effects: { particleColors: ['#d9c9f5', '#c6b3ee', '#efe7ff'], bokehColor: '222,210,255', tint: 'rgba(170,150,255,0.18)' },
        },
      },
      {
        id: 'rosegold',
        name: '로즈 골드',
        swatch: ['#f3dcd4', '#b76e79'],
        patch: {
          titleDesign: 'invitation',
          colors: { accent: '#f7dcd3', titleDim: 'rgba(80,38,40,0.42)', sceneDim: 'rgba(96,48,50,0.26)', textShadow: 'rgba(70,30,32,0.6)' },
          look: {
            backdropBase: '#f3e1da',
            backdropWash: 'rgba(250,234,228,0.5)',
            gap: '#fff8f5',
            paper: '#fbf1ed',
            paperText: '#4a2c2e',
            paperAccent: '#b76e79',
            tape: 'rgba(222,178,160,0.8)',
            caption: '#8a5058',
            light: '255,222,205',
            frameLine: '#f4d3c7',
            posterBg: '#f3dcd4',
            halftone: 'rgba(183,110,121,0.2)',
            wall: '#f6ede9',
            labelInk: '#6b4043',
          },
          effects: { warm: 0.08, glow: 0.24, sparkles: 40, bokehColor: '255,222,200', tint: 'rgba(230,160,140,0.16)', particleColors: ['#f3cfc4', '#fff4ee', '#e7b7a9'] },
          scene: { weights: { oval: 2 } },
          transitions: [
            { type: 'crossfade', weight: 2.6 },
            { type: 'veil', weight: 1.8 },
            { type: 'light', weight: 1.1 },
            { type: 'petals', weight: 0.9 },
            { type: 'blur', weight: 0.7 },
          ],
        },
      },
      {
        id: 'peach',
        name: '피치 선셋',
        swatch: ['#ffd9bf', '#e98a6b'],
        patch: {
          colors: { accent: '#ffe0c7', titleDim: 'rgba(110,50,30,0.38)', sceneDim: 'rgba(120,60,40,0.24)', textShadow: 'rgba(100,40,20,0.6)' },
          look: { backdropBase: '#f8e0d2', backdropWash: 'rgba(255,232,214,0.5)', paperAccent: '#d9765a', tape: 'rgba(255,196,160,0.8)', caption: '#9a5a40', light: '255,210,170', posterBg: '#ffd9bf', halftone: 'rgba(217,118,90,0.22)' },
          effects: { warm: 0.12, glow: 0.26, bokehColor: '255,214,170', tint: 'rgba(255,160,110,0.18)', particleColors: ['#ffc7b0', '#ffd9c7', '#fff0e6'] },
        },
      },
    ],
  }),
  define({
    id: 'classic',
    name: '클래식',
    label: 'Classic',
    description: '아이보리와 골드, 빛이 번지는 우아하고 격식 있는 연출',
    highlights: ['골드 타이틀', '아치 프레임', '빛줄기 · 앨범 넘김', '두 장 나란히'],
    moods: ['elegant'],
    badge: '가장 인기',
    swatch: ['#2b2118', '#e3c98f'],
    colors: {
      text: '#fffaf0',
      accent: '#e8cf98',
      sub: 'rgba(255,250,240,0.84)',
      bg: '#17120d',
      titleDim: 'rgba(18,12,6,0.52)',
      sceneDim: 'rgba(18,12,6,0.38)',
    },
    transitions: [
      { type: 'crossfade', weight: 4 },
      { type: 'light', weight: 1.2 },
      { type: 'shine', weight: 0.8 },
      { type: 'blur', weight: 0.7 },
      { type: 'dip-white', weight: 0.3 },
    ],
    scene: { weights: { cover: 3, contain: 1.1, pair: 2.2, polaroid2: 0.5, collage: 1.2, grid: 0.5, gallery1: 0.4 }, minAvg: 1.3 },
    look: {
      backdropBase: '#1b1510',
      backdropWash: 'rgba(24,16,8,0.5)',
      backdropBlurAlpha: 0.9,
      gap: '#f4ede1',
      paper: '#f5efe4',
      paperText: '#2d241c',
      paperMuted: '#8a7b69',
      paperAccent: '#a9844c',
      frame: '#fbf8f1',
      tape: 'rgba(226,210,175,0.8)',
      caption: '#6b5a45',
      light: '255,228,178',
      frameLine: '#f3dfb3',
      wall: '#efe8dc',
      frameWood: '#b8955a',
      mat: '#fbf8f1',
      labelInk: '#3a2f22',
    },
    effects: { vignette: 0.42, warm: 0.08, bokeh: 14, bokehColor: '255,230,190', glow: 0.1 },
    variants: [
      { id: 'ivory', name: '아이보리 골드', swatch: ['#2b2118', '#e3c98f'], patch: {} },
      {
        id: 'champagne',
        name: '샴페인',
        swatch: ['#3a2d1f', '#f4e3bd'],
        patch: {
          colors: { accent: '#f6e5bf' },
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'light', weight: 2 },
            { type: 'flare', weight: 0.8 },
            { type: 'shine', weight: 0.8 },
            { type: 'blur', weight: 0.6 },
          ],
          effects: { glow: 0.2, sparkles: 16, bokeh: 20 },
        },
      },
      {
        id: 'blacktie',
        name: '블랙 타이',
        swatch: ['#0e0e0e', '#d9d9d9'],
        patch: {
          colors: { text: '#ffffff', accent: '#e6e6e6', bg: '#0b0b0b', titleDim: 'rgba(0,0,0,0.55)', sceneDim: 'rgba(0,0,0,0.42)' },
          look: { backdropBase: '#0f0f0f', gap: '#111111', paper: '#141414', paperText: '#f2f2f2', paperMuted: '#9a9a9a', paperAccent: '#d9d9d9', light: '240,240,240', frameWood: '#111111', wall: '#e9e9e7' },
          effects: { desaturate: 0.35, warm: 0, vignette: 0.5, bokehColor: '240,240,240' },
          titleDesign: 'invitation',
        },
      },
      {
        id: 'navy',
        name: '로열 네이비',
        swatch: ['#101a33', '#d9c7a0'],
        patch: {
          colors: { accent: '#e2cfa3', bg: '#0c1222', titleDim: 'rgba(8,14,34,0.55)', sceneDim: 'rgba(8,14,34,0.4)' },
          look: { backdropBase: '#101829', backdropWash: 'rgba(10,16,36,0.5)', paper: '#f3efe6', paperAccent: '#27365e', light: '220,210,190' },
          effects: { tint: 'rgba(40,70,140,0.16)', warm: 0, bokehColor: '220,215,200' },
        },
      },
      {
        // 금빛 아치 안에 이름이 그려지는 오프닝, 사선 빛줄기 전환, 천천히 떨어지는 금박
        id: 'arch',
        name: '골드 아치',
        isNew: true,
        swatch: ['#2a1f15', '#f0d9a2'],
        demo: ['shine', 'light', 'crossfade', 'shine'],
        patch: {
          titleDesign: 'arch',
          colors: { accent: '#f0d9a2' },
          look: { ornament: 'flower', nameJoin: 'amp', light: '255,214,140' },
          effects: { particle: 'goldleaf', particles: 14, sparkles: 10, glow: 0.14, bokeh: 10 },
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'shine', weight: 1.6 },
            { type: 'light', weight: 1 },
            { type: 'blur', weight: 0.5 },
          ],
        },
      },
      {
        // 밝고 하얀 예배당: 진주 테두리, 하얀 깃털, 하얀 청첩장 카드, 화이트 페이드
        id: 'chapel',
        name: '채플 화이트',
        isNew: true,
        swatch: ['#f4efe6', '#c9b38a'],
        demo: ['dip-white', 'shine', 'crossfade', 'light'],
        patch: {
          titleDesign: 'invitation',
          colors: { text: '#ffffff', accent: '#f7eedb', sub: 'rgba(255,255,255,0.9)', bg: '#211d18', titleDim: 'rgba(54,46,36,0.4)', sceneDim: 'rgba(54,46,36,0.28)', textShadow: 'rgba(58,44,28,0.62)' },
          look: {
            backdropBase: '#e9e3d8',
            backdropWash: 'rgba(255,252,246,0.42)',
            backdropBlurAlpha: 0.72,
            gap: '#ffffff',
            paper: '#ffffff',
            paperText: '#2f2a24',
            paperMuted: '#8f857a',
            paperAccent: '#b0904f',
            frame: '#ffffff',
            tape: 'rgba(236,228,212,0.85)',
            caption: '#7a6a55',
            light: '255,251,242',
            frameLine: '#ffffff',
            ornament: 'rings',
            nameJoin: 'and',
            wall: '#f6f3ee',
            frameWood: '#e6dfd2',
            mat: '#ffffff',
            labelInk: '#3a3229',
          },
          effects: { vignette: 0.1, warm: 0.03, desaturate: 0.08, fade: 0.05, highlights: 'rgb(255,251,244)', glow: 0.26, bokeh: 8, bokehColor: '255,255,255', sparkles: 12, particle: 'feathers', particles: 8 },
          overlays: ['pearls'],
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'dip-white', weight: 1.6 },
            { type: 'shine', weight: 1 },
            { type: 'light', weight: 1 },
            { type: 'blur', weight: 0.5 },
          ],
        },
      },
      {
        // 촛불이 켜진 저녁 예식: 따뜻한 호박빛, 흔들리는 촛불 빛망울, 금빛 반딧불
        id: 'candle',
        name: '캔들라이트',
        isNew: true,
        swatch: ['#1d130b', '#ffbf6e'],
        demo: ['light', 'blur', 'crossfade', 'light'],
        patch: {
          colors: { text: '#fff4e2', accent: '#ffd28e', sub: 'rgba(255,240,220,0.86)', bg: '#120b06', titleDim: 'rgba(22,11,2,0.56)', sceneDim: 'rgba(22,11,2,0.42)', textShadow: 'rgba(40,16,0,0.7)' },
          look: { backdropBase: '#1b120a', backdropWash: 'rgba(36,20,6,0.55)', light: '255,196,120', frameLine: '#ffd28e', ornament: 'star', paperAccent: '#9a6424', caption: '#7a5228' },
          effects: {
            vignette: 0.56,
            warm: 0.2,
            hue: '#ff9440',
            hueAmount: 0.18,
            highlights: 'rgb(255,230,190)',
            shadows: 'rgb(36,14,0)',
            contrast: 0.08,
            glow: 0.22,
            bokeh: 24,
            bokehColor: '255,186,100',
            particle: 'fireflies',
            particles: 22,
            particleColors: ['rgba(255,204,120,1)', 'rgba(255,226,160,1)'],
          },
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'light', weight: 1.5 },
            { type: 'blur', weight: 1 },
            { type: 'dip-black', weight: 0.6 },
          ],
        },
      },
      {
        // 1920년대 개츠비: 검정과 금빛, 계단처럼 꺾인 기하학 테두리, 대문자 제목, 금박
        id: 'deco',
        name: '아르데코',
        isNew: true,
        swatch: ['#0d0c0b', '#d8b45a'],
        demo: ['shine', 'split', 'crossfade', 'shine'],
        patch: {
          fonts: { title: CINZEL, titleWeight: 600 },
          titleStyle: 'caps',
          colors: { text: '#fbf4e2', accent: '#dcb862', sub: 'rgba(251,244,226,0.84)', bg: '#0a0a09', titleDim: 'rgba(0,0,0,0.58)', sceneDim: 'rgba(0,0,0,0.44)' },
          look: {
            backdropBase: '#0e0d0b',
            backdropWash: 'rgba(8,7,5,0.6)',
            gap: '#0e0e0d',
            paper: '#121110',
            paperText: '#f5ead0',
            paperMuted: '#a29070',
            paperAccent: '#d4af37',
            frame: '#16140f',
            tape: null,
            caption: '#e6d6ad',
            light: '255,226,160',
            frameLine: '#dcb862',
            ornament: 'diamond',
            nameJoin: 'amp',
            wall: '#1a1814',
            frameWood: '#b8902f',
            mat: '#f5efe0',
            labelInk: '#e9dcbc',
          },
          effects: { particle: 'goldleaf', particles: 22, sparkles: 16, glow: 0.12, vignette: 0.52, contrast: 0.1, desaturate: 0.15, warm: 0.04, bokeh: 6, bokehColor: '255,226,160' },
          overlays: ['deco'],
          transitions: [
            { type: 'crossfade', weight: 2.5 },
            { type: 'shine', weight: 1.6 },
            { type: 'split', weight: 0.8 },
            { type: 'dip-black', weight: 0.6 },
          ],
        },
      },
      {
        // 오래된 사진첩: 세피아 색감, 필름 그레인, 책장을 넘기는 전환, 빛바랜 종이 청첩장
        id: 'antique',
        name: '앤틱 앨범',
        isNew: true,
        swatch: ['#2e2216', '#cfae7e'],
        demo: ['page', 'crossfade', 'page', 'dip-black'],
        patch: {
          titleDesign: 'invitation',
          colors: { text: '#fbf1df', accent: '#ecd6a8', sub: 'rgba(251,241,223,0.86)', bg: '#1a130c', titleDim: 'rgba(26,17,8,0.5)', sceneDim: 'rgba(26,17,8,0.4)' },
          look: {
            backdropBase: '#2a1f14',
            backdropWash: 'rgba(40,28,14,0.5)',
            gap: '#efe2c8',
            paper: '#efe2c6',
            paperText: '#3b2b1a',
            paperMuted: '#8c7556',
            paperAccent: '#7f5a2a',
            frame: '#f4ead6',
            tape: 'rgba(214,190,150,0.85)',
            caption: '#6b4e2e',
            light: '255,222,170',
            frameLine: '#ecd6a8',
            ornament: 'leaf',
            nameJoin: 'amp',
            wall: '#e9dcc4',
            frameWood: '#6e4e2c',
            mat: '#f4ead6',
            labelInk: '#3b2b1a',
          },
          effects: { desaturate: 0.88, hue: '#a8743e', hueAmount: 0.46, fade: 0.06, grain: 0.06, vignette: 0.5, contrast: 0.08, warm: 0, glow: 0.06, bokeh: 0 },
          overlays: ['frame'],
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'page', weight: 1.6 },
            { type: 'dip-black', weight: 0.6 },
            { type: 'blur', weight: 0.4 },
          ],
        },
      },
      {
        // 요즘 스튜디오 촬영의 베이지 톤: 부드러운 린넨 색, 레이스, 크림색 꽃잎
        id: 'beige',
        name: '베이지 린넨',
        isNew: true,
        swatch: ['#e9dcc9', '#a8886a'],
        demo: ['veil', 'crossfade', 'light', 'blur'],
        patch: {
          colors: { text: '#fffaf2', accent: '#f1e2c8', sub: 'rgba(255,250,242,0.88)', bg: '#2a2219', titleDim: 'rgba(60,46,32,0.44)', sceneDim: 'rgba(60,46,32,0.3)', textShadow: 'rgba(64,46,28,0.62)' },
          look: {
            backdropBase: '#d9cbb6',
            backdropWash: 'rgba(242,232,216,0.45)',
            backdropBlurAlpha: 0.75,
            gap: '#f6efe4',
            paper: '#f6efe4',
            paperText: '#3d3226',
            paperMuted: '#93816c',
            paperAccent: '#9a7a58',
            frame: '#fbf7f0',
            tape: 'rgba(222,206,180,0.85)',
            caption: '#7c6650',
            light: '255,238,214',
            frameLine: '#f1e2c8',
            ornament: 'leaf',
            nameJoin: 'amp',
            wall: '#efe7dc',
            frameWood: '#b39a7c',
            mat: '#fbf7f0',
            labelInk: '#3d3226',
          },
          effects: {
            vignette: 0.14,
            warm: 0.1,
            desaturate: 0.18,
            fade: 0.07,
            highlights: 'rgb(255,246,232)',
            shadows: 'rgb(40,30,20)',
            glow: 0.14,
            bokeh: 6,
            bokehColor: '255,238,214',
            particle: 'petals',
            particles: 14,
            particleColors: ['#f3e6d2', '#e8d6bc', '#fbf3e6'],
          },
          overlays: ['lace'],
          transitions: [
            { type: 'crossfade', weight: 3 },
            { type: 'veil', weight: 1.3 },
            { type: 'light', weight: 1 },
            { type: 'blur', weight: 0.6 },
          ],
        },
      },
    ],
  }),
  define({
    id: 'cinema',
    name: '시네마',
    label: 'Cinema',
    description: '레터박스와 렌즈 플레어, 영화 크레딧처럼 흐르는 오프닝',
    highlights: ['무비 크레딧', '레터박스', '렌즈 플레어', '영화 색감'],
    moods: ['elegant'],
    swatch: ['#0b1417', '#e2a55f'],
    fonts: { title: CINZEL, titleWeight: 600, body: MYEONGJO, latin: CINZEL, display: CINZEL, displayWeight: 600 },
    titleStyle: 'caps',
    titleDesign: 'movie',
    introScript: 'A Love Story',
    outroScript: 'The Beginning',
    colors: {
      text: '#f4efe6',
      accent: '#e2c48f',
      sub: 'rgba(244,239,230,0.85)',
      bg: '#050505',
      titleDim: 'rgba(0,0,0,0.5)',
      sceneDim: 'rgba(0,0,0,0.4)',
      textShadow: 'rgba(0,0,0,0.7)',
    },
    transitionDuration: 1.3,
    transitions: [
      { type: 'crossfade', weight: 2.2 },
      { type: 'flare', weight: 1.4 },
      { type: 'dip-black', weight: 1 },
      { type: 'blur', weight: 0.6 },
      { type: 'zoom', weight: 0.3 },
    ],
    scene: { weights: { cover: 3.4, contain: 1, pair: 1, filmstrip: 0.5, collage: 0.4 }, minAvg: 1.15 },
    look: {
      backdropBase: '#0a0a0a',
      backdropWash: 'rgba(0,0,0,0.5)',
      gap: '#0a0a0a',
      paper: '#0c0b0a',
      paperText: '#f4efe6',
      paperMuted: '#9d948a',
      paperAccent: '#e2c48f',
      magazineLabel: 'Chapter',
      frame: '#f4efe6',
      light: '255,190,120',
      nameJoin: 'amp',
      stripInk: 'rgba(226,196,143,0.9)',
    },
    effects: { vignette: 0.5, grain: 0.035, warm: 0.12, desaturate: 0.08, glow: 0.08, tint: 'rgba(0,110,140,0.14)' },
    overlays: ['letterbox'],
    photoBorder: 0,
    variants: [
      { id: 'teal', name: '틸 & 오렌지', swatch: ['#0b1417', '#e2a55f'], patch: {} },
      {
        id: 'golden',
        name: '골든아워',
        swatch: ['#2a1a0c', '#ffc27a'],
        patch: { effects: { warm: 0.35, tint: 'rgba(255,170,90,0.14)', glow: 0.14 }, look: { light: '255,200,130' } },
      },
      {
        id: 'noir',
        name: '느와르 흑백',
        swatch: ['#0a0a0a', '#f0f0f0'],
        patch: { colors: { accent: '#ffffff' }, effects: { desaturate: 1, warm: 0, tint: null, grain: 0.07, vignette: 0.62 }, look: { light: '255,255,255', paperAccent: '#ffffff' } },
      },
    ],
  }),
  define({
    id: 'garden',
    name: '가든',
    label: 'Garden',
    description: '아치형 프레임과 나뭇잎 화관, 싱그러운 초록빛 연출',
    highlights: ['아치 프레임', '리스 타이틀', '나뭇잎 흩날림', '잉크 번짐 전환'],
    moods: ['natural', 'lovely'],
    swatch: ['#dfe8d0', '#5f7f45'],
    titleDesign: 'wreath',
    introScript: 'Our Wedding Day',
    colors: {
      accent: '#eef5de',
      sub: 'rgba(255,255,255,0.9)',
      bg: '#141a12',
      titleDim: 'rgba(24,36,20,0.42)',
      sceneDim: 'rgba(24,36,20,0.3)',
      textShadow: 'rgba(20,30,15,0.6)',
    },
    transitions: [
      { type: 'crossfade', weight: 2.6 },
      { type: 'petals', weight: 1.1 },
      { type: 'ink', weight: 1 },
      { type: 'light', weight: 0.9 },
      { type: 'blur', weight: 0.9 },
    ],
    scene: { weights: { cover: 2.4, contain: 0.7, pair: 1.2, arch: 1.6, polaroid2: 0.8, polaroid3: 0.7, collage: 1, gallery2: 0.3 }, minAvg: 1.4 },
    look: {
      backdropBase: '#e9efdf',
      backdropWash: 'rgba(236,244,226,0.5)',
      backdropBlurAlpha: 0.7,
      gap: '#f7f8f1',
      paper: '#f3f2e8',
      paperText: '#2f3a28',
      paperMuted: '#7d8870',
      paperAccent: '#6f8a52',
      magazineLabel: 'Our Garden',
      frame: '#fffef8',
      tape: 'rgba(190,210,160,0.8)',
      caption: '#4d5e3c',
      light: '240,255,210',
      ornament: 'leaf',
      posterBg: '#dfe8d0',
      posterInk: '#ffffff',
      halftone: 'rgba(95,127,69,0.2)',
      wall: '#eef1e6',
      frameWood: '#fffef8',
      labelInk: '#33402b',
    },
    effects: { particle: 'leaves', particles: 16, bokeh: 8, bokehColor: '235,255,200', sparkles: 10, glow: 0.14, tint: 'rgba(170,210,130,0.14)' },
    variants: [
      { id: 'greenery', name: '그리너리', swatch: ['#dfe8d0', '#5f7f45'], patch: {} },
      {
        id: 'flower',
        name: '플라워',
        swatch: ['#fbe3ea', '#d97a98'],
        patch: {
          colors: { accent: '#ffe3ec' },
          effects: { particle: 'petals', particles: 22, particleColors: ['#ffc3d4', '#ffffff', '#ffd9e4'], tint: 'rgba(255,190,210,0.14)' },
          look: { paperAccent: '#c46a88', caption: '#8a4a60', posterBg: '#fbe3ea', halftone: 'rgba(217,122,152,0.2)' },
        },
      },
      {
        id: 'autumn',
        name: '가을 단풍',
        swatch: ['#f3dcc0', '#c2562d'],
        patch: {
          colors: { accent: '#ffe4c2', titleDim: 'rgba(50,26,10,0.42)', sceneDim: 'rgba(50,26,10,0.3)', textShadow: 'rgba(50,20,5,0.6)' },
          effects: { particleColors: ['#d9622b', '#e89b3a', '#c2452d', '#f0c05a'], warm: 0.2, tint: 'rgba(255,150,60,0.16)', bokehColor: '255,210,150' },
          look: { backdropBase: '#f1e3cf', backdropWash: 'rgba(250,236,214,0.5)', paperAccent: '#b4552e', caption: '#7a3f22', light: '255,214,160', posterBg: '#f3dcc0', halftone: 'rgba(194,86,45,0.2)' },
        },
      },
      {
        id: 'winter',
        name: '겨울 눈꽃',
        swatch: ['#e3ebf5', '#6f8db3'],
        patch: {
          colors: { accent: '#eaf2ff', titleDim: 'rgba(20,32,56,0.42)', sceneDim: 'rgba(20,32,56,0.3)', textShadow: 'rgba(20,30,60,0.6)' },
          effects: { particle: 'snow', particles: 70, tint: 'rgba(170,200,255,0.16)', desaturate: 0.1, bokehColor: '225,238,255' },
          look: { backdropBase: '#e6edf5', backdropWash: 'rgba(236,242,250,0.5)', paperAccent: '#5a7aa3', caption: '#3f5578', light: '230,240,255', ornament: 'star', posterBg: '#e3ebf5', halftone: 'rgba(111,141,179,0.2)' },
          transitions: [
            { type: 'crossfade', weight: 2.6 },
            { type: 'blur', weight: 1.2 },
            { type: 'light', weight: 1 },
            { type: 'dip-white', weight: 0.8 },
            { type: 'ink', weight: 0.6 },
          ],
        },
      },
    ],
  }),
  define({
    id: 'street',
    name: '스트릿',
    label: 'Street',
    description: '큰 글자 포스터와 스티커 콜라주, 글리치로 톡톡 튀는 힙한 무드',
    highlights: ['포스터 타이포', '스티커 콜라주', '글리치 전환', '키네틱 타이틀'],
    moods: ['hip'],
    badge: 'HOT',
    swatch: ['#111111', '#e8ff3a'],
    fonts: { title: ANTON, body: BLACK_HAN, bodyWeight: 400, nameWeight: 400, latin: ANTON, display: ANTON, mono: VT },
    titleStyle: 'caps',
    titleDesign: 'kinetic',
    introScript: 'We Are Getting Married',
    outroScript: 'Thank You',
    colors: {
      accent: '#e8ff3a',
      sub: 'rgba(255,255,255,0.92)',
      bg: '#111111',
      titleDim: 'rgba(10,10,10,0.5)',
      sceneDim: 'rgba(0,0,0,0.3)',
      textShadow: 'rgba(0,0,0,0.4)',
    },
    transitionDuration: 0.6,
    transitions: [
      { type: 'glitch', weight: 2 },
      { type: 'push', weight: 1.4 },
      { type: 'zoom', weight: 1.1 },
      { type: 'blinds', weight: 0.8 },
      { type: 'wipe', weight: 0.7 },
      { type: 'mosaic', weight: 0.5 },
      { type: 'crossfade', weight: 0.8 },
    ],
    scene: { weights: { cover: 2.4, contain: 0.4, pair: 0.6, poster: 1.6, sticker2: 1.3, sticker3: 1.1, grid: 1.1, collage: 0.7, filmstrip: 0.5 }, minAvg: 1.45 },
    look: {
      backdropBase: '#111111',
      backdropWash: 'rgba(0,0,0,0.35)',
      backdropBlurAlpha: 0.55,
      gap: '#111111',
      paper: '#111111',
      paperText: '#ffffff',
      paperMuted: '#b5b5b5',
      paperAccent: '#e8ff3a',
      magazineLabel: 'OUR STORY',
      frame: '#ffffff',
      tape: 'rgba(255,255,255,0.85)',
      caption: '#111111',
      light: '232,255,58',
      ornament: 'star',
      nameJoin: 'cross',
      stripTilt: -3,
      stripInk: 'rgba(232,255,58,0.95)',
      posterWord: 'LOVE',
      posterBg: '#e8ff3a',
      posterInk: '#111111',
      halftone: 'rgba(0,0,0,0.13)',
    },
    effects: { vignette: 0.12, grain: 0.05, particleColors: ['#ff3d8b', '#e8ff3a', '#3ee8ff', '#ffffff', '#ff9a3c'] },
    overlays: ['marks'],
    photoBorder: 12,
    variants: [
      { id: 'acid', name: '애시드 옐로', swatch: ['#111111', '#e8ff3a'], patch: {} },
      {
        id: 'pop',
        name: '핫핑크 팝',
        swatch: ['#1a0a12', '#ff3d8b'],
        patch: {
          colors: { accent: '#ff5fa2' },
          look: { posterBg: '#ff3d8b', posterInk: '#ffffff', paperAccent: '#ff5fa2', light: '255,95,162', stripInk: 'rgba(255,95,162,0.95)', halftone: 'rgba(0,0,0,0.12)' },
          effects: { particle: 'confetti', particles: 18 },
        },
      },
      {
        id: 'citypop',
        name: '시티팝',
        swatch: ['#ffb3d1', '#5bc8ff'],
        patch: {
          colors: { accent: '#8fe3ff' },
          look: { posterBg: '#ffb3d1', posterInk: '#1b2a6b', paperAccent: '#8fe3ff', light: '140,220,255', halftone: 'rgba(27,42,107,0.14)' },
          effects: { tint: 'rgba(255,150,210,0.14)', glow: 0.1, grain: 0.03 },
        },
      },
      {
        id: 'graffiti',
        name: '모노 그래피티',
        swatch: ['#1a1a1a', '#ffffff'],
        patch: {
          colors: { accent: '#ffffff' },
          look: { posterBg: '#1a1a1a', posterInk: '#ffffff', paperAccent: '#ffffff', light: '255,255,255', stripInk: 'rgba(255,255,255,0.9)', halftone: 'rgba(255,255,255,0.08)' },
          effects: { desaturate: 0.65, grain: 0.08, vignette: 0.3 },
        },
      },
    ],
  }),
  define({
    id: 'neon',
    name: '네온',
    label: 'Neon',
    description: '밤거리 네온사인처럼 빛나는 타이틀과 플레어, 시크한 나이트 무드',
    highlights: ['네온사인 타이틀', '렌즈 플레어', '글리치', '빛망울'],
    moods: ['hip'],
    swatch: ['#0b0718', '#ff4fd8'],
    fonts: { title: SCRIPT, body: PRETENDARD, bodyWeight: 500, nameWeight: 700, latin: LATIN, display: ANTON },
    titleDesign: 'neon',
    introScript: 'Wedding Night',
    colors: {
      accent: '#ff4fd8',
      sub: 'rgba(255,255,255,0.86)',
      bg: '#07060d',
      titleDim: 'rgba(8,4,20,0.62)',
      sceneDim: 'rgba(10,6,24,0.45)',
      textShadow: 'rgba(0,0,0,0.6)',
    },
    transitionDuration: 0.9,
    transitions: [
      { type: 'flare', weight: 1.4 },
      { type: 'glitch', weight: 1 },
      { type: 'crossfade', weight: 1.5 },
      { type: 'zoom', weight: 0.9 },
      { type: 'iris', weight: 0.5 },
    ],
    scene: { weights: { cover: 2.6, contain: 1, pair: 1.2, filmstrip: 1, grid: 0.9, collage: 0.8, poster: 0.7 }, minAvg: 1.35 },
    look: {
      backdropBase: '#0b0718',
      backdropWash: 'rgba(20,6,40,0.55)',
      backdropBlurAlpha: 0.6,
      gap: '#0b0718',
      paper: '#0e0a1c',
      paperText: '#ffffff',
      paperMuted: '#a99fc9',
      paperAccent: '#ff4fd8',
      magazineLabel: 'Tonight',
      frame: '#f5f0ff',
      caption: '#3b2a5c',
      light: '255,79,216',
      frameLine: '#ff4fd8',
      ornament: 'star',
      stripInk: 'rgba(255,79,216,0.95)',
      posterWord: 'FOREVER',
      posterBg: '#120a26',
      posterInk: '#ff4fd8',
      halftone: 'rgba(255,79,216,0.12)',
    },
    effects: { vignette: 0.45, bokeh: 18, bokehColor: '255,90,220', glow: 0.22, tint: 'rgba(120,60,255,0.16)' },
    photoBorder: 0,
    variants: [
      { id: 'pink', name: '핑크 네온', swatch: ['#0b0718', '#ff4fd8'], patch: {} },
      {
        id: 'cyber',
        name: '사이버 블루',
        swatch: ['#040b1a', '#3ee8ff'],
        patch: {
          colors: { accent: '#3ee8ff' },
          look: { light: '62,232,255', frameLine: '#3ee8ff', paperAccent: '#3ee8ff', stripInk: 'rgba(62,232,255,0.95)', posterInk: '#3ee8ff', halftone: 'rgba(62,232,255,0.12)' },
          effects: { bokehColor: '62,232,255', tint: 'rgba(40,120,255,0.18)' },
        },
      },
      {
        id: 'sunset',
        name: '선셋 네온',
        swatch: ['#1a0708', '#ff9a3c'],
        patch: {
          colors: { accent: '#ffa24d' },
          look: { light: '255,154,60', frameLine: '#ffa24d', paperAccent: '#ffa24d', stripInk: 'rgba(255,162,77,0.95)', posterInk: '#ffa24d', halftone: 'rgba(255,162,77,0.12)' },
          effects: { bokehColor: '255,150,80', tint: 'rgba(255,90,60,0.16)' },
        },
      },
    ],
  }),
  define({
    id: 'camcorder',
    name: 'Y2K 캠코더',
    label: 'Camcorder',
    description: 'REC 표시와 날짜 스탬프, 테이프 감기는 전환의 레트로 홈비디오',
    highlights: ['REC 화면', '날짜 스탬프', '트래킹 전환', '타자 타이틀'],
    moods: ['hip', 'vintage'],
    swatch: ['#1b2230', '#ff5b4a'],
    fonts: { title: VT, body: CODING, bodyWeight: 700, nameWeight: 700, latin: VT, display: VT, mono: VT },
    titleStyle: 'caps',
    titleDesign: 'camcorder',
    introScript: 'Our Wedding Tape',
    outroScript: 'Thank You',
    colors: {
      accent: '#ffffff',
      sub: 'rgba(255,255,255,0.92)',
      bg: '#050505',
      titleDim: 'rgba(0,0,0,0.38)',
      sceneDim: 'rgba(0,0,0,0.3)',
      textShadow: 'rgba(0,0,0,0.9)',
    },
    transitionDuration: 0.7,
    transitions: [
      { type: 'tracking', weight: 2 },
      { type: 'glitch', weight: 1 },
      { type: 'crossfade', weight: 1.2 },
      { type: 'dip-black', weight: 0.6 },
      { type: 'push', weight: 0.4 },
    ],
    scene: { weights: { cover: 3, contain: 1.2, pair: 1, polaroid2: 0.5, grid: 0.6, filmstrip: 0.4 }, minAvg: 1.25 },
    look: {
      backdropBase: '#101010',
      gap: '#101010',
      paper: '#0d0f14',
      paperText: '#ffffff',
      paperMuted: '#aab2c0',
      paperAccent: '#ff5b4a',
      magazineLabel: 'TAPE 01',
      tape: 'rgba(255,255,255,0.8)',
      caption: '#333333',
      light: '255,255,255',
      ornament: 'line',
      nameJoin: 'amp',
      stripInk: 'rgba(255,255,255,0.85)',
    },
    effects: { vignette: 0.35, grain: 0.07, warm: 0.1, desaturate: 0.12, glow: 0.08, tint: 'rgba(90,140,255,0.08)' },
    overlays: ['camcorder', 'vhs'],
    photoBorder: 0,
    variants: [
      { id: 'vhs', name: 'VHS 90s', swatch: ['#1b2230', '#ff5b4a'], patch: {} },
      {
        id: 'digicam',
        name: 'Y2K 디카',
        swatch: ['#2a2622', '#ff9a3c'],
        patch: { overlays: ['datestamp'], effects: { grain: 0.04, warm: 0.14, desaturate: 0.05, tint: 'rgba(255,200,120,0.1)', glow: 0.14 }, photoBorder: 0 },
      },
      {
        id: 'home',
        name: '홈비디오 웜',
        swatch: ['#2a1d14', '#ffd08a'],
        patch: { overlays: ['camcorder'], effects: { warm: 0.3, grain: 0.1, desaturate: 0.2, tint: null } },
      },
    ],
  }),
  define({
    id: 'film',
    name: '필름',
    label: 'Film',
    description: '따뜻한 색감과 필름 그레인, 빛 새어 듦이 있는 빈티지 무드',
    highlights: ['필름 스트립', '폴라로이드', '빛 새어 듦', '필름 그레인'],
    moods: ['vintage'],
    swatch: ['#3a2a1c', '#e0b77a'],
    fonts: { body: MYEONGJO },
    introScript: 'Our Story',
    colors: {
      text: '#f7eedc',
      accent: '#e9c48a',
      sub: 'rgba(247,238,220,0.84)',
      bg: '#1a130c',
      titleDim: 'rgba(30,18,6,0.5)',
      sceneDim: 'rgba(30,18,6,0.4)',
      textShadow: 'rgba(0,0,0,0.6)',
    },
    transitions: [
      { type: 'crossfade', weight: 3 },
      { type: 'light', weight: 1.6 },
      { type: 'dip-black', weight: 1 },
      { type: 'blur', weight: 0.4 },
    ],
    scene: { weights: { cover: 3, contain: 0.8, pair: 1.3, polaroid2: 1, polaroid3: 0.8, filmstrip: 1.4, collage: 0.8, grid: 0.4 }, minAvg: 1.4 },
    look: {
      backdropBase: '#20170f',
      backdropWash: 'rgba(30,20,10,0.52)',
      backdropBlurAlpha: 0.75,
      gap: '#efe3cf',
      paper: '#efe3cf',
      paperText: '#35271a',
      paperMuted: '#8c7a62',
      paperAccent: '#b0703a',
      frame: '#f6efe2',
      tape: 'rgba(196,164,120,0.78)',
      caption: '#5a4632',
      light: '255,150,70',
      frameLine: '#f6efe2',
      stripTilt: -2.2,
    },
    effects: { vignette: 0.55, grain: 0.09, warm: 0.3, desaturate: 0.18, bokehColor: '255,200,140', glow: 0.06, flicker: true, leak: 1 },
    photoBorder: 12,
    variants: [
      { id: 'kodak', name: '코닥 웜', swatch: ['#3a2a1c', '#e0b77a'], patch: {} },
      {
        id: 'fade',
        name: '폴라 페이드',
        swatch: ['#dfe6e2', '#7a9a9a'],
        patch: {
          effects: { warm: 0.12, desaturate: 0.3, tint: 'rgba(170,220,225,0.16)', flicker: false, leak: 0, grain: 0.06 },
          scene: { weights: { polaroid1: 0.6, polaroid2: 1.4, polaroid3: 1.2, filmstrip: 0.8 } },
        },
      },
      {
        id: 'noir',
        name: '흑백 무비',
        swatch: ['#111111', '#d8d8d8'],
        patch: {
          titleDesign: 'movie',
          colors: { accent: '#f0f0f0', text: '#f5f5f5' },
          effects: { desaturate: 1, warm: 0, grain: 0.12, vignette: 0.62 },
          overlays: ['letterbox'],
          look: { light: '255,255,255', stripInk: 'rgba(255,255,255,0.85)' },
        },
      },
      {
        id: '8mm',
        name: '8mm 홈무비',
        swatch: ['#2b1d10', '#ffb35c'],
        patch: { effects: { grain: 0.16, vignette: 0.7, warm: 0.36 }, overlays: ['gate'], transitions: [{ type: 'dip-black', weight: 1.4 }, { type: 'light', weight: 1.6 }, { type: 'crossfade', weight: 2 }] },
      },
    ],
  }),
  define({
    id: 'modern',
    name: '모던',
    label: 'Modern',
    description: '깔끔한 타이포그래피, 모자이크와 필름 스트립, 경쾌한 전환',
    highlights: ['모자이크', '필름 스트립', '밀어내기·와이프', '줌 전환'],
    moods: ['minimal'],
    swatch: ['#111111', '#f2f2f2'],
    fonts: { title: LATIN, titleWeight: 500, body: SANS_KR },
    titleStyle: 'caps',
    introScript: 'We Are Getting Married',
    outroScript: 'Thank You',
    colors: {
      accent: '#ffffff',
      sub: 'rgba(255,255,255,0.8)',
      bg: '#0d0d0d',
      titleDim: 'rgba(0,0,0,0.55)',
      sceneDim: 'rgba(0,0,0,0.42)',
      textShadow: 'rgba(0,0,0,0.5)',
    },
    transitionDuration: 0.8,
    transitions: [
      { type: 'crossfade', weight: 2 },
      { type: 'push', weight: 2 },
      { type: 'wipe', weight: 2 },
      { type: 'zoom', weight: 1.4 },
      { type: 'clock', weight: 0.5 },
      { type: 'iris', weight: 0.4 },
    ],
    scene: { weights: { cover: 3, contain: 0.8, pair: 1.5, collage: 1.3, grid: 1.4, filmstrip: 1 }, minAvg: 1.45 },
    look: {
      backdropBase: '#0f0f0f',
      backdropWash: 'rgba(10,10,10,0.6)',
      backdropBlurAlpha: 0.5,
      gap: '#0f0f0f',
      paper: '#f4f3f0',
      paperText: '#141414',
      paperMuted: '#77756f',
      paperAccent: '#141414',
      magazineLabel: 'OUR STORY',
      caption: '#444444',
      light: '255,255,255',
      ornament: 'line',
      nameJoin: 'amp',
      stripTilt: 0,
      stripInk: 'rgba(255,255,255,0.75)',
    },
    effects: { vignette: 0.15 },
    photoBorder: 0,
    variants: [
      { id: 'mono', name: '모노 블랙', swatch: ['#111111', '#f2f2f2'], patch: {} },
      {
        id: 'white',
        name: '화이트 에디션',
        swatch: ['#f4f3f0', '#1a1a1a'],
        patch: { look: { backdropBase: '#f4f3f0', backdropWash: 'rgba(244,243,240,0.72)', gap: '#ffffff' } },
      },
      {
        id: 'bold',
        name: '볼드 컬러',
        swatch: ['#111111', '#ff5a36'],
        patch: { titleDesign: 'kinetic', fonts: { display: ANTON }, colors: { accent: '#ff5a36' }, look: { paperAccent: '#ff5a36', gap: '#ff5a36', stripInk: 'rgba(255,90,54,0.95)' } },
      },
      {
        id: 'editorial',
        name: '매거진 에디션',
        swatch: ['#ebe7df', '#141414'],
        patch: { titleDesign: 'exhibition', scene: { weights: { gallery1: 0.8, gallery2: 0.8, grid: 1 } } },
      },
    ],
  }),
  define({
    id: 'gallery',
    name: '갤러리',
    label: 'Gallery',
    description: '전시장 벽에 걸린 액자와 작품 라벨, 미술관 같은 미니멀 연출',
    highlights: ['전시 액자', '작품 라벨', '블라인드 전환', '전시 포스터 타이틀'],
    moods: ['minimal', 'elegant'],
    swatch: ['#f1efeb', '#1c1a18'],
    fonts: { title: LATIN, titleWeight: 500, titleItalic: true, body: PRETENDARD, bodyWeight: 500, nameWeight: 700, display: LATIN, displayWeight: 500 },
    titleStyle: 'caps',
    titleDesign: 'exhibition',
    introScript: 'Our Moments',
    colors: {
      accent: '#ffffff',
      sub: 'rgba(255,255,255,0.86)',
      bg: '#101010',
      titleDim: 'rgba(0,0,0,0.42)',
      sceneDim: 'rgba(0,0,0,0.3)',
      textShadow: 'rgba(0,0,0,0.5)',
    },
    transitionDuration: 1,
    transitions: [
      { type: 'crossfade', weight: 2 },
      { type: 'blinds', weight: 1.1 },
      { type: 'wipe', weight: 1 },
      { type: 'push', weight: 0.6 },
      { type: 'iris', weight: 0.3 },
    ],
    scene: { weights: { cover: 2, contain: 0.5, pair: 0.5, gallery1: 1.4, gallery2: 1.4, gallery3: 1.1, grid: 0.6 }, minAvg: 1.5 },
    look: {
      backdropBase: '#efece6',
      backdropWash: 'rgba(239,236,230,0.7)',
      gap: '#ffffff',
      paper: '#f6f5f2',
      paperText: '#141414',
      paperMuted: '#7d7a73',
      paperAccent: '#141414',
      magazineLabel: 'Exhibition',
      light: '255,250,240',
      ornament: 'line',
      nameJoin: 'amp',
      stripTilt: 0,
      stripInk: 'rgba(255,255,255,0.75)',
    },
    effects: { vignette: 0.12 },
    photoBorder: 0,
    variants: [
      { id: 'whitecube', name: '화이트 큐브', swatch: ['#f1efeb', '#1c1a18'], patch: {} },
      {
        id: 'museum',
        name: '뮤지엄 다크',
        swatch: ['#23201d', '#b08d57'],
        patch: { look: { wall: '#23201d', frameWood: '#b08d57', mat: '#f4f1ea', labelInk: '#e9e2d6', backdropBase: '#1c1a17', backdropWash: 'rgba(28,26,23,0.6)' }, effects: { vignette: 0.35, warm: 0.08 } },
      },
      {
        id: 'paper',
        name: '페이퍼 아트',
        swatch: ['#e9e1d3', '#8a6a3a'],
        patch: { look: { wall: '#e9e1d3', frameWood: '#fbf8f2', mat: '#ffffff', labelInk: '#4a3b27', paper: '#efe7d9' }, effects: { grain: 0.04, warm: 0.1 } },
      },
    ],
  }),
  define({
    id: 'lovely',
    name: '러블리',
    label: 'Lovely',
    description: '말랑한 파스텔 색과 통통 튀는 글자, 비눗방울이 떠다니는 귀엽고 발랄한 연출',
    highlights: ['버블 타이틀', '스티커 폴라로이드', '비눗방울·반짝이', '떠오르기 전환'],
    moods: ['lovely'],
    badge: 'NEW',
    swatch: ['#ffe3ec', '#ff7fa8'],
    fonts: { title: 'Fredoka', titleWeight: 600, body: 'Jua', bodyWeight: 400, bodyBold: 400, name: 'Jua', nameWeight: 400, latin: 'Quicksand', hand: 'Gaegu', display: 'Fredoka', displayWeight: 600 },
    titleStyle: 'script',
    titleDesign: 'bubbly',
    introScript: 'Sweet Wedding Day',
    outroScript: 'Thank You!',
    colors: {
      accent: '#ffb8cf',
      sub: 'rgba(255,255,255,0.93)',
      bg: '#2a1620',
      titleDim: 'rgba(120,40,80,0.34)',
      sceneDim: 'rgba(130,50,90,0.28)',
      textShadow: 'rgba(160,50,100,0.55)',
    },
    transitionDuration: 1,
    transitions: [
      { type: 'rise', weight: 2 },
      { type: 'crossfade', weight: 2 },
      { type: 'sparkle', weight: 1.3 },
      { type: 'slide', weight: 0.9 },
      { type: 'petals', weight: 0.8 },
      { type: 'iris', weight: 0.6 },
      { type: 'zoom', weight: 0.5 },
    ],
    scene: {
      weights: { cover: 2, contain: 0.5, pair: 1.2, polaroid1: 0.5, polaroid2: 1.4, polaroid3: 1.3, sticker2: 1.2, sticker3: 1.1, collage: 0.8, oval: 0.6, grid: 0.6 },
      minAvg: 1.55,
    },
    look: {
      backdropBase: '#ffe8f0',
      backdropWash: 'rgba(255,236,244,0.5)',
      backdropBlurAlpha: 0.7,
      gap: '#fff7fa',
      paper: '#fff4f8',
      paperText: '#5a2a40',
      paperMuted: '#a07088',
      paperAccent: '#ff6f9f',
      magazineLabel: 'Love Story',
      frame: '#ffffff',
      tape: 'rgba(255,182,210,0.82)',
      caption: '#c2477a',
      light: '255,210,230',
      frameLine: '#ffd1e0',
      ornament: 'heart',
      nameJoin: 'heart',
      stripTilt: -2,
      stripInk: 'rgba(255,111,159,0.9)',
      posterWord: 'LOVELY',
      posterBg: '#ffd6e5',
      posterInk: '#ff4f8b',
      halftone: 'rgba(255,111,159,0.2)',
      wall: '#fff0f5',
      frameWood: '#ffffff',
      mat: '#ffffff',
      labelInk: '#7a3552',
    },
    effects: { vignette: 0.1, particle: 'bubbles', particles: 16, bokeh: 6, bokehColor: '255,200,225', sparkles: 20, glow: 0.18, tint: 'rgba(255,160,200,0.14)', fade: 0.04 },
    photoBorder: 14,
    variants: [
      { id: 'strawberry', name: '딸기우유', swatch: ['#ffe3ec', '#ff7fa8'], patch: {} },
      {
        id: 'mint',
        name: '민트 캔디',
        swatch: ['#dcfaf0', '#2fbf8f'],
        patch: {
          colors: { accent: '#b8f5df', titleDim: 'rgba(20,90,70,0.32)', sceneDim: 'rgba(20,90,70,0.2)', textShadow: 'rgba(20,90,70,0.55)' },
          look: { backdropBase: '#e3fbf2', backdropWash: 'rgba(226,250,241,0.5)', gap: '#f5fffb', paper: '#f2fcf8', paperText: '#1f4a3c', paperAccent: '#2fbf8f', tape: 'rgba(150,230,200,0.85)', caption: '#1f8a66', light: '200,255,235', frameLine: '#c8f7e6', posterBg: '#d4f7ea', posterInk: '#1fae80', halftone: 'rgba(31,174,128,0.18)', wall: '#effcf7', labelInk: '#1f4a3c' },
          effects: { tint: 'rgba(120,230,190,0.14)', bokehColor: '200,255,235' },
        },
      },
      {
        id: 'lemon',
        name: '레몬 소다',
        swatch: ['#fff7cc', '#f2b705'],
        patch: {
          colors: { accent: '#fff09a', titleDim: 'rgba(110,80,10,0.3)', sceneDim: 'rgba(110,80,10,0.2)', textShadow: 'rgba(120,80,0,0.5)' },
          look: { backdropBase: '#fff9dc', backdropWash: 'rgba(255,249,220,0.5)', gap: '#fffdf2', paper: '#fffbea', paperText: '#4a3a10', paperAccent: '#e0a800', tape: 'rgba(255,225,120,0.85)', caption: '#a07400', light: '255,245,190', frameLine: '#fff09a', posterBg: '#fff2a8', posterInk: '#e08a00', halftone: 'rgba(224,138,0,0.18)', wall: '#fffbe6', labelInk: '#4a3a10' },
          effects: { tint: 'rgba(255,230,120,0.14)', bokehColor: '255,245,190', warm: 0.06 },
        },
      },
      {
        id: 'cotton',
        name: '솜사탕',
        swatch: ['#efe3ff', '#b18cf2'],
        patch: {
          colors: { accent: '#e6d6ff', titleDim: 'rgba(80,50,130,0.34)', sceneDim: 'rgba(80,50,130,0.22)', textShadow: 'rgba(80,40,140,0.55)' },
          look: { backdropBase: '#f1e8ff', backdropWash: 'rgba(242,234,255,0.5)', gap: '#fbf8ff', paper: '#f8f3ff', paperText: '#3f2d5c', paperAccent: '#9f78e6', tape: 'rgba(205,180,250,0.85)', caption: '#7a55c2', light: '230,215,255', frameLine: '#e6d6ff', posterBg: '#ece0ff', posterInk: '#8c5fe0', halftone: 'rgba(140,95,224,0.18)', wall: '#f6f0ff', labelInk: '#3f2d5c' },
          effects: { particle: 'hearts', particles: 14, tint: 'rgba(200,170,255,0.16)', bokehColor: '230,215,255' },
        },
      },
    ],
  }),
  define({
    id: 'fairytale',
    name: '별빛 동화',
    label: 'Fairytale',
    description: '초승달과 별자리, 반짝이는 별빛이 쏟아지는 동화책 같은 몽환적인 연출',
    highlights: ['동화책 타이틀', '별자리·초승달', '반짝임 전환', '별빛·보케'],
    moods: ['dreamy', 'lovely'],
    badge: 'NEW',
    swatch: ['#141c3d', '#f3d98b'],
    fonts: { title: 'Parisienne', titleWeight: 400, body: SERIF_KR, latin: LATIN, display: CINZEL, displayWeight: 600 },
    titleStyle: 'script',
    titleDesign: 'storybook',
    introScript: 'Our Fairytale',
    outroScript: 'Happily Ever After',
    colors: {
      text: '#fdf8ea',
      accent: '#f6dc92',
      sub: 'rgba(253,248,234,0.86)',
      bg: '#0b1030',
      titleDim: 'rgba(10,16,52,0.55)',
      sceneDim: 'rgba(12,18,60,0.35)',
      textShadow: 'rgba(5,8,30,0.7)',
    },
    transitionDuration: 1.3,
    transitions: [
      { type: 'crossfade', weight: 2.2 },
      { type: 'sparkle', weight: 1.8 },
      { type: 'blur', weight: 1 },
      { type: 'iris', weight: 0.8 },
      { type: 'light', weight: 0.8 },
      { type: 'rise', weight: 0.7 },
    ],
    scene: { weights: { cover: 2.4, contain: 0.8, pair: 1.1, oval: 1.1, polaroid2: 0.8, polaroid3: 0.6, arch: 0.8, collage: 0.6 }, minAvg: 1.35 },
    look: {
      backdropBase: '#141c3d',
      backdropWash: 'rgba(16,22,60,0.55)',
      backdropBlurAlpha: 0.7,
      gap: '#0f1634',
      paper: '#f7f1e1',
      paperText: '#1d2340',
      paperMuted: '#7a7a95',
      paperAccent: '#b48a2e',
      magazineLabel: 'Once upon a time',
      frame: '#fbf7ec',
      tape: 'rgba(246,220,146,0.7)',
      caption: '#3a3f66',
      light: '255,236,180',
      frameLine: '#f6dc92',
      ornament: 'star',
      nameJoin: 'amp',
      stripInk: 'rgba(246,220,146,0.9)',
      posterWord: 'DREAM',
      posterBg: '#141c3d',
      posterInk: '#f6dc92',
      halftone: 'rgba(246,220,146,0.1)',
      wall: '#1a2147',
      frameWood: '#c49a3c',
      mat: '#f7f1e1',
      labelInk: '#f3eedd',
    },
    effects: { vignette: 0.4, particle: 'stars', particles: 22, sparkles: 34, bokeh: 10, bokehColor: '255,230,170', glow: 0.2, tint: 'rgba(90,110,255,0.14)' },
    variants: [
      { id: 'midnight', name: '한밤의 별', swatch: ['#141c3d', '#f3d98b'], patch: {} },
      {
        id: 'aurora',
        name: '오로라',
        swatch: ['#0b2a33', '#9ff5d9'],
        patch: {
          colors: { accent: '#bff7e8', titleDim: 'rgba(4,36,44,0.52)', sceneDim: 'rgba(4,36,44,0.34)' },
          look: { light: '190,255,230', frameLine: '#bff7e8', posterInk: '#bff7e8', stripInk: 'rgba(191,247,232,0.9)', backdropBase: '#0e2a33', gap: '#0b2229', wall: '#0e2a33' },
          effects: { particle: 'fireflies', particles: 30, tint: 'rgba(60,220,180,0.16)', bokehColor: '170,255,220' },
        },
      },
      {
        id: 'dawn',
        name: '새벽 노을',
        swatch: ['#2a1633', '#ffc9b5'],
        patch: {
          colors: { accent: '#ffd6c2', bg: '#1f1026', titleDim: 'rgba(56,20,56,0.5)', sceneDim: 'rgba(56,20,56,0.32)' },
          look: { light: '255,210,190', frameLine: '#ffd6c2', posterBg: '#2a1633', posterInk: '#ffd6c2', backdropBase: '#2a1633', gap: '#22112a', wall: '#2a1633' },
          effects: { tint: 'rgba(255,140,170,0.16)', bokehColor: '255,200,190' },
        },
      },
      {
        id: 'moon',
        name: '달빛 실버',
        swatch: ['#151a2b', '#e3e8f7'],
        patch: {
          colors: { accent: '#e8ecff' },
          look: { light: '225,232,255', frameLine: '#e8ecff', posterInk: '#e8ecff', paperAccent: '#5a6690' },
          effects: { particle: 'glitter', particles: 70, particleColors: ['#ffffff', '#e3e8f7', '#cfd8f5'], desaturate: 0.2, tint: 'rgba(170,190,255,0.16)', bokehColor: '220,228,255' },
        },
      },
    ],
  }),
  define({
    id: 'royal',
    name: '로열',
    label: 'Royal',
    description: '금빛 모노그램 문장과 월계수, 반짝이는 금가루가 흐르는 격조 높은 연출',
    highlights: ['모노그램 타이틀', '금가루', '코너 장식', '빛 번짐 전환'],
    moods: ['elegant'],
    badge: 'NEW',
    swatch: ['#3a0d1a', '#e2c27a'],
    fonts: { title: 'Pinyon Script', titleWeight: 400, body: MYEONGJO, latin: LATIN, display: CINZEL, displayWeight: 600 },
    titleStyle: 'script',
    titleDesign: 'monogram',
    introScript: 'The Wedding Day',
    outroScript: 'With Gratitude',
    colors: {
      text: '#fff8ee',
      accent: '#e8c987',
      sub: 'rgba(255,248,238,0.86)',
      bg: '#1a060c',
      titleDim: 'rgba(40,6,16,0.55)',
      sceneDim: 'rgba(40,6,16,0.36)',
      textShadow: 'rgba(20,0,6,0.7)',
    },
    transitionDuration: 1.3,
    transitions: [
      { type: 'crossfade', weight: 3 },
      { type: 'light', weight: 1.4 },
      { type: 'sparkle', weight: 1 },
      { type: 'flare', weight: 0.6 },
      { type: 'blur', weight: 0.6 },
      { type: 'iris', weight: 0.4 },
    ],
    scene: { weights: { cover: 2.8, contain: 1.1, pair: 1.6, oval: 1, gallery1: 0.6, gallery2: 0.4, collage: 0.8 }, minAvg: 1.3 },
    look: {
      backdropBase: '#2a0a14',
      backdropWash: 'rgba(40,8,18,0.55)',
      backdropBlurAlpha: 0.85,
      gap: '#1c070d',
      paper: '#f6efe2',
      paperText: '#2a1016',
      paperMuted: '#8a6f6a',
      paperAccent: '#9c7a3c',
      frame: '#fbf5e8',
      tape: 'rgba(226,194,122,0.7)',
      caption: '#5a3a2a',
      light: '255,222,160',
      frameLine: '#e8c987',
      ornament: 'crown',
      nameJoin: 'amp',
      stripInk: 'rgba(232,201,135,0.9)',
      posterBg: '#3a0d1a',
      posterInk: '#e8c987',
      halftone: 'rgba(232,201,135,0.12)',
      wall: '#2a0a14',
      frameWood: '#c8a25a',
      mat: '#f6efe2',
      labelInk: '#f1e3c8',
    },
    effects: { vignette: 0.45, warm: 0.1, particle: 'glitter', particles: 80, sparkles: 24, bokeh: 12, bokehColor: '255,220,160', glow: 0.14, tint: 'rgba(150,20,60,0.1)' },
    overlays: ['corners'],
    photoBorder: 12,
    variants: [
      { id: 'burgundy', name: '버건디 골드', swatch: ['#3a0d1a', '#e2c27a'], patch: {} },
      {
        id: 'emerald',
        name: '에메랄드',
        swatch: ['#0b2a22', '#e2c27a'],
        patch: {
          colors: { bg: '#06170f', titleDim: 'rgba(4,30,20,0.55)', sceneDim: 'rgba(4,30,20,0.36)', textShadow: 'rgba(0,16,8,0.7)' },
          look: { backdropBase: '#0b2a22', backdropWash: 'rgba(8,36,26,0.55)', gap: '#081d17', wall: '#0b2a22', posterBg: '#0b2a22' },
          effects: { tint: 'rgba(20,120,80,0.12)' },
        },
      },
      {
        id: 'sapphire',
        name: '사파이어 실버',
        swatch: ['#0c1a3d', '#dfe6f5'],
        patch: {
          colors: { accent: '#e3e9f7', bg: '#060c1f', titleDim: 'rgba(6,14,40,0.55)', sceneDim: 'rgba(6,14,40,0.36)' },
          look: { backdropBase: '#0c1a3d', backdropWash: 'rgba(10,20,50,0.55)', gap: '#081330', wall: '#0c1a3d', posterBg: '#0c1a3d', posterInk: '#e3e9f7', frameLine: '#e3e9f7', frameWood: '#c9cfdc', light: '225,232,255', paperAccent: '#4a5a86' },
          effects: { particleColors: ['#ffffff', '#dfe6f5', '#b9c4e0'], tint: 'rgba(40,80,200,0.12)', warm: 0, bokehColor: '220,228,255' },
        },
      },
      {
        id: 'pearl',
        name: '펄 화이트',
        swatch: ['#f4f1ea', '#b8995a'],
        patch: {
          colors: { accent: '#f4e3bd', titleDim: 'rgba(30,20,10,0.4)', sceneDim: 'rgba(30,20,10,0.28)', textShadow: 'rgba(40,25,10,0.6)' },
          look: { backdropBase: '#f4f1ea', backdropWash: 'rgba(244,241,234,0.6)', gap: '#fbfaf6', wall: '#f4f1ea', posterBg: '#f4f1ea', posterInk: '#9c7a3c', labelInk: '#3a2f22' },
          effects: { tint: 'rgba(255,230,190,0.1)', vignette: 0.28 },
        },
      },
    ],
  }),
  define({
    id: 'traditional',
    name: '전통 혼례',
    label: 'Hanok',
    description: '한지 카드와 붉은 낙관, 먹이 번지듯 넘어가는 우리식 혼례 연출',
    highlights: ['한지 낙관 타이틀', '먹 번짐 전환', '문 열림 전환', '매화 꽃잎'],
    moods: ['korean', 'elegant'],
    badge: 'NEW',
    swatch: ['#f3e6cf', '#b3261e'],
    fonts: { title: CINZEL, titleWeight: 600, body: SERIF_KR, name: 'Song Myung', nameWeight: 400, latin: LATIN, hand: 'Nanum Brush Script', display: CINZEL, displayWeight: 600 },
    titleStyle: 'caps',
    titleDesign: 'hanji',
    introScript: '우리 혼인합니다',
    outroScript: '감사합니다',
    colors: {
      text: '#fff8ec',
      accent: '#f3d9a4',
      sub: 'rgba(255,248,236,0.88)',
      bg: '#1a0f0c',
      titleDim: 'rgba(40,14,10,0.45)',
      sceneDim: 'rgba(40,14,10,0.3)',
      textShadow: 'rgba(30,8,5,0.6)',
    },
    transitionDuration: 1.3,
    transitions: [
      { type: 'crossfade', weight: 3 },
      { type: 'ink', weight: 1.4 },
      { type: 'split', weight: 0.8 },
      { type: 'light', weight: 0.8 },
      { type: 'petals', weight: 0.7 },
      { type: 'blur', weight: 0.5 },
    ],
    scene: { weights: { cover: 2.6, contain: 1, pair: 1.3, gallery1: 0.6, oval: 0.5, polaroid2: 0.4, collage: 0.8 }, minAvg: 1.3 },
    look: {
      backdropBase: '#efe4d0',
      backdropWash: 'rgba(240,228,206,0.5)',
      backdropBlurAlpha: 0.75,
      gap: '#f7f0e3',
      paper: '#f5ecdc',
      paperText: '#2b1d14',
      paperMuted: '#8a7560',
      paperAccent: '#b3261e',
      frame: '#fbf6ec',
      tape: 'rgba(179,38,30,0.5)',
      caption: '#5a3a26',
      light: '255,225,180',
      frameLine: '#e9c98f',
      ornament: 'flower',
      nameJoin: 'dot',
      stripTilt: -1,
      stripInk: 'rgba(179,38,30,0.85)',
      posterBg: '#f1e3cb',
      posterInk: '#b3261e',
      wall: '#efe6d6',
      frameWood: '#5a3a26',
      mat: '#faf5eb',
      labelInk: '#3a2718',
    },
    effects: {
      vignette: 0.35,
      warm: 0.12,
      desaturate: 0.05,
      particle: 'petals',
      particles: 18,
      particleColors: ['#ffffff', '#ffe4ea', '#f7c6d0'],
      bokeh: 6,
      bokehColor: '255,225,190',
      glow: 0.1,
      grain: 0.02,
      tint: 'rgba(255,200,140,0.1)',
    },
    overlays: ['frame'],
    variants: [
      { id: 'hong', name: '홍색 혼례', swatch: ['#f3e6cf', '#b3261e'], patch: {} },
      {
        id: 'cheong',
        name: '청색 혼례',
        swatch: ['#e6efe9', '#1f5c73'],
        patch: {
          colors: { accent: '#cfe6df', titleDim: 'rgba(10,30,36,0.45)', sceneDim: 'rgba(10,30,36,0.3)', textShadow: 'rgba(5,20,26,0.6)' },
          look: { paperAccent: '#1f5c73', stripInk: 'rgba(31,92,115,0.85)', posterInk: '#1f5c73', frameLine: '#cfe6df', tape: 'rgba(31,92,115,0.45)' },
          effects: { tint: 'rgba(80,150,170,0.12)', warm: 0.04 },
        },
      },
      {
        id: 'muk',
        name: '먹빛',
        swatch: ['#ece9e3', '#222222'],
        patch: {
          colors: { accent: '#f1ede4' },
          look: { paperAccent: '#222222', stripInk: 'rgba(30,30,30,0.85)', posterInk: '#222222', frameLine: '#e8e2d6', tape: 'rgba(40,40,40,0.4)' },
          effects: { desaturate: 0.6, warm: 0.04, tint: null, particleColors: ['#ffffff', '#f2f2f2', '#e2e2e2'] },
        },
      },
    ],
  }),
  define({
    id: 'editorial',
    name: '매거진 화보',
    label: 'Editorial',
    description: '잡지 표지처럼 큰 제호와 커버 문구, 또렷한 대비가 돋보이는 화보 연출',
    highlights: ['매거진 커버 타이틀', '커버 문구·바코드', '슬라이드·플래시 전환', '또렷한 대비'],
    moods: ['minimal', 'hip'],
    badge: 'NEW',
    swatch: ['#f2efe9', '#c8102e'],
    fonts: { title: 'Bodoni Moda', titleWeight: 500, body: 'Noto Serif KR', bodyWeight: 400, bodyBold: 700, nameWeight: 700, latin: 'Bodoni Moda', display: 'Bodoni Moda', displayWeight: 500 },
    titleStyle: 'caps',
    titleDesign: 'cover',
    introScript: 'The Wedding Issue',
    outroScript: 'Thank You',
    colors: {
      text: '#ffffff',
      accent: '#ff4d5e',
      sub: 'rgba(255,255,255,0.9)',
      bg: '#0c0c0c',
      titleDim: 'rgba(0,0,0,0.3)',
      sceneDim: 'rgba(0,0,0,0.3)',
      textShadow: 'rgba(0,0,0,0.45)',
    },
    transitionDuration: 0.9,
    transitions: [
      { type: 'slide', weight: 2 },
      { type: 'crossfade', weight: 1.6 },
      { type: 'flash', weight: 1 },
      { type: 'wipe', weight: 0.8 },
      { type: 'split', weight: 0.6 },
      { type: 'push', weight: 0.5 },
    ],
    scene: { weights: { cover: 2.4, contain: 0.8, pair: 1.1, poster: 0.7, grid: 0.9, collage: 1, gallery2: 0.5, filmstrip: 0.4 }, minAvg: 1.35 },
    look: {
      backdropBase: '#f2efe9',
      backdropWash: 'rgba(242,239,233,0.72)',
      backdropBlurAlpha: 0.5,
      gap: '#ffffff',
      paper: '#f5f2ec',
      paperText: '#111111',
      paperMuted: '#77716a',
      paperAccent: '#c8102e',
      magazineLabel: 'The Issue',
      frame: '#ffffff',
      caption: '#222222',
      light: '255,255,255',
      ornament: 'line',
      nameJoin: 'amp',
      stripTilt: 0,
      stripInk: 'rgba(255,255,255,0.8)',
      posterWord: 'MUSE',
      posterBg: '#f2efe9',
      posterInk: '#c8102e',
      halftone: 'rgba(0,0,0,0.08)',
      wall: '#f2efe9',
      frameWood: '#111111',
      mat: '#ffffff',
      labelInk: '#111111',
    },
    effects: { vignette: 0.12, desaturate: 0.15, contrast: 0.15, grain: 0.02 },
    photoBorder: 0,
    variants: [
      { id: 'red', name: '레드 에디션', swatch: ['#f2efe9', '#c8102e'], patch: {} },
      {
        id: 'mono',
        name: '모노크롬',
        swatch: ['#111111', '#f2f2f2'],
        patch: { colors: { accent: '#ffffff' }, look: { paperAccent: '#111111', posterInk: '#111111' }, effects: { desaturate: 1, contrast: 0.25 } },
      },
      {
        id: 'pastel',
        name: '파스텔 커버',
        swatch: ['#fde7ee', '#d9607f'],
        patch: {
          colors: { accent: '#ffc2d1' },
          look: { paperAccent: '#d9607f', posterBg: '#fde7ee', posterInk: '#d9607f', backdropBase: '#fdf0f3', wall: '#fdf0f3' },
          effects: { desaturate: 0, contrast: 0.05, fade: 0.06, tint: 'rgba(255,190,210,0.14)' },
        },
      },
      {
        id: 'gold',
        name: '골드 에디션',
        swatch: ['#14110c', '#e8cf98'],
        patch: {
          colors: { accent: '#e8cf98', bg: '#14110c' },
          look: { paperAccent: '#9c7a3c', posterBg: '#14110c', posterInk: '#e8cf98', frameWood: '#b8955a' },
          effects: { desaturate: 0.1, warm: 0.12 },
        },
      },
    ],
  }),
  define({
    id: 'summer',
    name: '썸머 비치',
    label: 'Summer',
    description: '바다 엽서와 우표, 햇살이 부서지는 청량한 여름 휴양지 연출',
    highlights: ['여행 엽서 타이틀', '우표·소인', '비눗방울·햇살', '슬라이드 전환'],
    moods: ['natural', 'hip'],
    badge: 'NEW',
    swatch: ['#bfe9f2', '#1f8fb0'],
    fonts: { title: 'Pacifico', titleWeight: 400, body: 'Gowun Dodum', bodyWeight: 400, bodyBold: 400, nameWeight: 400, latin: 'Montserrat', hand: 'Gaegu', display: 'Bebas Neue', displayWeight: 400 },
    titleStyle: 'script',
    titleDesign: 'postcard',
    introScript: 'Our Wedding Day',
    outroScript: 'See You Soon',
    colors: {
      accent: '#fff3c4',
      sub: 'rgba(255,255,255,0.92)',
      bg: '#08222c',
      titleDim: 'rgba(0,50,70,0.36)',
      sceneDim: 'rgba(0,50,70,0.24)',
      textShadow: 'rgba(0,40,60,0.55)',
    },
    transitionDuration: 0.9,
    transitions: [
      { type: 'slide', weight: 1.8 },
      { type: 'crossfade', weight: 2 },
      { type: 'light', weight: 1.2 },
      { type: 'push', weight: 1 },
      { type: 'rise', weight: 0.8 },
      { type: 'wipe', weight: 0.6 },
    ],
    scene: { weights: { cover: 2.6, pair: 1.2, polaroid2: 1.2, polaroid3: 1, sticker2: 0.6, collage: 1, grid: 0.8, filmstrip: 0.5 }, minAvg: 1.45 },
    look: {
      backdropBase: '#dff4f7',
      backdropWash: 'rgba(225,246,250,0.5)',
      backdropBlurAlpha: 0.7,
      gap: '#f4fbfc',
      paper: '#fbf6ea',
      paperText: '#123845',
      paperMuted: '#6c8a92',
      paperAccent: '#1f8fb0',
      magazineLabel: 'Summer Days',
      frame: '#ffffff',
      tape: 'rgba(255,214,120,0.8)',
      caption: '#1d5d70',
      light: '255,244,200',
      ornament: 'star',
      stripTilt: -2,
      stripInk: 'rgba(255,214,120,0.95)',
      posterWord: 'SUMMER',
      posterBg: '#bfe9f2',
      posterInk: '#ff7a59',
      halftone: 'rgba(31,143,176,0.16)',
      wall: '#eef8f9',
      frameWood: '#ffffff',
      mat: '#ffffff',
      labelInk: '#123845',
    },
    effects: { vignette: 0.12, warm: 0.06, particle: 'bubbles', particles: 12, bokeh: 14, bokehColor: '255,250,220', sparkles: 16, glow: 0.16, tint: 'rgba(80,200,230,0.12)', vivid: 0.1, leak: 0.6 },
    photoBorder: 14,
    variants: [
      { id: 'ocean', name: '오션 블루', swatch: ['#bfe9f2', '#1f8fb0'], patch: {} },
      {
        id: 'coral',
        name: '선셋 코랄',
        swatch: ['#ffd9c9', '#e5684a'],
        patch: {
          colors: { accent: '#ffe0cf', titleDim: 'rgba(90,30,20,0.36)', sceneDim: 'rgba(90,30,20,0.22)', textShadow: 'rgba(90,30,10,0.55)' },
          look: { backdropBase: '#ffeee6', paperAccent: '#e5684a', caption: '#9a3f28', light: '255,210,180', posterBg: '#ffd3c2', posterInk: '#1f8fb0', halftone: 'rgba(229,104,74,0.16)' },
          effects: { warm: 0.2, tint: 'rgba(255,140,110,0.16)', bokehColor: '255,220,190' },
        },
      },
      {
        id: 'tropical',
        name: '트로피컬',
        swatch: ['#e3f7c9', '#2e9e5b'],
        patch: {
          colors: { accent: '#e7ffb0', titleDim: 'rgba(10,60,30,0.36)', sceneDim: 'rgba(10,60,30,0.22)', textShadow: 'rgba(10,50,20,0.55)' },
          look: { backdropBase: '#eefbe2', paperAccent: '#2e9e5b', caption: '#1f6b3d', light: '230,255,190', posterBg: '#e3f7c9', posterInk: '#ff6f61', halftone: 'rgba(46,158,91,0.16)' },
          effects: { particle: 'butterflies', particles: 8, tint: 'rgba(80,220,140,0.14)', bokehColor: '230,255,200' },
        },
      },
    ],
  }),
  define({
    id: 'retro',
    name: '레트로',
    label: 'Retro',
    description: '70년대 선셋 줄무늬와 겹겹이 그림자 진 글자, 따뜻한 필름 색감의 복고 연출',
    highlights: ['레트로 선셋 타이틀', '겹 그림자 글자', '필름 번 전환', '빈티지 색감'],
    moods: ['vintage', 'hip'],
    badge: 'NEW',
    swatch: ['#f6e3c1', '#d9542b'],
    fonts: { title: 'Abril Fatface', titleWeight: 400, body: 'Do Hyeon', bodyWeight: 400, bodyBold: 400, nameWeight: 400, latin: 'Josefin Sans', display: 'Abril Fatface', displayWeight: 400 },
    titleStyle: 'script',
    titleDesign: 'sunburst',
    introScript: 'Our Love Story',
    outroScript: 'Thank You',
    colors: {
      text: '#fff6e6',
      accent: '#ffc15e',
      sub: 'rgba(255,246,230,0.9)',
      bg: '#2a140a',
      titleDim: 'rgba(60,24,6,0.45)',
      sceneDim: 'rgba(60,24,6,0.3)',
      textShadow: 'rgba(40,14,2,0.6)',
    },
    transitionDuration: 1,
    transitions: [
      { type: 'filmburn', weight: 1.6 },
      { type: 'crossfade', weight: 2 },
      { type: 'light', weight: 0.8 },
      { type: 'push', weight: 0.8 },
      { type: 'zoom', weight: 0.7 },
      { type: 'blinds', weight: 0.6 },
    ],
    scene: { weights: { cover: 2.6, pair: 1.2, polaroid2: 1, polaroid3: 0.8, filmstrip: 1, poster: 0.8, sticker2: 0.5, grid: 0.6 }, minAvg: 1.4 },
    look: {
      backdropBase: '#f6e3c1',
      backdropWash: 'rgba(246,227,193,0.5)',
      backdropBlurAlpha: 0.75,
      gap: '#fbf1de',
      paper: '#f6e3c1',
      paperText: '#3a1d0e',
      paperMuted: '#8f6a4f',
      paperAccent: '#d9542b',
      magazineLabel: 'Groovy Days',
      frame: '#fff8ea',
      tape: 'rgba(240,160,60,0.75)',
      caption: '#7a3b18',
      light: '255,190,110',
      frameLine: '#ffc15e',
      ornament: 'star',
      nameJoin: 'amp',
      stripTilt: -2.5,
      stripInk: 'rgba(255,193,94,0.95)',
      posterWord: 'GROOVY',
      posterBg: '#f6e3c1',
      posterInk: '#d9542b',
      halftone: 'rgba(217,84,43,0.18)',
      wall: '#f3dfbd',
      frameWood: '#8a4a24',
      mat: '#fff8ea',
      labelInk: '#3a1d0e',
    },
    effects: { vignette: 0.4, grain: 0.06, warm: 0.28, desaturate: 0.12, fade: 0.08, leak: 1, tint: 'rgba(255,150,60,0.12)' },
    photoBorder: 12,
    variants: [
      { id: 'seventies', name: '70s 선셋', swatch: ['#f6e3c1', '#d9542b'], patch: {} },
      {
        id: 'disco',
        name: '디스코',
        swatch: ['#2a0f2e', '#ff7ad9'],
        patch: {
          colors: { accent: '#ff9be3', bg: '#1a0a1e', titleDim: 'rgba(40,8,46,0.5)', sceneDim: 'rgba(40,8,46,0.32)' },
          look: { posterBg: '#2a0f2e', posterInk: '#ff7ad9', paperAccent: '#c2389b', light: '255,150,230', frameLine: '#ff9be3', stripInk: 'rgba(255,122,217,0.95)', halftone: 'rgba(255,122,217,0.14)' },
          effects: { particle: 'glitter', particles: 70, particleColors: ['#ff9be3', '#ffd36e', '#ffffff', '#b58cff'], warm: 0.1, tint: 'rgba(255,100,200,0.14)', sparkles: 20 },
        },
      },
      {
        id: 'diner',
        name: '50s 다이너',
        swatch: ['#dff5f0', '#e23b3b'],
        patch: {
          colors: { accent: '#9ef0e0', titleDim: 'rgba(20,40,40,0.42)', sceneDim: 'rgba(20,40,40,0.28)' },
          look: { posterBg: '#dff5f0', posterInk: '#e23b3b', paperAccent: '#e23b3b', backdropBase: '#e6f7f3', light: '200,255,240', frameLine: '#9ef0e0', halftone: 'rgba(226,59,59,0.14)' },
          effects: { warm: 0.1, desaturate: 0.05, tint: 'rgba(120,230,210,0.12)' },
        },
      },
    ],
  }),
];

/** 스타일 카드·쇼케이스에 보여 줄 순서 (가장 인기 있는 클래식이 맨 앞) */
const ORDER: readonly ThemeId[] = [
  'classic',
  'romantic',
  'lovely',
  'cinema',
  'garden',
  'fairytale',
  'royal',
  'traditional',
  'editorial',
  'street',
  'neon',
  'summer',
  'retro',
  'camcorder',
  'film',
  'modern',
  'gallery',
];

export const THEMES: Theme[] = ORDER.map((id) => ALL_THEMES.find((t) => t.id === id)!);

export const DEFAULT_THEME_ID: ThemeId = 'classic';

// ───────────────────────── 꾸미기 (사용자 선택) ─────────────────────────

export type Level = 'none' | 'low' | 'mid' | 'high';
export type FilterId = 'none' | 'warm' | 'cool' | 'film' | 'mono' | 'sepia' | 'fade' | 'pastel' | 'vivid' | 'pink' | 'golden' | 'teal' | 'lavender' | 'mint';
export type FrameId = OverlayKind | 'none';
export type TransitionChoice = 'soft' | 'mix' | TransitionType;

/** 꾸미기에서 고른 값. 없는 항목은 스타일 기본값(추천)을 씀 */
export interface Customization {
  /** 오프닝 디자인 */
  title?: TitleDesign;
  /** 흩날리는 효과 */
  particle?: ParticleKind;
  /** 글씨체 (font-catalog의 id) */
  fontTitle?: string;
  fontName?: string;
  fontBody?: string;
  fontHand?: string;
  textSize?: 'sm' | 'lg';
  textEffect?: 'soft' | 'strong' | 'glow' | 'none';
  /** 포인트 색·글자 색 (#rrggbb) */
  accent?: string;
  textColor?: string;
  /** 오프닝·엔딩 배경 사진 어둡기 */
  dim?: 'low' | 'mid' | 'high';
  filter?: FilterId;
  /** 흩날리는 효과 양 */
  amount?: 'low' | 'high';
  bokeh?: Level;
  sparkles?: Level;
  glow?: Level;
  vignette?: Level;
  grain?: 'none' | 'low' | 'high';
  leak?: 'on' | 'off';
  /** 화면 테두리·장치 */
  frame?: FrameId;
  /** 사진 테두리 두께 */
  border?: 'none' | 'thin' | 'mid' | 'thick';
  transition?: TransitionChoice;
  speed?: 'fast' | 'slow';
  ornament?: Ornament;
  nameJoin?: NameJoin;
  /** 사진 연출 (배치 섞는 방식) */
  scenes?: 'calm' | 'mix' | 'many';
}
export type CustomKey = keyof Customization;

/** 바꾸면 영상 구성(장면·전환 시간)을 다시 계산해야 하는 항목 */
export const STRUCTURAL_KEYS: ReadonlySet<CustomKey> = new Set<CustomKey>(['transition', 'speed', 'scenes']);

export interface Choice<T extends string = string> {
  id: T;
  name: string;
  /** 칩에 함께 보여 줄 색 */
  swatch?: string;
}

interface FilterFx {
  warm: number;
  desaturate: number;
  tint: string | null;
  hue: string | null;
  hueAmount: number;
  highlights: string | null;
  shadows: string | null;
  fade: number;
  vivid: number;
  contrast: number;
}

/** 필터 값 (적지 않은 항목은 0/없음 → 스타일에 원래 있던 색 보정도 모두 바뀜) */
const filterFx = (p: Partial<FilterFx>): FilterFx => ({
  warm: 0,
  desaturate: 0,
  tint: null,
  hue: null,
  hueAmount: 0,
  highlights: null,
  shadows: null,
  fade: 0,
  vivid: 0,
  contrast: 0,
  ...p,
});

// 색이 강한 사진(노을 등)에서도 이름대로 보이도록: 색조는 'color' 합성(hue)으로 입히고,
// 틸 & 오렌지·필름은 어두운 곳/밝은 곳에 다른 색을 입힘 (shadows/highlights)
export const FILTERS: readonly (Choice<FilterId> & { swatch2: string; fx: FilterFx })[] = [
  { id: 'none', name: '보정 없음', swatch: '#9aa5b1', swatch2: '#d7dde3', fx: filterFx({}) },
  { id: 'warm', name: '따뜻하게', swatch: '#f6c98f', swatch2: '#e98a4b', fx: filterFx({ warm: 0.3, hue: '#ff8a3d', hueAmount: 0.1, highlights: 'rgb(255,244,228)' }) },
  { id: 'cool', name: '시원하게', swatch: '#bfe3ff', swatch2: '#5a8fd8', fx: filterFx({ desaturate: 0.25, hue: '#38a6ff', hueAmount: 0.3, highlights: 'rgb(224,241,255)', shadows: 'rgb(0,10,34)', contrast: 0.05 }) },
  { id: 'film', name: '필름', swatch: '#e9d3a8', swatch2: '#8a6a3a', fx: filterFx({ desaturate: 0.22, highlights: 'rgb(255,246,226)', shadows: 'rgb(14,26,24)', fade: 0.02, contrast: 0.16 }) },
  { id: 'mono', name: '흑백', swatch: '#f0f0f0', swatch2: '#222222', fx: filterFx({ desaturate: 1, contrast: 0.15 }) },
  { id: 'sepia', name: '세피아', swatch: '#e8d2b0', swatch2: '#7a5230', fx: filterFx({ desaturate: 1, hue: '#a8743e', hueAmount: 0.55, fade: 0.04, contrast: 0.06 }) },
  { id: 'fade', name: '빈티지 페이드', swatch: '#e3ddd3', swatch2: '#9a8f82', fx: filterFx({ desaturate: 0.35, highlights: 'rgb(250,244,234)', fade: 0.2 }) },
  { id: 'pastel', name: '파스텔', swatch: '#ffe3ef', swatch2: '#cfd8ff', fx: filterFx({ desaturate: 0.25, hue: '#ffb3d9', hueAmount: 0.14, shadows: 'rgb(62,54,72)' }) },
  { id: 'vivid', name: '선명하게', swatch: '#ff6b6b', swatch2: '#3ec1ff', fx: filterFx({ vivid: 0.36, contrast: 0.22 }) },
  { id: 'pink', name: '핑크빛', swatch: '#ffd1e0', swatch2: '#e46a93', fx: filterFx({ hue: '#ff6fa8', hueAmount: 0.18, tint: 'rgba(255,140,185,0.2)', shadows: 'rgb(24,6,14)' }) },
  { id: 'golden', name: '골든아워', swatch: '#ffe0a3', swatch2: '#e0892f', fx: filterFx({ warm: 0.22, hue: '#ffb640', hueAmount: 0.18, shadows: 'rgb(26,14,0)', contrast: 0.06 }) },
  { id: 'teal', name: '틸 & 오렌지', swatch: '#0f5d6b', swatch2: '#e89a4f', fx: filterFx({ desaturate: 0.22, highlights: 'rgb(255,226,190)', shadows: 'rgb(0,58,70)', contrast: 0.24 }) },
  { id: 'lavender', name: '라벤더', swatch: '#e7dcff', swatch2: '#8f78c4', fx: filterFx({ desaturate: 0.2, hue: '#9b7bff', hueAmount: 0.23, shadows: 'rgb(24,14,40)', fade: 0.03 }) },
  { id: 'mint', name: '민트', swatch: '#d4f7ea', swatch2: '#2fbf8f', fx: filterFx({ desaturate: 0.28, hue: '#29e3cc', hueAmount: 0.22, highlights: 'rgb(236,255,248)', shadows: 'rgb(0,30,30)', fade: 0.03 }) },
];

/** 포인트 색 (제목·장식·이름 사이 기호) */
export const ACCENTS: readonly Choice[] = [
  { id: '#ffffff', name: '화이트', swatch: '#ffffff' },
  { id: '#fff1d6', name: '아이보리', swatch: '#fff1d6' },
  { id: '#e8cf98', name: '골드', swatch: '#e8cf98' },
  { id: '#f6e5bf', name: '샴페인', swatch: '#f6e5bf' },
  { id: '#f4d3c7', name: '로즈골드', swatch: '#f4d3c7' },
  { id: '#ffd3dd', name: '벚꽃 핑크', swatch: '#ffd3dd' },
  { id: '#ff9fbd', name: '러블리 핑크', swatch: '#ff9fbd' },
  { id: '#ff5fa2', name: '핫핑크', swatch: '#ff5fa2' },
  { id: '#e7dcff', name: '라벤더', swatch: '#e7dcff' },
  { id: '#bfe6ff', name: '스카이', swatch: '#bfe6ff' },
  { id: '#b8f5df', name: '민트', swatch: '#b8f5df' },
  { id: '#eef5de', name: '세이지', swatch: '#eef5de' },
  { id: '#ffe0c7', name: '피치', swatch: '#ffe0c7' },
  { id: '#ffb35c', name: '선셋 오렌지', swatch: '#ffb35c' },
  { id: '#ff6b5e', name: '코랄 레드', swatch: '#ff6b5e' },
  { id: '#e8ff3a', name: '네온 옐로', swatch: '#e8ff3a' },
  { id: '#3ee8ff', name: '네온 블루', swatch: '#3ee8ff' },
  { id: '#ff4fd8', name: '네온 핑크', swatch: '#ff4fd8' },
];

/** 글자 색 (이름·본문) */
export const TEXT_COLORS: readonly Choice[] = [
  { id: '#ffffff', name: '화이트', swatch: '#ffffff' },
  { id: '#fff8ec', name: '아이보리', swatch: '#fff8ec' },
  { id: '#f7eedc', name: '크림', swatch: '#f7eedc' },
  { id: '#ffeef2', name: '연분홍', swatch: '#ffeef2' },
  { id: '#eef6ff', name: '연하늘', swatch: '#eef6ff' },
  { id: '#f3dfb3', name: '연골드', swatch: '#f3dfb3' },
];

export const TEXT_SIZES: readonly Choice<'sm' | 'lg'>[] = [
  { id: 'sm', name: '작게' },
  { id: 'lg', name: '크게' },
];
export const TEXT_EFFECTS: readonly Choice<'soft' | 'strong' | 'glow' | 'none'>[] = [
  { id: 'soft', name: '은은한 그림자' },
  { id: 'strong', name: '진한 그림자' },
  { id: 'glow', name: '빛나는 글자' },
  { id: 'none', name: '그림자 없음' },
];
export const DIMS: readonly Choice<'low' | 'mid' | 'high'>[] = [
  { id: 'low', name: '밝게' },
  { id: 'mid', name: '보통' },
  { id: 'high', name: '어둡게' },
];
export const AMOUNTS: readonly Choice<'low' | 'high'>[] = [
  { id: 'low', name: '적게' },
  { id: 'high', name: '많이' },
];
export const LEVELS: readonly Choice<Level>[] = [
  { id: 'none', name: '없음' },
  { id: 'low', name: '약하게' },
  { id: 'mid', name: '보통' },
  { id: 'high', name: '강하게' },
];
export const GRAINS: readonly Choice<'none' | 'low' | 'high'>[] = [
  { id: 'none', name: '없음' },
  { id: 'low', name: '약하게' },
  { id: 'high', name: '강하게' },
];
export const LEAKS: readonly Choice<'on' | 'off'>[] = [
  { id: 'on', name: '켜기' },
  { id: 'off', name: '끄기' },
];
export const FRAMES: readonly Choice<FrameId>[] = [
  { id: 'none', name: '없음' },
  { id: 'frame', name: '얇은 액자선' },
  { id: 'corners', name: '코너 장식' },
  { id: 'lace', name: '레이스' },
  { id: 'flowers', name: '꽃 코너' },
  { id: 'pearls', name: '진주 테두리' },
  { id: 'deco', name: '아르데코' },
  { id: 'letterbox', name: '시네마 띠' },
  { id: 'gate', name: '8mm 필름 창' },
  { id: 'camcorder', name: '캠코더 REC' },
  { id: 'datestamp', name: '디카 날짜' },
  { id: 'vhs', name: 'VHS 줄무늬' },
  { id: 'marks', name: '촬영 표시' },
];
export const BORDERS: readonly Choice<'none' | 'thin' | 'mid' | 'thick'>[] = [
  { id: 'none', name: '없음' },
  { id: 'thin', name: '얇게' },
  { id: 'mid', name: '보통' },
  { id: 'thick', name: '두껍게' },
];
export const TRANSITION_MODES: readonly Choice<'soft' | 'mix'>[] = [
  { id: 'soft', name: '부드럽게 (디졸브만)' },
  { id: 'mix', name: '다양하게 섞기' },
];
export const SPEEDS: readonly Choice<'fast' | 'slow'>[] = [
  { id: 'fast', name: '빠르게' },
  { id: 'slow', name: '느리게' },
];
export const ORNAMENTS: readonly Choice<Ornament>[] = [
  { id: 'heart', name: '하트' },
  { id: 'diamond', name: '마름모' },
  { id: 'leaf', name: '잎사귀' },
  { id: 'star', name: '별' },
  { id: 'flower', name: '꽃' },
  { id: 'bow', name: '리본' },
  { id: 'rings', name: '반지' },
  { id: 'crown', name: '왕관' },
  { id: 'line', name: '점' },
  { id: 'none', name: '선만' },
];
export const NAME_JOINS: readonly Choice<NameJoin>[] = [
  { id: 'heart', name: '♥ 하트' },
  { id: 'amp', name: '& 앤드' },
  { id: 'and', name: 'and' },
  { id: 'rings', name: '반지' },
  { id: 'infinity', name: '∞ 무한' },
  { id: 'cross', name: '× 곱하기' },
  { id: 'dot', name: '· 가운뎃점' },
];
export const SCENE_MODES: readonly Choice<'calm' | 'mix' | 'many'>[] = [
  { id: 'calm', name: '한 장씩 크게' },
  { id: 'mix', name: '다양하게 섞기' },
  { id: 'many', name: '여러 장 모아서' },
];

const FILTER_FX = new Map(FILTERS.map((f) => [f.id, f.fx]));
const BOKEH: Record<Level, number> = { none: 0, low: 6, mid: 12, high: 22 };
const SPARKLES: Record<Level, number> = { none: 0, low: 12, mid: 28, high: 50 };
const GLOW: Record<Level, number> = { none: 0, low: 0.1, mid: 0.2, high: 0.32 };
const VIGNETTE: Record<Level, number> = { none: 0, low: 0.18, mid: 0.35, high: 0.55 };
const GRAIN: Record<'none' | 'low' | 'high', number> = { none: 0, low: 0.04, high: 0.1 };
const BORDER: Record<'none' | 'thin' | 'mid' | 'thick', number> = { none: 0, thin: 6, mid: 12, thick: 20 };
const AMOUNT: Record<'low' | 'high', number> = { low: 0.5, high: 1.8 };
const SPEED: Record<'fast' | 'slow', number> = { fast: 0.65, slow: 1.4 };
const TEXT_SCALE: Record<'sm' | 'lg', number> = { sm: 0.9, lg: 1.1 };
const DIM_ALPHA: Record<'low' | 'mid' | 'high', number> = { low: 0.22, mid: 0.45, high: 0.64 };

/** '다양하게 섞기': 모든 전환을 고루 (튀는 전환은 조금 드물게) */
const MIX_TRANSITIONS: { type: TransitionType; weight: number }[] = TRANSITIONS.map((t) => ({
  type: t.id,
  weight: t.id === 'crossfade' ? 2.5 : t.id === 'glitch' || t.id === 'tracking' || t.id === 'mosaic' ? 0.35 : 1,
}));

const SCENE_PRESETS: Record<'calm' | 'mix' | 'many', SceneStyle> = {
  calm: { weights: { cover: 3, contain: 1.3, pair: 1.3 }, minAvg: 1.05 },
  mix: {
    weights: {
      cover: 2,
      contain: 0.6,
      pair: 1,
      polaroid1: 0.4,
      polaroid2: 0.8,
      polaroid3: 0.8,
      collage: 0.9,
      grid: 0.7,
      oval: 0.6,
      filmstrip: 0.6,
      poster: 0.5,
      sticker2: 0.5,
      sticker3: 0.5,
      gallery1: 0.4,
      gallery2: 0.4,
      gallery3: 0.4,
      arch: 0.5,
    },
    minAvg: 1.5,
  },
  many: { weights: { cover: 1.2, contain: 0.3, pair: 1, polaroid2: 1.1, polaroid3: 1.4, collage: 1.4, grid: 1.3, filmstrip: 0.8, sticker3: 0.6, gallery3: 0.5 }, minAvg: 2 },
};

const ids = (list: readonly { id: string }[]) => new Set(list.map((x) => x.id));
const ENUMS: Partial<Record<CustomKey, ReadonlySet<string>>> = {
  title: ids(TITLE_DESIGNS),
  particle: ids(PARTICLES),
  textSize: ids(TEXT_SIZES),
  textEffect: ids(TEXT_EFFECTS),
  dim: ids(DIMS),
  filter: ids(FILTERS),
  amount: ids(AMOUNTS),
  bokeh: ids(LEVELS),
  sparkles: ids(LEVELS),
  glow: ids(LEVELS),
  vignette: ids(LEVELS),
  grain: ids(GRAINS),
  leak: ids(LEAKS),
  frame: ids(FRAMES),
  border: ids(BORDERS),
  transition: new Set<string>([...TRANSITION_MODES.map((m) => m.id), ...TRANSITIONS.map((t) => t.id)]),
  speed: ids(SPEEDS),
  ornament: ids(ORNAMENTS),
  nameJoin: ids(NAME_JOINS),
  scenes: ids(SCENE_MODES),
};
const HEX = /^#[0-9a-f]{6}$/i;
const CUSTOM_ORDER: readonly CustomKey[] = [
  'title',
  'particle',
  'fontTitle',
  'fontName',
  'fontBody',
  'fontHand',
  'textSize',
  'textEffect',
  'accent',
  'textColor',
  'dim',
  'filter',
  'amount',
  'bokeh',
  'sparkles',
  'glow',
  'vignette',
  'grain',
  'leak',
  'frame',
  'border',
  'transition',
  'speed',
  'ornament',
  'nameJoin',
  'scenes',
];

/** 저장값·입력값에서 알 수 있는 항목만 남김 ('auto'나 모르는 값은 버림) */
export function sanitizeCustom(raw: unknown): Customization {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const key of CUSTOM_ORDER) {
    const v = src[key];
    if (typeof v !== 'string' || !v || v === 'auto') continue;
    let ok = false;
    if (key === 'accent' || key === 'textColor') ok = HEX.test(v);
    else if (key === 'fontTitle') ok = fontById(v)?.kr === false;
    else if (key === 'fontName' || key === 'fontBody' || key === 'fontHand') ok = fontById(v)?.kr === true;
    else ok = ENUMS[key]?.has(v) ?? false;
    if (ok) out[key] = key === 'accent' || key === 'textColor' ? v.toLowerCase() : v;
  }
  return out as Customization;
}

/** 스타일 기본값에서 바꾼 항목 수 */
export function customCount(c: Customization): number {
  return Object.keys(sanitizeCustom(c)).length;
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 'rgba(r,g,b,a)'의 투명도만 바꿈 */
function withAlpha(color: string, a: number): string {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},${a})` : `rgba(0,0,0,${a})`;
}

/** 꾸미기 선택을 테마 위에 덮어씀 */
function applyCustom(t: Theme, c: Customization): Theme {
  if (Object.keys(c).length === 0) return t;
  const fonts = { ...t.fonts };
  const colors = { ...t.colors };
  const look = { ...t.look };
  const effects = { ...t.effects };
  let { titleDesign, titleStyle, transitions, transitionDuration, scene, overlays, photoBorder, textScale } = t;

  if (c.title) titleDesign = c.title;
  const ft = fontById(c.fontTitle);
  if (ft && !ft.kr) {
    fonts.title = ft.family;
    fonts.titleWeight = ft.weight ?? ft.weights[0];
    fonts.titleItalic = !!ft.italic;
    fonts.titleCustom = true;
    titleStyle = ft.titleStyle ?? 'script';
  }
  const fn = fontById(c.fontName);
  if (fn?.kr) {
    fonts.name = fn.family;
    fonts.nameWeight = nearestWeight(fn, 700);
  }
  const fb = fontById(c.fontBody);
  if (fb?.kr) {
    fonts.body = fb.family;
    fonts.bodyWeight = nearestWeight(fb, t.fonts.bodyWeight);
    fonts.bodyBold = nearestWeight(fb, 700);
  }
  const fh = fontById(c.fontHand);
  if (fh?.kr) fonts.hand = fh.family;
  if (c.textSize) textScale = TEXT_SCALE[c.textSize];

  if (c.accent) {
    colors.accent = c.accent;
    look.frameLine = c.accent;
  }
  if (c.textColor) {
    colors.text = c.textColor;
    colors.sub = rgba(c.textColor, 0.88);
  }
  if (c.textEffect) {
    colors.textShadow =
      c.textEffect === 'soft' ? 'rgba(0,0,0,0.32)' : c.textEffect === 'strong' ? 'rgba(0,0,0,0.9)' : c.textEffect === 'glow' ? rgba(colors.accent, 0.9) : 'rgba(0,0,0,0)';
  }
  if (c.dim) colors.titleDim = withAlpha(colors.titleDim, DIM_ALPHA[c.dim]);

  const fx = c.filter ? FILTER_FX.get(c.filter) : undefined;
  if (fx) Object.assign(effects, fx);
  if (c.particle) {
    const same = effects.particle === c.particle && effects.particles > 0;
    effects.particle = c.particle;
    effects.particles = same ? effects.particles : PARTICLE_COUNT[c.particle];
    effects.particleColors = same ? effects.particleColors : null;
  }
  if (c.amount && effects.particle !== 'none' && effects.particles > 0) effects.particles = Math.max(1, Math.round(effects.particles * AMOUNT[c.amount]));
  if (c.bokeh) effects.bokeh = BOKEH[c.bokeh];
  if (c.sparkles) effects.sparkles = SPARKLES[c.sparkles];
  if (c.glow) effects.glow = GLOW[c.glow];
  if (c.vignette) effects.vignette = VIGNETTE[c.vignette];
  if (c.grain) effects.grain = GRAIN[c.grain];
  if (c.leak) effects.leak = c.leak === 'on' ? 1 : 0;

  if (c.frame) overlays = c.frame === 'none' ? [] : [c.frame];
  if (c.border) photoBorder = BORDER[c.border];
  if (c.transition) {
    transitions = c.transition === 'soft' ? [{ type: 'crossfade', weight: 1 }] : c.transition === 'mix' ? MIX_TRANSITIONS : [{ type: c.transition, weight: 1 }];
  }
  if (c.speed) transitionDuration = Math.round(t.transitionDuration * SPEED[c.speed] * 100) / 100;
  if (c.ornament) look.ornament = c.ornament;
  if (c.nameJoin) look.nameJoin = c.nameJoin;
  if (c.scenes) scene = SCENE_PRESETS[c.scenes];

  return { ...t, fonts, colors, look, effects, titleDesign, titleStyle, transitions, transitionDuration, scene, overlays, photoBorder, textScale, custom: c };
}

/** 양식 + 꾸미기 (예전 저장값의 title·particle도 그대로 받음) */
export interface StyleOptions extends Omit<Customization, 'title' | 'particle'> {
  /** 양식 id (없으면 기본 양식) */
  variant?: string | null;
  /** 오프닝 디자인 ('auto'면 스타일 기본값) */
  title?: TitleDesign | 'auto' | null;
  /** 떠다니는 효과 ('auto'면 스타일 기본값) */
  particle?: ParticleKind | 'auto' | null;
}

const RESOLVED_MAX = 240;
const resolved = new Map<string, Theme>();

export function baseTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

/** 스타일 + 양식 + 꾸미기를 합친 최종 테마 (같은 조합이면 같은 객체) */
export function resolveTheme(id: string, opts: StyleOptions = {}): Theme {
  const base = baseTheme(id);
  const variant = base.variants.find((v) => v.id === opts.variant) ?? base.variants[0];
  // 'variant' 같은 꾸미기 밖의 값은 sanitizeCustom이 걸러 냄
  const custom = sanitizeCustom(opts);
  const key = `${base.id}|${variant?.id ?? ''}|${JSON.stringify(custom)}`;
  const hit = resolved.get(key);
  if (hit) return hit;
  const t: Theme = { ...merge(base, variant?.patch ?? {}), id: base.id, variants: base.variants, variantId: variant?.id ?? '', custom: {} };
  const out = applyCustom(t, custom);
  if (resolved.size >= RESOLVED_MAX) resolved.delete(resolved.keys().next().value!);
  resolved.set(key, out);
  return out;
}

export function getTheme(id: string): Theme {
  return resolveTheme(id);
}

/** 캔버스 font 문자열 (한글 누락 글리프 대비 대체 글꼴 포함). 글자가 작게 보이는 글꼴은 크기를 보정함 */
export function fontSpec(family: string, size: number, weight = 400, italic = false): string {
  const s = size * fontScale(family);
  return `${italic ? 'italic ' : ''}${weight} ${Math.round(s * 100) / 100}px "${family}", "${SANS_KR}", sans-serif`;
}

/** 테마가 사용하는 모든 글꼴 조합 (미리 불러오기용) */
export function themeFontFaces(theme: Theme): { family: string; weight: number; italic: boolean }[] {
  const f = theme.fonts;
  const list = [
    { family: f.title, weight: f.titleWeight, italic: f.titleItalic },
    { family: f.body, weight: f.bodyWeight, italic: false },
    { family: f.body, weight: f.bodyBold, italic: false },
    { family: f.name, weight: f.nameWeight, italic: false },
    { family: f.latin, weight: 500, italic: false },
    { family: f.latin, weight: 500, italic: true },
    { family: f.hand, weight: 400, italic: false },
    { family: f.display, weight: f.displayWeight, italic: false },
    { family: f.mono, weight: 400, italic: false },
    { family: SCRIPT, weight: 400, italic: false },
    { family: LATIN, weight: 500, italic: true },
  ];
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.family}|${x.weight}|${x.italic}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
