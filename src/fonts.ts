// 웹폰트 등록(@fontsource, 번들에 포함)과 캔버스용 미리 불러오기.
// 한글 폰트는 unicode-range로 잘게 나뉘어 있어, 실제로 그릴 글자를 넘겨야 해당 조각만 받아온다.
// 기본 스타일에 쓰는 글꼴은 처음부터 등록하고, 꾸미기에서 고르는 글꼴은 필요할 때 등록(CSS를 나중에 불러옴)한다.

import '@fontsource/gowun-batang/400.css';
import '@fontsource/gowun-batang/700.css';
import '@fontsource/great-vibes/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/nanum-myeongjo/400.css';
import '@fontsource/nanum-myeongjo/700.css';
import '@fontsource/nanum-pen-script/400.css';
import '@fontsource/black-han-sans/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/vt323/400.css';
import '@fontsource/nanum-gothic-coding/400.css';
import '@fontsource/nanum-gothic-coding/700.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

import { KR_FONTS, LATIN_FONTS } from './font-catalog';
import { fontSpec, themeFontFaces, type Theme } from './themes';

/** 나중에 등록하는 글꼴: 글꼴 이름 → CSS 불러오기 (경로는 번들러가 알 수 있게 그대로 적어 둠) */
const LAZY: Record<string, () => Promise<unknown>> = {
  'Noto Serif KR': () => Promise.all([import('@fontsource/noto-serif-kr/400.css'), import('@fontsource/noto-serif-kr/700.css')]),
  Hahmlet: () => Promise.all([import('@fontsource/hahmlet/400.css'), import('@fontsource/hahmlet/700.css')]),
  'Song Myung': () => import('@fontsource/song-myung/400.css'),
  Diphylleia: () => import('@fontsource/diphylleia/400.css'),
  'Gowun Dodum': () => import('@fontsource/gowun-dodum/400.css'),
  'Nanum Gothic': () => Promise.all([import('@fontsource/nanum-gothic/400.css'), import('@fontsource/nanum-gothic/700.css')]),
  'IBM Plex Sans KR': () => Promise.all([import('@fontsource/ibm-plex-sans-kr/400.css'), import('@fontsource/ibm-plex-sans-kr/600.css')]),
  Sunflower: () => Promise.all([import('@fontsource/sunflower/500.css'), import('@fontsource/sunflower/700.css')]),
  Orbit: () => import('@fontsource/orbit/400.css'),
  Jua: () => import('@fontsource/jua/400.css'),
  Dongle: () => Promise.all([import('@fontsource/dongle/400.css'), import('@fontsource/dongle/700.css')]),
  'Cute Font': () => import('@fontsource/cute-font/400.css'),
  'Bagel Fat One': () => import('@fontsource/bagel-fat-one/400.css'),
  'Do Hyeon': () => import('@fontsource/do-hyeon/400.css'),
  Gugi: () => import('@fontsource/gugi/400.css'),
  Stylish: () => import('@fontsource/stylish/400.css'),
  'Grandiflora One': () => import('@fontsource/grandiflora-one/400.css'),
  Gaegu: () => Promise.all([import('@fontsource/gaegu/400.css'), import('@fontsource/gaegu/700.css')]),
  'Gamja Flower': () => import('@fontsource/gamja-flower/400.css'),
  'Poor Story': () => import('@fontsource/poor-story/400.css'),
  'Hi Melody': () => import('@fontsource/hi-melody/400.css'),
  'Single Day': () => import('@fontsource/single-day/400.css'),
  'Yeon Sung': () => import('@fontsource/yeon-sung/400.css'),
  'Nanum Brush Script': () => import('@fontsource/nanum-brush-script/400.css'),
  'East Sea Dokdo': () => import('@fontsource/east-sea-dokdo/400.css'),
  Dokdo: () => import('@fontsource/dokdo/400.css'),
  'Kirang Haerang': () => import('@fontsource/kirang-haerang/400.css'),
  'Dancing Script': () => import('@fontsource/dancing-script/400.css'),
  Parisienne: () => import('@fontsource/parisienne/400.css'),
  Allura: () => import('@fontsource/allura/400.css'),
  'Pinyon Script': () => import('@fontsource/pinyon-script/400.css'),
  Sacramento: () => import('@fontsource/sacramento/400.css'),
  'Alex Brush': () => import('@fontsource/alex-brush/400.css'),
  Tangerine: () => import('@fontsource/tangerine/700.css'),
  Italianno: () => import('@fontsource/italianno/400.css'),
  'Style Script': () => import('@fontsource/style-script/400.css'),
  'Ms Madi': () => import('@fontsource/ms-madi/400.css'),
  Birthstone: () => import('@fontsource/birthstone/400.css'),
  'Mea Culpa': () => import('@fontsource/mea-culpa/400.css'),
  'Rouge Script': () => import('@fontsource/rouge-script/400.css'),
  Satisfy: () => import('@fontsource/satisfy/400.css'),
  Yellowtail: () => import('@fontsource/yellowtail/400.css'),
  Cookie: () => import('@fontsource/cookie/400.css'),
  'Kaushan Script': () => import('@fontsource/kaushan-script/400.css'),
  Pacifico: () => import('@fontsource/pacifico/400.css'),
  Lobster: () => import('@fontsource/lobster/400.css'),
  'Homemade Apple': () => import('@fontsource/homemade-apple/400.css'),
  Caveat: () => import('@fontsource/caveat/600.css'),
  'Shadows Into Light': () => import('@fontsource/shadows-into-light/400.css'),
  'Playfair Display': () => Promise.all([import('@fontsource/playfair-display/600.css'), import('@fontsource/playfair-display/500-italic.css')]),
  'Bodoni Moda': () => Promise.all([import('@fontsource/bodoni-moda/500.css'), import('@fontsource/bodoni-moda/500-italic.css')]),
  Lora: () => import('@fontsource/lora/500-italic.css'),
  Marcellus: () => import('@fontsource/marcellus/400.css'),
  'Abril Fatface': () => import('@fontsource/abril-fatface/400.css'),
  Montserrat: () => import('@fontsource/montserrat/500.css'),
  'Josefin Sans': () => import('@fontsource/josefin-sans/400.css'),
  Quicksand: () => import('@fontsource/quicksand/600.css'),
  Fredoka: () => import('@fontsource/fredoka/600.css'),
  'Baloo 2': () => import('@fontsource/baloo-2/700.css'),
  'Bebas Neue': () => import('@fontsource/bebas-neue/400.css'),
  'Amatic SC': () => import('@fontsource/amatic-sc/700.css'),
  Monoton: () => import('@fontsource/monoton/400.css'),
};

