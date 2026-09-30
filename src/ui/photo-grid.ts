// 사진 순서 목록: 드래그 또는 버튼으로 순서 변경, 오프닝/엔딩 사진 지정, 사진 문구 편집, 빼기

import type { PhotoItem } from '../types';
import { h } from './dom';

export interface PhotoGridCallbacks {
  /** id 사진을 toIndex 위치(이동 전 배열 기준, 끼워 넣을 자리)로 옮김 */
  onMove(id: string, toIndex: number): void;
  onRemove(id: string): void;
  onSetCover(id: string): void;
  onSetOutro(id: string): void;
  /** 사진을 눌렀을 때 (미리보기에서 해당 장면으로 이동) */
  onSelect(id: string): void;
  /** 사진 편집 창 열기 (문구 입력 등) */
  onEdit(id: string): void;
}

interface Row {
  li: HTMLLIElement;
  idx: HTMLSpanElement;
  marks: HTMLSpanElement;
  cap: HTMLSpanElement;
  open: HTMLButtonElement;
  left: HTMLButtonElement;
  right: HTMLButtonElement;
  cover: HTMLButtonElement;
  outro: HTMLButtonElement;
  edit: HTMLButtonElement;
  remove: HTMLButtonElement;
}

/** 손가락으로 쓰는 화면(휴대폰·태블릿): 작은 버튼 대신 사진을 누르면 편집 창이 열림 */
const coarse = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

export class PhotoGrid {
  private rows = new Map<string, Row>();
  private order: string[] = [];
  private dragId: string | null = null;

  constructor(
    private readonly root: HTMLOListElement,
    private readonly cb: PhotoGridCallbacks,
  ) {
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('dragstart', (e) => this.onDragStart(e));
    root.addEventListener('dragover', (e) => this.onDragOver(e));
    root.addEventListener('drop', (e) => this.onDrop(e));
    root.addEventListener('dragend', () => this.endDrag());
    root.addEventListener('dragleave', (e) => {
      if (e.target === root) this.clearIndicators();
    });
  }

  private createRow(p: PhotoItem): Row {
    const btn = (act: string, label: string, text: string, cls = '') =>
      h('button', { text, class: cls, attrs: { type: 'button', 'data-act': act, 'aria-label': label, title: label } });
    const img = h('img', { attrs: { src: p.thumbUrl, alt: '', decoding: 'async', draggable: 'false' } });
    const open = h('button', { class: 'open', attrs: { type: 'button', 'data-act': 'select' } });
    const idx = h('span', { class: 'idx' });
    const marks = h('span', { class: 'marks' });
    const badges = h('span', { class: 'badges', attrs: { 'aria-hidden': 'true' } }, [idx, marks]);
    const cap = h('span', { class: 'cap', attrs: { 'aria-hidden': 'true' } });
    const left = btn('left', '앞으로 이동', '◀');
    const cover = btn('cover', '오프닝 사진으로 지정', '★');
    const outro = btn('outro', '엔딩 사진으로 지정', '♥');
    const edit = btn('edit', '사진 문구 넣기', '✎');
    const right = btn('right', '뒤로 이동', '▶');
    const remove = btn('remove', '이 사진 빼기', '✕', 'del');
    const actions = h('div', { class: 'actions' }, [left, cover, outro, edit, right]);
    const li = h('li', { class: 'photo', attrs: { draggable: 'true', 'data-id': p.id } }, [img, open, badges, cap, remove, actions]);
    return { li, idx, marks, cap, open, left, right, cover, outro, edit, remove };
  }

