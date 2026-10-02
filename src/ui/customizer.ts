// 꾸미기: 오프닝 디자인·글씨체·색감·효과·전환을 직접 고르는 탭 화면.
// 고르면 바로 적용되고(onChange), 마우스를 올려 두면 적용하기 전에 미리 보여 줌(onPreview).

import type { DemoFocus } from '../demo';
import { FONT_GROUPS, FONT_ROLES, fontById, fontsForRole, nearestWeight, type FontDef, type FontRole } from '../font-catalog';
import { loadAllFontCss } from '../fonts';
import {
  ACCENTS,
  AMOUNTS,
  BORDERS,
  DIMS,
  FILTERS,
  FRAMES,
  GRAINS,
  LEAKS,
  LEVELS,
  NAME_JOINS,
  ORNAMENTS,
  PARTICLES,
  SCENE_MODES,
  SPEEDS,
  TEXT_COLORS,
  TEXT_EFFECTS,
  TEXT_SIZES,
  TITLE_DESIGNS,
  TRANSITIONS,
  TRANSITION_MODES,
  customCount,
  sanitizeCustom,
  type Choice,
  type CustomKey,
  type Customization,
  type Theme,
  type TitleDesign,
} from '../themes';
import { $, h } from './dom';

type Panel = 'opening' | 'font' | 'color' | 'effect' | 'motion';
type Kind = 'chips' | 'swatch' | 'designs' | 'filters' | 'fonts';

interface Group {
  key: CustomKey;
  title: string;
  hint?: string;
  panel: Panel;
  kind: Kind;
  choices: readonly Choice[];
  /** 추천(스타일 기본) 칩 이름 */
  auto: (plain: Theme) => string;
  /** 칩 묶음 id (자동 테스트·기존 화면과 같은 id 유지) */
  id?: string;
  /** 칩 앞에 붙는 작은 제목 (전환 '한 가지만') */
  sub?: { from: number; title: string };
}

/** 항목을 바꿨을 때 미리보기에서 보여 줄 곳 */
export const CUSTOM_FOCUS: Record<CustomKey, DemoFocus> = {
  title: 'intro',
  particle: 'scene',
  fontTitle: 'intro',
  fontName: 'intro',
  fontBody: 'intro',
  fontHand: 'caption',
  textSize: 'intro',
  textEffect: 'intro',
  accent: 'intro',
  textColor: 'intro',
  dim: 'intro',
  filter: 'scene',
  amount: 'scene',
  bokeh: 'scene',
  sparkles: 'scene',
  glow: 'scene',
  vignette: 'scene',
  grain: 'scene',
  leak: 'scene',
  frame: 'scene',
  border: 'scene',
  transition: 'transition',
  speed: 'transition',
  ornament: 'intro',
  nameJoin: 'intro',
  scenes: 'scene',
};

const ROLE_KEY: Record<FontRole, CustomKey> = { title: 'fontTitle', name: 'fontName', body: 'fontBody', hand: 'fontHand' };
const nameOf = (list: readonly Choice[], id: string | undefined) => list.find((c) => c.id === id)?.name ?? '';
const fontName = (family: string) => fontById(family)?.name ?? fontById(`${family} Italic`)?.name ?? family;
const levelOf = (v: number, table: [number, string][]) => table.reduce((best, cur) => (Math.abs(cur[0] - v) < Math.abs(best[0] - v) ? cur : best))[1];

