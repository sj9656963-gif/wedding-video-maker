// MP4 내보내기: 캔버스 프레임(H.264) + 배경음악(AAC)을 브라우저의 WebCodecs로 인코딩

import {
  AudioBufferSource,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type StreamTargetChunk,
  type VideoCodec,
} from 'mediabunny';
import { needsInRange, type PhotoLibrary, ResolutionCache } from './assets';
import { ChunkCollector } from './chunk-collector';
import { createCanvas } from './design';
import { SAMPLE_RATE } from './music';
import { Renderer, type RenderContext } from './renderer';

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
}

export const EXPORT_PRESETS: Record<'1080p' | '720p', ExportSettings> = {
  '1080p': { width: 1920, height: 1080, fps: 30, videoBitrate: 8_000_000, audioBitrate: 192_000 },
  '720p': { width: 1280, height: 720, fps: 30, videoBitrate: 5_000_000, audioBitrate: 192_000 },
};

/** 예상 파일 크기(바이트) */
export function estimateFileSize(settings: ExportSettings, duration: number, withAudio: boolean): number {
  const bps = settings.videoBitrate + (withAudio ? settings.audioBitrate : 0);
  return Math.round((bps / 8) * duration * 1.02);
}

export interface ExportProgress {
  phase: 'prepare' | 'render' | 'finalize';
  /** 0~1 */
  progress: number;
  frame: number;
  totalFrames: number;
  /** 경과 시간(초) */
  elapsed: number;
  /** 남은 예상 시간(초) */
  eta: number | null;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  duration: number;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec | null;
  /** 원본을 다시 읽지 못해 저화질로 들어간 사진 수 */
  lowResPhotos: number;
  elapsed: number;
}

export class ExportCanceledError extends Error {
  constructor() {
    super('영상 만들기를 취소했어요.');
    this.name = 'ExportCanceledError';
  }
}

const VIDEO_CODECS: VideoCodec[] = ['avc', 'hevc', 'vp9', 'av1'];
const AUDIO_CODECS: AudioCodec[] = ['aac', 'opus'];

/** H.264 High 프로파일 + 해상도에 맞는 표준 레벨 (1080p30 → 4.0, 720p30 → 3.1) */
function avcCodecString(settings: ExportSettings): string {
  return settings.height > 720 ? 'avc1.640028' : 'avc1.64001f';
}

/**
 * 가능하면 소프트웨어 H.264 인코더 사용: 일부 하드웨어 인코더는 1080p에도 레벨 5.0을 기록해
 * 오래된 TV·예식장 재생기에서 열리지 않을 수 있음. 지원하지 않으면 브라우저 기본값 사용.
 */
async function pickAvcAcceleration(settings: ExportSettings): Promise<'prefer-software' | 'no-preference'> {
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: avcCodecString(settings),
      width: settings.width,
      height: settings.height,
      bitrate: settings.videoBitrate,
      framerate: settings.fps,
      hardwareAcceleration: 'prefer-software',
    });
    return r.supported ? 'prefer-software' : 'no-preference';
  } catch {
    return 'no-preference';
  }
}

/** 이 브라우저에서 영상을 만들 수 있는지 확인. 불가능하면 이유를 반환 */
export async function checkExportSupport(settings: ExportSettings): Promise<string | null> {
  if (!window.isSecureContext) return 'https 또는 localhost 주소로 열어야 영상을 만들 수 있어요.';
  if (typeof VideoEncoder === 'undefined') {
    return '이 브라우저는 영상 만들기(WebCodecs)를 지원하지 않아요. PC·안드로이드의 최신 Chrome/Edge 또는 iOS 26 이상의 Safari에서 열어 주세요.';
  }
  const codec = await getFirstEncodableVideoCodec(VIDEO_CODECS, {
    width: settings.width,
    height: settings.height,
    bitrate: settings.videoBitrate,
  });
  return codec ? null : '이 기기에서는 MP4 영상 인코딩을 사용할 수 없어요. 다른 브라우저(Chrome/Edge)로 시도해 주세요.';
}

/** 배경음악을 영상에 넣을 수 있는지 (iOS 18 이하 Safari는 영상만 되고 음악 인코딩이 없음) */
export async function canEncodeMusic(settings: ExportSettings): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return false;
  try {
    const codec = await getFirstEncodableAudioCodec(AUDIO_CODECS, {
      numberOfChannels: 2,
      sampleRate: SAMPLE_RATE,
      bitrate: settings.audioBitrate,
    });
    return !!codec;
  } catch {
    return false;
  }
}

export interface ExportOptions {
  library: PhotoLibrary;
  context: Omit<RenderContext, 'assets'>;
  /** 영상 길이에 맞춘 스테레오 믹스 (없으면 무음) */
  audio: [Float32Array, Float32Array] | null;
  settings: ExportSettings;
  title?: string;
  signal: AbortSignal;
  onProgress: (p: ExportProgress) => void;
}

