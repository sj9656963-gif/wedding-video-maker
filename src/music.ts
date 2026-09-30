// 배경음악: 기본 음악(워커에서 합성) 또는 사용자 음악 파일 디코딩, 영상 길이에 맞춘 믹스

import { mixPlaylist, playlistDuration, type PcmTrack } from './audio-mix';

export const SAMPLE_RATE = 48000;
/** 기본 음악은 최대 영상 길이(5분)보다 약간 길게 생성 */
const DEFAULT_MUSIC_LENGTH = 302;
const MIX_OPTIONS = { crossfade: 3, fadeIn: 0.3, fadeOut: 4 };

export interface MusicTrack extends PcmTrack {
  id: string;
  name: string;
  /** 원본 길이(초) */
  duration: number;
}

let defaultMusic: Promise<MusicTrack> | null = null;

/** 기본 음악(파헬벨 캐논 화성 진행 기반 창작 편곡) — 한 번만 생성해 재사용 */
export function loadDefaultMusic(): Promise<MusicTrack> {
  if (!defaultMusic) {
    defaultMusic = new Promise<MusicTrack>((resolve, reject) => {
      const worker = new Worker(new URL('./music-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ left?: Float32Array; right?: Float32Array; error?: string }>) => {
        worker.terminate();
        const { left, right, error } = e.data;
        if (error || !left || !right) {
          reject(new Error(error ?? '기본 음악을 만들지 못했어요.'));
          return;
        }
        resolve({
          id: 'default',
          name: '기본 음악 · 캐논 변주',
          channels: [left, right],
          sampleRate: SAMPLE_RATE,
          duration: left.length / SAMPLE_RATE,
        });
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(new Error(e.message || '기본 음악을 만들지 못했어요.'));
      };
      worker.postMessage({ id: 1, duration: DEFAULT_MUSIC_LENGTH, sampleRate: SAMPLE_RATE });
    });
    defaultMusic.catch(() => {
      defaultMusic = null; // 실패 시 다음에 다시 시도
    });
  }
  return defaultMusic;
}

let musicSeq = 0;

/** 음악 파일(MP3/M4A/WAV 등)을 48kHz PCM으로 디코딩 */
export async function decodeMusicFile(file: File): Promise<MusicTrack> {
  const data = await file.arrayBuffer();
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: SAMPLE_RATE });
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(data);
  } catch {
    throw new Error(`"${file.name}" 파일을 열 수 없어요. MP3, M4A, WAV 형식을 사용해 주세요.`);
  }
  if (buf.duration < 1) throw new Error(`"${file.name}" 파일이 너무 짧아요.`);
  const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i));
  return { id: `m${++musicSeq}`, name: file.name, channels, sampleRate: SAMPLE_RATE, duration: buf.duration };
}

/** 곡들을 한 번씩 이어 붙였을 때 길이(초, 크로스페이드·앞뒤 무음 제외) */
export function musicTotalDuration(tracks: readonly MusicTrack[]): number {
  return playlistDuration(tracks, SAMPLE_RATE, MIX_OPTIONS);
}

/** 영상 길이에 맞춘 스테레오 믹스 (짧으면 반복, 끝은 페이드아웃) */
export function mixMusic(tracks: readonly MusicTrack[], duration: number): [Float32Array, Float32Array] {
  return mixPlaylist(tracks, Math.round(duration * SAMPLE_RATE), SAMPLE_RATE, MIX_OPTIONS);
}
