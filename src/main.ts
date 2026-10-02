// 앱 진입점: 상태 관리와 화면 연결

import './style.css';
import { PhotoLibrary, ResolutionCache } from './assets';
import { StyleDemo, demoInfo, renderPoster, sampleAssets, sampleThumb, type DemoFocus } from './demo';
import { collectTexts } from './draw-text';
import { ensureFonts, fontsReady } from './fonts';
import { formatTime, safeFileName } from './format';
import { decodeMusicFile, loadDefaultMusic, mixMusic, musicTotalDuration, type MusicTrack } from './music';
import { fileKey, importPhotos, isImageFile, sortPhotos, type SortMode } from './photos';
import { PreviewPlayer, type PreviewAudio } from './preview';
import { initPwa } from './pwa';
import type { RenderContext } from './renderer';
import { loadSettings, saveSettings, type DurationMode } from './settings-store';
import { SUGGESTIONS, type SuggestField } from './suggestions';
import {
  DEFAULT_THEME_ID,
  STRUCTURAL_KEYS,
  THEMES,
  baseTheme,
  resolveTheme,
  sanitizeCustom,
  type CustomKey,
  type Customization,
  type Theme,
  type TitleDesign,
} from './themes';
import { initSite } from './site/site';
import { CUSTOM_FOCUS, Customizer } from './ui/customizer';
import { StylePicker } from './ui/style-picker';
import { attachSuggestions, type Suggest } from './ui/suggest';
import {
  MIN_VIDEO_DURATION,
  autoDuration,
  buildTimeline,
  clampDuration,
  maxPhotosFor,
  type PhotoRef,
  type TimelineInput,
} from './timeline';
import type { PhotoItem, Timeline, WeddingInfo } from './types';
import { $, debounce, filesFromDataTransfer, h, setStatus } from './ui/dom';
import { setupExportPanel, type ExportJob, type QualityKey } from './ui/export-panel';
import { PhotoEditor } from './ui/photo-editor';
import { PhotoGrid } from './ui/photo-grid';

// ───────────────────────── 상태 ─────────────────────────

const DEFAULT_INFO: WeddingInfo = {
  groom: '',
  bride: '',
  date: '',
  time: '',
  venue: '',
  introTitle: '',
  outroTitle: '',
  outroMessage: '귀한 걸음 해 주셔서 진심으로 감사합니다.\n따뜻한 마음으로 저희의 새 출발을 축복해 주세요.',
  outroNotice: '잠시 후 예식이 시작됩니다',
  // 영상 중간 문구는 직접 쓴 경우에만 넣음 (기본 문구 없음)
  quotes: '',
};
/** 예전 버전의 기본 감성 문구: 사용자가 고치지 않은 채 저장돼 있으면 비움 */
const LEGACY_DEFAULT_QUOTES = '우리가 처음 만난 날\n함께라서 모든 날이 좋았다\n서로에게 가장 좋은 친구가 되어\n그리고 이제, 평생을 함께';
const DURATION_CHOICES = [180, 210, 240, 270, 300];
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i;

const saved = loadSettings();

function savedInfo(): WeddingInfo {
  const info = { ...DEFAULT_INFO };
  const src = saved.info ?? {};
  for (const key of Object.keys(info) as (keyof WeddingInfo)[]) {
    const v = src[key];
    if (typeof v === 'string') info[key] = v;
  }
  if (info.quotes.replace(/\r/g, '').trim() === LEGACY_DEFAULT_QUOTES) info.quotes = '';
  return info;
}

function savedDuration(v: unknown): DurationMode {
  if (v === 'auto' || v === 'music') return v;
  if (typeof v === 'number' && DURATION_CHOICES.includes(v)) return v;
  return 'auto';
}

/** 꾸미기 저장값 (예전 버전의 오프닝 디자인·효과 선택도 이어받음) */
function savedCustom(): Customization {
  if (saved.custom && typeof saved.custom === 'object') return sanitizeCustom(saved.custom);
  return sanitizeCustom({ title: saved.titleDesign, particle: saved.particle });
}

const state = {
  photos: [] as PhotoItem[],
  coverId: null as string | null,
  outroId: null as string | null,
  info: savedInfo(),
  themeId: baseTheme(saved.themeId ?? DEFAULT_THEME_ID).id as string,
  variantId: (typeof saved.variantId === 'string' ? saved.variantId : null) as string | null,
  custom: savedCustom(),
  groupPhotos: saved.groupPhotos ?? true,
  durationMode: savedDuration(saved.durationMode),
  musicMode: 'default' as 'default' | 'custom',
  customMusic: [] as MusicTrack[],
  quality: (saved.quality === '720p' ? '720p' : '1080p') as QualityKey,
  sort: null as SortMode | null,
  seed: (Math.random() * 0x7fffffff) | 0,
};

let timeline: Timeline | null = null;
let excludedIds = new Set<string>();
let exporting = false;
let nextAddedIndex = 0;
let photoDates = new Map<string, number | null>();
let captions = new Map<string, string>();
/** 꾸미기 칩에 마우스를 올려 둔 동안 미리 보여 줄 꾸미기 (적용 전) */
let hoverCustom: Customization | null = null;
let hoverKey: CustomKey | null = null;

const library = new PhotoLibrary();
const previewCanvas = $<HTMLCanvasElement>('preview');
const previewCache = new ResolutionCache(library, previewCanvas.width, previewCanvas.height, 10);

const persist = debounce(() => {
  saveSettings({
    info: state.info,
    themeId: state.themeId,
    variantId: state.variantId,
    custom: { ...state.custom },
    groupPhotos: state.groupPhotos,
    durationMode: state.durationMode,
    quality: state.quality,
  });
}, 400);

/** 스타일 + 양식 + 꾸미기를 합친 현재 테마 */
function currentTheme(): Theme {
  return resolveTheme(state.themeId, { variant: state.variantId, ...state.custom });
}

/** 꾸미기 없이 스타일·양식만 (꾸미기의 '추천' 표시용) */
function plainTheme(): Theme {
  return resolveTheme(state.themeId, { variant: state.variantId });
}

/** 예시 영상에 보여 줄 테마: 마우스를 올려 둔 꾸미기가 있으면 그것까지 */
function demoTheme(): Theme {
  return hoverCustom ? resolveTheme(state.themeId, { variant: state.variantId, ...hoverCustom }) : currentTheme();
}

/** 내 영상 미리보기 테마: 장면 구성을 바꾸지 않는 꾸미기만 미리 보여 줌 */
function previewTheme(): Theme {
  return hoverCustom && hoverKey && !STRUCTURAL_KEYS.has(hoverKey) ? demoTheme() : currentTheme();
}