const GROUPS: Group[] = [
  { key: 'title', title: '오프닝 디자인', hint: '오프닝·엔딩 문구가 나오는 모양', panel: 'opening', kind: 'designs', choices: TITLE_DESIGNS, id: 'title-options', auto: (p) => `추천 · ${nameOf(TITLE_DESIGNS, p.titleDesign)}` },
  { key: 'textSize', title: '글자 크기', panel: 'opening', kind: 'chips', choices: TEXT_SIZES, auto: () => '보통' },
  { key: 'textEffect', title: '글자 효과', panel: 'opening', kind: 'chips', choices: TEXT_EFFECTS, auto: () => '스타일 기본' },
  { key: 'dim', title: '배경 사진 어둡기', hint: '글자가 잘 안 보이면 어둡게', panel: 'opening', kind: 'chips', choices: DIMS, auto: () => '스타일 기본' },
  { key: 'ornament', title: '제목 아래 장식', panel: 'opening', kind: 'chips', choices: ORNAMENTS, auto: (p) => `추천 · ${nameOf(ORNAMENTS, p.look.ornament)}` },
  { key: 'nameJoin', title: '이름 사이 기호', panel: 'opening', kind: 'chips', choices: NAME_JOINS, auto: (p) => `추천 · ${nameOf(NAME_JOINS, p.look.nameJoin)}` },
  { key: 'filter', title: '색감 필터', hint: '사진 전체의 색 느낌', panel: 'color', kind: 'filters', choices: FILTERS, auto: () => '스타일 기본' },
  { key: 'accent', title: '포인트 색', hint: '제목·장식·기호 색', panel: 'color', kind: 'swatch', choices: ACCENTS, auto: () => '스타일 기본' },
  { key: 'textColor', title: '글자 색', hint: '이름·날짜·인사말 색', panel: 'color', kind: 'swatch', choices: TEXT_COLORS, auto: () => '스타일 기본' },
  { key: 'particle', title: '흩날리는 효과', panel: 'effect', kind: 'chips', choices: PARTICLES, id: 'particle-options', auto: (p) => `추천 · ${p.effects.particles > 0 ? nameOf(PARTICLES, p.effects.particle) : '없음'}` },
  { key: 'amount', title: '효과 양', panel: 'effect', kind: 'chips', choices: AMOUNTS, auto: () => '보통' },
  {
    key: 'sparkles',
    title: '반짝이는 별빛',
    panel: 'effect',
    kind: 'chips',
    choices: LEVELS,
    auto: (p) => `추천 · ${levelOf(p.effects.sparkles, [[0, '없음'], [12, '약하게'], [28, '보통'], [50, '강하게']])}`,
  },
  {
    key: 'bokeh',
    title: '빛망울 (보케)',
    panel: 'effect',
    kind: 'chips',
    choices: LEVELS,
    auto: (p) => `추천 · ${levelOf(p.effects.bokeh, [[0, '없음'], [6, '약하게'], [12, '보통'], [22, '강하게']])}`,
  },
  {
    key: 'glow',
    title: '뽀샤시 빛 번짐',
    panel: 'effect',
    kind: 'chips',
    choices: LEVELS,
    auto: (p) => `추천 · ${levelOf(p.effects.glow, [[0, '없음'], [0.1, '약하게'], [0.2, '보통'], [0.32, '강하게']])}`,
  },
  {
    key: 'vignette',
    title: '가장자리 어둡게',
    panel: 'effect',
    kind: 'chips',
    choices: LEVELS,
    auto: (p) => `추천 · ${levelOf(p.effects.vignette, [[0, '없음'], [0.18, '약하게'], [0.35, '보통'], [0.55, '강하게']])}`,
  },
  { key: 'grain', title: '필름 그레인', panel: 'effect', kind: 'chips', choices: GRAINS, auto: (p) => `추천 · ${levelOf(p.effects.grain, [[0, '없음'], [0.04, '약하게'], [0.1, '강하게']])}` },
  { key: 'leak', title: '빛 새어 듦', hint: '가장자리로 따뜻한 빛', panel: 'effect', kind: 'chips', choices: LEAKS, auto: (p) => `추천 · ${p.effects.leak > 0 ? '켜짐' : '꺼짐'}` },
  {
    key: 'frame',
    title: '화면 테두리 · 장치',
    panel: 'effect',
    kind: 'chips',
    choices: FRAMES,
    auto: (p) => `추천 · ${p.overlays.length ? p.overlays.map((o) => nameOf(FRAMES, o)).join('+') : '없음'}`,
  },
  { key: 'border', title: '사진 테두리', hint: '액자형·두 장 나란히 사진', panel: 'effect', kind: 'chips', choices: BORDERS, auto: () => '스타일 기본' },
  {
    key: 'transition',
    title: '장면 전환',
    hint: '사진과 사진 사이',
    panel: 'motion',
    kind: 'chips',
    choices: [...TRANSITION_MODES, ...TRANSITIONS],
    sub: { from: TRANSITION_MODES.length, title: '한 가지 전환만 쓰기' },
    auto: () => '추천 (스타일에 맞게 섞기)',
  },
  { key: 'speed', title: '전환 속도', panel: 'motion', kind: 'chips', choices: SPEEDS, auto: () => '보통' },
  { key: 'scenes', title: '사진 연출', hint: '한 화면에 사진을 모으는 정도', panel: 'motion', kind: 'chips', choices: SCENE_MODES, auto: () => '추천' },
];

