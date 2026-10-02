import { describe, expect, it } from 'vitest';
import { AI_PRESETS, matchesPick, pixelStats, rankPresets, recommend, summarize, type PhotoStats } from '../src/recommend';
import { THEMES, baseTheme, resolveTheme, sanitizeCustom } from '../src/themes';

/** w×h 크기의 한 가지 색 RGBA */
const solid = (r: number, g: number, b: number, n = 64) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4);
  return a;
};
const stats = (p: Partial<PhotoStats>): PhotoStats => ({
  count: 40,
  portrait: 10,
  dated: 0,
  yearFrom: null,
  yearTo: null,
  sampled: 40,
  bw: 0,
  dark: 0,
  green: 0,
  warm: 0,
  ...p,
});

describe('AI 추천 조합', () => {
  it('모든 추천 조합은 있는 스타일·양식이고 꾸미기 값도 올바름', () => {
    expect(AI_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(AI_PRESETS.map((p) => p.id)).size).toBe(AI_PRESETS.length);
    for (const p of AI_PRESETS) {
      const t = THEMES.find((x) => x.id === p.themeId);
      expect(t, p.id).toBeDefined();
      expect(t!.variants.some((v) => v.id === p.variantId), `${p.id} 양식`).toBe(true);
      expect(sanitizeCustom(p.custom)).toEqual(p.custom);
      // 실제로 그 양식으로 적용됨
      expect(resolveTheme(p.themeId, { variant: p.variantId, ...p.custom }).variantId).toBe(p.variantId);
      expect(p.headline.length).toBeGreaterThan(4);
      expect(p.why.length).toBeGreaterThan(20);
    }
  });

  it('사진이 없거나 평범하면 가장 무난한 클래식 · 아이보리 골드가 1순위 (꽃잎 조금)', () => {
    for (const s of [null, stats({})]) {
      const pick = recommend(s);
      expect(pick.preset.themeId).toBe('classic');
      expect(pick.preset.variantId).toBe('ivory');
      expect(pick.rank).toBe(0);
      expect(pick.total).toBe(AI_PRESETS.length);
      expect(pick.custom).toEqual({ particle: 'petals', amount: 'low' });
    }
    // 클래식이 가장 인기 스타일
    expect(baseTheme('classic').badge).toBe('가장 인기');
  });

  it("'다른 추천'은 순서대로 돌고 끝나면 처음으로", () => {
    const ids = Array.from({ length: AI_PRESETS.length + 1 }, (_, i) => recommend(null, i).preset.id);
    expect(new Set(ids.slice(0, AI_PRESETS.length)).size).toBe(AI_PRESETS.length);
    expect(ids[AI_PRESETS.length]).toBe(ids[0]);
  });

  it('사진을 보고 순서를 바꿈: 흑백 → 블랙 타이 먼저, 초록빛 → 가든, 노을빛 → 샴페인이 두 번째', () => {
    expect(rankPresets(stats({ bw: 0.8 }))[0].id).toBe('classic-blacktie');
    expect(rankPresets(stats({ green: 0.6 }))[1].id).toBe('garden-greenery');
    expect(rankPresets(stats({ warm: 0.6 }))[1].id).toBe('classic-champagne');
    // 1순위는 그대로 클래식
    expect(rankPresets(stats({ green: 0.6 }))[0].id).toBe('classic-ivory');
    // 색을 살펴보지 못했으면 기본 순서
    expect(rankPresets(stats({ bw: 1, sampled: 0 })).map((p) => p.id)).toEqual(AI_PRESETS.map((p) => p.id));
  });

  it('어두운 사진이 많으면 오프닝 배경을 밝게 · 무엇을 봤는지 메모', () => {
    const pick = recommend(stats({ dark: 0.7, portrait: 20, dated: 40, yearFrom: 2019, yearTo: 2026 }));
    expect(pick.custom.dim).toBe('low');
    const text = pick.notes.map((n) => `${n.text} ${n.then ?? ''}`).join(' / ');
    expect(text).toContain('사진 40장');
    expect(text).toContain('세로 사진이 많아요');
    expect(text).toContain('2019~2026년');
    expect(text).toContain('어두운 사진');
    expect(recommend(stats({ count: 8, sampled: 8 })).notes.some((n) => n.text === '사진이 적어요')).toBe(true);
  });

  it('픽셀 색: 흑백·초록·노을빛·어두운 사진을 구분', () => {
    const gray = pixelStats(solid(128, 128, 128));
    expect(gray.sat).toBeLessThan(0.08);
    expect(pixelStats(solid(60, 160, 70)).green).toBe(1);
    expect(pixelStats(solid(240, 150, 60)).warm).toBe(1);
    expect(pixelStats(solid(30, 28, 40)).lum).toBeLessThan(0.32);
    const s = summarize(
      [
        { aspect: 0.66, dateTaken: new Date(2019, 4, 1).getTime() },
        { aspect: 1.5, dateTaken: new Date(2024, 4, 1).getTime() },
        { aspect: 1.5, dateTaken: null },
      ],
      [gray, pixelStats(solid(60, 160, 70)), pixelStats(solid(30, 28, 40))],
    );
    expect(s).toMatchObject({ count: 3, portrait: 1, dated: 2, yearFrom: 2019, yearTo: 2024, sampled: 3 });
    // 회색 1장만 흑백 (어두운 보랏빛은 색이 있는 사진)
    expect(s.bw).toBeCloseTo(1 / 3);
    expect(s.dark).toBeCloseTo(1 / 3);
    expect(s.green).toBeCloseTo(1 / 3);
  });

  it('지금 설정이 추천과 같은지', () => {
    const pick = { themeId: 'classic', variantId: 'ivory', custom: { particle: 'petals' as const, amount: 'low' as const } };
    expect(matchesPick(pick, { themeId: 'classic', variantId: null, custom: { amount: 'low', particle: 'petals' } }, 'ivory')).toBe(true);
    expect(matchesPick(pick, { themeId: 'classic', variantId: 'ivory', custom: { particle: 'petals' } }, 'ivory')).toBe(false);
    expect(matchesPick(pick, { themeId: 'romantic', variantId: 'blossom', custom: pick.custom }, 'blossom')).toBe(false);
  });
});