// ───────────────────────── 타임라인 ─────────────────────────

const hasCustomMusic = () => state.musicMode === 'custom' && state.customMusic.length > 0;

function effectiveDurationMode(): DurationMode {
  return state.durationMode === 'music' && !hasCustomMusic() ? 'auto' : state.durationMode;
}

function durationLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

function targetDuration(photos: readonly PhotoItem[]): number {
  const mode = effectiveDurationMode();
  if (typeof mode === 'number') return mode;
  if (mode === 'music') return clampDuration(Math.floor(musicTotalDuration(state.customMusic)));
  return autoDuration(photos.length);
}

const quoteList = () => state.info.quotes.split('\n').map((q) => q.trim()).filter(Boolean);

function photoRefs(photos: readonly PhotoItem[]): PhotoRef[] {
  return photos.map((p) => ({
    id: p.id,
    aspect: p.aspect,
    year: p.dateTaken !== null ? new Date(p.dateTaken).getFullYear() : null,
  }));
}

/** 사진 문구 목록 (글꼴 미리 불러오기용) */
const captionTexts = () => state.photos.map((p) => p.caption.trim()).filter(Boolean);

function timelineInput(photos: readonly PhotoItem[]): TimelineInput {
  const theme = currentTheme();
  return {
    photos: photoRefs(photos),
    targetDuration: targetDuration(photos),
    transitionDuration: theme.transitionDuration,
    transitionTypes: theme.transitions,
    sceneStyle: theme.scene,
    groupPhotos: state.groupPhotos,
    quotes: quoteList(),
    seed: state.seed,
    coverId: state.coverId,
    outroPhotoId: state.outroId,
  };
}

const summaryEl = $('timeline-summary');
const timelineErrorEl = $('timeline-error');

function rebuild(audioMayChange = false): void {
  const prevDuration = timeline?.duration ?? 0;
  timeline = null;
  excludedIds = new Set();
  photoDates = new Map(state.photos.map((p) => [p.id, p.dateTaken]));
  captions = new Map(state.photos.filter((p) => p.caption.trim()).map((p) => [p.id, p.caption.trim()]));
  let warning = '';
  const photos = state.photos;
  if (photos.length > 0) {
    const input = timelineInput(photos);
    const max = maxPhotosFor(input);
    let used = photos;
    if (max < photos.length) {
      used = photos.slice(0, Math.max(1, max));
      excludedIds = new Set(photos.slice(used.length).map((p) => p.id));
      const lengthText = `${durationLabel(clampDuration(input.targetDuration))} 영상`;
      warning =
        `사진이 너무 많아서 뒤쪽 ${excludedIds.size}장은 영상에서 빠져요. ` +
        `${lengthText}에는 최대 ${used.length}장까지 넣을 수 있어요. 영상 길이를 늘리거나 사진을 골라서 빼 주세요.`;
    }
    timeline = buildTimeline({ ...input, photos: photoRefs(used) });
  }
  timelineErrorEl.textContent = warning;
  timelineErrorEl.hidden = !warning;
  renderSummary();
  renderDurationOptions();
  renderGrid();
  editor.refresh();
  updateFab();
  updateMusicStatus();
  exportPanel.update();
  const durationChanged = (timeline?.duration ?? 0) !== prevDuration;
  player.refresh(audioMayChange || durationChanged);
}
const rebuildSoon = debounce(() => rebuild(), 450);

function renderSummary(): void {
  if (!timeline) {
    summaryEl.textContent = '사진을 올리면 영상 구성이 자동으로 계산돼요.';
    return;
  }
  const tl = timeline;
  const parts: (string | Node)[] = [
    '사진 ',
    h('b', { text: `${tl.photoCount}장` }),
    ` · 장면 ${tl.sceneCount}개 (연출 ${tl.layoutCount}가지) · 장면당 평균 `,
    h('b', { text: `${tl.averageSceneDuration.toFixed(1)}초` }),
  ];
  if (tl.quoteCount > 0) parts.push(` · 감성 문구 ${tl.quoteCount}개`);
  parts.push(' · 전체 ', h('b', { text: formatTime(tl.duration) }));
  if (tl.repeatedScenes > 0) parts.push(` · 사진이 적어서 ${tl.repeatedScenes}장면은 앞의 사진이 다른 연출로 한 번 더 나와요`);
  if (tl.photoCount < 20) parts.push(' (30장 이상이면 더 자연스러워요)');
  summaryEl.replaceChildren(...parts);
}

const durationOptionsEl = $('duration-options');

function renderDurationOptions(): void {
  const mode = effectiveDurationMode();
  const chips: HTMLButtonElement[] = [];
  const chip = (value: DurationMode, label: string, sub?: string) => {
    const pressed = mode === value;
    const b = h('button', { class: 'chip', attrs: { type: 'button', 'aria-pressed': String(pressed) } }, [label]);
    if (sub) b.append(' ', h('small', { text: sub }));
    b.addEventListener('click', () => {
      state.durationMode = value;
      persist();
      rebuild();
    });
    chips.push(b);
  };
  const autoSec = state.photos.length ? targetDurationFor('auto') : null;
  chip('auto', '자동', autoSec !== null ? `(${formatTime(autoSec)})` : '(사진 수에 맞춤)');
  if (hasCustomMusic()) {
    chip('music', '음악 길이에 맞춤', `(${formatTime(clampDuration(Math.floor(musicTotalDuration(state.customMusic))))})`);
  }
  for (const d of DURATION_CHOICES) chip(d, durationLabel(d));
  durationOptionsEl.replaceChildren(...chips);
}

function targetDurationFor(mode: DurationMode): number {
  const prev = state.durationMode;
  state.durationMode = mode;
  try {
    return targetDuration(state.photos);
  } finally {
    state.durationMode = prev;
  }
}

// ───────────────────────── 사진 ─────────────────────────

const importStatus = $('import-status');
const photoToolbar = $('photo-toolbar');
const gridHelp = $('grid-help');
const photoCount = $('photo-count');
const sortChips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sort]'));

function movePhoto(id: string, toIndex: number): void {
  const from = state.photos.findIndex((p) => p.id === id);
  if (from < 0) return;
  let to = Math.max(0, Math.min(toIndex, state.photos.length));
  if (from < to) to--;
  if (to === from) return;
  const [p] = state.photos.splice(from, 1);
  state.photos.splice(to, 0, p);
  state.sort = null;
  updateSortChips();
  rebuild();
}

function setCover(id: string): void {
  state.coverId = id;
  rebuild();
  if (!player.isPlaying) player.seek(4.5);
}

