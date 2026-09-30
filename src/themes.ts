// 영상 스타일(테마) 10종과 스타일 안의 양식(색·연출 변형), 오프닝 디자인·효과 선택.
// 스타일 = 기본 연출 묶음, 양식 = 스타일 위에 덮어쓰는 부분 설정(patch). resolveTheme()이 합쳐서 돌려줌.

import type { TransitionType } from './types';

export type ThemeId = 'romantic' | 'classic' | 'modern' | 'film' | 'street' | 'neon' | 'camcorder' | 'cinema' | 'garden' | 'gallery';

/** 스타일 고르기용 분위기 분류 */
export type MoodId = 'lovely' | 'elegant' | 'hip' | 'vintage' | 'minimal' | 'natural';
export const MOODS: readonly { id: MoodId; name: string }[] = [
  { id: 'lovely', name: '사랑스러운' },
  { id: 'elegant', name: '우아한' },
  { id: 'hip', name: '힙한' },
  { id: 'vintage', name: '빈티지' },
  { id: 'minimal', name: '모던·미니멀' },
  { id: 'natural', name: '내추럴' },
];

/** 오프닝·엔딩 문구 디자인 */
export type TitleDesign = 'classic' | 'invitation' | 'movie' | 'kinetic' | 'neon' | 'camcorder' | 'wreath' | 'exhibition';
export const TITLE_DESIGNS: readonly { id: TitleDesign; name: string; desc: string }[] = [
  { id: 'classic', name: '클래식', desc: '필기체 제목과 이름이 차례로' },
  { id: 'invitation', name: '청첩장', desc: '종이 카드가 떠오르듯' },
  { id: 'movie', name: '무비 크레딧', desc: '영화 오프닝처럼' },
  { id: 'kinetic', name: '키네틱', desc: '큰 글자가 튀어 들어오는' },
  { id: 'neon', name: '네온사인', desc: '깜빡이며 켜지는 네온' },
  { id: 'camcorder', name: '캠코더', desc: '타자 치듯 한 글자씩' },
  { id: 'wreath', name: '리스', desc: '나뭇잎 화관이 그려지는' },
  { id: 'exhibition', name: '전시 포스터', desc: '갤러리 전시 안내처럼' },
];

/** 화면 위를 떠다니는 효과 */
export type ParticleKind = 'petals' | 'hearts' | 'leaves' | 'snow' | 'confetti' | 'none';
export const PARTICLES: readonly { id: ParticleKind; name: string }[] = [
  { id: 'petals', name: '꽃잎' },
  { id: 'hearts', name: '하트' },
  { id: 'leaves', name: '나뭇잎' },
  { id: 'snow', name: '눈송이' },
  { id: 'confetti', name: '컨페티' },
  { id: 'none', name: '없음' },
];
const PARTICLE_COUNT: Record<ParticleKind, number> = { petals: 24, hearts: 14, leaves: 16, snow: 70, confetti: 26, none: 0 };

/** 영상 전체에 덧씌우는 장치 */
export type OverlayKind = 'letterbox' | 'camcorder' | 'datestamp' | 'vhs' | 'marks' | 'gate';

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
  ornament: 'heart' | 'diamond' | 'leaf' | 'star' | 'line';
  /** 신랑·신부 이름 사이 */
  nameJoin: 'heart' | 'amp' | 'cross';
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
    /** 이름 */
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
  /** 이 스타일에서 고를 수 있는 양식 (첫 번째가 기본) */
  variants: StyleVariant[];
  /** 적용된 양식 id */
  variantId: string;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type ThemePatch = DeepPartial<Omit<Theme, 'id' | 'variants' | 'variantId'>>;

export interface StyleVariant {
  id: string;
  name: string;
  swatch: [string, string];
  patch: ThemePatch;
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
    nameWeight: 700,
    latin: LATIN,
    hand: HAND,
    display: ANTON,
    displayWeight: 400,
    mono: VT,
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
  },
  overlays: [],
  photoBorder: 10,
  variants: [],
  variantId: '',
};

function define(p: ThemePatch & { id: ThemeId; variants: StyleVariant[] }): Theme {
  const { id, variants, ...rest } = p;
  return { ...merge(BASE, rest), id, variants, variantId: variants[0]?.id ?? '' };
}

