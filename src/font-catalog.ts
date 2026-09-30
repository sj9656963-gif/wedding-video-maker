// 글씨체 목록 (순수 데이터, DOM 없음): 꾸미기에서 고르는 한글·영문 글꼴, 번들에 넣은 굵기, 크기 보정.
// 글꼴 파일은 fonts.ts가 필요할 때(고르거나 미리 볼 때) 불러옴.

export type FontGroup = 'serif' | 'sans' | 'cute' | 'bold' | 'hand' | 'brush' | 'script' | 'classic' | 'modern';

export const FONT_GROUPS: Record<FontGroup, string> = {
  serif: '명조 · 바탕',
  sans: '고딕 · 돋움',
  cute: '동글동글',
  bold: '굵은 · 개성',
  hand: '손글씨',
  brush: '붓글씨',
  script: '필기체',
  classic: '클래식 세리프',
  modern: '모던 · 굵은',
};

export interface FontDef {
  /** 고유 id (대부분 글꼴 이름과 같음. 기울임꼴처럼 한 글꼴의 다른 모양은 따로) */
  id: string;
  family: string;
  /** 화면에 보여 줄 이름 */
  name: string;
  /** 한글 글자가 들어 있는지 */
  kr: boolean;
  group: FontGroup;
  /** 번들에 넣은 굵기 */
  weights: readonly number[];
  /** 영문 제목으로 쓸 때 굵기·기울임 */
  weight?: number;
  italic?: boolean;
  /** 영문 제목 모양: script = 대소문자 그대로 크게, caps = 자간 넓은 대문자 */
  titleStyle?: 'script' | 'caps';
  /** 같은 크기에서 글자가 작게 보이면 1보다 크게 (1 = 보통) */
  scale?: number;
}

function kr(family: string, name: string, group: FontGroup, weights: readonly number[], scale?: number): FontDef {
  return { id: family, family, name, kr: true, group, weights, scale };
}

function en(
  family: string,
  group: FontGroup,
  weights: readonly number[],
  o: { name?: string; id?: string; weight?: number; italic?: boolean; titleStyle: 'script' | 'caps'; scale?: number },
): FontDef {
  return {
    id: o.id ?? family,
    family,
    name: o.name ?? family,
    kr: false,
    group,
    weights,
    weight: o.weight ?? weights[0],
    italic: o.italic,
    titleStyle: o.titleStyle,
    scale: o.scale,
  };
}

/** 한글 글꼴 (제목·이름, 본문, 손글씨에 사용) */
export const KR_FONTS: readonly FontDef[] = [
  kr('Gowun Batang', '고운바탕', 'serif', [400, 700]),
  kr('Nanum Myeongjo', '나눔명조', 'serif', [400, 700]),
  kr('Noto Serif KR', '본명조', 'serif', [400, 700]),
  kr('Hahmlet', '함렛', 'serif', [400, 700]),
  kr('Song Myung', '송명', 'serif', [400]),
  kr('Diphylleia', '산하엽', 'serif', [400]),
  kr('Pretendard Variable', '프리텐다드', 'sans', [400, 500, 700]),
  kr('Noto Sans KR', '본고딕', 'sans', [400, 500, 700]),
  kr('Gowun Dodum', '고운돋움', 'sans', [400]),
  kr('Nanum Gothic', '나눔고딕', 'sans', [400, 700]),
  kr('IBM Plex Sans KR', 'IBM 플렉스', 'sans', [400, 600]),
  kr('Sunflower', '해바라기', 'sans', [500, 700]),
  kr('Orbit', '오르빗', 'sans', [400]),
  kr('Nanum Gothic Coding', '나눔고딕코딩', 'sans', [400, 700]),
  kr('Jua', '주아', 'cute', [400]),
  kr('Dongle', '동글', 'cute', [400, 700], 1.5),
  kr('Cute Font', '큐트', 'cute', [400], 1.3),
  kr('Bagel Fat One', '베이글', 'cute', [400]),
  kr('Black Han Sans', '검은고딕', 'bold', [400]),
  kr('Do Hyeon', '도현', 'bold', [400]),
  kr('Gugi', '구기', 'bold', [400]),
  kr('Stylish', '스타일리시', 'bold', [400]),
  kr('Grandiflora One', '그랜디플로라', 'bold', [400]),
  kr('Nanum Pen Script', '나눔손글씨 펜', 'hand', [400]),
  kr('Gaegu', '개구', 'hand', [400, 700], 1.05),
  kr('Gamja Flower', '감자꽃', 'hand', [400]),
  kr('Poor Story', '푸어 스토리', 'hand', [400]),
  kr('Hi Melody', '하이 멜로디', 'hand', [400], 1.12),
  kr('Single Day', '싱글데이', 'hand', [400]),
  kr('Yeon Sung', '연성', 'hand', [400]),
  kr('Nanum Brush Script', '나눔손글씨 붓', 'brush', [400], 1.08),
  kr('East Sea Dokdo', '동해 독도', 'brush', [400], 1.3),
  kr('Dokdo', '독도', 'brush', [400], 1.05),
  kr('Kirang Haerang', '기랑해랑', 'brush', [400], 1.1),
];

