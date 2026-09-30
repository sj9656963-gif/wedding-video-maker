// 스튜디오의 스타일 고르기: 분위기 필터, 스타일 카드 10종, 양식(미니 포스터), 오프닝 디자인·흩날리는 효과

import {
  MOODS,
  PARTICLES,
  THEMES,
  TITLE_DESIGNS,
  baseTheme,
  resolveTheme,
  type MoodId,
  type ParticleKind,
  type Theme,
  type TitleDesign,
} from '../themes';
import { $, h } from './dom';

export interface StyleSelection {
  themeId: string;
  variantId: string | null;
  title: TitleDesign | 'auto';
  particle: ParticleKind | 'auto';
}

export type StyleChange = 'theme' | 'variant' | 'title' | 'particle';

export interface StylePickerOptions {
  initial: StyleSelection;
  onChange: (sel: StyleSelection, what: StyleChange) => void;
  /** 카드 그림 (data URL) */
  poster: (theme: Theme, width: number, height: number) => string;
}

const nameOfTitle = (id: TitleDesign) => TITLE_DESIGNS.find((d) => d.id === id)?.name ?? id;
const nameOfParticle = (id: ParticleKind) => PARTICLES.find((p) => p.id === id)?.name ?? id;
const idle = () => new Promise<void>((r) => setTimeout(r, 0));

export class StylePicker {
  readonly sel: StyleSelection;
  private mood: MoodId | 'all' = 'all';
  private ready = false;
  private readonly cards = new Map<string, HTMLLabelElement>();
  private readonly posters = new Map<string, HTMLElement>();
  private readonly posterUrls = new Map<string, string>();
  private readonly variantUrls = new Map<string, string>();
  private readonly moodEl = $('mood-filter');
  private readonly listEl = $('theme-list');
  private readonly variantEl = $('variant-list');
  private readonly variantHelp = $('variant-help');
  private readonly titleEl = $('title-options');
  private readonly particleEl = $('particle-options');
  private variantJob = 0;

  constructor(private readonly opts: StylePickerOptions) {
    this.sel = { ...opts.initial, themeId: baseTheme(opts.initial.themeId).id };
    const base = baseTheme(this.sel.themeId);
    if (!base.variants.some((v) => v.id === this.sel.variantId)) this.sel.variantId = null;
    this.renderMoods();
    this.renderCards();
    this.renderVariants();
    this.renderOptions();
  }

  get theme(): Theme {
    return resolveTheme(this.sel.themeId, { variant: this.sel.variantId, title: this.sel.title, particle: this.sel.particle });
  }

  /** 스타일 카드 그림 (쇼케이스 등에서 재사용) */
  posterUrl(id: string): string | undefined {
    return this.posterUrls.get(id);
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
    void this.renderVariantPosters();
  }

  /** 다른 곳(쇼케이스)에서 스타일을 고를 때 */
  select(themeId: string): void {
    const input = this.cards.get(themeId)?.querySelector('input');
    if (!input) return;
    if (this.mood !== 'all' && !baseTheme(themeId).moods.includes(this.mood)) this.setMood('all');
    input.checked = true;
    this.pickTheme(themeId);
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
  }

  private renderCards(): void {
    for (const t of THEMES) {
      const input = h('input', { attrs: { type: 'radio', name: 'theme', value: t.id } });
      input.checked = t.id === this.sel.themeId;
      input.addEventListener('change', () => {
        if (input.checked) this.pickTheme(t.id);
      });
      const poster = h('span', { class: 'poster', attrs: { 'aria-hidden': 'true' } });
      poster.style.backgroundImage = `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`;
      if (t.badge) poster.append(h('span', { class: 'badge', text: t.badge }));
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
      const card = h('label', { class: 'theme-card', attrs: { 'data-moods': t.moods.join(' ') } }, [input, poster, text]);
      this.cards.set(t.id, card);
      this.listEl.append(card);
    }
  }

