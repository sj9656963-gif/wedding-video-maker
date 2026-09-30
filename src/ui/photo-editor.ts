// 사진 편집 창: 사진마다 문구 넣기(Enter로 다음 사진), 순서 이동, 오프닝·엔딩 지정, 빼기, 미리보기에서 보기.
// 넓은 화면에서는 가운데 창, 휴대폰에서는 아래에서 올라오는 시트(CSS).

import type { PhotoItem } from '../types';
import { $ } from './dom';

export interface PhotoEditorDeps {
  photos(): readonly PhotoItem[];
  /** 실제 영상에 쓰이는 오프닝·엔딩 사진 */
  coverId(): string | null;
  outroId(): string | null;
  /** 사진이 너무 많아 영상에서 빠진 사진 */
  unused(): ReadonlySet<string>;
  onCaption(id: string, text: string): void;
  /** id 사진을 toIndex 위치(이동 전 배열 기준, 끼워 넣을 자리)로 옮김 */
  onMove(id: string, toIndex: number): void;
  onSetCover(id: string): void;
  onSetOutro(id: string): void;
  onRemove(id: string): void;
  /** 미리보기에서 이 사진이 나오는 장면 보기 */
  onView(id: string): void;
  /** 창이 닫힐 때 (마지막으로 보던 사진) */
  onClose(id: string | null): void;
}

const coarse = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

export class PhotoEditor {
  private readonly dialog = $<HTMLDialogElement>('photo-editor');
  private readonly img = $<HTMLImageElement>('pe-img');
  private readonly pos = $('pe-pos');
  private readonly caption = $<HTMLInputElement>('pe-caption');
  private readonly note = $('pe-note');
  private readonly prevBtn = $<HTMLButtonElement>('pe-prev');
  private readonly nextBtn = $<HTMLButtonElement>('pe-next');
  private readonly act = new Map<string, HTMLButtonElement>();
  private id: string | null = null;

  constructor(private readonly deps: PhotoEditorDeps) {
    for (const b of this.dialog.querySelectorAll<HTMLButtonElement>('button[data-pe]')) this.act.set(b.dataset.pe ?? '', b);
    $('pe-close').addEventListener('click', () => this.close());
    // 창 바깥(어두운 배경)을 누르면 닫힘
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close();
    });
    this.dialog.addEventListener('close', () => {
      const id = this.id;
      this.id = null;
      deps.onClose(id);
    });
    this.caption.addEventListener('input', () => {
      if (this.id) deps.onCaption(this.id, this.caption.value);
    });
    this.caption.addEventListener('keydown', (e) => {
      // 한글 조합 중 Enter는 글자 확정용이므로 넘어가지 않음
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      this.step(1, true);
    });
    this.prevBtn.addEventListener('click', () => this.step(-1));
    this.nextBtn.addEventListener('click', () => this.step(1, true));
    this.on('left', (id, i) => deps.onMove(id, i - 1));
    this.on('right', (id, i) => deps.onMove(id, i + 2));
    this.on('cover', (id) => deps.onSetCover(id));
    this.on('outro', (id) => deps.onSetOutro(id));
    this.on('view', (id) => {
      this.close();
      deps.onView(id);
    });
    this.on('remove', (id, i) => {
      const list = this.deps.photos();
      const neighbor = list[i + 1]?.id ?? list[i - 1]?.id ?? null;
      deps.onRemove(id);
      if (neighbor) this.show(neighbor);
      else this.close();
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  open(id: string): void {
    this.show(id);
    if (!this.dialog.open) this.dialog.showModal();
    // 휴대폰에서는 자판이 바로 올라오지 않게 (문구를 넣으려면 입력칸을 누름)
    if (!coarse()) {
      this.caption.focus();
      this.caption.select();
    }
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }

  /** 사진 목록이 바뀐 뒤 (순서·오프닝 사진 등) 다시 표시 */
  refresh(): void {
    if (!this.dialog.open || !this.id) return;
    if (!this.deps.photos().some((p) => p.id === this.id)) {
      this.close();
      return;
    }
    this.render();
  }

  private on(name: string, fn: (id: string, index: number) => void): void {
    this.act.get(name)?.addEventListener('click', () => {
      const id = this.id;
      if (!id) return;
      const i = this.deps.photos().findIndex((p) => p.id === id);
      if (i >= 0) fn(id, i);
    });
  }

  private show(id: string): void {
    const p = this.deps.photos().find((x) => x.id === id);
    if (!p) return;
    this.id = id;
    this.img.src = p.thumbUrl;
    this.caption.value = p.caption;
    this.render();
  }

  private step(d: number, closeAtEnd = false): void {
    const list = this.deps.photos();
    const i = list.findIndex((p) => p.id === this.id);
    const target = list[i + d];
    if (target) {
      this.show(target.id);
      if (document.activeElement === this.caption || !coarse()) {
        this.caption.focus();
        this.caption.select();
      }
    } else if (closeAtEnd) {
      this.close();
    }
  }

  private render(): void {
    const list = this.deps.photos();
    const i = list.findIndex((p) => p.id === this.id);
    if (i < 0) return;
    const n = list.length;
    const p = list[i];
    this.pos.textContent = `${i + 1} / ${n}`;
    this.img.alt = `${i + 1}번째 사진 ${p.name}`;
    const isCover = this.deps.coverId() === p.id;
    const isOutro = this.deps.outroId() === p.id;
    this.act.get('left')!.disabled = i === 0;
    this.act.get('right')!.disabled = i === n - 1;
    this.act.get('cover')!.setAttribute('aria-pressed', String(isCover));
    this.act.get('outro')!.setAttribute('aria-pressed', String(isOutro));
    this.prevBtn.disabled = i === 0;
    this.nextBtn.textContent = i === n - 1 ? '완료' : '다음 사진 ›';
    this.note.textContent = this.deps.unused().has(p.id)
      ? '이 사진은 영상 길이에 비해 사진이 많아 지금은 영상에서 빠져 있어요. 영상 길이를 늘리면 들어가요.'
      : '';
    this.note.hidden = !this.note.textContent;
  }
}