export interface CustomizerOptions {
  initial: Customization;
  /** 꾸미기 없이 스타일·양식만 적용한 테마 ('추천' 이름 표시용) */
  plain: () => Theme;
  onChange: (custom: Customization, key: CustomKey, message: string) => void;
  /** 마우스를 올려 미리 보기 (null이면 원래대로) */
  onPreview?: (custom: Customization | null, key: CustomKey | null) => void;
  /** 오프닝 디자인 카드 그림 */
  designPoster?: (design: TitleDesign, width: number, height: number) => string;
}

const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const idle = () => new Promise<void>((r) => setTimeout(r, 0));

export class Customizer {
  custom: Customization;
  private panel: Panel = 'opening';
  private fontsRequested = false;
  private readonly tabs = new Map<Panel, HTMLButtonElement>();
  private readonly panels = new Map<Panel, HTMLElement>();
  private readonly groups = new Map<CustomKey, HTMLElement>();
  private readonly autoChips = new Map<CustomKey, HTMLButtonElement>();
  private readonly roleTabs = new Map<FontRole, HTMLButtonElement>();
  private readonly rolePanes = new Map<FontRole, HTMLElement>();
  private readonly countEl = $('cz-count');
  private readonly resetBtn = $<HTMLButtonElement>('cz-reset');
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private hovering = false;
  private posterJob = 0;
  private postersDirty = true;
  /** 세부 설정이 열려 있어 화면에 보이는지 (닫혀 있으면 카드 그림을 미뤄 둠) */
  private visible = false;

  constructor(private readonly opts: CustomizerOptions) {
    this.custom = sanitizeCustom(opts.initial);
    for (const tab of document.querySelectorAll<HTMLButtonElement>('#cz-tabs [role="tab"]')) {
      const id = tab.dataset.panel as Panel;
      this.tabs.set(id, tab);
      const panel = $(`czp-${id}`);
      this.panels.set(id, panel);
      tab.addEventListener('click', () => this.showPanel(id));
      tab.addEventListener('keydown', (e) => this.tabKeys(e, [...this.tabs.keys()], id, (p) => this.showPanel(p, true)));
    }
    for (const g of GROUPS) this.buildGroup(g);
    this.buildFonts();
    this.resetBtn.addEventListener('click', () => this.reset());
    this.refresh();
    this.showPanel('opening');
  }

  /** 스타일·양식이 바뀌었을 때 '추천' 이름과 오프닝 카드 그림을 다시 */
  refresh(): void {
    const plain = this.opts.plain();
    for (const g of GROUPS) {
      const chip = this.autoChips.get(g.key);
      const label = chip?.querySelector('.lbl');
      if (label) label.textContent = g.auto(plain);
    }
    for (const role of FONT_ROLES) {
      const chip = this.autoChips.get(ROLE_KEY[role.id]);
      const label = chip?.querySelector('.lbl');
      if (label) label.textContent = `추천 · ${fontName(this.roleFamily(plain, role.id))}`;
    }
    this.sync();
    this.postersDirty = true;
    if (this.panel === 'opening' && this.visible) void this.renderPosters();
  }