function setOutro(id: string): void {
  state.outroId = id;
  rebuild();
  seekToOutro();
}

/** 미리보기를 이 사진이 나오는 장면으로 */
function selectPhoto(id: string): void {
  const seg = timeline?.segments.find((s) => s.kind === 'photo' && s.photoIds.includes(id));
  if (!seg) return;
  setLiveTab('mine');
  player.seek(seg.start + (seg.transitionIn?.duration ?? 0) + 0.3);
}

/** 실제 영상에 쓰이는 오프닝·엔딩 사진 */
function titlePhotoIds(): { cover: string | null; outro: string | null } {
  const segs = timeline?.segments;
  const intro = segs?.[0];
  const outro = segs?.[segs.length - 1];
  return {
    cover: intro && intro.kind === 'intro' ? intro.photoId : null,
    outro: outro && outro.kind === 'outro' ? outro.photoId : null,
  };
}

const grid = new PhotoGrid($<HTMLOListElement>('photo-grid'), {
  onMove: movePhoto,
  onRemove(id) {
    removePhotos([id]);
  },
  onSetCover: setCover,
  onSetOutro: setOutro,
  onSelect: selectPhoto,
  onEdit(id) {
    editor.open(id);
  },
});

const editor = new PhotoEditor({
  photos: () => state.photos,
  coverId: () => titlePhotoIds().cover,
  outroId: () => titlePhotoIds().outro,
  unused: () => excludedIds,
  onCaption(id, text) {
    const p = state.photos.find((x) => x.id === id);
    if (!p || p.caption === text) return;
    p.caption = text;
    // 문구는 장면 구성에 영향을 주지 않으므로 다시 그리기만 함
    const t = text.trim();
    if (t) captions.set(id, t);
    else captions.delete(id);
    renderGrid();
    player.refresh();
    refreshFontsSoon();
  },
  onMove: movePhoto,
  onSetCover: setCover,
  onSetOutro: setOutro,
  onRemove(id) {
    removePhotos([id]);
  },
  onView(id) {
    selectPhoto(id);
    if (narrow.matches && !liveInView) openPreviewSheet();
  },
  onClose(id) {
    if (id && state.photos.some((p) => p.id === id)) grid.focus(id);
    updateFab();
  },
});

function renderGrid(): void {
  const { cover, outro } = titlePhotoIds();
  grid.render(state.photos, cover, outro, excludedIds);
  const n = state.photos.length;
  photoToolbar.hidden = n === 0;
  gridHelp.hidden = n === 0;
  photoCount.textContent = `사진 ${n}장`;
}

function updateSortChips(): void {
  for (const c of sortChips) c.setAttribute('aria-pressed', String(c.dataset.sort === state.sort));
}

function removePhotos(ids: readonly string[]): void {
  const set = new Set(ids);
  for (const p of state.photos) {
    if (!set.has(p.id)) continue;
    library.remove(p.id);
    previewCache.drop(p.id);
    URL.revokeObjectURL(p.thumbUrl);
  }
  state.photos = state.photos.filter((p) => !set.has(p.id));
  if (state.coverId && set.has(state.coverId)) state.coverId = null;
  if (state.outroId && set.has(state.outroId)) state.outroId = null;
  if (state.photos.length === 0) {
    state.sort = null;
    updateSortChips();
    setStatus(importStatus, '');
    // 사진이 없으면 내 영상 화면은 비어 있으므로 스타일 예시로
    setLiveTab('demo');
    mineAutoShown = false;
  }
  rebuild();
}

let importQueue: Promise<void> = Promise.resolve();

function addPhotoFiles(files: readonly File[]): Promise<void> {
  importQueue = importQueue.then(() => doImport(files)).catch((e) => {
    console.error(e);
    setStatus(importStatus, '사진을 불러오는 중 문제가 생겼어요. 다시 시도해 주세요.', 'err');
  });
  return importQueue;
}

async function doImport(files: readonly File[]): Promise<void> {
  if (files.length === 0 || exporting) return;
  const existing = new Set(state.photos.map((p) => fileKey(p.file)));
  const res = await importPhotos(files, existing, nextAddedIndex, (done, total) => {
    if (total > 0) setStatus(importStatus, `사진 불러오는 중… ${done} / ${total}`);
  });
  nextAddedIndex += files.length;
  const added = res.photos.map((r) => r.item);
  for (const r of res.photos) library.add(r.item.id, r.item.file, r.thumb);

  if (state.photos.length === 0 && added.length > 0 && state.sort === null) {
    // 처음 올릴 때: 촬영일 정보가 충분하면 촬영일순, 아니면 파일명순
    const dated = added.filter((p) => p.dateTaken !== null).length;
    state.sort = dated >= added.length * 0.6 ? 'date' : 'name';
  }
  if (state.sort && state.sort !== 'shuffle') {
    state.photos = sortPhotos([...state.photos, ...added], state.sort);
  } else {
    state.photos = [...state.photos, ...added];
    state.sort = null;
  }
  updateSortChips();

  const msgs: string[] = [];
  if (added.length) msgs.push(`사진 ${added.length}장을 추가했어요.`);
  if (res.duplicates) msgs.push(`이미 있는 사진 ${res.duplicates}장은 건너뛰었어요.`);
  if (res.skipped) msgs.push(`사진이 아닌 파일 ${res.skipped}개는 제외했어요.`);
  if (res.failed.length) {
    const names = res.failed.slice(0, 3).map((f) => f.name).join(', ');
    msgs.push(`열 수 없는 사진 ${res.failed.length}장(${names}${res.failed.length > 3 ? ' 외' : ''}): ${res.failed[0].reason}`);
  }
  if (!msgs.length) msgs.push('추가할 새 사진이 없어요.');
  setStatus(importStatus, msgs.join(' '), res.failed.length ? 'warn' : added.length ? 'ok' : '');
  rebuild();
  refreshFonts();
  // 처음 사진을 올리면 미리보기를 '내 영상'으로 바꿔 올린 사진으로 보여 줌
  if (added.length && !mineAutoShown && timeline) {
    mineAutoShown = true;
    setLiveTab('mine');
  }
}

function seekToOutro(): void {
  if (!timeline || player.isPlaying) return;
  const outro = timeline.segments[timeline.segments.length - 1];
  player.seek(Math.min(outro.start + 6.5, timeline.duration - 3));
}

for (const chip of sortChips) {
  chip.addEventListener('click', () => {
    const mode = chip.dataset.sort as SortMode;
    state.photos = sortPhotos(state.photos, mode, mode === 'shuffle' ? Date.now() : state.seed);
    state.sort = mode;
    updateSortChips();
    rebuild();
  });
}

