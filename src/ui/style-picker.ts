// 스튜디오의 스타일 고르기: 분위기 필터, 스타일 카드 17종, 그리고 고른 카드가 있는 줄 바로 아래에 열리는
// 세부 설정(양식·오프닝과 문구·글씨체·색감·효과·전환 탭). 다른 카드를 누르면 세부 설정이 그 카드 아래로 따라가므로,
// 스타일을 바꿔 가며 꾸며 볼 때 목록과 설정 사이를 오르내리며 스크롤할 필요가 없음.
// 탭과 꾸미기 내용은 customizer.ts에서.

import { MOODS, THEMES, baseTheme, resolveTheme, type MoodId, type Theme } from '../themes';
import { $, h } from './dom';

export interface StyleSelection {
  themeId: string;
  variantId: string | null;
}

export type StyleChange = 'theme' | 'variant';

export interface StylePickerOptions {
  initial: StyleSelection;
  onChange: (sel: StyleSelection, what: StyleChange) => void;
  /** 카드 그림 (data URL). at = 'intro'면 오프닝 문구가 다 나온 순간 */
  poster: (theme: Theme, width: number, height: number, at?: 'poster' | 'intro') => string;
  /** 화면 위쪽에 붙어 있어 내용을 가리는 높이 (메뉴, 휴대폰은 위쪽 미리보기까지) */
  topInset?: () => number;
  /** 세부 설정이 열리거나 닫힐 때 */
  onDetail?: (open: boolean) => void;
}

const idle = () => new Promise<void>((r) => setTimeout(r, 0));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** 화면 이동 없이 바로 (html의 부드러운 스크롤 설정을 무시) */
const INSTANT = 'instant' as ScrollBehavior;

export class StylePicker {
  readonly sel: StyleSelection;
  private mood: MoodId | 'all' = 'all';
  private ready = false;
  private open = false;
  private cols = 0;
  private readonly cards = new Map<string, HTMLLabelElement>();
  private readonly posters = new Map<string, HTMLElement>();
  private readonly posterUrls = new Map<string, string>();
  private readonly variantUrls = new Map<string, string>();
  private readonly moodEl = $('mood-filter');
  private readonly listEl = $('theme-list');
  private readonly detailEl = $('style-detail');
  private readonly customEl = $('custom-card');
  private readonly detailName = $('sd-name');
  private readonly variantEl = $('variant-list');
  private readonly variantHelp = $('variant-help');
  private variantJob = 0;

  constructor(private readonly opts: StylePickerOptions) {
    this.sel = { ...opts.initial, themeId: baseTheme(opts.initial.themeId).id };
    const base = baseTheme(this.sel.themeId);
    if (!base.variants.some((v) => v.id === this.sel.variantId)) this.sel.variantId = null;
    this.renderMoods();
    this.renderCards();
    this.renderVariants();
    $('sd-prev').addEventListener('click', () => this.step(-1));
    $('sd-next').addEventListener('click', () => this.step(1));
    $('sd-close').addEventListener('click', () => this.closeDetail(true));
    $('sd-done').addEventListener('click', () => this.closeDetail(true));
    // 열릴 때의 움직임은 한 번만 (다른 줄로 옮길 때 다시 재생되면 화면 위치 보정이 어긋남)
    this.detailEl.addEventListener('animationend', () => this.detailEl.classList.remove('enter'));
    // 화면 폭이 바뀌어 한 줄의 카드 수가 달라지면 세부 설정을 다시 그 줄 아래로 (스타일 단계가 숨어 있을 때는 그대로)
    new ResizeObserver(() => {
      if (!this.open || !this.listEl.offsetParent) return;
      const n = this.columns();
      if (n === this.cols) this.caret();
      else this.withAnchor(this.detailEl, () => this.place());
    }).observe(this.listEl);
  }

  /** 스타일 카드 그림 (쇼케이스 등에서 재사용) */
  posterUrl(id: string): string | undefined {
    return this.posterUrls.get(id);
  }

  get detailOpen(): boolean {
    return this.open;
  }

  /** 글꼴·샘플 그림이 준비된 뒤 카드 그림을 그림 */
  async renderPosters(): Promise<void> {
    for (const t of THEMES) {
      const url = this.opts.poster(t, 480, 270);
      this.posterUrls.set(t.id, url);
      const p = this.posters.get(t.id);
      if (p) p.style.backgroundImage = `url("${url}")`;
      await idle();
    }
    this.ready = true;
    if (this.open) void this.renderVariantPosters();
  }