const cssJobs = new Map<string, Promise<void>>();
const cssDone = new Set<string>();

/** 처음부터 등록된 글꼴 (위 import) */
const STATIC_FAMILIES = new Set([
  'Gowun Batang',
  'Great Vibes',
  'Cormorant Garamond',
  'Noto Sans KR',
  'Nanum Myeongjo',
  'Nanum Pen Script',
  'Black Han Sans',
  'Anton',
  'Cinzel',
  'VT323',
  'Nanum Gothic Coding',
  'Pretendard Variable',
]);

/** 이 글꼴을 쓸 수 있는지 (처음부터 등록됐거나 나중에 불러올 수 있음) */
export function isFontAvailable(family: string): boolean {
  return STATIC_FAMILIES.has(family) || Object.hasOwn(LAZY, family);
}

/** 글꼴의 @font-face 등록 (처음부터 등록된 글꼴은 바로 끝남). 실패해도 대체 글꼴로 계속 진행 */
export function loadFontCss(families: Iterable<string>): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const family of new Set(families)) {
    const load = LAZY[family];
    if (!load || cssDone.has(family)) continue;
    let job = cssJobs.get(family);
    if (!job) {
      job = load().then(
        () => {
          cssDone.add(family);
        },
        () => {
          cssJobs.delete(family); // 인터넷이 끊겼던 경우 다음에 다시 시도
        },
      );
      cssJobs.set(family, job);
    }
    jobs.push(job);
  }
  return jobs.length ? Promise.all(jobs).then(() => undefined) : Promise.resolve();
}

/** 글씨체 고르기 목록의 미리보기용: 모든 글꼴 등록 */
export function loadAllFontCss(): Promise<void> {
  return loadFontCss([...KR_FONTS, ...LATIN_FONTS].map((f) => f.family));
}

const BASIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:&·-';
const loaded = new Set<string>();

function sampleOf(texts: readonly string[]): string {
  return Array.from(new Set(Array.from(texts.join('') + BASIC))).join('');
}

/** 테마 글꼴이 주어진 글자들에 대해 이미 준비됐는지 (기다리지 않고 바로 그려도 되는지) */
export function fontsReady(theme: Theme, texts: readonly string[]): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  const sample = sampleOf(texts);
  return themeFontFaces(theme).every((face) => {
    const spec = fontSpec(face.family, 40, face.weight, face.italic);
    if (loaded.has(`${spec}|${sample}`)) return true;
    if (LAZY[face.family] && !cssDone.has(face.family)) return false;
    try {
      return document.fonts.check(spec, sample);
    } catch {
      return true;
    }
  });
}

/** 테마 글꼴을 주어진 글자들에 대해 모두 불러올 때까지 기다림 */
export async function ensureFonts(theme: Theme, texts: readonly string[], timeoutMs = 15000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const faces = themeFontFaces(theme);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const run = async () => {
    await loadFontCss(faces.map((f) => f.family));
    const sample = sampleOf(texts);
    const jobs: Promise<unknown>[] = [];
    for (const face of faces) {
      const spec = fontSpec(face.family, 40, face.weight, face.italic);
      const key = `${spec}|${sample}`;
      if (loaded.has(key)) continue;
      jobs.push(
        document.fonts.load(spec, sample).then(
          () => loaded.add(key),
          () => undefined, // 실패해도 대체 글꼴로 계속 진행
        ),
      );
    }
    await Promise.allSettled(jobs);
  };
  await Promise.race([run(), timeout]);
  clearTimeout(timer);
}
