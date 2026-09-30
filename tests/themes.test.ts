import { describe, expect, it } from 'vitest';
import { DESIGN_H as H_DESIGN } from '../src/design';
import { LETTERBOX, overlayInsets } from '../src/overlays';
import { MOODS, PARTICLES, THEMES, TITLE_DESIGNS, getTheme, resolveTheme } from '../src/themes';
import { LAYOUT_SPECS, planScenes, type PhotoRef } from '../src/timeline';

const LAYOUT_KEYS = new Set(Object.keys(LAYOUT_SPECS));
const MOOD_IDS = new Set(MOODS.map((m) => m.id));

function mixedPhotos(n: number): PhotoRef[] {
  const aspects = [1.5, 0.667, 1.5, 1, 0.667, 1.5, 2.6, 0.667, 1.5, 0.75];
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, aspect: aspects[i % aspects.length] }));
}

describe('스타일과 양식', () => {
  it('스타일 10종, 스타일마다 양식 3개 이상 (전체 30개 이상)', () => {
    expect(THEMES).toHaveLength(10);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
    for (const t of THEMES) expect(t.variants.length).toBeGreaterThanOrEqual(3);
    expect(THEMES.reduce((s, t) => s + t.variants.length, 0)).toBeGreaterThanOrEqual(30);
  });

  it('모든 스타일·양식이 빠짐없는 설정으로 합쳐진다', () => {
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
        expect(t.fonts.title && t.fonts.body && t.fonts.display && t.fonts.mono).toBeTruthy();
        expect(t.look.backdropBase).toMatch(/^#[0-9a-f]{6}$/i);
        expect(t.look.light).toMatch(/^\d+,\d+,\d+$/);
        expect(t.effects.bokehColor).toMatch(/^\d+,\d+,\d+$/);
        expect(TITLE_DESIGNS.some((d) => d.id === t.titleDesign)).toBe(true);
      }
    }
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
    expect(t.id).toBe('romantic');
    expect(t.variantId).toBe('blossom');
    expect(t.titleDesign).toBe('classic');
    expect(resolveTheme('street', { title: 'auto' }).titleDesign).toBe('kinetic');
  });

  it.each([
    ['street', ['poster', 'sticker']],
    ['gallery', ['gallery']],
    ['garden', ['arch']],
    ['neon', ['filmstrip']],
    ['romantic', ['oval']],
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