  /** 목록을 현재 상태로 갱신 (기존 요소 재사용). coverId/outroId는 실제 영상에 쓰이는 사진 */
  render(photos: readonly PhotoItem[], coverId: string | null, outroId: string | null, unused: ReadonlySet<string>): void {
    const active = document.activeElement as HTMLElement | null;
    const focusId = active?.closest<HTMLLIElement>('li.photo')?.dataset.id ?? null;
    const focusAct = active?.dataset.act ?? null;

    const alive = new Set(photos.map((p) => p.id));
    for (const [id, row] of this.rows) {
      if (!alive.has(id)) {
        row.li.remove();
        this.rows.delete(id);
      }
    }
    const n = photos.length;
    photos.forEach((p, i) => {
      let row = this.rows.get(p.id);
      if (!row) {
        row = this.createRow(p);
        this.rows.set(p.id, row);
      }
      const num = i + 1;
      row.idx.textContent = String(num);
      const isCover = p.id === coverId;
      const isOutro = p.id === outroId;
      const caption = p.caption.trim();
      row.marks.replaceChildren(
        ...(isCover ? [h('span', { class: 'mark', text: '★' })] : []),
        ...(isOutro ? [h('span', { class: 'mark', text: '♥' })] : []),
      );
      row.cap.textContent = caption;
      row.cap.hidden = !caption;
      const extra = [
        isCover ? '오프닝 사진' : '',
        isOutro ? '엔딩 사진' : '',
        caption ? `문구 "${caption}"` : '',
        unused.has(p.id) ? '영상에서 제외됨' : '',
      ]
        .filter(Boolean)
        .join(', ');
      const how = coarse() ? '눌러서 편집' : '눌러서 미리보기';
      row.open.setAttribute('aria-label', `${num}번째 사진 ${p.name}${extra ? ` (${extra})` : ''}. ${how}`);
      row.left.disabled = i === 0;
      row.right.disabled = i === n - 1;
      row.cover.setAttribute('aria-pressed', String(isCover));
      row.outro.setAttribute('aria-pressed', String(isOutro));
      row.edit.setAttribute('aria-pressed', String(!!caption));
      row.left.setAttribute('aria-label', `${num}번째 사진을 앞으로 이동`);
      row.right.setAttribute('aria-label', `${num}번째 사진을 뒤로 이동`);
      row.edit.setAttribute('aria-label', `${num}번째 사진 문구 ${caption ? '고치기' : '넣기'}`);
      row.remove.setAttribute('aria-label', `${num}번째 사진 빼기`);
      row.li.classList.toggle('unused', unused.has(p.id));
      row.li.classList.toggle('has-cap', !!caption);
      // 순서가 바뀐 경우에만 DOM 이동
      if (this.root.children[i] !== row.li) this.root.insertBefore(row.li, this.root.children[i] ?? null);
    });
    this.order = photos.map((p) => p.id);

    if (focusId && focusAct) {
      const row = this.rows.get(focusId);
      const target = row?.li.querySelector<HTMLButtonElement>(`[data-act="${focusAct}"]`);
      if (target && document.activeElement !== target) {
        if (target.disabled) row?.open.focus();
        else target.focus();
      }
    }
  }

  /** 편집 창을 닫은 뒤 그 사진으로 초점을 돌려줌 */
  focus(id: string): void {
    this.rows.get(id)?.open.focus({ preventScroll: true });
  }

  private onClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    const li = btn?.closest<HTMLLIElement>('li.photo');
    const id = li?.dataset.id;
    if (!btn || !id) return;
    const i = this.order.indexOf(id);
    switch (btn.dataset.act) {
      case 'left':
        if (i > 0) this.cb.onMove(id, i - 1);
        break;
      case 'right':
        if (i < this.order.length - 1) this.cb.onMove(id, i + 2);
        break;
      case 'cover':
        this.cb.onSetCover(id);
        break;
      case 'outro':
        this.cb.onSetOutro(id);
        break;
      case 'edit':
        this.cb.onEdit(id);
        break;
      case 'remove':
        this.cb.onRemove(id);
        break;
      case 'select':
        if (coarse()) this.cb.onEdit(id);
        else this.cb.onSelect(id);
        break;
    }
  }

  private onDragStart(e: DragEvent): void {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('li.photo');
    if (!li || !e.dataTransfer) return;
    this.dragId = li.dataset.id ?? null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dragId ?? '');
    li.classList.add('dragging');
  }

  private dropTarget(e: DragEvent): { li: HTMLLIElement; after: boolean } | null {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('li.photo');
    if (!li) return null;
    const rect = li.getBoundingClientRect();
    return { li, after: e.clientX > rect.left + rect.width / 2 };
  }

  private clearIndicators(): void {
    for (const el of this.root.querySelectorAll('.drop-before, .drop-after')) {
      el.classList.remove('drop-before', 'drop-after');
    }
  }

  private onDragOver(e: DragEvent): void {
    if (!this.dragId) return; // 바깥에서 파일을 끌어온 경우는 페이지 전체 처리에 맡김
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const t = this.dropTarget(e);
    this.clearIndicators();
    if (t && t.li.dataset.id !== this.dragId) t.li.classList.add(t.after ? 'drop-after' : 'drop-before');
  }

  private onDrop(e: DragEvent): void {
    if (!this.dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const t = this.dropTarget(e);
    const id = this.dragId;
    this.endDrag();
    if (!t || t.li.dataset.id === id) return;
    const targetIndex = this.order.indexOf(t.li.dataset.id!);
    if (targetIndex < 0) return;
    this.cb.onMove(id, targetIndex + (t.after ? 1 : 0));
  }

  private endDrag(): void {
    if (this.dragId) this.rows.get(this.dragId)?.li.classList.remove('dragging');
    this.dragId = null;
    this.clearIndicators();
  }
}
