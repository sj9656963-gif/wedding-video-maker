// 웹폰트 등록(@fontsource, 번들에 포함)과 캔버스용 미리 불러오기.
// 한글 폰트는 unicode-range로 잘게 나뉘어 있어, 실제로 그릴 글자를 넘겨야 해당 조각만 받아온다.

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

import { fontSpec, themeFontFaces, type Theme } from './themes';

const BASIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:&·-';
const loaded = new Set<string>();

/** 테마 글꼴을 주어진 글자들에 대해 모두 불러올 때까지 기다림 */
export async function ensureFonts(theme: Theme, texts: readonly string[], timeoutMs = 15000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = Array.from(new Set(Array.from(texts.join('') + BASIC))).join('');
  const jobs: Promise<unknown>[] = [];
  for (const face of themeFontFaces(theme)) {
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
  if (jobs.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.allSettled(jobs), timeout]);
  clearTimeout(timer);
}