$('btn-clear').addEventListener('click', () => {
  const n = state.photos.length;
  if (n && window.confirm(`사진 ${n}장을 모두 지울까요?`)) removePhotos(state.photos.map((p) => p.id));
});

const fileInput = $<HTMLInputElement>('file-input');
const folderInput = $<HTMLInputElement>('folder-input');
// 아이폰·아이패드: accept에 HEIC를 직접 적으면 원본 HEIC가 넘어와 촬영일을 읽지 못하므로,
// image/*만 적어 사진첩이 호환되는 JPEG(촬영 정보 포함)로 바꿔 주게 함
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS) fileInput.accept = 'image/*';
$('btn-pick').addEventListener('click', () => fileInput.click());
$('btn-folder').addEventListener('click', () => folderInput.click());
for (const input of [fileInput, folderInput]) {
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    void addPhotoFiles(files);
  });
}

// 페이지 어디에 끌어다 놓아도 사진/음악 추가
const isAudioFile = (f: File) => !isImageFile(f) && (f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  document.body.classList.add('dragging-files');
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragging-files');
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = exporting ? 'none' : 'copy';
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e) || !e.dataTransfer) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging-files');
  if (exporting) return;
  void filesFromDataTransfer(e.dataTransfer).then((files) => {
    const audio = files.filter(isAudioFile);
    const others = files.filter((f) => !isAudioFile(f));
    if (others.length) void addPhotoFiles(others);
    if (audio.length) void addMusicFiles(audio);
  });
});

// ───────────────────────── 미리보기 자리 (스타일 예시 / 내 영상) ─────────────────────────
// 넓은 화면: 오른쪽 패널에 붙어 있음. 휴대폰: 스타일·꾸미기·문구 카드 위쪽에 붙어 스크롤해도 보임.

const narrow = window.matchMedia('(max-width: 1080px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const liveBox = $('live-box');
const liveHome = $('live-home');
const liveMobile = $('live-mobile');
const tabDemo = $<HTMLButtonElement>('tab-demo');
const tabMine = $<HTMLButtonElement>('tab-mine');
const paneDemo = $('pane-demo');
const paneMine = $('pane-mine');
const collapseBtn = $<HTMLButtonElement>('live-collapse');
const toastEl = $('apply-toast');
type LiveTab = 'demo' | 'mine';
let liveTab: LiveTab = 'demo';
/** 처음 사진을 올렸을 때 한 번만 '내 영상'으로 자동 전환 */
let mineAutoShown = false;
let liveInView = false;

function placeLive(): void {
  const target = narrow.matches ? liveMobile : liveHome;
  if (liveBox.parentElement !== target) target.append(liveBox);
}

/** 화면 위쪽에 붙어 내용을 가리는 높이: 메뉴, 휴대폰은 위쪽에 붙는 미리보기까지 */
function stuckTop(): number {
  const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
  if (!narrow.matches || liveBox.parentElement !== liveMobile || getComputedStyle(liveMobile).position !== 'sticky') return nav;
  return nav + 6 + liveBox.offsetHeight;
}

/** 세부 설정 머리줄(이전·다음 스타일)이 위쪽 미리보기 바로 아래에 붙도록 CSS 값으로 */
function syncStuckTop(): void {
  document.documentElement.style.setProperty('--stuck-top', `${Math.round(stuckTop())}px`);
}
new ResizeObserver(syncStuckTop).observe(liveBox);

function setLiveTab(tab: LiveTab, focusTab = false): void {
  liveTab = tab;
  for (const [t, btn, pane] of [
    ['demo', tabDemo, paneDemo],
    ['mine', tabMine, paneMine],
  ] as const) {
    const on = t === tab;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    pane.hidden = !on;
    if (on && focusTab) btn.focus();
  }
  if (tab === 'mine') player.refresh();
  else player.pause();
  if (liveBox.classList.contains('collapsed')) setCollapsed(false);
  updateFab();
}

tabDemo.addEventListener('click', () => setLiveTab('demo'));
tabMine.addEventListener('click', () => setLiveTab('mine'));
for (const btn of [tabDemo, tabMine]) {
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    setLiveTab(liveTab === 'demo' ? 'mine' : 'demo', true);
  });
}

function setCollapsed(collapsed: boolean): void {
  liveBox.classList.toggle('collapsed', collapsed);
  collapseBtn.setAttribute('aria-expanded', String(!collapsed));
}
collapseBtn.addEventListener('click', () => setCollapsed(!liveBox.classList.contains('collapsed')));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
const previewFrame = previewCanvas.parentElement as HTMLElement;
/** 미리보기 아래쪽에 잠깐 뜨는 '적용됨' 안내 (제목·이름이 있는 가운데를 가리지 않게, 보이는 화면 안에) */
function toast(message: string): void {
  const host = liveTab === 'mine' && !sheet.open ? previewFrame : demoStage;
  if (toastEl.parentElement !== host) host.append(toastEl);
  toastEl.textContent = `✓ ${message}`;
  toastEl.classList.add('on');
  host.classList.add('toasting');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('on');
    host.classList.remove('toasting');
  }, 2300);
}

/** 내 영상 미리보기를 바꾼 항목이 보이는 장면으로 (재생 중이면 그대로) */
function seekMine(target: DemoFocus): void {
  if (!timeline || player.isPlaying || liveTab !== 'mine') return;
  const segs = timeline.segments;
  const sceneAt = (i: number) => {
    const s = segs[Math.min(i, segs.length - 2)];
    if (s) player.seek(s.start + (s.transitionIn?.duration ?? 0) + Math.min(1.5, (s.end - s.start) / 3));
  };
  if (target === 'intro') player.seek(4.5);
  else if (target === 'outro') seekToOutro();
  else if (target === 'quote') seekToQuote();
  else if (target === 'transition') {
    const s = segs[2] ?? segs[1];
    if (s?.transitionIn) player.seek(s.start + s.transitionIn.duration * 0.5);
  } else if (target === 'caption') {
    const s = segs.find((x) => x.kind === 'photo' && x.photoIds.some((id) => captions.has(id)));
    if (s) player.seek(s.start + (s.transitionIn?.duration ?? 0) + 1.2);
    else sceneAt(1);
  } else sceneAt(1);
}

/** 바꾼 항목을 두 미리보기 모두에서 바로 보여 줌 */
function showChange(target: DemoFocus, holdMs: number): void {
  if (demoReady) demo.focus(target, holdMs);
  seekMine(target);
}
const HOLD_MS: Record<DemoFocus, number> = { intro: 2600, outro: 2600, caption: 2600, quote: 2600, scene: 0, transition: 0 };