  /** 다른 곳(쇼케이스)에서 스타일을 고를 때: 고르고 세부 설정을 엶 */
  select(themeId: string): void {
    const card = this.cards.get(themeId);
    const input = card?.querySelector('input');
    if (!card || !input) return;
    if (this.mood !== 'all' && !baseTheme(themeId).moods.includes(this.mood)) this.setMood('all');
    input.checked = true;
    this.openDetail(card, false, () => this.pickTheme(themeId));
  }

  /** 되돌리기: 스타일·양식을 바꿈 (onChange 없이). 세부 설정이 열려 있으면 그 카드 아래로 옮기되 화면에서는 제자리 */
  setSelection(sel: StyleSelection): void {
    const base = baseTheme(sel.themeId);
    const card = this.cards.get(base.id);
    const input = card?.querySelector('input');
    if (!card || !input) return;
    if (this.mood !== 'all' && !base.moods.includes(this.mood)) this.setMood('all');
    const apply = () => {
      input.checked = true;
      this.sel.themeId = base.id;
      this.sel.variantId = base.variants.some((v) => v.id === sel.variantId) ? sel.variantId : null;
      this.renderVariants();
      if (this.open) this.place();
    };
    if (this.open) this.withAnchor(this.detailEl, apply);
    else apply();
  }

  /** 고른 카드가 위쪽 미리보기·메뉴에 가리지 않는 자리로 스크롤 */
  scrollToSelection(): void {
    const card = this.cards.get(this.sel.themeId);
    if (!card) return;
    const top = card.getBoundingClientRect().top - (this.opts.topInset?.() ?? 0) - 12;
    window.scrollTo({ top: window.scrollY + top, behavior: reducedMotion() ? INSTANT : 'smooth' });
  }

  private renderMoods(): void {
    const items: { id: MoodId | 'all'; name: string }[] = [{ id: 'all', name: '전체' }, ...MOODS];
    this.moodEl.replaceChildren(
      ...items.map((m) =>
        h('button', {
          class: 'chip',
          text: m.name,
          attrs: { type: 'button', 'data-mood': m.id, 'aria-pressed': String(m.id === this.mood) },
          on: { click: () => this.setMood(m.id) },
        }),
      ),
    );
  }