  /** 세부 설정이 열리고 닫힐 때 (닫히면 미리 보기 중이던 것을 원래대로) */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      if (this.panel === 'opening' && this.postersDirty) void this.renderPosters();
      return;
    }
    clearTimeout(this.hoverTimer);
    if (this.hovering) this.opts.onPreview?.(null, null);
    this.hovering = false;
  }

  /** 모든 꾸미기를 스타일 기본값으로 */
  reset(): void {
    if (customCount(this.custom) === 0) return;
    this.custom = {};
    this.sync();
    this.opts.onChange({}, 'title', '모든 꾸미기를 스타일 기본값으로 되돌렸어요');
  }

  /** 오프닝 디자인 카드 그림을 다시 그려야 함 (문구·꾸미기가 바뀐 경우) */
  invalidatePosters(): void {
    this.postersDirty = true;
    if (this.panel === 'opening' && this.visible) void this.renderPosters();
  }

  private roleFamily(plain: Theme, role: FontRole): string {
    const f = plain.fonts;
    return role === 'title' ? f.title : role === 'name' ? f.name : role === 'body' ? f.body : f.hand;
  }

  private tabKeys<T>(e: KeyboardEvent, ids: T[], cur: T, go: (id: T) => void): void {
    const i = ids.indexOf(cur);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    if (next < 0) return;
    e.preventDefault();
    go(ids[next]);
  }

  private showPanel(id: Panel, focus = false): void {
    this.panel = id;
    for (const [p, tab] of this.tabs) {
      const on = p === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      this.panels.get(p)!.hidden = !on;
      if (on && focus) tab.focus();
    }
    if (id === 'font' && !this.fontsRequested) {
      // 글씨체 미리보기용 글꼴 등록 (처음 열 때 한 번)
      this.fontsRequested = true;
      void loadAllFontCss();
    }
    if (id === 'opening' && this.postersDirty && this.visible) void this.renderPosters();
  }

  private showRole(role: FontRole, focus = false): void {
    for (const [r, tab] of this.roleTabs) {
      const on = r === role;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      this.rolePanes.get(r)!.hidden = !on;
      if (on && focus) tab.focus();
    }
    const desc = document.getElementById('font-role-desc');
    if (desc) desc.textContent = FONT_ROLES.find((r) => r.id === role)?.desc ?? '';
  }

  // ───────────────────────── 만들기 ─────────────────────────

  private option(key: CustomKey, value: string, content: (Node | string)[], cls: string, title: string, label: string): HTMLButtonElement {
    const b = h('button', { class: cls, attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-key': key, 'data-value': value, title } }, content);
    b.addEventListener('click', () => this.pick(key, value, label));
    b.addEventListener('pointerenter', () => this.hoverStart(key, value));
    b.addEventListener('pointerleave', () => this.hoverEnd());
    return b;
  }

  private buildGroup(g: Group): void {
    const panel = this.panels.get(g.panel);
    if (!panel) return;
    const block = h('div', { class: `opt-block opt-${g.kind}`, attrs: { 'data-opt': g.key } });
    const head = h('h3', { class: 'opt-h', text: g.title });
    if (g.hint) head.append(' ', h('small', { text: g.hint }));
    const list = h('div', { class: g.kind === 'designs' ? 'design-grid' : 'chip-group', attrs: { role: 'radiogroup', 'aria-label': g.title } });
    if (g.id) list.id = g.id;
    const auto = this.option(g.key, 'auto', [h('span', { class: 'lbl', text: '추천' })], g.kind === 'designs' ? 'design-card auto' : 'chip auto', '스타일에 맞춘 추천 값', '추천');
    if (g.kind === 'designs') auto.prepend(h('span', { class: 'dthumb auto-thumb', attrs: { 'aria-hidden': 'true' } }, [h('span', { text: 'AUTO' })]));
    this.autoChips.set(g.key, auto);
    list.append(auto);
    g.choices.forEach((c, i) => {
      if (g.sub && i === g.sub.from) list.append(h('span', { class: 'chip-sub', text: g.sub.title }));
      list.append(this.choiceButton(g, c));
    });
    if (g.kind === 'swatch') list.append(this.colorInput(g));
    block.append(head, list);
    panel.insertBefore(block, panel.querySelector(':scope > .cz-foot'));
    this.groups.set(g.key, list);
  }

  private choiceButton(g: Group, c: Choice): HTMLButtonElement {
    const label = `${g.title}: ${c.name}`;
    switch (g.kind) {
      case 'designs': {
        const d = TITLE_DESIGNS.find((x) => x.id === c.id);
        return this.option(g.key, c.id, [h('span', { class: 'dthumb', attrs: { 'aria-hidden': 'true', 'data-design': c.id } }), h('span', { class: 'dname', text: c.name })], 'design-card', d?.desc ?? c.name, label);
      }
      case 'swatch': {
        const b = this.option(g.key, c.id, [h('span', { class: 'sr-only', text: c.name })], 'swatch', c.name, label);
        b.style.setProperty('--c', c.swatch ?? c.id);
        return b;
      }
      case 'filters': {
        const f = FILTERS.find((x) => x.id === c.id);
        const dot = h('span', { class: 'fdot', attrs: { 'aria-hidden': 'true' } });
        dot.style.background = `linear-gradient(135deg, ${f?.swatch ?? '#ccc'}, ${f?.swatch2 ?? '#888'})`;
        return this.option(g.key, c.id, [dot, c.name], 'chip', c.name, label);
      }
      default:
        return this.option(g.key, c.id, [c.name], 'chip', c.name, label);
    }
  }

  /** 팔레트에 없는 색을 직접 고르는 칸 */
  private colorInput(g: Group): HTMLElement {
    const input = h('input', { attrs: { type: 'color', 'aria-label': `${g.title} 직접 고르기`, value: '#ffffff' } });
    const wrap = h('label', { class: 'swatch pick', attrs: { title: '직접 고르기' } }, [input, h('span', { class: 'pick-l', text: '직접', attrs: { 'aria-hidden': 'true' } })]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.pick(g.key, input.value.toLowerCase(), `${g.title}: ${input.value}`), 120);
    });
    return wrap;
  }

  private buildFonts(): void {
    const panel = this.panels.get('font');
    if (!panel) return;
    const tabs = h('div', { class: 'font-roles', attrs: { role: 'tablist', 'aria-label': '글씨체를 바꿀 자리' } });
    const desc = h('p', { class: 'font-role-desc', attrs: { id: 'font-role-desc' } });
    const panes = h('div', { class: 'font-panes' });
    const ids = FONT_ROLES.map((r) => r.id);
    for (const role of FONT_ROLES) {
      const tab = h('button', {
        class: 'seg-tab',
        text: role.name,
        attrs: { type: 'button', role: 'tab', id: `fr-${role.id}`, 'aria-controls': `fp-${role.id}`, 'aria-selected': 'false', 'data-role': role.id },
      });
      tab.addEventListener('click', () => this.showRole(role.id));
      tab.addEventListener('keydown', (e) => this.tabKeys(e, ids, role.id, (r) => this.showRole(r, true)));
      this.roleTabs.set(role.id, tab);
      tabs.append(tab);
      const pane = h('div', { class: 'font-pane', attrs: { id: `fp-${role.id}`, role: 'tabpanel', 'aria-labelledby': `fr-${role.id}` } });
      const key = ROLE_KEY[role.id];
      const auto = this.option(key, 'auto', [h('span', { class: 'lbl', text: '추천' })], 'chip auto', '스타일에 맞춘 추천 글씨체', '추천');
      this.autoChips.set(key, auto);
      pane.append(h('div', { class: 'chip-group', attrs: { role: 'radiogroup', 'aria-label': `${role.name} 추천` } }, [auto]));
      const defs = fontsForRole(role.id);
      const byGroup = new Map<string, FontDef[]>();
      for (const d of defs) {
        const list = byGroup.get(d.group) ?? [];
        list.push(d);
        byGroup.set(d.group, list);
      }
      for (const [group, list] of byGroup) {
        const grid = h('div', { class: 'font-grid', attrs: { role: 'radiogroup', 'aria-label': `${role.name} · ${FONT_GROUPS[group as keyof typeof FONT_GROUPS]}` } });
        for (const d of list) grid.append(this.fontChip(role.id, d));
        pane.append(h('h4', { class: 'fg-h', text: FONT_GROUPS[group as keyof typeof FONT_GROUPS] }), grid);
      }
      panes.append(pane);
      this.rolePanes.set(role.id, pane);
      this.groups.set(key, pane);
    }
    panel.append(h('div', { class: 'opt-block' }, [h('h3', { class: 'opt-h', text: '글씨체 바꿀 자리' }), tabs, desc, panes]));
    this.showRole('title');
  }

  private fontChip(role: FontRole, d: FontDef): HTMLButtonElement {
    const key = ROLE_KEY[role];
    const sample = h('span', { class: 'fs', text: d.kr ? d.name : 'Wedding Day' });
    const weight = role === 'title' ? (d.weight ?? d.weights[0]) : role === 'name' ? nearestWeight(d, 700) : nearestWeight(d, 400);
    sample.style.fontFamily = `"${d.family}", "Noto Sans KR", sans-serif`;
    sample.style.fontWeight = String(weight);
    if (d.italic) sample.style.fontStyle = 'italic';
    if (d.scale && d.scale !== 1) sample.style.fontSize = `${Math.round(19 * d.scale)}px`;
    const content: (Node | string)[] = [sample];
    if (!d.kr) content.push(h('small', { text: d.name }));
    return this.option(key, d.id, content, 'font-chip', d.name, `글씨체(${FONT_ROLES.find((r) => r.id === role)?.name}): ${d.name}`);
  }

  // ───────────────────────── 선택 ─────────────────────────

  private withValue(key: CustomKey, value: string): Customization {
    const next = { ...this.custom } as Record<string, string>;
    if (value === 'auto') delete next[key];
    else next[key] = value;
    return sanitizeCustom(next);
  }

  private pick(key: CustomKey, value: string, label: string): void {
    clearTimeout(this.hoverTimer);
    this.custom = this.withValue(key, value);
    this.sync();
    if (key !== 'title') this.postersDirty = true;
    const message = value === 'auto' ? `${this.titleOf(key)}: 추천(스타일 기본)으로 적용했어요` : `${label} 적용`;
    this.opts.onChange({ ...this.custom }, key, message);
    if (this.hovering) this.opts.onPreview?.(null, null);
    this.hovering = false;
  }

  private titleOf(key: CustomKey): string {
    const g = GROUPS.find((x) => x.key === key);
    if (g) return g.title;
    const role = (Object.keys(ROLE_KEY) as FontRole[]).find((r) => ROLE_KEY[r] === key);
    return `글씨체(${FONT_ROLES.find((r) => r.id === role)?.name ?? ''})`;
  }

  private hoverStart(key: CustomKey, value: string): void {
    if (!this.opts.onPreview || !canHover()) return;
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      const cur = (this.custom as Record<string, string>)[key] ?? 'auto';
      if (cur === value) {
        if (this.hovering) this.opts.onPreview?.(null, null);
        this.hovering = false;
        return;
      }
      this.hovering = true;
      this.opts.onPreview?.(this.withValue(key, value), key);
    }, 160);
  }

  private hoverEnd(): void {
    clearTimeout(this.hoverTimer);
    if (!this.hovering) return;
    this.hoverTimer = setTimeout(() => {
      this.hovering = false;
      this.opts.onPreview?.(null, null);
    }, 120);
  }

  /** 버튼의 선택 표시와 '꾸민 항목 수'를 현재 값에 맞춤 */
  private sync(): void {
    const values = this.custom as Record<string, string>;
    for (const [key, el] of this.groups) {
      const cur = values[key] ?? 'auto';
      for (const b of el.querySelectorAll<HTMLButtonElement>('button[data-value]')) {
        b.setAttribute('aria-checked', String(b.dataset.value === cur));
      }
    }
    const n = customCount(this.custom);
    this.countEl.textContent = n ? `직접 꾸민 항목 ${n}개` : '지금은 스타일 기본값이에요';
    this.resetBtn.hidden = n === 0;
  }

  /** 오프닝 디자인 카드에 그 디자인으로 만든 작은 그림을 채움 (보일 때만, 조금씩) */
  private async renderPosters(): Promise<void> {
    const make = this.opts.designPoster;
    if (!make) return;
    const job = ++this.posterJob;
    this.postersDirty = false;
    const list = this.groups.get('title');
    if (!list) return;
    for (const d of TITLE_DESIGNS) {
      await idle();
      if (job !== this.posterJob) return;
      const el = list.querySelector<HTMLElement>(`[data-design="${d.id}"]`);
      if (el) el.style.backgroundImage = `url("${make(d.id, 256, 144)}")`;
    }
  }
}