export const THEMES: Theme[] = [
  define({
    id: 'romantic',
    name: '로맨틱',
    label: 'Romantic',
    description: '타원 액자와 폴라로이드, 꽃잎과 별빛이 흐르는 사랑스러운 연출',
    highlights: ['타원 액자', '폴라로이드', '베일·꽃잎 전환', '별빛·보케'],
    moods: ['lovely'],
    badge: '가장 인기',
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
    highlights: ['골드 타이틀', '빛 번짐 전환', '액자형 배치', '두 장 나란히'],
    moods: ['elegant'],
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
    ],
  }),
  define({
    id: 'cinema',
    name: '시네마',
    label: 'Cinema',
    description: '레터박스와 렌즈 플레어, 영화 크레딧처럼 흐르는 오프닝',
    highlights: ['무비 크레딧', '레터박스', '렌즈 플레어', '영화 색감'],
    moods: ['elegant'],
    badge: 'NEW',
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
    effects: { vignette: 0.55, grain: 0.09, warm: 0.3, desaturate: 0.18, bokehColor: '255,200,140', glow: 0.06, flicker: true },
    photoBorder: 12,
    variants: [
      { id: 'kodak', name: '코닥 웜', swatch: ['#3a2a1c', '#e0b77a'], patch: {} },
      {
        id: 'fade',
        name: '폴라 페이드',
        swatch: ['#dfe6e2', '#7a9a9a'],
        patch: {
          effects: { warm: 0.12, desaturate: 0.3, tint: 'rgba(170,220,225,0.16)', flicker: false, grain: 0.06 },
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
];

export const DEFAULT_THEME_ID: ThemeId = 'romantic';

export interface StyleOptions {
  /** 양식 id (없으면 기본 양식) */
  variant?: string | null;
  /** 오프닝 디자인 ('auto'면 스타일 기본값) */
  title?: TitleDesign | 'auto' | null;
  /** 떠다니는 효과 ('auto'면 스타일 기본값) */
  particle?: ParticleKind | 'auto' | null;
}

const TITLE_IDS = new Set<string>(TITLE_DESIGNS.map((d) => d.id));
const PARTICLE_IDS = new Set<string>(PARTICLES.map((p) => p.id));
const resolved = new Map<string, Theme>();

export function baseTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

/** 스타일 + 양식 + 오프닝/효과 선택을 합친 최종 테마 (같은 조합이면 같은 객체) */
export function resolveTheme(id: string, opts: StyleOptions = {}): Theme {
  const base = baseTheme(id);
  const variant = base.variants.find((v) => v.id === opts.variant) ?? base.variants[0];
  const title = opts.title && TITLE_IDS.has(opts.title) ? (opts.title as TitleDesign) : null;
  const particle = opts.particle && PARTICLE_IDS.has(opts.particle) ? (opts.particle as ParticleKind) : null;
  const key = `${base.id}|${variant?.id ?? ''}|${title ?? ''}|${particle ?? ''}`;
  const hit = resolved.get(key);
  if (hit) return hit;
  let t: Theme = { ...merge(base, variant?.patch ?? {}), id: base.id, variants: base.variants, variantId: variant?.id ?? '' };
  if (title) t = { ...t, titleDesign: title };
  if (particle) {
    const same = t.effects.particle === particle && t.effects.particles > 0;
    t = {
      ...t,
      effects: {
        ...t.effects,
        particle,
        particles: same ? t.effects.particles : PARTICLE_COUNT[particle],
        particleColors: same ? t.effects.particleColors : null,
      },
    };
  }
  resolved.set(key, t);
  return t;
}

export function getTheme(id: string): Theme {
  return resolveTheme(id);
}

/** 캔버스 font 문자열 (한글 누락 글리프 대비 대체 글꼴 포함) */
export function fontSpec(family: string, size: number, weight = 400, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 100) / 100}px "${family}", "${SANS_KR}", sans-serif`;
}

/** 테마가 사용하는 모든 글꼴 조합 (미리 불러오기용) */
export function themeFontFaces(theme: Theme): { family: string; weight: number; italic: boolean }[] {
  const f = theme.fonts;
  const list = [
    { family: f.title, weight: f.titleWeight, italic: f.titleItalic },
    { family: f.body, weight: f.bodyWeight, italic: false },
    { family: f.body, weight: f.nameWeight, italic: false },
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