// ───────────────────────── 문구 ─────────────────────────

type Where = 'intro' | 'outro' | 'story';
const FIELDS: [string, keyof WeddingInfo, Where][] = [
  ['f-groom', 'groom', 'intro'],
  ['f-bride', 'bride', 'intro'],
  ['f-date', 'date', 'intro'],
  ['f-time', 'time', 'intro'],
  ['f-venue', 'venue', 'intro'],
  ['f-intro-title', 'introTitle', 'intro'],
  ['f-quotes', 'quotes', 'story'],
  ['f-outro-title', 'outroTitle', 'outro'],
  ['f-outro-message', 'outroMessage', 'outro'],
  ['f-outro-notice', 'outroNotice', 'outro'],
];
const focusOfWhere = (w: Where): DemoFocus => (w === 'intro' ? 'intro' : w === 'outro' ? 'outro' : 'quote');

function refreshFonts(): void {
  const theme = currentTheme();
  void ensureFonts(theme, collectTexts(theme, state.info, captionTexts())).then(() => {
    player.refresh();
    if (demoReady) demo.redraw();
  });
  const info = demoInfo(state.info);
  void ensureFonts(theme, collectTexts(theme, info)).then(() => {
    if (demoReady) demo.redraw();
  });
}
const refreshFontsSoon = debounce(refreshFonts, 350);

/** 첫 감성 문구 장면으로 이동 */
function seekToQuote(): void {
  if (!timeline || player.isPlaying) return;
  const seg = timeline.segments.find((s) => s.kind === 'photo' && s.quote);
  if (seg) player.seek(seg.start + (seg.transitionIn?.duration ?? 0) + 2.2);
}

const suggests = new Map<string, Suggest>();
const SUGGEST_FIELDS: [string, string, SuggestField, 'replace' | 'line', string, number][] = [
  ['f-intro-title', 'sg-intro-title', 'introTitle', 'replace', '오프닝 제목 예시', 0],
  ['f-quotes', 'sg-quotes', 'quotes', 'line', '영상 중간 문구 예시', 4],
  ['f-outro-title', 'sg-outro-title', 'outroTitle', 'replace', '엔딩 제목 예시', 0],
  ['f-outro-message', 'sg-outro-message', 'outroMessage', 'replace', '엔딩 인사말 예시', 0],
  ['f-outro-notice', 'sg-outro-notice', 'outroNotice', 'replace', '엔딩 안내 문구 예시', 0],
];

for (const [id, key, where] of FIELDS) {
  const el = $<HTMLInputElement | HTMLTextAreaElement>(id);
  el.value = state.info[key];
  el.addEventListener('input', () => {
    state.info[key] = el.value;
    persist();
    // 감성 문구는 장면 구성에 영향을 주므로 다시 계산
    if (key === 'quotes') rebuildSoon();
    else player.refresh();
    refreshFontsSoon();
    demoInfoSoon(focusOfWhere(where));
    suggests.get(id)?.refresh();
  });
  // 입력하는 문구가 보이는 장면으로 미리보기 이동
  el.addEventListener('focus', () => showChange(focusOfWhere(where), 3200));
}

for (const [fieldId, hostId, key, mode, label, fillAll] of SUGGEST_FIELDS) {
  const where = FIELDS.find((f) => f[0] === fieldId)?.[2] ?? 'intro';
  suggests.set(
    fieldId,
    attachSuggestions($(hostId), {
      field: $<HTMLInputElement | HTMLTextAreaElement>(fieldId),
      items: SUGGESTIONS[key],
      mode,
      label,
      fillAll,
      perPage: key === 'outroMessage' ? 2 : 4,
      onApply: () => {
        toast(`${label.replace(' 예시', '')}에 예시 문구를 넣었어요`);
        showChange(focusOfWhere(where), 3200);
      },
    }),
  );
}

// ───────────────────────── 스타일 (예시 영상 + 카드) ─────────────────────────

const PAUSE_ICON = 'M7 5h4v14H7zM13 5h4v14h-4z';
const PLAY_ICON = 'M8 5v14l11-7z';
const demoCanvas = $<HTMLCanvasElement>('style-demo');
const demoStage = $('style-stage');
const demoName = $('style-demo-name');
const demoCaption = $('style-demo-caption');
const demoSteps = $('style-demo-steps');
const demoToggle = $<HTMLButtonElement>('style-demo-toggle');
const demoIcon = document.getElementById('style-demo-icon') as unknown as SVGPathElement;
const demo = new StyleDemo(demoCanvas);
let demoVisible = false;
let demoReady = false;
/** 사용자가 직접 멈췄으면 자동으로 다시 재생하지 않음 */
let demoUserPaused = reducedMotion;

demo.onCue = (label, index, total) => {
  demoCaption.textContent = label;
  demoSteps.replaceChildren(...Array.from({ length: total }, (_, i) => h('i', { class: i === index ? 'on' : '' })));
};
/** 버튼은 사용자가 정한 재생/멈춤 상태를 보여줌 (화면 밖이라 잠시 멈춘 것과는 구분) */
function syncDemoToggle(): void {
  const on = !demoUserPaused;
  demoIcon.setAttribute('d', on ? PAUSE_ICON : PLAY_ICON);
  demoToggle.setAttribute('aria-label', on ? '예시 영상 일시정지' : '예시 영상 재생');
}
syncDemoToggle();

function updateDemoPlayback(): void {
  const shouldPlay = demoReady && demoVisible && !demoUserPaused && !exporting && document.visibilityState === 'visible';
  if (shouldPlay) demo.play();
  else demo.pause();
}

function demoLabel(theme: Theme): string {
  const variant = theme.variants.find((v) => v.id === theme.variantId);
  return `${theme.name}${variant && theme.variants.length > 1 ? ` · ${variant.name}` : ''} 예시`;
}

/** 예시 영상에 테마 적용. restart면 처음부터, focus가 있으면 그 장면으로 바로 이동 */
function showDemo(theme: Theme, opts: { restart?: boolean; focus?: DemoFocus; hold?: number } = {}): void {
  demoName.textContent = demoLabel(theme);
  demoCanvas.setAttribute('aria-label', `${theme.name} 스타일 예시 영상: ${theme.highlights.join(', ')}`);
  if (!demoReady) return;
  demo.setTheme(theme, demoInfo(state.info), opts.restart ?? false);
  if (opts.focus) demo.focus(opts.focus, opts.hold ?? 0);
  else if (demoUserPaused && opts.restart) demo.showPoster();
  updateDemoPlayback();
}

