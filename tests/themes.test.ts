import { describe, expect, it } from 'vitest';
import { DESIGN_H as H_DESIGN } from '../src/design';
import { KR_FONTS, LATIN_FONTS, fontById, fontScale, fontsForRole } from '../src/font-catalog';
import { isFontAvailable } from '../src/fonts';
import { LETTERBOX, overlayInsets } from '../src/overlays';
import { SUGGESTIONS } from '../src/suggestions';
import {
  FILTERS,
  FRAMES,
  MOODS,
  PARTICLES,
  STRUCTURAL_KEYS,
  THEMES,
  TITLE_DESIGNS,
  TRANSITIONS,
  customCount,
  fontSpec,
  getTheme,
  resolveTheme,
  sanitizeCustom,
  themeFontFaces,
} from '../src/themes';
import { LAYOUT_SPECS, planScenes, type PhotoRef } from '../src/timeline';

const LAYOUT_KEYS = new Set(Object.keys(LAYOUT_SPECS));
const MOOD_IDS = new Set(MOODS.map((m) => m.id));

function mixedPhotos(n: number): PhotoRef[] {
  const aspects = [1.5, 0.667, 1.5, 1, 0.667, 1.5, 2.6, 0.667, 1.5, 0.75];
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, aspect: aspects[i % aspects.length] }));
}

