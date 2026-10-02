// 만들기 단계: 사진 → 스타일 → 문구 → 음악·길이 → 만들기.
// 한 번에 한 단계만 같은 자리에 보여 주고, 단계 표시줄(PC는 위쪽, 휴대폰은 아래쪽에 붙어 있음)이나
// 이전·다음 버튼으로 스크롤 없이 넘어가고 되돌아감.

import { $, h } from './dom';

export type StepId = 'photos' | 'style' | 'text' | 'sound' | 'export';

export const STEPS: readonly { id: StepId; title: string }[] = [
  { id: 'photos', title: '사진 올리기' },
  { id: 'style', title: '스타일 고르기' },
  { id: 'text', title: '문구 입력' },
  { id: 'sound', title: '음악·길이' },
  { id: 'export', title: '영상 만들기' },
];

/** 휴대폰 미리보기가 위쪽에 붙어 있는 단계 */
const LIVE_STEPS = new Set<StepId>(['style', 'text']);

export interface FlowOptions {
  /** 화면 위쪽에 붙어 내용을 가리는 높이 (메뉴) */
  navInset: () => number;
  /** 단계가 바뀐 뒤 */
  onChange?: (step: StepId, prev: StepId) => void;
}

/** 화면 이동 없이 바로 (html의 부드러운 스크롤 설정을 무시) */
const INSTANT = 'instant' as ScrollBehavior;
const indexOf = (id: StepId) => STEPS.findIndex((s) => s.id === id);

export class Flow {
  private cur: StepId = 'photos';
  private busy = false;
  private nudgeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly bar = $('flow-bar');
  private readonly stepsEl = $('steps');
  private readonly liveZone = $('live-zone');
  private readonly prevBtn = $<HTMLButtonElement>('fb-prev');
  private readonly nextBtn = $<HTMLButtonElement>('fb-next');
  private readonly nextTo = $('fb-next-to');
  private readonly sections = new Map<StepId, HTMLElement>();
  private readonly buttons = new Map<StepId, HTMLButtonElement>();

  constructor(private readonly opts: FlowOptions) {
    for (const s of STEPS) {
      const sec = document.querySelector<HTMLElement>(`.step[data-step="${s.id}"]`);
      if (!sec) throw new Error(`${s.id} 단계를 찾을 수 없어요.`);
      this.sections.set(s.id, sec);
      sec.append(this.footer(s.id));
      const btn = $<HTMLButtonElement>(`fb-${s.id}`);
      btn.addEventListener('click', () => this.go(s.id));
      this.buttons.set(s.id, btn);
    }
    this.prevBtn.addEventListener('click', () => this.step(-1));
    this.nextBtn.addEventListener('click', () => this.step(1));
    this.render();
  }

  get current(): StepId {
    return this.cur;
  }

  /** 앞/뒤 단계로 */
  step(dir: 1 | -1): void {
    const next = STEPS[indexOf(this.cur) + dir];
    if (next) this.go(next.id);
  }

  /**
   * 그 단계를 이 자리에 엶. 단계 내용을 보다가 아래로 내려와 있었으면 새 단계의 처음이
   * 단계 표시줄 바로 아래(휴대폰은 메뉴 바로 아래)에 오도록 맞춤 (화면을 오르내릴 필요 없음).
   */
  go(id: StepId, o: { focus?: boolean; scroll?: boolean } = {}): void {
    if (this.busy && id !== 'export') return;
    const prev = this.cur;
    if (id !== prev) {
      this.cur = id;
      this.render();
    }
    if (o.scroll !== false) this.settle();
    if (id === prev) return;
    // 키보드·화면 낭독기 사용자를 새 단계 제목으로 (화면은 움직이지 않음)
    if (o.focus !== false) this.sections.get(id)?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    this.opts.onChange?.(id, prev);
  }

  /** 단계 표시줄의 완료 표시 */
  setDone(id: StepId, done: boolean): void {
    this.buttons.get(id)?.classList.toggle('done', done);
  }

  /** 단계 표시줄의 작은 숫자 (사진 수 등) */
  setBadge(id: StepId, text: string): void {
    const el = document.getElementById(`fbb-${id}`);
    if (el) el.textContent = text;
  }

  /** '다음' 버튼을 잠깐 눈에 띄게 (사진을 처음 올렸을 때 등) */
  nudge(): void {
    const targets = [this.nextBtn, ...this.stepsEl.querySelectorAll<HTMLElement>(`.step[data-step="${this.cur}"] [data-flow-next]`)];
    for (const t of targets) t.classList.remove('nudge');
    void this.nextBtn.offsetWidth;
    for (const t of targets) t.classList.add('nudge');
    clearTimeout(this.nudgeTimer);
    this.nudgeTimer = setTimeout(() => targets.forEach((t) => t.classList.remove('nudge')), 4500);
  }

  /** 영상을 만드는 동안: 만들기 단계에 머물고 다른 단계·표시줄은 잠금 */
  setBusy(busy: boolean): void {
    if (busy && this.cur !== 'export') this.go('export', { focus: false });
    this.busy = busy;
    this.bar.inert = busy;
    for (const [id, sec] of this.sections) if (id !== 'export') sec.inert = busy;
  }

  private render(): void {
    const i = indexOf(this.cur);
    for (const [id, sec] of this.sections) sec.hidden = id !== this.cur;
    this.liveZone.hidden = !LIVE_STEPS.has(this.cur);
    for (const [id, btn] of this.buttons) {
      if (id === this.cur) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    }
    const prev = STEPS[i - 1];
    const next = STEPS[i + 1];
    this.prevBtn.disabled = !prev;
    this.prevBtn.setAttribute('aria-label', prev ? `이전 단계: ${prev.title}` : '이전 단계');
    this.nextBtn.hidden = !next;
    this.nextTo.textContent = next ? `: ${next.title}` : '';
    this.nextBtn.setAttribute('aria-label', next ? `다음 단계: ${next.title}` : '');
    this.nextBtn.classList.remove('nudge');
    this.bar.dataset.step = this.cur;
  }

  private settle(): void {
    const line = this.opts.navInset() + 8;
    const top = this.stepsEl.getBoundingClientRect().top;
    if (top < line - 1) window.scrollBy({ top: top - line, behavior: INSTANT });
  }

  /** 단계 맨 아래의 이전·다음 버튼 (PC. 휴대폰은 아래쪽에 붙은 단계 표시줄이 대신함) */
  private footer(id: StepId): HTMLElement {
    const i = indexOf(id);
    const prev = STEPS[i - 1];
    const next = STEPS[i + 1];
    const foot = h('div', { class: 'step-foot' });
    if (prev) {
      foot.append(h('button', { class: 'btn subtle', text: `‹ 이전: ${prev.title}`, attrs: { type: 'button' }, on: { click: () => this.go(prev.id) } }));
    }
    if (next) {
      foot.append(
        h('button', { class: 'btn primary', text: `다음: ${next.title} ›`, attrs: { type: 'button', 'data-flow-next': '' }, on: { click: () => this.go(next.id) } }),
      );
    }
    return foot;
  }
}