const demoInfoSoon = debounce((focus?: DemoFocus) => {
  if (!demoReady) return;
  const info = demoInfo(state.info);
  demo.setInfo(info);
  heroDemo.setInfo(info);
  if (focus && document.activeElement?.matches('input, textarea')) demo.focus(focus, 3200);
  customizer.invalidatePosters();
}, 400);

demoToggle.addEventListener('click', () => {
  demoUserPaused = !demoUserPaused;
  syncDemoToggle();
  if (!demoUserPaused) demo.release();
  updateDemoPlayback();
});
new IntersectionObserver(
  (entries) => {
    demoVisible = entries.some((e) => e.isIntersecting);
    updateDemoPlayback();
  },
  { threshold: 0.25 },
).observe(demoStage);
document.addEventListener('visibilitychange', updateDemoPlayback);

const picker = new StylePicker({
  initial: { themeId: state.themeId, variantId: state.variantId },
  poster: (t, w, ph, at) => renderPoster(t, demoInfo(state.info), w, ph, at),
  topInset: stuckTop,
  onDetail: (open) => customizer.setVisible(open),
  onChange: (sel, what) => {
    state.themeId = sel.themeId;
    state.variantId = sel.variantId;
    persist();
    // 스타일·양식은 전환·배치가 달라지므로 영상 구성을 다시 계산
    rebuild();
    refreshFonts();
    customizer.refresh();
    const theme = currentTheme();
    showDemo(theme, { restart: true });
    if (liveTab === 'mine' && timeline && !player.isPlaying) player.seek(4.5);
    toast(what === 'theme' ? `${theme.name} 스타일 적용` : `양식 · ${theme.variants.find((v) => v.id === theme.variantId)?.name ?? ''} 적용`);
  },
});

const customizer = new Customizer({
  initial: state.custom,
  plain: plainTheme,
  designPoster: (design: TitleDesign, w, ph) =>
    renderPoster(resolveTheme(state.themeId, { variant: state.variantId, ...state.custom, title: design }), demoInfo(state.info), w, ph, 'intro'),
  onChange: (custom, key, message) => {
    state.custom = custom;
    hoverCustom = null;
    hoverKey = null;
    persist();
    if (STRUCTURAL_KEYS.has(key)) rebuild();
    else player.refresh();
    const theme = currentTheme();
    const target = CUSTOM_FOCUS[key];
    showDemo(theme, { focus: target, hold: HOLD_MS[target] });
    seekMine(target);
    refreshFonts();
    if (key !== 'title') customizer.invalidatePosters();
    toast(message);
  },
  onPreview: (next, key) => {
    hoverCustom = next;
    hoverKey = key;
    if (!demoReady) return;
    const info = demoInfo(state.info);
    if (next && key) {
      const theme = demoTheme();
      const target = CUSTOM_FOCUS[key];
      const apply = () => {
        if (hoverCustom !== next) return;
        demo.setTheme(theme, info, false);
        demo.focus(target, Infinity);
        if (!STRUCTURAL_KEYS.has(key)) {
          player.refresh();
          seekMine(target);
        }
      };
      const texts = collectTexts(theme, info);
      if (fontsReady(theme, texts)) apply();
      else void ensureFonts(theme, texts, 4000).then(apply);
    } else {
      demo.setTheme(currentTheme(), info, false);
      demo.release(600);
      player.refresh();
    }
  },
});

// ───────────────────────── 홈 화면 라이브 데모 (스타일을 차례로 보여줌) ─────────────────────────

const HERO_ORDER = [
  'classic',
  'lovely',
  'cinema',
  'romantic',
  'fairytale',
  'street',
  'royal',
  'garden',
  'editorial',
  'traditional',
  'neon',
  'summer',
  'retro',
  'camcorder',
  'gallery',
  'film',
  'modern',
];
const heroCanvas = $<HTMLCanvasElement>('hero-demo');
const heroDemo = new StyleDemo(heroCanvas);
const heroName = $('hero-demo-name');
const heroCue = $('hero-demo-cue');
let heroIndex = 0;
let heroVisible = false;
heroDemo.onCue = (label) => {
  heroCue.textContent = label;
};
function showHero(i: number): void {
  heroIndex = i % HERO_ORDER.length;
  const t = resolveTheme(HERO_ORDER[heroIndex]);
  heroName.textContent = `${t.name} 스타일`;
  heroCanvas.setAttribute('aria-label', `${t.name} 스타일 예시 영상`);
  heroDemo.setTheme(t, demoInfo(state.info));
}
heroDemo.onLoop = () => showHero(heroIndex + 1);
function updateHeroPlayback(): void {
  if (demoReady && heroVisible && !reducedMotion && !exporting && document.visibilityState === 'visible') heroDemo.play();
  else heroDemo.pause();
}
new IntersectionObserver(
  (entries) => {
    heroVisible = entries.some((e) => e.isIntersecting);
    updateHeroPlayback();
  },
  { threshold: 0.2 },
).observe(heroCanvas);
document.addEventListener('visibilitychange', updateHeroPlayback);

const site = initSite({
  onPickStyle: (id) => {
    // 고른 스타일 카드로 이동하고, 그 아래에 양식·꾸미기를 열어 둠
    picker.select(id);
    picker.scrollToSelection();
  },
});

/** 샘플 그림·글꼴을 준비한 뒤 카드 그림과 예시 영상을 만듦 */
async function initStyleDemos(): Promise<void> {
  const info = demoInfo(state.info);
  const first = currentTheme();
  await ensureFonts(first, collectTexts(first, info));
  sampleAssets();
  demoReady = true;
  showDemo(currentTheme(), { restart: true });
  if (demoUserPaused) demo.showPoster();
  updateDemoPlayback();
  const all = THEMES.flatMap((t) => t.variants.map((v) => resolveTheme(t.id, { variant: v.id })));
  await Promise.all(all.map((t) => ensureFonts(t, collectTexts(t, info))));
  site.setSamples((id) => sampleThumb(id));
  demo.redraw();
  showHero(0);
  if (reducedMotion) heroDemo.showPoster();
  updateHeroPlayback();
  await picker.renderPosters();
  site.setPosters((id) => picker.posterUrl(id));
  customizer.invalidatePosters();
}

const groupInput = $<HTMLInputElement>('f-group');
groupInput.checked = state.groupPhotos;
groupInput.addEventListener('change', () => {
  state.groupPhotos = groupInput.checked;
  persist();
  rebuild();
  seekMine('scene');
  toast(groupInput.checked ? '여러 장을 한 화면에 모아 보여줘요' : '한 화면에 사진을 한 장씩 보여줘요');
});

