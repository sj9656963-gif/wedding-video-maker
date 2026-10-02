// AI 자동 추천: 고르기 어려운 사람을 위해 식전영상에 가장 무난하고 인기 있는 조합을 골라 줌.
// 인기 순으로 골라 둔 추천 조합에, 올린 사진을 살펴본 결과(흑백·초록빛 야외·노을빛·어두운 사진, 세로 사진 비율,
// 촬영 연도)를 더해 추천 순서를 바꾸고 작은 설정을 맞춤. 무엇을 왜 골랐는지는 화면에 그대로 보여 줌.

import { sanitizeCustom, type Customization } from './themes';

/** 미리 골라 둔 추천 조합 */
export interface AiPreset {
  id: string;
  themeId: string;
  variantId: string;
  /** 스타일 기본값 위에 더하는 꾸미기 (적게: 대부분은 스타일 기본값이 가장 잘 어울림) */
  custom: Customization;
  /** 한 줄 소개 */
  headline: string;
  /** 이 스타일을 고른 이유 */
  why: string;
}

/** 인기 순 (맨 앞이 가장 무난한 기본 추천) */
export const AI_PRESETS: readonly AiPreset[] = [
  {
    id: 'classic-ivory',
    themeId: 'classic',
    variantId: 'ivory',
    custom: { particle: 'petals', amount: 'low' },
    headline: '가장 무난하고 인기 있는 조합',
    why: '식전영상에서 가장 많이 고르는 스타일이에요. 아이보리와 골드라 어떤 사진에도 잘 어울리고, 꽃잎을 조금만 흩날려 화사해요.',
  },
  {
    id: 'romantic-blossom',
    themeId: 'romantic',
    variantId: 'blossom',
    custom: { amount: 'low' },
    headline: '화사하고 사랑스럽게',
    why: '벚꽃 핑크 톤에 꽃잎이 흩날리는 사랑스러운 분위기예요. 봄·야외 사진과 특히 잘 어울려요.',
  },
  {
    id: 'classic-champagne',
    themeId: 'classic',
    variantId: 'champagne',
    custom: { sparkles: 'low' },
    headline: '따뜻한 금빛으로 고급스럽게',
    why: '샴페인 골드 색감에 빛줄기 전환이 더해져 호텔 예식처럼 따뜻하고 고급스러워요. 노을·조명 사진과 잘 어울려요.',
  },
  {
    id: 'garden-greenery',
    themeId: 'garden',
    variantId: 'greenery',
    custom: {},
    headline: '야외·자연 사진에 잘 어울리게',
    why: '초록 잎과 리스 오프닝으로 싱그러운 분위기예요. 공원·숲 같은 야외 스냅이 많을 때 잘 어울려요.',
  },
  {
    id: 'royal-pearl',
    themeId: 'royal',
    variantId: 'pearl',
    custom: { amount: 'low' },
    headline: '호텔 예식처럼 격식 있게',
    why: '펄 화이트와 모노그램 오프닝으로 단정하고 격식 있어요. 금가루는 조금만 흩날려요.',
  },
  {
    id: 'classic-blacktie',
    themeId: 'classic',
    variantId: 'blacktie',
    custom: {},
    headline: '흑백·모던 사진에 잘 어울리게',
    why: '블랙과 골드로 흑백 사진이나 모던한 스튜디오 사진을 세련되게 살려 줘요.',
  },
];

// ───────────────────────── 사진 살펴보기 ─────────────────────────

/** 사진 한 장의 색 (작게 줄인 RGBA에서) */
export interface PixelStats {
  /** 평균 밝기 0~1 */
  lum: number;
  /** 평균 채도 0~1 */
  sat: number;
  /** 초록빛(나뭇잎·잔디) 픽셀 비율 */
  green: number;
  /** 노을·조명 같은 주황·금빛 픽셀 비율 */
  warm: number;
}

export function pixelStats(data: ArrayLike<number>): PixelStats {
  let n = 0;
  let lum = 0;
  let sat = 0;
  let green = 0;
  let warm = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d > 0) {
      if (max === r) h = 60 * (((g - b) / d + 6) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    n++;
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat += s;
    if (s > 0.18 && h >= 70 && h <= 170 && l > 0.12) green++;
    if (s > 0.25 && h >= 15 && h <= 50 && l > 0.25) warm++;
  }
  if (!n) return { lum: 0, sat: 0, green: 0, warm: 0 };
  return { lum: lum / n, sat: sat / n, green: green / n, warm: warm / n };
}

/** 사진들을 살펴본 결과 */
export interface PhotoStats {
  count: number;
  /** 세로 사진 수 */
  portrait: number;
  /** 촬영일이 있는 사진 수 */
  dated: number;
  yearFrom: number | null;
  yearTo: number | null;
  /** 색을 살펴본 사진 수 */
  sampled: number;
  /** 살펴본 사진 중 비율 (0~1) */
  bw: number;
  dark: number;
  green: number;
  warm: number;
}