export async function exportVideo(opts: ExportOptions): Promise<ExportResult> {
  const { settings, signal, onProgress } = opts;
  const { width, height, fps } = settings;
  const timeline = opts.context.timeline;
  const duration = timeline.duration;
  const totalFrames = Math.round(duration * fps);
  const startedAt = performance.now();
  const elapsed = () => (performance.now() - startedAt) / 1000;
  onProgress({ phase: 'prepare', progress: 0, frame: 0, totalFrames, elapsed: 0, eta: null });

  const videoCodec = await getFirstEncodableVideoCodec(VIDEO_CODECS, { width, height, bitrate: settings.videoBitrate });
  if (!videoCodec) throw new Error('이 브라우저에서 사용할 수 있는 영상 코덱이 없어요.');
  const audioCodec = opts.audio
    ? await getFirstEncodableAudioCodec(AUDIO_CODECS, {
        numberOfChannels: 2,
        sampleRate: SAMPLE_RATE,
        bitrate: settings.audioBitrate,
      })
    : null;

  const canvas = createCanvas(width, height);
  const renderer = new Renderer(canvas);
  const cache = new ResolutionCache(opts.library, width, height, 12);
  const rc: RenderContext = { ...opts.context, assets: cache };

  const collector = new ChunkCollector();
  const writable = new WritableStream<StreamTargetChunk>({
    write(chunk) {
      collector.write(chunk);
    },
  });
  // fastStart:false → 영상 데이터를 순서대로 흘려보내 메모리 사용을 최소화 (moov는 파일 끝)
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: false }),
    target: new StreamTarget(writable, { chunked: true }),
  });
  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    quality: new Quality({ bitrate: settings.videoBitrate }),
    keyFrameInterval: 2,
    latencyMode: 'quality',
    ...(videoCodec === 'avc'
      ? { fullCodecString: avcCodecString(settings), hardwareAcceleration: await pickAvcAcceleration(settings) }
      : {}),
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (audioCodec && opts.audio) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: settings.audioBitrate }) });
    output.addAudioTrack(audioSource);
  }
  if (opts.title) {
    output.setMetadataTags({ title: opts.title, date: new Date(), comment: '식전영상 메이커 · 제작자 : 부산북구 주양현' });
  }

  const [left, right] = opts.audio ?? [new Float32Array(0), new Float32Array(0)];
  const audioTotal = Math.min(left.length, Math.round(duration * SAMPLE_RATE));
  let audioPos = 0;
  /** 영상 진행에 맞춰 1초 단위로 오디오를 끼워 넣음 */
  const pushAudioUntil = async (sec: number) => {
    if (!audioSource) return;
    const target = Math.min(audioTotal, Math.round(sec * SAMPLE_RATE));
    while (audioPos < target) {
      const len = Math.min(SAMPLE_RATE, audioTotal - audioPos);
      const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SAMPLE_RATE });
      buf.copyToChannel(left.subarray(audioPos, audioPos + len) as Float32Array<ArrayBuffer>, 0);
      buf.copyToChannel(right.subarray(audioPos, audioPos + len) as Float32Array<ArrayBuffer>, 1);
      await audioSource.add(buf);
      audioPos += len;
    }
  };

  let finished = false;
  try {
    await output.start();
    const frameDur = 1 / fps;
    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new ExportCanceledError();
      const t = i * frameDur;
      cache.prefetch(needsInRange(timeline, t, t + 6));
      await cache.ensureAll(needsInRange(timeline, t, t + frameDur));
      renderer.render(t, rc);
      await videoSource.add(t, frameDur);
      await pushAudioUntil(t + 1.5);
      if (i % 10 === 0 || i === totalFrames - 1) {
        const done = i + 1;
        const el = elapsed();
        onProgress({
          phase: 'render',
          progress: (done / totalFrames) * 0.98,
          frame: done,
          totalFrames,
          elapsed: el,
          eta: done >= 30 ? (el / done) * (totalFrames - done) : null,
        });
      }
    }
    await pushAudioUntil(duration);
    if (signal.aborted) throw new ExportCanceledError();
    onProgress({ phase: 'finalize', progress: 0.98, frame: totalFrames, totalFrames, elapsed: elapsed(), eta: 1 });
    videoSource.close();
    audioSource?.close();
    await output.finalize();
    finished = true;
    const mimeType = await output.getMimeType();
    const blob = collector.toBlob('video/mp4');
    collector.clear();
    onProgress({ phase: 'finalize', progress: 1, frame: totalFrames, totalFrames, elapsed: elapsed(), eta: 0 });
    return {
      blob,
      mimeType,
      duration,
      videoCodec,
      audioCodec,
      lowResPhotos: cache.failedCount,
      elapsed: elapsed(),
    };
  } catch (e) {
    if (!finished) await output.cancel().catch(() => undefined);
    collector.clear();
    throw signal.aborted ? new ExportCanceledError() : e;
  } finally {
    cache.clear();
    canvas.width = canvas.height = 0;
  }
}
