// 사진 자원 관리: 썸네일/흐린 배경(항상 메모리에 있음) + 출력 해상도별 고화질 캐시(LRU)

import { createCanvas, get2d } from './design';
import { decodeScaled } from './photos';
import type { Timeline } from './types';

export interface DrawableImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** 렌더러가 사용하는 자원 조회 인터페이스 */
export interface RenderAssets {
  /** 현재 쓸 수 있는 가장 좋은 이미지 (고화질이 없으면 썸네일) */
  image(id: string): DrawableImage | null;
  /** 세로 사진 뒤에 까는 흐린 배경 */
  blur(id: string): DrawableImage | null;
}

/** 'cover'는 화면을 꽉 채우는 용도(더 큰 해상도 필요), 'contain'은 액자형 */
export type Need = 'cover' | 'contain';
const rank = (n: Need) => (n === 'cover' ? 2 : 1);

const BLUR_W = 256;
const BLUR_H = 144;

export function makeBlur(src: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const c = createCanvas(BLUR_W, BLUR_H);
  const ctx = get2d(c);
  const s = Math.max(BLUR_W / src.width, BLUR_H / src.height) * 1.12;
  const dw = src.width * s;
  const dh = src.height * s;
  // Safari 일부 버전은 ctx.filter 미지원 (타입상 항상 있으므로 런타임 확인)
  const supportsFilter = typeof (ctx as { filter?: unknown }).filter === 'string';
  if (supportsFilter) {
    ctx.filter = 'blur(7px) saturate(1.08)';
    ctx.drawImage(src, (BLUR_W - dw) / 2, (BLUR_H - dh) / 2, dw, dh);
    ctx.filter = 'none';
  } else {
    // filter 미지원 브라우저: 아주 작게 줄였다가 키워서 흐리게
    const tiny = createCanvas(24, 14);
    const tctx = get2d(tiny);
    const s2 = Math.max(24 / src.width, 14 / src.height);
    tctx.drawImage(src, (24 - src.width * s2) / 2, (14 - src.height * s2) / 2, src.width * s2, src.height * s2);
    ctx.drawImage(tiny, 0, 0, BLUR_W, BLUR_H);
  }
  return c;
}

/** 모든 사진의 원본 파일, 썸네일, 흐린 배경 보관소 */
export class PhotoLibrary {
  private files = new Map<string, Blob>();
  private thumbs = new Map<string, ImageBitmap>();
  private blurs = new Map<string, HTMLCanvasElement>();

  add(id: string, file: Blob, thumb: ImageBitmap): void {
    this.files.set(id, file);
    this.thumbs.set(id, thumb);
  }

  has(id: string): boolean {
    return this.files.has(id);
  }

  file(id: string): Blob | undefined {
    return this.files.get(id);
  }

  thumb(id: string): DrawableImage | null {
    const t = this.thumbs.get(id);
    return t ? { image: t, width: t.width, height: t.height } : null;
  }

  blur(id: string): DrawableImage | null {
    let b = this.blurs.get(id);
    if (!b) {
      const t = this.thumbs.get(id);
      if (!t) return null;
      b = makeBlur(t);
      this.blurs.set(id, b);
    }
    return { image: b, width: b.width, height: b.height };
  }

  remove(id: string): void {
    this.thumbs.get(id)?.close();
    const b = this.blurs.get(id);
    if (b) b.width = b.height = 0;
    this.files.delete(id);
    this.thumbs.delete(id);
    this.blurs.delete(id);
  }

  clear(): void {
    for (const id of [...this.files.keys()]) this.remove(id);
  }
}

interface Entry {
  bmp: ImageBitmap;
  need: Need;
  used: number;
}

/** 특정 출력 해상도용 고화질 이미지 캐시 */
export class ResolutionCache implements RenderAssets {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<void>>();
  private failedIds = new Set<string>();
  private clock = 0;
  private protectedIds = new Set<string>();
  /** 고화질 이미지가 새로 준비되면 호출 */
  onLoad: (() => void) | null = null;

  constructor(
    private lib: PhotoLibrary,
    readonly outW: number,
    readonly outH: number,
    private capacity = 10,
  ) {}