export function summarize(photos: readonly { aspect: number; dateTaken: number | null }[], pix: readonly PixelStats[]): PhotoStats {
  const years = photos.map((p) => (p.dateTaken !== null ? new Date(p.dateTaken).getFullYear() : null)).filter((y): y is number => y !== null && Number.isFinite(y));
  const share = (f: (p: PixelStats) => boolean) => (pix.length ? pix.filter(f).length / pix.length : 0);
  return {
    count: photos.length,
    portrait: photos.filter((p) => p.aspect < 0.95).length,
    dated: years.length,
    yearFrom: years.length ? Math.min(...years) : null,
    yearTo: years.length ? Math.max(...years) : null,
    sampled: pix.length,
    bw: share((p) => p.sat < 0.08),
    dark: share((p) => p.lum < 0.32),
    green: share((p) => p.green > 0.35),
    warm: share((p) => p.warm > 0.4),
  };
}

// ───────────────────────── 추천 ─────────────────────────

/** 사진을 보고 알게 된 것 (화면에 칩으로 보여 줌) */
export interface AiNote {
  text: string;
  /** 그래서 바꾼 것 */
  then?: string;
}

export interface AiPick {
  preset: AiPreset;
  /** 추천 순서 (0 = 가장 추천) */
  rank: number;
  total: number;
  /** 적용할 꾸미기 (추천 조합 + 사진에 맞춘 것) */
  custom: Customization;
  notes: AiNote[];
}

/** 사진을 보고 추천 순서를 정함. 특별한 사진이 아니면 가장 무난한 클래식 · 아이보리 골드가 맨 앞 */
export function rankPresets(stats: PhotoStats | null): AiPreset[] {
  const list = [...AI_PRESETS];
  const moveTo = (id: string, at: number) => {
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = list.splice(i, 1);
    list.splice(Math.min(at, list.length), 0, p);
  };
  if (stats && stats.sampled > 0) {
    if (stats.green >= 0.45) moveTo('garden-greenery', 1);
    if (stats.warm >= 0.45) moveTo('classic-champagne', 1);
    if (stats.bw >= 0.6) moveTo('classic-blacktie', 0);
  }
  return list;
}

/** index번째 추천 (끝까지 가면 처음으로) */
export function recommend(stats: PhotoStats | null, index = 0): AiPick {
  const ranked = rankPresets(stats);
  const rank = ((index % ranked.length) + ranked.length) % ranked.length;
  const preset = ranked[rank];
  const custom: Customization = { ...preset.custom };
  const notes: AiNote[] = [];
  if (stats && stats.count > 0) {
    const pct = (x: number) => Math.round(x * 100);
    notes.push({ text: `사진 ${stats.count}장${stats.portrait ? ` (세로 ${stats.portrait}장)` : ''}` });
    if (stats.portrait / stats.count >= 0.4) notes.push({ text: '세로 사진이 많아요', then: '두 장씩 나란히·액자형으로 섞어 보여 줘요' });
    if (stats.dated >= stats.count * 0.6 && stats.yearFrom !== null && stats.yearTo !== null) {
      notes.push(
        stats.yearTo > stats.yearFrom
          ? { text: `${stats.yearFrom}~${stats.yearTo}년에 찍은 사진`, then: '찍은 순서대로, 해가 바뀌면 연도 자막' }
          : { text: `${stats.yearFrom}년에 찍은 사진`, then: '찍은 순서대로 보여 줘요' },
      );
    }
    if (stats.sampled > 0) {
      if (stats.bw >= 0.6) notes.push({ text: `흑백 사진이 ${pct(stats.bw)}%`, then: "흑백과 잘 어울리는 '블랙 타이'를 먼저 추천" });
      if (stats.green >= 0.45) notes.push({ text: '초록빛 야외 사진이 많아요', then: "'가든'도 잘 어울려요" });
      if (stats.warm >= 0.45) notes.push({ text: '노을·조명처럼 따뜻한 사진이 많아요', then: "'샴페인'도 잘 어울려요" });
      if (stats.dark >= 0.5) {
        custom.dim = 'low';
        notes.push({ text: '어두운 사진이 많아요', then: '오프닝·엔딩 배경 사진을 덜 어둡게' });
      }
    }
    if (stats.count < 20) notes.push({ text: '사진이 적어요', then: '30장 이상이면 장면이 더 다양해요' });
    else if (stats.count >= 60) notes.push({ text: '사진이 많아요', then: '여러 장을 한 화면에 모아 보여 줘요' });
  }
  return { preset, rank, total: ranked.length, custom: sanitizeCustom(custom), notes };
}

/** 지금 설정이 이 추천과 같은지 (스타일·양식·꾸미기) */
export function matchesPick(pick: { themeId: string; variantId: string; custom: Customization }, cur: { themeId: string; variantId: string | null; custom: Customization }, firstVariant: string): boolean {
  if (pick.themeId !== cur.themeId || pick.variantId !== (cur.variantId ?? firstVariant)) return false;
  const a = pick.custom as Record<string, unknown>;
  const b = cur.custom as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}
