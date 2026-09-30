// 배경음악 믹싱: 여러 곡을 이어 붙이고(크로스페이드), 짧으면 반복, 끝은 페이드아웃.
// Float32Array만 다루는 순수 모듈.

export interface PcmTrack {
  /** 채널별 샘플 (1채널이면 스테레오로 복제) */
  channels: Float32Array[];
  sampleRate: number;
}

export interface MixOptions {
  /** 곡과 곡 사이 크로스페이드(초) */
  crossfade?: number;
  /** 시작 페이드인(초) */
  fadeIn?: number;
  /** 끝 페이드아웃(초) */
  fadeOut?: number;
  /** 곡 앞뒤의 무음 제거 */
  trim?: boolean;
}

const DEFAULTS: Required<MixOptions> = { crossfade: 2.5, fadeIn: 0.4, fadeOut: 4, trim: true };

/** 소리가 나는 구간 [start, end) (샘플 단위). 앞뒤 무음을 잘라냄. */
export function findAudibleRange(
  channels: readonly Float32Array[],
  threshold = 0.003,
  marginSamples = 0,
): { start: number; end: number } {
  const len = Math.min(...channels.map((c) => c.length));
  if (!Number.isFinite(len) || len <= 0) return { start: 0, end: 0 };
  const loud = (i: number) => channels.some((c) => Math.abs(c[i]) > threshold);
  let start = 0;
  while (start < len && !loud(start)) start++;
  if (start >= len) return { start: 0, end: 0 };
  let end = len;
  while (end > start && !loud(end - 1)) end--;
  return { start: Math.max(0, start - marginSamples), end: Math.min(len, end + marginSamples) };
}

interface Item {
  left: Float32Array;
  right: Float32Array;
  start: number;
  len: number;
}

function prepareItems(tracks: readonly PcmTrack[], sampleRate: number, trim: boolean): Item[] {
  const items: Item[] = [];
  for (const t of tracks) {
    if (t.sampleRate !== sampleRate) {
      throw new Error(`샘플레이트 불일치: ${t.sampleRate} != ${sampleRate}`);
    }
    if (t.channels.length === 0) continue;
    const left = t.channels[0];
    const right = t.channels[1] ?? t.channels[0];
    const range = trim
      ? findAudibleRange([left, right], 0.003, Math.round(sampleRate * 0.05))
      : { start: 0, end: Math.min(left.length, right.length) };
    const len = range.end - range.start;
    // 0.5초 미만의 곡은 무시
    if (len < sampleRate * 0.5) continue;
    items.push({ left, right, start: range.start, len });
  }
  return items;
}

function crossfadeBetween(cf: number, a: number, b: number): number {
  return Math.max(0, Math.min(cf, Math.floor(a / 3), Math.floor(b / 3)));
}

/** 곡들을 한 번씩 이어 붙였을 때의 길이(초) */
export function playlistDuration(tracks: readonly PcmTrack[], sampleRate: number, options: MixOptions = {}): number {
  const opts = { ...DEFAULTS, ...options };
  const items = prepareItems(tracks, sampleRate, opts.trim);
  if (items.length === 0) return 0;
  const cf = Math.round(opts.crossfade * sampleRate);
  let total = items[0].len;
  for (let i = 1; i < items.length; i++) {
    total += items[i].len - crossfadeBetween(cf, items[i - 1].len, items[i].len);
  }
  return total / sampleRate;
}

/** 0.9를 넘는 부분만 부드럽게 눌러 클리핑 방지 */
function softClip(x: number): number {
  const a = Math.abs(x);
  if (a <= 0.9) return x;
  const y = 0.9 + 0.0999 * Math.tanh((a - 0.9) / 0.1);
  return x < 0 ? -y : y;
}

/**
 * 곡 목록을 totalSamples 길이의 스테레오 트랙으로 믹스.
 * 곡이 부족하면 처음부터 반복하며, 곡 사이는 등전력 크로스페이드.
 */
export function mixPlaylist(
  tracks: readonly PcmTrack[],
  totalSamples: number,
  sampleRate: number,
  options: MixOptions = {},
): [Float32Array, Float32Array] {
  const opts = { ...DEFAULTS, ...options };
  const outL = new Float32Array(Math.max(0, totalSamples));
  const outR = new Float32Array(Math.max(0, totalSamples));
  const items = prepareItems(tracks, sampleRate, opts.trim);
  if (items.length === 0 || totalSamples <= 0) return [outL, outR];

  const cf = Math.round(opts.crossfade * sampleRate);

  // 배치 계산
  const placements: { item: Item; offset: number; fadeIn: number; fadeOut: number }[] = [];
  let offset = 0;
  let k = 0;
  while (offset < totalSamples) {
    const item = items[k % items.length];
    placements.push({ item, offset, fadeIn: 0, fadeOut: 0 });
    const next = items[(k + 1) % items.length];
    const x = crossfadeBetween(cf, item.len, next.len);
    offset += item.len - x;
    k++;
    if (k > 100000) break; // 안전장치
  }
  for (let i = 1; i < placements.length; i++) {
    const prev = placements[i - 1];
    const x = prev.offset + prev.item.len - placements[i].offset;
    prev.fadeOut = x;
    placements[i].fadeIn = x;
  }

  const halfPi = Math.PI / 2;
  for (const p of placements) {
    const { item, fadeIn, fadeOut } = p;
    const n = Math.min(item.len, totalSamples - p.offset);
    const fadeOutStart = item.len - fadeOut;
    for (let i = 0; i < n; i++) {
      let g = 1;
      if (i < fadeIn) g *= Math.sin(halfPi * (i / fadeIn));
      if (fadeOut > 0 && i >= fadeOutStart) g *= Math.cos(halfPi * ((i - fadeOutStart) / fadeOut));
      const src = item.start + i;
      const dst = p.offset + i;
      outL[dst] += item.left[src] * g;
      outR[dst] += item.right[src] * g;
    }
  }

  // 전체 페이드인/아웃 + 소프트 클리핑
  const fi = Math.min(totalSamples, Math.round(opts.fadeIn * sampleRate));
  const fo = Math.min(totalSamples, Math.round(opts.fadeOut * sampleRate));
  for (let i = 0; i < totalSamples; i++) {
    let g = 1;
    if (i < fi) g *= i / fi;
    const fromEnd = totalSamples - 1 - i;
    if (fromEnd < fo) g *= Math.sin(halfPi * (fromEnd / fo));
    outL[i] = softClip(outL[i] * g);
    outR[i] = softClip(outR[i] * g);
  }
  return [outL, outR];
}