  /** 원본 대비 디코딩 배율 */
  private scaleFor(need: Need, w: number, h: number): number {
    if (need === 'cover') {
      // 켄번스 확대(최대 ~12%)까지 고려
      return Math.max((this.outW * 1.14) / w, (this.outH * 1.14) / h);
    }
    // 액자형: 화면 높이의 약 86%, 너비의 약 90% 안에 들어감
    return Math.min((this.outW * 0.92) / w, (this.outH * 0.9) / h) * 1.06;
  }

  isReady(id: string, need: Need): boolean {
    const e = this.entries.get(id);
    return (!!e && rank(e.need) >= rank(need)) || this.failedIds.has(id);
  }

  /** 원본을 읽지 못해 썸네일로 대신한 사진 수 */
  get failedCount(): number {
    return this.failedIds.size;
  }

  ensure(id: string, need: Need): Promise<void> {
    const cur = this.entries.get(id);
    if (cur && rank(cur.need) >= rank(need)) {
      cur.used = ++this.clock;
      return Promise.resolve();
    }
    if (this.failedIds.has(id)) return Promise.resolve();
    const key = `${id}|${need}`;
    const inflight = this.pending.get(key) ?? (need === 'contain' ? this.pending.get(`${id}|cover`) : undefined);
    if (inflight) return inflight;
    const file = this.lib.file(id);
    if (!file) return Promise.resolve();
    const job = decodeScaled(file, (w, h) => this.scaleFor(need, w, h))
      .then((bmp) => {
        const old = this.entries.get(id);
        if (!this.lib.has(id) || (old && rank(old.need) >= rank(need))) {
          bmp.close();
          return;
        }
        old?.bmp.close();
        this.entries.set(id, { bmp, need, used: ++this.clock });
        this.evict();
        this.onLoad?.();
      })
      .catch(() => {
        // 파일을 다시 읽지 못함(이동/삭제 등) → 썸네일로 대체
        this.failedIds.add(id);
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }

  /** 필요한 사진들을 미리 불러오기 (완료를 기다리지 않음) */
  prefetch(needs: ReadonlyMap<string, Need>): void {
    this.protectedIds = new Set(needs.keys());
    for (const [id, need] of needs) void this.ensure(id, need);
  }

  /** 필요한 사진이 모두 준비될 때까지 대기 */
  async ensureAll(needs: ReadonlyMap<string, Need>): Promise<void> {
    await Promise.all([...needs].map(([id, need]) => this.ensure(id, need)));
  }

  private evict(): void {
    while (this.entries.size > this.capacity) {
      let victim: string | null = null;
      let oldest = Infinity;
      for (const [id, e] of this.entries) {
        if (this.protectedIds.has(id)) continue;
        if (e.used < oldest) {
          oldest = e.used;
          victim = id;
        }
      }
      if (victim === null) return;
      this.entries.get(victim)!.bmp.close();
      this.entries.delete(victim);
    }
  }

  image(id: string): DrawableImage | null {
    const e = this.entries.get(id);
    if (e) {
      e.used = ++this.clock;
      return { image: e.bmp, width: e.bmp.width, height: e.bmp.height };
    }
    return this.lib.thumb(id);
  }

  blur(id: string): DrawableImage | null {
    return this.lib.blur(id);
  }

  drop(id: string): void {
    this.entries.get(id)?.bmp.close();
    this.entries.delete(id);
    this.failedIds.delete(id);
  }

  clear(): void {
    for (const e of this.entries.values()) e.bmp.close();
    this.entries.clear();
    this.failedIds.clear();
    this.protectedIds.clear();
  }
}

/** [t0, t1] 구간에 필요한 사진과 필요한 해상도 종류 */
export function needsInRange(tl: Timeline, t0: number, t1: number): Map<string, Need> {
  const m = new Map<string, Need>();
  const put = (id: string, need: Need) => {
    if (m.get(id) !== 'cover') m.set(id, need);
  };
  for (const seg of tl.segments) {
    if (seg.start > t1) break;
    if (seg.end < t0) continue;
    if (seg.kind === 'photo') {
      for (const id of seg.photoIds) put(id, seg.layout === 'cover' ? 'cover' : 'contain');
    } else if (seg.photoId) {
      put(seg.photoId, 'cover');
    }
  }
  return m;
}