  private setMood(mood: MoodId | 'all'): void {
    this.mood = mood;
    for (const b of this.moodEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mood === mood));
    for (const t of THEMES) {
      const card = this.cards.get(t.id);
      if (card) card.hidden = mood !== 'all' && !t.moods.includes(mood);
    }
    if (!this.open) return;
    // 고른 스타일이 걸러져 안 보이면 세부 설정도 접음 (다른 카드를 누르면 그 아래에 다시 열림)
    if (this.cards.get(this.sel.themeId)?.hidden) this.closeDetail(false);
    else this.place();
  }

  private renderCards(): void {
    for (const t of THEMES) {
      const input = h('input', { attrs: { type: 'radio', name: 'theme', value: t.id } });
      input.checked = t.id === this.sel.themeId;
      const poster = h('span', { class: 'poster', attrs: { 'aria-hidden': 'true' } });
      poster.style.backgroundImage = `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`;
      if (t.badge) poster.append(h('span', { class: `badge${t.badge === '가장 인기' ? ' hot' : ''}`, text: t.badge }));
      // 고른 카드에만 보이는 '세부 설정 열기/접기' 표시 (그림 위에 겹쳐 그려 카드 높이는 그대로)
      poster.append(
        h('span', { class: 'sd-hint' }, [h('span', { class: 'sd-hint-open', text: '양식·꾸미기 ▾' }), h('span', { class: 'sd-hint-close', text: '접기 ▴' })]),
      );
      this.posters.set(t.id, poster);
      const moods = t.moods.map((m) => MOODS.find((x) => x.id === m)?.name ?? m).join(' · ');
      const tags = h('span', { class: 'tags' }, t.highlights.map((x) => h('span', { text: x })));
      const text = h('span', { class: 'tx' }, [
        h('span', { class: 'en', text: t.label }),
        h('strong', { text: t.name }),
        h('span', { class: 'mood', text: `${moods} · 양식 ${t.variants.length}가지` }),
        h('span', { class: 'd', text: t.description }),
        tags,
      ]);
      const card = h('label', { class: 'theme-card', attrs: { 'data-moods': t.moods.join(' '), 'data-theme-id': t.id } }, [input, poster, text]);
      // 클릭(마우스·손가락·스페이스·방향키)은 바뀌기 전 선택과 비교해 열기/접기를 정하고,
      // 클릭 없이 선택만 바뀌는 경우(일부 브라우저의 방향키)는 change에서 처리
      input.addEventListener('click', () => this.cardClicked(t.id));
      input.addEventListener('change', () => {
        if (!input.checked || this.sel.themeId === t.id) return;
        if (!this.open) {
          this.pickTheme(t.id);
          return;
        }
        this.withAnchor(card, () => {
          this.pickTheme(t.id);
          this.place();
        });
      });
      this.cards.set(t.id, card);
      this.listEl.append(card);
    }
  }

  private cardClicked(id: string): void {
    const card = this.cards.get(id);
    if (!card) return;
    if (id === this.sel.themeId) {
      // 이미 고른 카드: 세부 설정 열기/접기
      if (this.open) this.closeDetail(false, card);
      else this.openDetail(card, true);
      return;
    }
    this.openDetail(card, true, () => this.pickTheme(id));
  }

  /** 보이는 카드 순서에서 앞/뒤 스타일로 (세부 설정 상자는 화면에서 제자리에 둔 채) */
  private step(dir: 1 | -1): void {
    const visible = this.visibleCards();
    if (visible.length < 2) return;
    const cur = this.cards.get(this.sel.themeId);
    const i = cur ? visible.indexOf(cur) : -1;
    const next = visible[(i + dir + visible.length) % visible.length];
    const id = next.dataset.themeId;
    const input = next.querySelector('input');
    if (!id || !input) return;
    // 세부 설정 윗부분이 보이면 그 자리를, 꾸미기를 보던 중이면(머리줄만 붙어 있으면) 꾸미기 내용을 화면에 그대로 둠
    const top = this.opts.topInset?.() ?? 0;
    const anchor = this.detailEl.getBoundingClientRect().top >= top ? this.detailEl : this.customEl;
    this.withAnchor(anchor, () => {
      input.checked = true;
      this.pickTheme(id);
      this.place();
    });
  }

  private pickTheme(id: string): void {
    if (id === this.sel.themeId) return;
    this.sel.themeId = id;
    this.sel.variantId = null;
    this.renderVariants();
    this.opts.onChange({ ...this.sel }, 'theme');
  }

  private visibleCards(): HTMLLabelElement[] {
    return [...this.cards.values()].filter((c) => !c.hidden);
  }

  /** 지금 화면 폭에서 한 줄에 놓이는 카드 수 */
  private columns(): number {
    const tpl = getComputedStyle(this.listEl).gridTemplateColumns;
    if (!tpl || tpl === 'none') return 1;
    return Math.max(1, tpl.trim().split(/\s+/).length);
  }

  /** 세부 설정을 고른 카드가 있는 줄의 마지막 카드 바로 뒤로 (화면에서는 그 줄 바로 아래) */
  private place(): void {
    const card = this.cards.get(this.sel.themeId);
    const visible = this.visibleCards();
    const i = card ? visible.indexOf(card) : -1;
    if (!card || i < 0) return;
    const cols = (this.cols = this.columns());
    const last = visible[Math.min(visible.length - 1, Math.floor(i / cols) * cols + cols - 1)];
    if (last.nextElementSibling !== this.detailEl) {
      // 옮기면(다시 끼우면) 열릴 때의 움직임이 처음부터 다시 재생되므로 끔
      this.detailEl.classList.remove('enter');
      last.after(this.detailEl);
    }
    this.caret();
  }

  /** 위쪽 뾰족한 표시가 고른 카드를 가리키도록 */
  private caret(): void {
    const card = this.cards.get(this.sel.themeId);
    if (!card || card.hidden) return;
    const lr = this.listEl.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    this.detailEl.style.setProperty('--caret-x', `${Math.round(cr.left + cr.width / 2 - lr.left)}px`);
  }

  /** 바꾸는 동안 기준 요소가 화면에서 같은 자리에 있도록 스크롤을 맞춤 (위쪽 내용이 늘거나 줄어도 튀지 않게) */
  private withAnchor(anchor: Element, mutate: () => void): void {
    const before = anchor.getBoundingClientRect().top;
    mutate();
    const d = anchor.getBoundingClientRect().top - before;
    if (Math.abs(d) > 0.5) window.scrollBy({ top: d, behavior: INSTANT });
  }

  /** 세부 설정을 card가 있는 줄 아래에 엶. before = 그 전에 할 일(스타일 바꾸기)로, 화면 위치 보정 안에서 함께 함 */
  private openDetail(card: HTMLElement, reveal: boolean, before?: () => void): void {
    const was = this.open;
    this.open = true;
    this.withAnchor(card, () => {
      before?.();
      this.detailEl.hidden = false;
      this.place();
    });
    this.listEl.classList.add('detail-open');
    if (!was) {
      if (!reducedMotion()) {
        this.detailEl.classList.remove('enter');
        void this.detailEl.offsetWidth;
        this.detailEl.classList.add('enter');
      }
      this.opts.onDetail?.(true);
      if (this.ready) void this.renderVariantPosters();
    }
    if (reveal) this.reveal(card);
  }

  /** 세부 설정 접기. 접기 버튼으로 접으면 고른 카드가 화면 안에 보이게 */
  private closeDetail(fromButton: boolean, anchor?: HTMLElement): void {
    if (!this.open) return;
    const card = this.cards.get(this.sel.themeId);
    this.open = false;
    const apply = () => {
      this.detailEl.hidden = true;
      this.detailEl.classList.remove('enter');
    };
    if (anchor) this.withAnchor(anchor, apply);
    else apply();
    this.listEl.classList.remove('detail-open');
    this.opts.onDetail?.(false);
    if (fromButton && card && !card.hidden) {
      // 아래쪽 '다 골랐어요'로 접으면 긴 설정이 사라지며 화면이 크게 바뀌므로, 고른 카드로 바로 이동 (움직임 없이)
      const top = this.opts.topInset?.() ?? 0;
      const r = card.getBoundingClientRect();
      if (r.top < top || r.bottom > window.innerHeight) window.scrollBy({ top: r.top - top - 12, behavior: INSTANT });
      card.querySelector('input')?.focus({ preventScroll: true });
    }
  }

  /** 카드를 누른 뒤: 세부 설정의 윗부분(제목·양식 첫 줄)까지 보이도록, 고른 카드가 가려지지 않는 만큼만 스크롤 */
  private reveal(card: HTMLElement): void {
    const top = (this.opts.topInset?.() ?? 0) + 12;
    const vh = window.innerHeight;
    const cr = card.getBoundingClientRect();
    const pr = this.detailEl.getBoundingClientRect();
    const need = pr.top + Math.min(pr.height, 280) - (vh - 12);
    let d = 0;
    if (need > 0) d = Math.min(need, cr.top - top);
    else if (cr.top < top - 8) d = cr.top - top;
    if (Math.abs(d) > 2) window.scrollBy({ top: d, behavior: reducedMotion() ? INSTANT : 'smooth' });
  }

  private renderVariants(): void {
    const base = baseTheme(this.sel.themeId);
    const current = this.sel.variantId ?? base.variants[0].id;
    this.detailName.textContent = base.name;
    this.variantHelp.textContent = `· ${base.name} 스타일 ${base.variants.length}가지`;
    // 양식이 많으면 휴대폰에서 두 줄로 옆으로 넘겨 보게 (세로로 길어지지 않게)
    this.variantEl.classList.toggle('many', base.variants.length > 4);
    this.variantEl.replaceChildren(
      ...base.variants.map((v) => {
        const input = h('input', { attrs: { type: 'radio', name: 'variant', value: v.id } });
        input.checked = v.id === current;
        input.addEventListener('change', () => {
          if (!input.checked) return;
          this.sel.variantId = v.id;
          this.opts.onChange({ ...this.sel }, 'variant');
        });
        const pic = h('span', { class: 'vposter', attrs: { 'aria-hidden': 'true', 'data-variant': v.id } });
        const cached = this.variantUrls.get(`${base.id}|${v.id}`);
        pic.style.backgroundImage = cached ? `url("${cached}")` : `linear-gradient(135deg, ${v.swatch[0]}, ${v.swatch[1]})`;
        const sw = h('span', { class: 'vswatch', attrs: { 'aria-hidden': 'true' } });
        sw.style.background = `linear-gradient(135deg, ${v.swatch[0]} 50%, ${v.swatch[1]} 50%)`;
        const name = h('span', { class: 'vname' }, [sw, v.name]);
        if (v.isNew) name.append(h('span', { class: 'vnew', text: 'NEW' }));
        return h('label', { class: 'variant-card' }, [input, pic, name]);
      }),
    );
    if (this.ready && this.open) void this.renderVariantPosters();
  }

  /** 양식 카드에 그 양식으로 만든 작은 그림을 채움 (세부 설정이 열려 있을 때만, 조금씩) */
  private async renderVariantPosters(): Promise<void> {
    const job = ++this.variantJob;
    const base = baseTheme(this.sel.themeId);
    for (const v of base.variants) {
      const key = `${base.id}|${v.id}`;
      let url = this.variantUrls.get(key);
      if (!url) {
        await idle();
        if (job !== this.variantJob) return;
        // 양식끼리 가장 크게 다른 오프닝 화면 (제목 디자인·테두리·색)
        url = this.opts.poster(resolveTheme(base.id, { variant: v.id }), 320, 180, 'intro');
        this.variantUrls.set(key, url);
      }
      const pic = this.variantEl.querySelector<HTMLElement>(`[data-variant="${v.id}"]`);
      if (pic) pic.style.backgroundImage = `url("${url}")`;
    }
  }
}