// ───────────────────────── 음악 ─────────────────────────

const musicRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="music"]'));
const customMusicEl = $('custom-music');
const musicList = $('music-list');
const musicStatus = $('music-status');
const musicInput = $<HTMLInputElement>('music-input');
let defaultMusicReady = false;

for (const r of musicRadios) {
  r.addEventListener('change', () => {
    if (r.checked) setMusicMode(r.value === 'custom' ? 'custom' : 'default');
  });
}
$('btn-music').addEventListener('click', () => musicInput.click());
musicInput.addEventListener('change', () => {
  const files = Array.from(musicInput.files ?? []);
  musicInput.value = '';
  void addMusicFiles(files);
});

function setMusicMode(mode: 'default' | 'custom'): void {
  state.musicMode = mode;
  for (const r of musicRadios) r.checked = r.value === mode;
  customMusicEl.hidden = mode !== 'custom';
  musicChanged();
}

function musicChanged(): void {
  renderMusicList();
  rebuild(true);
}

let musicQueue: Promise<void> = Promise.resolve();

function addMusicFiles(files: readonly File[]): Promise<void> {
  musicQueue = musicQueue.then(async () => {
    if (exporting || files.length === 0) return;
    const errors: string[] = [];
    let added = 0;
    for (const [i, f] of files.entries()) {
      setStatus(musicStatus, `음악 파일을 읽는 중… (${i + 1}/${files.length}) ${f.name}`);
      try {
        state.customMusic.push(await decodeMusicFile(f));
        added++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (added) setMusicMode('custom');
    else musicChanged();
    if (errors.length) setStatus(musicStatus, errors.join(' '), 'err');
  });
  return musicQueue;
}

function renderMusicList(): void {
  const last = state.customMusic.length - 1;
  const btn = (text: string, label: string, disabled: boolean, fn: () => void) => {
    const b = h('button', { text, attrs: { type: 'button', 'aria-label': label, title: label } });
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  };
  const move = (i: number, d: number) => {
    const list = state.customMusic;
    [list[i], list[i + d]] = [list[i + d], list[i]];
    musicChanged();
  };
  musicList.replaceChildren(
    ...state.customMusic.map((t, i) =>
      h('li', {}, [
        h('span', { class: 'name', text: `${i + 1}. ${t.name}`, attrs: { title: t.name } }),
        h('span', { class: 'dur', text: formatTime(t.duration) }),
        btn('▲', `${t.name} 앞으로`, i === 0, () => move(i, -1)),
        btn('▼', `${t.name} 뒤로`, i === last, () => move(i, 1)),
        btn('✕', `${t.name} 빼기`, false, () => {
          state.customMusic.splice(i, 1);
          musicChanged();
        }),
      ]),
    ),
  );
}

function updateMusicStatus(): void {
  if (state.musicMode === 'custom') {
    if (!state.customMusic.length) {
      setStatus(musicStatus, '아직 음악 파일을 고르지 않아서 기본 음악이 사용돼요.', 'warn');
      return;
    }
    const total = musicTotalDuration(state.customMusic);
    const d = timeline?.duration;
    let msg = `음악 ${state.customMusic.length}곡 · 총 ${formatTime(total)}`;
    if (d) {
      if (total < d - 1) msg += ` · 영상(${formatTime(d)})보다 짧아서 처음부터 이어서 반복돼요.`;
      else if (total > d + 1) msg += ` · 영상(${formatTime(d)})보다 길어서 끝부분은 자연스럽게 페이드아웃돼요.`;
      else msg += ' · 영상 길이와 딱 맞아요.';
    }
    setStatus(musicStatus, msg, 'ok');
  } else {
    setStatus(musicStatus, defaultMusicReady ? '기본 음악이 준비됐어요.' : '기본 음악을 준비하는 중…', defaultMusicReady ? 'ok' : '');
  }
}

async function currentTracks(): Promise<MusicTrack[]> {
  if (hasCustomMusic()) return state.customMusic;
  return [await loadDefaultMusic()];
}

// ───────────────────────── 미리보기 ─────────────────────────

const PLAY_PATH = 'M8 5v14l11-7z';
const PAUSE_PATH = 'M7 5h4v14H7zM13 5h4v14h-4z';
const playBtn = $<HTMLButtonElement>('btn-play');
const playIcon = document.getElementById('play-icon') as unknown as SVGPathElement;
const seekInput = $<HTMLInputElement>('seek');
const timeEl = $('time');
let seeking = false;

function previewContext(): RenderContext | null {
  if (!timeline) return null;
  return {
    timeline,
    theme: previewTheme(),
    info: state.info,
    assets: previewCache,
    photoDate: (id) => photoDates.get(id) ?? null,
    caption: (id) => captions.get(id) ?? '',
  };
}

async function previewAudio(): Promise<PreviewAudio | null> {
  const tl = timeline;
  if (!tl) return null;
  const tracks = await currentTracks();
  const d = tl.duration;
  return { key: `${tracks.map((t) => t.id).join(',')}|${d}`, load: () => mixMusic(tracks, d) };
}

const player = new PreviewPlayer(
  previewCanvas,
  previewCache,
  previewContext,
  previewAudio,
  '사진을 올리면 여기에서 미리 볼 수 있어요',
);
player.onUpdate = (t, d, playing, loading) => {
  seekInput.max = String(d || MIN_VIDEO_DURATION);
  if (!seeking) seekInput.value = String(t);
  timeEl.textContent = `${formatTime(t)} / ${formatTime(d)}`;
  playIcon.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
  playBtn.setAttribute('aria-label', playing ? '일시정지' : '재생');
  playBtn.setAttribute('aria-busy', String(loading));
  playBtn.disabled = !timeline || exporting;
  seekInput.disabled = !timeline || exporting;
};
player.onAudioError = (msg) => setStatus(musicStatus, msg, 'err');
document.addEventListener('appearancechange', () => player.refresh());
void document.fonts
  .load('600 50px "Pretendard Variable"', '사진을 올리면 여기에서 미리 볼 수 있어요')
  .then(() => player.refresh())
  .catch(() => undefined);
playBtn.addEventListener('click', () => player.toggle());
seekInput.addEventListener('input', () => {
  seeking = true;
  player.seek(Number(seekInput.value));
});
seekInput.addEventListener('change', () => {
  seeking = false;
});

// ───────────────────────── 내보내기 ─────────────────────────

const stepsEl = $('steps');

function getJob(): ExportJob | null {
  if (!timeline) return null;
  const theme = currentTheme();
  const info = { ...state.info };
  const names = [info.groom.trim(), info.bride.trim()].filter(Boolean);
  // 만드는 도중 사진 목록·문구가 바뀌어도 영향이 없도록 복사본 사용
  const dates = new Map(photoDates);
  const caps = new Map(captions);
  return {
    context: { timeline, theme, info, photoDate: (id: string) => dates.get(id) ?? null, caption: (id: string) => caps.get(id) ?? '' },
    fileBase: safeFileName(['식전영상', ...names].join('_')) || '식전영상',
    title: names.length ? `${names.join(' ♥ ')} 식전영상` : '웨딩 식전영상',
  };
}

const exportPanel = setupExportPanel({
  library,
  getJob,
  getQuality: () => state.quality,
  setQuality: (q) => {
    state.quality = q;
    persist();
  },
  prepare: async (job) => {
    await ensureFonts(job.context.theme, collectTexts(job.context.theme, job.context.info, captionTexts()), 20000);
  },
  getAudio: async (duration) => {
    try {
      const tracks = await currentTracks();
      return tracks.length ? mixMusic(tracks, duration) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  onBusyChange: (busy) => {
    exporting = busy;
    stepsEl.inert = busy;
    if (busy) {
      player.pause();
      editor.close();
      if (sheet.open) sheet.close();
    }
    playBtn.disabled = busy || !timeline;
    seekInput.disabled = busy || !timeline;
    // 영상을 만드는 동안에는 예시 영상·배경 효과를 멈춰 속도를 확보
    updateDemoPlayback();
    updateHeroPlayback();
    site.setBusy(busy);
    updateFab();
  },
});

// ───────────────────────── 휴대폰: 어디서든 미리보기 ─────────────────────────
// 스타일·꾸미기·문구 카드를 지나는 동안은 위쪽에 붙은 미리보기가 보이고, 그 밖(사진·음악·길이)에서는
// 떠 있는 버튼으로 내 영상 미리보기를 아래에서 올라오는 창으로 열어 봄.

const fab = $<HTMLButtonElement>('preview-fab');
const sheet = $<HTMLDialogElement>('preview-sheet');
const previewBox = $('preview-box');
const previewHome = $('preview-home');
let stepsInView = false;
let typing = false;

function updateFab(): void {
  fab.hidden = !(narrow.matches && stepsInView && !liveInView && !typing && !!timeline && !exporting && !sheet.open && !editor.isOpen);
}

function openPreviewSheet(): void {
  if (sheet.open || !timeline) return;
  $('ps-body').append(previewBox);
  sheet.showModal();
  player.refresh();
  updateFab();
}

new IntersectionObserver((entries) => {
  stepsInView = entries.some((e) => e.isIntersecting);
  updateFab();
}).observe(stepsEl);
new IntersectionObserver(
  (entries) => {
    liveInView = entries.some((e) => e.isIntersecting);
    updateFab();
  },
  { threshold: 0.35 },
).observe(liveBox);
narrow.addEventListener('change', () => {
  placeLive();
  syncStuckTop();
  updateFab();
});
// 자판이 올라와 있을 때는 버튼이 입력칸을 가리지 않도록 숨기고, 휴대폰에서는 붙어 있던 미리보기도 제자리로
document.addEventListener('focusin', (e) => {
  typing = (e.target as HTMLElement).matches?.('input[type="text"], input[type="date"], input[type="time"], textarea') ?? false;
  document.body.classList.toggle('typing', typing);
  syncStuckTop();
  updateFab();
});
document.addEventListener('focusout', () => {
  typing = false;
  document.body.classList.remove('typing');
  syncStuckTop();
  updateFab();
});
fab.addEventListener('click', openPreviewSheet);
sheet.addEventListener('close', () => {
  previewHome.append(previewBox);
  player.pause();
  player.refresh();
  updateFab();
});
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) sheet.close();
});
$('ps-close').addEventListener('click', () => sheet.close());
$('ps-export').addEventListener('click', () => {
  sheet.close();
  $('h-export').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
});

// ───────────────────────── 시작 ─────────────────────────

const supportWarning = $('support-warning');
if (!window.isSecureContext) {
  supportWarning.textContent =
    '영상 만들기는 https 또는 localhost 주소에서만 동작해요. 안내된 실행 방법(npm run dev)으로 열어 주세요.';
  supportWarning.hidden = false;
} else if (typeof VideoEncoder === 'undefined') {
  supportWarning.textContent =
    '이 브라우저는 MP4 만들기(WebCodecs)를 지원하지 않아요. 미리보기는 볼 수 있어요. 영상을 만들려면 PC·안드로이드의 최신 Chrome/Edge 또는 iOS 26 이상의 Safari에서 열어 주세요.';
  supportWarning.hidden = false;
}

window.addEventListener('beforeunload', (e) => {
  if (exporting || state.photos.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

initPwa();
placeLive();
updateSortChips();
customMusicEl.hidden = true;
rebuild();
refreshFonts();
showDemo(currentTheme(), { restart: true });
void initStyleDemos().catch((e) => console.error(e));

// 자동 테스트용 정보 (?e2e 주소로 열었을 때만)
if (new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __wvm: unknown }).__wvm = {
    timeline: () => timeline,
    photos: () => state.photos.map((p) => ({ id: p.id, name: p.name, aspect: p.aspect, caption: p.caption })),
    demoReady: () => demoReady,
    demoPlaying: () => demo.isPlaying,
    demoPause: () => {
      demoUserPaused = true;
      syncDemoToggle();
      demo.pause();
    },
    demoSeek: (t: number) => demo.seek(t),
    demoInfo: () => ({ duration: demo.duration, cues: demo.cues, marks: demo.marks }),
    demoTime: () => demo.currentTime,
    heroPlaying: () => heroDemo.isPlaying,
    liveTab: () => liveTab,
    detailOpen: () => picker.detailOpen,
    /** 사진마다 문구 넣기 (화면 캡처 점검용): fn(순서) → 문구 */
    setCaptions: (fn: (index: number) => string) => {
      state.photos.forEach((p, i) => {
        p.caption = fn(i);
      });
      rebuild();
      refreshFonts();
    },
    theme: () => {
      const t = currentTheme();
      return { id: t.id, variant: t.variantId, title: t.titleDesign, particle: t.effects.particle, fonts: t.fonts, custom: { ...state.custom } };
    },
  };
}
setTimeout(() => {
  loadDefaultMusic().then(
    () => {
      defaultMusicReady = true;
      updateMusicStatus();
    },
    (e: unknown) => {
      setStatus(musicStatus, `기본 음악을 준비하지 못했어요: ${e instanceof Error ? e.message : String(e)}`, 'err');
    },
  );
}, 300);