/** 영문 제목 글꼴 (Our Wedding Day 같은 영어 제목) */
export const LATIN_FONTS: readonly FontDef[] = [
  en('Great Vibes', 'script', [400], { titleStyle: 'script' }),
  en('Dancing Script', 'script', [400], { titleStyle: 'script' }),
  en('Parisienne', 'script', [400], { titleStyle: 'script', scale: 0.95 }),
  en('Allura', 'script', [400], { titleStyle: 'script', scale: 1.1 }),
  en('Pinyon Script', 'script', [400], { titleStyle: 'script', scale: 0.95 }),
  en('Sacramento', 'script', [400], { titleStyle: 'script', scale: 1.2 }),
  en('Alex Brush', 'script', [400], { titleStyle: 'script', scale: 1.05 }),
  en('Tangerine', 'script', [700], { titleStyle: 'script', scale: 1.5 }),
  en('Italianno', 'script', [400], { titleStyle: 'script', scale: 1.3 }),
  en('Style Script', 'script', [400], { titleStyle: 'script' }),
  en('Ms Madi', 'script', [400], { titleStyle: 'script', scale: 1.15 }),
  en('Birthstone', 'script', [400], { titleStyle: 'script', scale: 1.1 }),
  en('Mea Culpa', 'script', [400], { titleStyle: 'script', scale: 1.05 }),
  en('Rouge Script', 'script', [400], { titleStyle: 'script', scale: 1.1 }),
  en('Satisfy', 'script', [400], { titleStyle: 'script' }),
  en('Yellowtail', 'script', [400], { titleStyle: 'script' }),
  en('Cookie', 'script', [400], { titleStyle: 'script', scale: 1.1 }),
  en('Kaushan Script', 'script', [400], { titleStyle: 'script', scale: 0.95 }),
  en('Pacifico', 'script', [400], { titleStyle: 'script', scale: 0.85 }),
  en('Lobster', 'script', [400], { titleStyle: 'script', scale: 0.95 }),
  en('Homemade Apple', 'script', [400], { titleStyle: 'script', scale: 0.85 }),
  en('Caveat', 'script', [600], { titleStyle: 'script', scale: 1.15 }),
  en('Shadows Into Light', 'script', [400], { titleStyle: 'script', scale: 1.1 }),
  en('Cormorant Garamond', 'classic', [500], { name: 'Cormorant', titleStyle: 'caps' }),
  en('Cormorant Garamond', 'classic', [500], { name: 'Cormorant Italic', id: 'Cormorant Garamond Italic', italic: true, titleStyle: 'script' }),
  en('Cinzel', 'classic', [500, 600], { weight: 600, titleStyle: 'caps' }),
  en('Playfair Display', 'classic', [600], { name: 'Playfair', titleStyle: 'caps' }),
  en('Playfair Display', 'classic', [500], { name: 'Playfair Italic', id: 'Playfair Display Italic', italic: true, titleStyle: 'script' }),
  en('Bodoni Moda', 'classic', [500], { name: 'Bodoni', titleStyle: 'caps' }),
  en('Bodoni Moda', 'classic', [500], { name: 'Bodoni Italic', id: 'Bodoni Moda Italic', italic: true, titleStyle: 'script' }),
  en('Lora', 'classic', [500], { name: 'Lora Italic', id: 'Lora Italic', italic: true, titleStyle: 'script' }),
  en('Marcellus', 'classic', [400], { titleStyle: 'caps' }),
  en('Abril Fatface', 'classic', [400], { titleStyle: 'script', scale: 0.95 }),
  en('Montserrat', 'modern', [500], { titleStyle: 'caps' }),
  en('Josefin Sans', 'modern', [400], { titleStyle: 'caps' }),
  en('Quicksand', 'modern', [600], { titleStyle: 'script' }),
  en('Fredoka', 'modern', [600], { titleStyle: 'script' }),
  en('Baloo 2', 'modern', [700], { titleStyle: 'script', scale: 0.95 }),
  en('Bebas Neue', 'modern', [400], { titleStyle: 'caps' }),
  en('Anton', 'modern', [400], { titleStyle: 'caps' }),
  en('Amatic SC', 'modern', [700], { titleStyle: 'caps', scale: 1.25 }),
  en('Monoton', 'modern', [400], { titleStyle: 'caps', scale: 0.85 }),
  en('VT323', 'modern', [400], { titleStyle: 'caps' }),
];

