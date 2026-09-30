// "영상 만들기" 영역: 진행률, 취소, 결과 재생·저장

import type { PhotoLibrary } from '../assets';
import {
  EXPORT_PRESETS,
  ExportCanceledError,
  canEncodeMusic,
  checkExportSupport,
  estimateFileSize,
  exportVideo,
  type ExportProgress,
} from '../exporter';
import { formatBytes, formatTime } from '../format';
import type { RenderContext } from '../renderer';
import { $ } from './dom';

export type QualityKey = keyof typeof EXPORT_PRESETS;

export interface ExportJob {
  context: Omit<RenderContext, 'assets'>;
  fileBase: string;
  title: string;
}

export interface ExportPanelDeps {
  library: PhotoLibrary;
  getJob(): ExportJob | null;
  getQuality(): QualityKey;
  setQuality(q: QualityKey): void;
  /** 글꼴 등 준비 */
  prepare(job: ExportJob): Promise<void>;
  /** 영상 길이에 맞춘 음악 믹스 (없으면 null) */
  getAudio(duration: number): Promise<[Float32Array, Float32Array] | null>;
  onBusyChange(busy: boolean): void;
}

function formatDurationKo(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}초`;
  return r === 0 ? `${m}분` : `${m}분 ${r}초`;
}

export function setupExportPanel(deps: ExportPanelDeps): { update(): void; readonly busy: boolean } {
  const quality = $<HTMLSelectElement>('f-quality');
  const estimate = $('export-estimate');
  const btn = $<HTMLButtonElement>('btn-export');
  const progressWrap = $('export-progress');
  const progress = $<HTMLProgressElement>('progress');
  const progressText = $('progress-text');
  const cancel = $<HTMLButtonElement>('btn-cancel');
  const errorEl = $('export-error');
  const resultEl = $('export-result');
  const video = $<HTMLVideoElement>('result-video');
  const download = $<HTMLAnchorElement>('download');
  const share = $<HTMLButtonElement>('share');
  const resultInfo = $('result-info');

  let busy = false;
  let controller: AbortController | null = null;
  let resultUrl: string | null = null;
  let resultFile: File | null = null;
  const baseTitle = document.title;

  // 휴대폰: 공유 시트로 사진 앱(갤러리)에 저장하거나 메신저로 바로 보내기
  share.addEventListener('click', () => {
    if (!resultFile) return;
    navigator.share({ files: [resultFile], title: resultFile.name.replace(/\.mp4$/i, '') }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      showError('공유 창을 열지 못했어요. 아래 "MP4 파일 저장하기"로 저장해 주세요.');
    });
  });

  quality.value = deps.getQuality();
  quality.addEventListener('change', () => {
    deps.setQuality(quality.value === '720p' ? '720p' : '1080p');
    update();
  });

  function update(): void {
    const job = deps.getJob();
    btn.disabled = busy || !job;
    quality.disabled = busy;
    if (!job) {
      estimate.textContent = '사진을 올리면 영상을 만들 수 있어요.';
      return;
    }
    const settings = EXPORT_PRESETS[deps.getQuality()];
    const d = job.context.timeline.duration;
    estimate.textContent = `${formatTime(d)} 길이 · 예상 파일 크기 약 ${formatBytes(estimateFileSize(settings, d, true))}`;
  }

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function onProgress(p: ExportProgress, fps: number, duration: number): void {
    progress.value = p.progress;
    const pct = Math.floor(p.progress * 100);
    if (p.phase === 'prepare') {
      progressText.textContent = '준비 중… (글꼴·음악·사진을 불러오고 있어요)';
    } else if (p.phase === 'render') {
      const eta = p.eta !== null ? ` · 남은 시간 약 ${formatDurationKo(Math.max(1, p.eta))}` : '';
      progressText.textContent = `영상 만드는 중… ${pct}% (${formatTime(p.frame / fps)} / ${formatTime(duration)})${eta}`;
    } else {
      progressText.textContent = '마무리하는 중…';
    }
    document.title = `(${pct}%) ${baseTitle}`;
  }

  async function requestWakeLock(): Promise<WakeLockSentinel | null> {
    try {
      return (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      return null;
    }
  }

  async function start(): Promise<void> {
    const job = deps.getJob();
    if (!job || busy) return;
    errorEl.hidden = true;
    const settings = EXPORT_PRESETS[deps.getQuality()];
    const unsupported = await checkExportSupport(settings);
    if (unsupported) {
      showError(unsupported);
      return;
    }
    if (
      !(await canEncodeMusic(settings)) &&
      !window.confirm(
        '이 브라우저에서는 영상에 배경음악을 넣을 수 없어요. (아이폰은 iOS 26 이상 Safari, 안드로이드·PC는 최신 Chrome에서 음악이 들어가요)\n\n음악 없이 만들까요?',
      )
    ) {
      return;
    }
    busy = true;
    deps.onBusyChange(true);
    update();
    resultEl.hidden = true;
    share.hidden = true;
    resultFile = null;
    video.removeAttribute('src');
    video.load();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;

    const ac = new AbortController();
    controller = ac;
    progressWrap.hidden = false;
    progress.value = 0;
    const duration = job.context.timeline.duration;
    onProgress({ phase: 'prepare', progress: 0, frame: 0, totalFrames: 0, elapsed: 0, eta: null }, settings.fps, duration);
    const wakeLock = await requestWakeLock();
    try {
      await deps.prepare(job);
      const audio = await deps.getAudio(duration);
      if (ac.signal.aborted) throw new ExportCanceledError();
      const result = await exportVideo({
        library: deps.library,
        context: job.context,
        audio,
        settings,
        title: job.title,
        signal: ac.signal,
        onProgress: (p) => onProgress(p, settings.fps, duration),
      });
      resultUrl = URL.createObjectURL(result.blob);
      video.src = resultUrl;
      download.href = resultUrl;
      download.download = `${job.fileBase}.mp4`;
      resultFile = new File([result.blob], `${job.fileBase}.mp4`, { type: 'video/mp4' });
      const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      let canShare = false;
      try {
        canShare = touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [resultFile] });
      } catch {
        canShare = false;
      }
      share.hidden = !canShare;
      download.classList.toggle('primary', !canShare);
      const notes: string[] = [
        `${formatTime(result.duration)} · ${formatBytes(result.blob.size)} · ${settings.height}p`,
        `만드는 데 ${formatDurationKo(result.elapsed)} 걸렸어요.`,
      ];
      if (!audio) notes.push('음악 없이 만들어졌어요.');
      else if (!result.audioCodec) notes.push('이 브라우저에서는 음악을 넣을 수 없어 음악 없이 만들어졌어요. PC·안드로이드의 최신 Chrome·Edge나 iOS 26 이상 Safari를 권장해요.');
      else if (result.audioCodec !== 'aac') notes.push('음악이 Opus 형식으로 저장되어 일부 기기에서는 소리가 나오지 않을 수 있어요.');
      if (result.videoCodec !== 'avc') notes.push('H.264를 사용할 수 없어 다른 코덱으로 저장했어요. 일부 기기에서 재생되지 않을 수 있어요.');
      if (result.lowResPhotos > 0) {
        notes.push(`원본을 다시 읽지 못한 사진 ${result.lowResPhotos}장은 저화질로 들어갔어요.`);
      }
      resultInfo.textContent = notes.join(' ');
      resultEl.hidden = false;
      (canShare ? share : download).focus();
    } catch (e) {
      if (e instanceof ExportCanceledError) {
        showError('영상 만들기를 취소했어요.');
      } else {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        showError(`영상을 만들지 못했어요. ${msg} — 화질을 720p로 낮추거나 다른 탭을 닫고 다시 시도해 주세요.`);
      }
    } finally {
      void wakeLock?.release().catch(() => undefined);
      busy = false;
      controller = null;
      progressWrap.hidden = true;
      document.title = baseTitle;
      deps.onBusyChange(false);
      update();
    }
  }

  btn.addEventListener('click', () => void start());
  cancel.addEventListener('click', () => controller?.abort());

  update();
  return {
    update,
    get busy() {
      return busy;
    },
  };
}