  private pickTheme(id: string): void {
    if (id === this.sel.themeId) return;
    this.sel.themeId = id;
    this.sel.variantId = null;
    this.renderVariants();
    this.renderOptions();
    this.opts.onChange({ ...this.sel }, 'theme');
  }

  private renderVariants(): void {
    const base = baseTheme(this.sel.themeId);
    const current = this.sel.variantId ?? base.variants[0].id;
    this.variantHelp.textContent = `· ${base.name} 스타일 ${base.variants.length}가지`;
    this.variantEl.replaceChildren(
      ...base.variants.map((v) => {
        const input = h('input', { attrs: { type: 'radio', name: 'variant', value: v.id } });
        input.checked = v.id === current;
        input.addEventListener('change', () => {
          if (!input.checked) return;
          this.sel.variantId = v.id;
          this.renderOptions();
          this.opts.onChange({ ...this.sel }, 'variant');
        });
        const pic = h('span', { class: 'vposter', attrs: { 'aria-hidden': 'true', 'data-variant': v.id } });
        const cached = this.variantUrls.get(`${base.id}|${v.id}`);
        pic.style.backgroundImage = cached ? `url("${cached}")` : `linear-gradient(135deg, ${v.swatch[0]}, ${v.swatch[1]})`;
        const sw = h('span', { class: 'vswatch', attrs: { 'aria-hidden': 'true' } });
        sw.style.background = `linear-gradient(135deg, ${v.swatch[0]} 50%, ${v.swatch[1]} 50%)`;
        return h('label', { class: 'variant-card' }, [input, pic, h('span', { class: 'vname' }, [sw, v.name])]);
      }),
    );
    if (this.ready) void this.renderVariantPosters();
  }

  private async renderVariantPosters(): Promise<void> {
    const job = ++this.variantJob;
    const base = baseTheme(this.sel.themeId);
    for (const v of base.variants) {
      const key = `${base.id}|${v.id}`;
      let url = this.variantUrls.get(key);
      if (!url) {
        await idle();
        if (job !== this.variantJob) return;
        url = this.opts.poster(resolveTheme(base.id, { variant: v.id }), 320, 180);
        this.variantUrls.set(key, url);
      }
      const pic = this.variantEl.querySelector<HTMLElement>(`[data-variant="${v.id}"]`);
      if (pic) pic.style.backgroundImage = `url("${url}")`;
    }
  }

  private renderOptions(): void {
    const plain = resolveTheme(this.sel.themeId, { variant: this.sel.variantId });
    const chip = (value: string, label: string, checked: boolean, pick: () => void) =>
      h('button', { class: 'chip', attrs: { type: 'button', role: 'radio', 'aria-checked': String(checked), 'data-value': value }, on: { click: pick } }, [label]);
    this.titleEl.replaceChildren(
      chip('auto', `추천 (${nameOfTitle(plain.titleDesign)})`, this.sel.title === 'auto', () => this.pickTitle('auto')),
      ...TITLE_DESIGNS.map((d) => chip(d.id, d.name, this.sel.title === d.id, () => this.pickTitle(d.id))),
    );
    const autoParticle = plain.effects.particles > 0 ? nameOfParticle(plain.effects.particle) : '없음';
    this.particleEl.replaceChildren(
      chip('auto', `추천 (${autoParticle})`, this.sel.particle === 'auto', () => this.pickParticle('auto')),
      ...PARTICLES.map((p) => chip(p.id, p.name, this.sel.particle === p.id, () => this.pickParticle(p.id))),
    );
    for (const b of this.titleEl.querySelectorAll('button')) b.title = TITLE_DESIGNS.find((d) => d.id === b.dataset.value)?.desc ?? '';
  }

  private pickTitle(v: TitleDesign | 'auto'): void {
    this.sel.title = v;
    for (const b of this.titleEl.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === v));
    this.opts.onChange({ ...this.sel }, 'title');
  }

  private pickParticle(v: ParticleKind | 'auto'): void {
    this.sel.particle = v;
    for (const b of this.particleEl.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === v));
    this.opts.onChange({ ...this.sel }, 'particle');
  }
}