describe('스타일과 양식', () => {
  it('스타일 17종, 스타일마다 양식 3개 이상 (전체 55개 이상)', () => {
    expect(THEMES).toHaveLength(17);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(17);
    for (const t of THEMES) expect(t.variants.length).toBeGreaterThanOrEqual(3);
    expect(THEMES.reduce((s, t) => s + t.variants.length, 0)).toBeGreaterThanOrEqual(55);
  });

  it("'가장 인기' 표시는 클래식 하나에만, 클래식이 맨 앞", () => {
    const popular = THEMES.filter((t) => t.badge === '가장 인기');
    expect(popular.map((t) => t.id)).toEqual(['classic']);
    expect(THEMES[0].id).toBe('classic');
    expect(getTheme('romantic').badge).toBeUndefined();
  });

  it('러블리는 로맨틱과 다른 스타일 (귀여운 글씨체·버블 타이틀·비눗방울)', () => {
    const lovely = getTheme('lovely');
    const romantic = getTheme('romantic');
    expect(lovely.name).toBe('러블리');
    expect(lovely.titleDesign).toBe('bubbly');
    expect(lovely.titleDesign).not.toBe(romantic.titleDesign);
    expect(lovely.fonts.name).not.toBe(romantic.fonts.name);
    expect(lovely.effects.particle).toBe('bubbles');
    expect(lovely.moods).toContain('lovely');
  });

  it('모든 스타일·양식이 빠짐없는 설정으로 합쳐지고 쓰는 글꼴이 모두 준비돼 있다', () => {
    for (const base of THEMES) {
      expect(base.moods.length).toBeGreaterThan(0);
      for (const m of base.moods) expect(MOOD_IDS.has(m)).toBe(true);
      const ids = new Set<string>();
      for (const v of base.variants) {
        expect(ids.has(v.id)).toBe(false);
        ids.add(v.id);
        const t = resolveTheme(base.id, { variant: v.id });
        expect(t.variantId).toBe(v.id);
        expect(t.name).toBe(base.name);
        expect(t.transitions.length).toBeGreaterThan(0);
        expect(t.transitions.every((x) => x.weight > 0)).toBe(true);
        for (const key of Object.keys(t.scene.weights)) expect(LAYOUT_KEYS.has(key)).toBe(true);
        expect(t.fonts.title && t.fonts.body && t.fonts.name && t.fonts.display && t.fonts.mono).toBeTruthy();
        for (const face of themeFontFaces(t)) expect(isFontAvailable(face.family), `${base.id}/${v.id}: ${face.family}`).toBe(true);
        expect(t.look.backdropBase).toMatch(/^#[0-9a-f]{6}$/i);
        expect(t.look.light).toMatch(/^\d+,\d+,\d+$/);
        expect(t.effects.bokehColor).toMatch(/^\d+,\d+,\d+$/);
        expect(TITLE_DESIGNS.some((d) => d.id === t.titleDesign)).toBe(true);
        expect(t.custom).toEqual({});
      }
    }
  });

  it('이름 글꼴을 따로 정하지 않은 스타일은 본문 글꼴로 이름을 씀 (기존 모습 유지)', () => {
    expect(getTheme('cinema').fonts.name).toBe('Nanum Myeongjo');
    expect(getTheme('street').fonts.name).toBe('Black Han Sans');
    expect(getTheme('street').fonts.bodyBold).toBe(400);
    expect(getTheme('traditional').fonts.name).toBe('Song Myung');
  });

  it('양식은 바꾼 값만 덮어쓰고 나머지는 스타일 기본값을 유지', () => {
    const base = getTheme('romantic');
    const lav = resolveTheme('romantic', { variant: 'lavender' });
    expect(lav.colors.accent).not.toBe(base.colors.accent);
    expect(lav.colors.text).toBe(base.colors.text);
    expect(lav.effects.particle).toBe('petals');
    expect(lav.effects.sparkles).toBe(base.effects.sparkles);
    // 배치 선호도는 합쳐짐
    const rose = resolveTheme('romantic', { variant: 'rosegold' });
    expect(rose.scene.weights.oval).toBe(2);
    expect(rose.scene.weights.cover).toBe(base.scene.weights.cover);
    // 원본 스타일은 바뀌지 않음
    expect(getTheme('romantic').colors.accent).toBe(base.colors.accent);
  });

  it('오프닝 디자인·효과 선택이 적용되고 같은 조합은 같은 객체', () => {
    const a = resolveTheme('classic', { variant: 'navy', title: 'movie', particle: 'snow' });
    expect(a.titleDesign).toBe('movie');
    expect(a.effects.particle).toBe('snow');
    expect(a.effects.particles).toBeGreaterThan(0);
    expect(resolveTheme('classic', { variant: 'navy', title: 'movie', particle: 'snow' })).toBe(a);
    const none = resolveTheme('romantic', { particle: 'none' });
    expect(none.effects.particles).toBe(0);
    for (const p of PARTICLES) expect(resolveTheme('gallery', { particle: p.id }).effects.particle).toBe(p.id);
  });

  it('없는 스타일·양식·옵션은 기본값으로', () => {
    const t = resolveTheme('nope', { variant: 'zzz', title: 'bogus' as never, particle: 'auto' });
    expect(t.id).toBe('classic');
    expect(t.variantId).toBe('ivory');
    expect(t.titleDesign).toBe('classic');
    expect(resolveTheme('street', { title: 'auto' }).titleDesign).toBe('kinetic');
  });

  it.each([
    ['street', ['poster', 'sticker']],
    ['gallery', ['gallery']],
    ['garden', ['arch']],
    ['neon', ['filmstrip']],
    ['romantic', ['oval']],
    ['lovely', ['sticker', 'polaroid']],
    ['royal', ['oval']],
  ])('%s 스타일은 대표 배치를 섞어 쓴다', (id, layouts) => {
    for (const seed of [1, 2, 3]) {
      const scenes = planScenes(mixedPhotos(40), { style: getTheme(id).scene, seed, ratio: 1.6 });
      const used = new Set(scenes.map((s) => s.layout));
      for (const l of layouts) expect(used.has(l as never)).toBe(true);
      expect(scenes.flatMap((s) => s.photoIds)).toEqual(mixedPhotos(40).map((p) => p.id));
    }
  });

  it('하트 액자·하트 전환은 어느 스타일·양식에도 없다', () => {
    for (const base of THEMES) {
      for (const v of base.variants) {
        const t = resolveTheme(base.id, { variant: v.id });
        expect(Object.keys(t.scene.weights)).not.toContain('heart');
        expect(t.transitions.map((x) => x.type as string)).not.toContain('heart');
      }
    }
    expect(TRANSITIONS.map((x) => x.id as string)).not.toContain('heart');
    const rose = resolveTheme('romantic', { variant: 'rosegold' });
    expect(rose.transitions.some((x) => x.type === 'veil')).toBe(true);
  });

  it('레터박스·캠코더 화면 표시에 가려지지 않는 안전 영역', () => {
    const cinema = overlayInsets(getTheme('cinema'));
    expect(cinema.top).toBe(LETTERBOX);
    expect(cinema.bottom).toBe(LETTERBOX);
    expect(cinema.textBottom).toBeGreaterThan(LETTERBOX);
    const cam = overlayInsets(getTheme('camcorder'));
    expect(cam.top).toBe(0);
    expect(cam.textBottom).toBeGreaterThanOrEqual(150);
    // 캠코더 날짜(916 중심, 두 줄)의 윗부분 887보다 위에서 문구 칸이 끝나야 함
    expect(H_DESIGN - cam.hud).toBeLessThan(887);
    const digicam = overlayInsets(resolveTheme('camcorder', { variant: 'digicam' }));
    expect(digicam.hud).toBeGreaterThan(0);
    expect(cinema.hud).toBe(0);
    const noir = overlayInsets(resolveTheme('film', { variant: 'noir' }));
    expect(noir.top).toBe(LETTERBOX);
    expect(overlayInsets(getTheme('romantic'))).toEqual({ top: 0, bottom: 0, textBottom: 0, hud: 0, hudTop: 0 });
  });
});

describe('꾸미기', () => {
  it('글씨체 자리마다 고른 글꼴이 들어가고, 없는 굵기는 가까운 굵기로', () => {
    const t = resolveTheme('classic', { fontTitle: 'Playfair Display Italic', fontName: 'Jua', fontBody: 'Noto Serif KR', fontHand: 'Gaegu' });
    expect(t.fonts.title).toBe('Playfair Display');
    expect(t.fonts.titleItalic).toBe(true);
    expect(t.fonts.titleCustom).toBe(true);
    expect(t.titleStyle).toBe('script');
    expect(t.fonts.name).toBe('Jua');
    expect(t.fonts.nameWeight).toBe(400); // 주아는 한 가지 굵기뿐
    expect(t.fonts.body).toBe('Noto Serif KR');
    expect(t.fonts.bodyBold).toBe(700);
    expect(t.fonts.hand).toBe('Gaegu');
    const caps = resolveTheme('romantic', { fontTitle: 'Cinzel' });
    expect(caps.titleStyle).toBe('caps');
    expect(caps.fonts.titleWeight).toBe(600);
    // 한글 글꼴을 영문 제목 자리에, 영문 글꼴을 이름 자리에 넣으면 무시
    const bad = resolveTheme('classic', { fontTitle: 'Jua', fontName: 'Pacifico' });
    expect(bad.fonts.title).toBe(getTheme('classic').fonts.title);
    expect(bad.fonts.name).toBe(getTheme('classic').fonts.name);
  });

  it('글씨체 목록: 한글 30종 이상, 영문 35종 이상, 모두 불러올 수 있음', () => {
    expect(KR_FONTS.length).toBeGreaterThanOrEqual(30);
    expect(LATIN_FONTS.length).toBeGreaterThanOrEqual(35);
    expect(new Set([...KR_FONTS, ...LATIN_FONTS].map((f) => f.id)).size).toBe(KR_FONTS.length + LATIN_FONTS.length);
    for (const f of [...KR_FONTS, ...LATIN_FONTS]) {
      expect(isFontAvailable(f.family), f.family).toBe(true);
      expect(f.weights.length).toBeGreaterThan(0);
      if (!f.kr) expect(f.titleStyle).toBeTruthy();
    }
    expect(fontsForRole('hand').every((f) => f.kr)).toBe(true);
    expect(fontsForRole('title').every((f) => !f.kr)).toBe(true);
    expect(fontById('Tangerine')?.weight).toBe(700);
  });

  it('글자가 작게 보이는 글꼴은 크기를 보정하고, 기존 글꼴은 그대로', () => {
    expect(fontScale('Dongle')).toBeGreaterThan(1.2);
    expect(fontScale('Great Vibes')).toBe(1);
    expect(fontScale('Nanum Pen Script')).toBe(1);
    expect(fontSpec('Dongle', 100)).toContain('150px');
    expect(fontSpec('Gowun Batang', 40, 700)).toBe('700 40px "Gowun Batang", "Noto Sans KR", sans-serif');
  });

  it('색감 필터·색·효과 양·테두리가 적용됨', () => {
    const mono = resolveTheme('romantic', { filter: 'mono' });
    expect(mono.effects.desaturate).toBe(1);
    expect(mono.effects.tint).toBeNull();
    const none = resolveTheme('film', { filter: 'none' });
    expect([none.effects.warm, none.effects.desaturate, none.effects.fade, none.effects.vivid, none.effects.contrast]).toEqual([0, 0, 0, 0, 0]);
    expect([none.effects.tint, none.effects.hue, none.effects.hueAmount, none.effects.highlights, none.effects.shadows]).toEqual([null, null, 0, null, null]);
    expect(FILTERS.length).toBeGreaterThanOrEqual(12);
    // 색 이름이 붙은 필터는 원래 색이 강한 사진에서도 그 색으로 보이도록 색조(hue) 또는 밝은/어두운 곳 색을 씀
    for (const id of ['cool', 'lavender', 'mint', 'pink', 'golden', 'sepia'] as const) {
      const t = resolveTheme('classic', { filter: id });
      expect(t.effects.hue, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.effects.hueAmount, id).toBeGreaterThan(0.1);
    }
    const teal = resolveTheme('classic', { filter: 'teal' });
    expect(teal.effects.shadows).not.toBeNull();
    expect(teal.effects.highlights).not.toBeNull();
    expect(teal.effects.warm).toBe(0);
    const c = resolveTheme('classic', { accent: '#FF5FA2', textColor: '#fff8ec', dim: 'high', textEffect: 'glow' });
    expect(c.colors.accent).toBe('#ff5fa2');
    expect(c.look.frameLine).toBe('#ff5fa2');
    expect(c.colors.text).toBe('#fff8ec');
    expect(c.colors.titleDim).toMatch(/,0\.64\)$/);
    expect(c.colors.textShadow).toBe('rgba(255,95,162,0.9)');
    const many = resolveTheme('romantic', { amount: 'high' });
    expect(many.effects.particles).toBeGreaterThan(getTheme('romantic').effects.particles);
    const fx = resolveTheme('modern', { bokeh: 'high', sparkles: 'mid', glow: 'low', vignette: 'none', grain: 'high', leak: 'on' });
    expect(fx.effects.bokeh).toBe(22);
    expect(fx.effects.sparkles).toBe(28);
    expect(fx.effects.glow).toBe(0.1);
    expect(fx.effects.vignette).toBe(0);
    expect(fx.effects.grain).toBe(0.1);
    expect(fx.effects.leak).toBe(1);
    expect(resolveTheme('cinema', { frame: 'none' }).overlays).toEqual([]);
    expect(resolveTheme('classic', { frame: 'corners' }).overlays).toEqual(['corners']);
    expect(overlayInsets(resolveTheme('classic', { frame: 'letterbox' })).top).toBe(LETTERBOX);
    expect(FRAMES.length).toBeGreaterThanOrEqual(10);
    expect(resolveTheme('classic', { border: 'thick' }).photoBorder).toBe(20);
  });

  it('전환·속도·사진 연출을 바꾸면 영상 구성에 쓰는 값이 바뀜', () => {
    expect(resolveTheme('street', { transition: 'soft' }).transitions).toEqual([{ type: 'crossfade', weight: 1 }]);
    expect(resolveTheme('classic', { transition: 'clock' }).transitions).toEqual([{ type: 'clock', weight: 1 }]);
    const mix = resolveTheme('classic', { transition: 'mix' }).transitions;
    expect(new Set(mix.map((x) => x.type)).size).toBe(TRANSITIONS.length);
    const base = getTheme('classic').transitionDuration;
    expect(resolveTheme('classic', { speed: 'slow' }).transitionDuration).toBeGreaterThan(base);
    expect(resolveTheme('classic', { speed: 'fast' }).transitionDuration).toBeLessThan(base);
    expect(resolveTheme('classic', { scenes: 'calm' }).scene.minAvg).toBeLessThan(getTheme('classic').scene.minAvg);
    expect(resolveTheme('classic', { scenes: 'many' }).scene.minAvg).toBeGreaterThan(getTheme('classic').scene.minAvg);
    expect([...STRUCTURAL_KEYS].sort()).toEqual(['scenes', 'speed', 'transition']);
  });

  it('장식·이름 기호·글자 크기', () => {
    const t = resolveTheme('classic', { ornament: 'crown', nameJoin: 'infinity', textSize: 'lg' });
    expect(t.look.ornament).toBe('crown');
    expect(t.look.nameJoin).toBe('infinity');
    expect(t.textScale).toBeGreaterThan(1);
    expect(resolveTheme('classic', { textSize: 'sm' }).textScale).toBeLessThan(1);
    expect(getTheme('classic').textScale).toBe(1);
  });

  it('모르는 값·auto는 버리고 개수를 셈, 꾸미기 순서가 달라도 같은 테마', () => {
    const c = sanitizeCustom({ accent: 'red', fontName: 'Nope', filter: 'mono', title: 'auto', bokeh: 'huge', variant: 'x', grain: 'low' });
    expect(c).toEqual({ filter: 'mono', grain: 'low' });
    expect(customCount(c)).toBe(2);
    expect(customCount({})).toBe(0);
    expect(sanitizeCustom(null)).toEqual({});
    const a = resolveTheme('garden', { grain: 'low', filter: 'mono' });
    const b = resolveTheme('garden', { filter: 'mono', grain: 'low' });
    expect(a).toBe(b);
    expect(a.custom).toEqual({ filter: 'mono', grain: 'low' });
  });
});

describe('예시 문구', () => {
  it('빈칸마다 예시가 있고 입력칸 길이 제한 안에 들어감', () => {
    const limits: Record<keyof typeof SUGGESTIONS, number> = { introTitle: 30, outroTitle: 30, quotes: 400, outroMessage: 120, outroNotice: 40, caption: 24 };
    for (const [key, list] of Object.entries(SUGGESTIONS) as [keyof typeof SUGGESTIONS, readonly string[]][]) {
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(new Set(list).size).toBe(list.length);
      for (const s of list) expect(s.length, `${key}: ${s}`).toBeLessThanOrEqual(limits[key]);
    }
  });
});
