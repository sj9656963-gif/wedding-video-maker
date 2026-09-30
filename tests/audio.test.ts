import { describe, expect, it } from 'vitest';
import { findAudibleRange, mixPlaylist, playlistDuration, type PcmTrack } from '../src/audio-mix';
import { generateMusic } from '../src/music-gen';

const SR = 8000;

function tone(seconds: number, freq: number, amp = 0.5, silenceHead = 0, silenceTail = 0, channels = 2): PcmTrack {
  const n = Math.round((seconds + silenceHead + silenceTail) * SR);
  const head = Math.round(silenceHead * SR);
  const body = Math.round(seconds * SR);
  const data = new Float32Array(n);
  for (let i = 0; i < body; i++) data[head + i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return { channels: Array.from({ length: channels }, () => data.slice()), sampleRate: SR };
}

const rms = (a: Float32Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
};

describe('findAudibleRange', () => {
  it('앞뒤 무음을 찾는다', () => {
    const t = tone(2, 440, 0.5, 1, 0.5);
    const r = findAudibleRange(t.channels);
    expect(r.start).toBeGreaterThanOrEqual(SR * 1);
    expect(r.start).toBeLessThan(SR * 1 + 10);
    expect(r.end).toBeLessThanOrEqual(SR * 3);
    expect(r.end).toBeGreaterThan(SR * 3 - 10);
    expect(findAudibleRange([new Float32Array(100)])).toEqual({ start: 0, end: 0 });
  });
});

describe('mixPlaylist', () => {
  it('출력 길이가 정확하고 시작/끝이 페이드된다', () => {
    const [l, r] = mixPlaylist([tone(10, 440)], SR * 20, SR, { crossfade: 1, fadeIn: 0.5, fadeOut: 2 });
    expect(l.length).toBe(SR * 20);
    expect(r.length).toBe(SR * 20);
    expect(Math.abs(l[0])).toBeLessThan(1e-6);
    expect(Math.abs(l[l.length - 1])).toBeLessThan(1e-3);
    // 곡이 10초인데 20초를 채우므로 반복되어 중간에도 소리가 있다
    expect(rms(l, SR * 12, SR * 16)).toBeGreaterThan(0.2);
  });

  it('앞 무음을 잘라내고 바로 시작', () => {
    const [l] = mixPlaylist([tone(5, 440, 0.5, 2)], SR * 4, SR, { fadeIn: 0.1, fadeOut: 0.5 });
    expect(rms(l, Math.round(SR * 0.2), SR * 1)).toBeGreaterThan(0.2);
  });

  it('두 곡 사이를 크로스페이드', () => {
    const a = tone(6, 440, 0.5);
    const b = tone(6, 660, 0.5);
    const total = SR * 11;
    const [l] = mixPlaylist([a, b], total, SR, { crossfade: 1, fadeIn: 0, fadeOut: 0.5, trim: false });
    // 크로스페이드 구간(5~6초)에도 에너지가 끊기지 않음
    expect(rms(l, SR * 5, SR * 6)).toBeGreaterThan(0.2);
    expect(playlistDuration([a, b], SR, { crossfade: 1, trim: false })).toBeCloseTo(11, 3);
  });

  it('모노 트랙은 양 채널로 복제', () => {
    const [l, r] = mixPlaylist([tone(3, 300, 0.5, 0, 0, 1)], SR * 3, SR, { fadeIn: 0, fadeOut: 0.1 });
    expect(rms(r, 0, SR * 2)).toBeCloseTo(rms(l, 0, SR * 2), 6);
    expect(rms(r, 0, SR * 2)).toBeGreaterThan(0.2);
  });

  it('클리핑 없이 -1~1 범위', () => {
    const loud = tone(4, 200, 1.4);
    const [l] = mixPlaylist([loud, loud], SR * 8, SR, { crossfade: 1 });
    let peak = 0;
    for (const v of l) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(1);
  });

  it('곡이 없으면 무음', () => {
    const [l, r] = mixPlaylist([], SR, SR);
    expect(l.length).toBe(SR);
    expect(l.every((v) => v === 0) && r.every((v) => v === 0)).toBe(true);
  });

  it('샘플레이트가 다르면 오류', () => {
    expect(() => mixPlaylist([{ channels: [new Float32Array(SR * 2)], sampleRate: 44100 }], SR, SR)).toThrow();
  });
});

describe('generateMusic', () => {
  it('요청 길이만큼 유효한 스테레오 음악을 만든다', () => {
    const start = performance.now();
    const [l, r] = generateMusic(40, 48000);
    const elapsed = performance.now() - start;
    expect(l.length).toBe(40 * 48000);
    expect(r.length).toBe(40 * 48000);
    let peak = 0;
    let finite = true;
    for (let i = 0; i < l.length; i++) {
      if (!Number.isFinite(l[i]) || !Number.isFinite(r[i])) finite = false;
      peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
    }
    expect(finite).toBe(true);
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThanOrEqual(0.8 + 1e-6);
    // 어느 구간이든 소리가 난다 (1초 단위)
    for (let s = 0; s < 39; s++) expect(rms(l, s * 48000, (s + 1) * 48000)).toBeGreaterThan(0.01);
    // 성능: 40초 생성이 너무 오래 걸리지 않아야 함
    expect(elapsed).toBeLessThan(4000);
  });

  it('같은 시드는 같은 결과', () => {
    const [a] = generateMusic(3, 8000, { seed: 3 });
    const [b] = generateMusic(3, 8000, { seed: 3 });
    expect(a).toEqual(b);
  });
});