/** 글꼴을 쓰는 자리 */
export type FontRole = 'title' | 'name' | 'body' | 'hand';

export const FONT_ROLES: readonly { id: FontRole; name: string; desc: string; sample: string }[] = [
  { id: 'title', name: '영문 제목', desc: 'Our Wedding Day 같은 영어 제목', sample: 'Wedding Day' },
  { id: 'name', name: '제목 · 이름', desc: '한글 제목과 신랑·신부 이름', sample: '우리 결혼해요' },
  { id: 'body', name: '본문', desc: '날짜·장소·인사말·문구', sample: '감사합니다' },
  { id: 'hand', name: '손글씨', desc: '폴라로이드·액자 아래 사진 문구', sample: '봄 소풍' },
];

const BY_ID = new Map<string, FontDef>([...KR_FONTS, ...LATIN_FONTS].map((f) => [f.id, f]));

export function fontById(id: string | null | undefined): FontDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** 자리마다 고를 수 있는 글꼴 */
export function fontsForRole(role: FontRole): readonly FontDef[] {
  if (role === 'title') return LATIN_FONTS;
  if (role === 'hand') return KR_FONTS.filter((f) => f.group === 'hand' || f.group === 'brush' || f.group === 'cute');
  return KR_FONTS;
}

/** 번들에 있는 굵기 중 target에 가장 가까운 굵기 (같으면 더 굵은 쪽) */
export function nearestWeight(def: FontDef, target: number): number {
  let best = def.weights[0];
  for (const w of def.weights) {
    const d = Math.abs(w - target);
    const bd = Math.abs(best - target);
    if (d < bd || (d === bd && w > best)) best = w;
  }
  return best;
}

/** 같은 크기에서 보이는 글자 크기를 맞추는 배율 */
const SCALE = new Map<string, number>();
for (const f of [...KR_FONTS, ...LATIN_FONTS]) if (f.scale && f.scale !== 1) SCALE.set(f.family, f.scale);

export function fontScale(family: string): number {
  return SCALE.get(family) ?? 1;
}

/** 전체 글씨체 수 (홍보 문구용: 같은 글꼴의 기울임꼴은 하나로 셈) */
export function fontFamilyCount(): number {
  return new Set([...KR_FONTS, ...LATIN_FONTS].map((f) => f.family)).size;
}
