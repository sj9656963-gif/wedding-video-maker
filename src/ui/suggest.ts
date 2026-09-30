// 입력칸 옆 예시 문구 칩: 누르면 입력칸에 들어가고(중간 문구는 한 줄 추가), '다른 예시'로 넘겨 봄

import { h } from './dom';

export interface SuggestOptions {
  field: HTMLInputElement | HTMLTextAreaElement;
  items: readonly string[];
  /** replace = 입력칸을 바꿈, line = 새 줄로 추가 (이미 있으면 그대로) */
  mode: 'replace' | 'line';
  /** 한 번에 보여 줄 칩 수 */
  perPage?: number;
  /** 스크린 리더용 이름 */
  label: string;
  /** 줄 추가 방식에서 '한 번에 넣기' 버튼으로 넣을 줄 수 (0이면 버튼 없음) */
  fillAll?: number;
  /** 문구를 넣은 뒤 (미리보기 이동 등) */
  onApply?: () => void;
}

export interface Suggest {
  /** 입력칸 값이 바뀌었을 때 칩 표시(넣은 문구 표시)를 다시 */
  refresh(): void;
}

const lines = (v: string) =>
  v
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function attachSuggestions(host: HTMLElement, o: SuggestOptions): Suggest {
  const per = o.perPage ?? 4;
  let page = 0;
  const pages = Math.max(1, Math.ceil(o.items.length / per));
  host.classList.add('suggest');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', o.label);
  const list = h('span', { class: 'sg-list' });
  const more = h('button', { class: 'sg-more', text: '↻ 다른 예시', attrs: { type: 'button', title: '다른 예시 보기' } });
  const parts: Node[] = [h('span', { class: 'sg-label', text: '예시', attrs: { 'aria-hidden': 'true' } }), list];
  if (pages > 1) parts.push(more);
  let all: HTMLButtonElement | null = null;
  if (o.mode === 'line' && o.fillAll) {
    all = h('button', { class: 'sg-more', text: `예시 ${o.fillAll}줄 한 번에`, attrs: { type: 'button' } });
    parts.push(all);
  }
  host.replaceChildren(...parts);

  const max = () => (o.field.maxLength > 0 ? o.field.maxLength : Infinity);
  const apply = (value: string) => {
    o.field.value = value.slice(0, max());
    o.field.dispatchEvent(new Event('input', { bubbles: true }));
    render();
    o.onApply?.();
  };
  const used = (text: string) => (o.mode === 'line' ? lines(o.field.value).includes(text) : o.field.value.trim() === text);

  function render(): void {
    const start = page * per;
    const items = o.items.slice(start, start + per);
    list.replaceChildren(
      ...items.map((text) => {
        const shown = text.split('\n')[0] + (text.includes('\n') ? ' …' : '');
        const b = h('button', { class: 'sg-chip', text: shown, attrs: { type: 'button', title: text.replace(/\n/g, ' '), 'aria-pressed': String(used(text)) } });
        b.addEventListener('click', () => {
          if (o.mode === 'replace') {
            apply(text);
            return;
          }
          const cur = lines(o.field.value);
          if (cur.includes(text)) return;
          apply([...cur, text].join('\n'));
        });
        return b;
      }),
    );
  }
  more.addEventListener('click', () => {
    page = (page + 1) % pages;
    render();
  });
  all?.addEventListener('click', () => apply(o.items.slice(0, o.fillAll).join('\n')));
  render();
  return {
    refresh() {
      for (const b of list.querySelectorAll<HTMLButtonElement>('.sg-chip')) {
        const text = o.items.find((x) => x.replace(/\n/g, ' ') === b.title) ?? '';
        b.setAttribute('aria-pressed', String(!!text && used(text)));
      }
    },
  };
}
