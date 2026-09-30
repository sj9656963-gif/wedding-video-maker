import { describe, expect, it } from 'vitest';
import {
  COVER_MIN_ASPECT,
  LAYOUT_SPECS,
  MAX_VIDEO_DURATION,
  MIN_SCENE_DURATION,
  MIN_VIDEO_DURATION,
  REPEAT_SCENE_DURATION,
  TALL_MAX_ASPECT,
  TimelineError,
  activeSegments,
  assignQuotes,
  assignYears,
  autoDuration,
  buildTimeline,
  defaultCoverId,
  defaultOutroId,
  maxPhotosFor,
  motionState,
  photoIdsInRange,
  planScenes,
  type PhotoRef,
  type ScenePlan,
  type TimelineInput,
} from '../src/timeline';
import { THEMES, getTheme } from '../src/themes';
import type { PhotoSegment, Timeline } from '../src/types';

const TRANSITIONS = [
  { type: 'crossfade' as const, weight: 3 },
  { type: 'push' as const, weight: 1 },
];

function makePhotos(n: number, pattern: 'landscape' | 'portrait' | 'mixed' = 'mixed'): PhotoRef[] {
  return Array.from({ length: n }, (_, i) => {
    let aspect = 1.5;
    if (pattern === 'portrait') aspect = 2 / 3;
    if (pattern === 'mixed') aspect = [1.5, 0.667, 1.333, 0.75, 1.0, 1.778][i % 6];
    return { id: `p${i}`, aspect };
  });
}

function input(photos: PhotoRef[], targetDuration: number, extra: Partial<TimelineInput> = {}): TimelineInput {
  return {
    photos,
    targetDuration,
    transitionDuration: 1.2,
    transitionTypes: TRANSITIONS,
    groupPhotos: true,
    seed: 42,
    ...extra,
  };
}

function themed(themeId: string, photos: PhotoRef[], targetDuration: number, extra: Partial<TimelineInput> = {}) {
  const theme = getTheme(themeId);
  return input(photos, targetDuration, {
    transitionDuration: theme.transitionDuration,
    transitionTypes: theme.transitions,
    sceneStyle: theme.scene,
    ...extra,
  });
}

/** 타임라인의 구조적 불변 조건 검사 */
function checkInvariants(tl: Timeline) {
  const segs = tl.segments;
  expect(segs[0].kind).toBe('intro');
  expect(segs[segs.length - 1].kind).toBe('outro');
  expect(segs[0].start).toBe(0);
  expect(segs[segs.length - 1].end).toBe(tl.duration);
  expect(tl.duration).toBeGreaterThanOrEqual(MIN_VIDEO_DURATION);
  expect(tl.duration).toBeLessThanOrEqual(MAX_VIDEO_DURATION);
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const cur = segs[i];
    // 빈틈 없이 겹치고, 겹치는 길이 = 전환 길이
    expect(cur.start).toBeLessThan(prev.end);
    expect(cur.start).toBeGreaterThan(prev.start);
    expect(cur.transitionIn).not.toBeNull();
    expect(prev.end - cur.start).toBeCloseTo(cur.transitionIn!.duration, 6);
    // 세 구간이 동시에 겹치지 않음
    if (i >= 2) expect(cur.start).toBeGreaterThanOrEqual(segs[i - 2].end - 1e-9);
  }
  for (const seg of segs) {
    if (seg.kind === 'photo') {
      expect(seg.end - seg.start).toBeGreaterThanOrEqual(MIN_SCENE_DURATION - 1e-6);
    }
  }
}

/** 장면에 담긴 사진이 배치 조건(장수·비율)을 지키는지 */
function checkLayouts(scenes: readonly { layout: string; photoIds: string[] }[], photos: readonly PhotoRef[]) {
  const aspect = new Map(photos.map((p) => [p.id, p.aspect]));
  for (const sc of scenes) {
    const a = sc.photoIds.map((id) => aspect.get(id)!);
    if (sc.layout === 'cover') {
      expect(a).toHaveLength(1);
      expect(a[0]).toBeGreaterThanOrEqual(COVER_MIN_ASPECT);
    }
    if (sc.layout === 'pair') {
      expect(a).toHaveLength(2);
      for (const x of a) expect(x).toBeLessThan(TALL_MAX_ASPECT);
    }
    if (['contain', 'oval', 'magazine'].includes(sc.layout)) expect(a).toHaveLength(1);
    if (sc.layout === 'collage') expect(a).toHaveLength(3);
    if (sc.layout === 'grid' || sc.layout === 'filmstrip') expect(a).toHaveLength(4);
    if (sc.layout === 'polaroid') expect(a.length).toBeGreaterThanOrEqual(1);
  }
}

describe('planScenes', () => {
  it.each(THEMES.map((t) => t.id))('%s: 모든 사진이 순서대로 정확히 한 번씩 들어간다', (id) => {
    for (const seed of [1, 2, 3]) {
      const photos = makePhotos(57);
      const scenes = planScenes(photos, { style: getTheme(id).scene, seed });
      expect(scenes.flatMap((s) => s.photoIds)).toEqual(photos.map((p) => p.id));
      checkLayouts(scenes, photos);
      for (const s of scenes) expect(s.weight).toBeGreaterThanOrEqual(1);
    }
  });

  it('여러 장 모아 보기를 끄면 한 장씩만 배치', () => {
    const photos = makePhotos(40);
    const scenes = planScenes(photos, { style: getTheme('romantic').scene, group: false, seed: 5 });
    expect(scenes).toHaveLength(40);
    for (const s of scenes) expect(s.photoIds).toHaveLength(1);
  });

  it('로맨틱은 다양한 배치를 섞어 쓴다', () => {
    const photos = makePhotos(60);
    const scenes = planScenes(photos, { style: getTheme('romantic').scene, seed: 11 });
    const layouts = new Set(scenes.map((s) => s.layout));
    expect(layouts.size).toBeGreaterThanOrEqual(5);
    for (const l of ['oval', 'polaroid', 'collage']) expect(layouts.has(l as never)).toBe(true);
    // 같은 특수 배치가 연달아 나오는 경우는 드묾
    let repeats = 0;
    for (let i = 1; i < scenes.length; i++) if (scenes[i].key === scenes[i - 1].key && scenes[i].key !== 'cover') repeats++;
    expect(repeats).toBeLessThanOrEqual(2);
    // 첫 장면은 한 장 배치
    expect(scenes[0].photoIds).toHaveLength(1);
  });

  it.each([1.5, 2.5])('장면당 평균 사진 수 목표(%s)를 대체로 지킨다', (ratio) => {
    const photos = makePhotos(150);
    const scenes = planScenes(photos, { style: getTheme('romantic').scene, ratio, seed: 3 });
    const avg = photos.length / scenes.length;
    expect(Math.abs(avg - ratio)).toBeLessThan(0.4);
  });

  it('배치 정의가 일관된다', () => {
    for (const spec of Object.values(LAYOUT_SPECS)) {
      expect(spec.count).toBeGreaterThanOrEqual(1);
      expect(spec.weight).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('assignYears / assignQuotes', () => {
  const plans = (n: number): ScenePlan[] =>
    Array.from({ length: n }, (_, i) => ({ photoIds: [`p${i}`], layout: 'cover', key: 'cover', weight: 1, variant: 0 }));

  it('촬영 연도가 바뀌는 장면에 연도를 표시', () => {
    const photos: PhotoRef[] = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, aspect: 1.5, year: i < 4 ? 2019 : i < 7 ? 2020 : 2022 }));
    const scenes = plans(10);
    assignYears(scenes, photos);
    expect(scenes.map((s) => s.year)).toEqual([2019, undefined, undefined, undefined, 2020, undefined, undefined, 2022, undefined, undefined]);
  });

  it('시간순이 아니거나 연도가 하나뿐이면 표시하지 않음', () => {
    const shuffled: PhotoRef[] = [2020, 2019, 2021, 2019].map((y, i) => ({ id: `p${i}`, aspect: 1.5, year: y }));
    const s1 = plans(4);
    assignYears(s1, shuffled);
    expect(s1.every((s) => s.year === undefined)).toBe(true);
    const single: PhotoRef[] = [2020, 2020, 2020].map((y, i) => ({ id: `p${i}`, aspect: 1.5, year: y }));
    const s2 = plans(3);
    assignYears(s2, single);
    expect(s2.every((s) => s.year === undefined)).toBe(true);
  });

  it('문구를 고르게 배치하고 한 장 장면을 매거진으로 바꿈', () => {
    const scenes = plans(30);
    const placed = assignQuotes(scenes, ['첫째', '둘째', ' ', '셋째']);
    expect(placed).toBe(3);
    const idx = scenes.map((s, i) => (s.quote ? i : -1)).filter((i) => i >= 0);
    expect(idx).toHaveLength(3);
    expect(scenes[idx[0]].quote).toBe('첫째');
    for (const i of idx) {
      expect(scenes[i].layout).toBe('magazine');
      expect(scenes[i].weight).toBeGreaterThan(1);
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThan(29);
    }
    // 간격이 고르게
    expect(idx[1] - idx[0]).toBeGreaterThan(4);
    expect(idx[2] - idx[1]).toBeGreaterThan(4);
  });

  it('장면이 적으면 문구 수를 줄임', () => {
    const scenes = plans(8);
    expect(assignQuotes(scenes, ['a', 'b', 'c', 'd'])).toBe(1);
    expect(assignQuotes(plans(5), ['a'])).toBe(0);
  });
});

describe('buildTimeline', () => {
  it('사진이 없으면 오류', () => {
    expect(() => buildTimeline(input([], 240))).toThrowError(TimelineError);
    try {
      buildTimeline(input([], 240));
    } catch (e) {
      expect((e as TimelineError).code).toBe('no-photos');
    }
  });

  it.each([
    [12, 180],
    [20, 180],
    [37, 200],
    [60, 240],
    [100, 270],
    [140, 300],
  ])('%i장 / %i초: 모든 스타일에서 길이가 정확하고 구조가 올바르다', (n, target) => {
    const photos = makePhotos(n);
    for (const theme of THEMES) {
      const tl = buildTimeline(themed(theme.id, photos, target, { quotes: ['하나', '둘', '셋'] }));
      expect(tl.duration).toBe(target);
      checkInvariants(tl);
      const photoSegs = tl.segments.filter((s): s is PhotoSegment => s.kind === 'photo');
      checkLayouts(photoSegs, photos);
      // 모든 사진이 순서대로 최소 한 번 등장
      const order = photoSegs.flatMap((s) => s.photoIds);
      const firstSeen = photos.map((p) => order.indexOf(p.id));
      expect(firstSeen.every((i) => i >= 0)).toBe(true);
      for (let i = 1; i < firstSeen.length; i++) expect(firstSeen[i]).toBeGreaterThan(firstSeen[i - 1]);
    }
  });

  it('로맨틱 3분 영상: 여러 기법과 문구가 들어간다', () => {
    const tl = buildTimeline(themed('romantic', makePhotos(40), 180, { quotes: ['하나', '둘', '셋', '넷'] }));
    expect(tl.layoutCount).toBeGreaterThanOrEqual(5);
    expect(tl.quoteCount).toBeGreaterThanOrEqual(3);
    const kinds = new Set(tl.segments.map((s) => s.transitionIn?.type).filter(Boolean));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    expect(tl.averageSceneDuration).toBeGreaterThan(4);
    expect(tl.averageSceneDuration).toBeLessThan(10);
  });

  it('목표 길이는 3~5분으로 보정된다', () => {
    expect(buildTimeline(input(makePhotos(30), 60)).duration).toBe(MIN_VIDEO_DURATION);
    expect(buildTimeline(input(makePhotos(30), 999)).duration).toBe(MAX_VIDEO_DURATION);
    expect(buildTimeline(input(makePhotos(30), Number.NaN)).duration).toBe(MIN_VIDEO_DURATION);
  });

  it('사진이 너무 많으면 최대 장수를 알려준다', () => {
    const photos = makePhotos(400, 'landscape');
    let err: TimelineError | null = null;
    try {
      buildTimeline(input(photos, 240));
    } catch (e) {
      err = e as TimelineError;
    }
    expect(err).toBeInstanceOf(TimelineError);
    expect(err!.code).toBe('too-many');
    const max = err!.maxPhotos!;
    expect(max).toBeGreaterThan(50);
    expect(max).toBeLessThan(400);
    expect(maxPhotosFor(input(photos, 240))).toBe(max);
    // 최대 장수까지는 성공, 한 장 더하면 실패
    checkInvariants(buildTimeline(input(photos.slice(0, max), 240)));
    expect(() => buildTimeline(input(photos.slice(0, max + 1), 240))).toThrowError(TimelineError);
  });

  it('여러 장 배치가 있는 스타일은 더 많은 사진을 담는다', () => {
    const photos = makePhotos(400);
    const basic = maxPhotosFor(input(photos, 180));
    const romantic = maxPhotosFor(themed('romantic', photos, 180));
    expect(romantic).toBeGreaterThan(basic);
    checkInvariants(buildTimeline(themed('romantic', photos.slice(0, romantic), 180)));
  });

  it('사진이 적으면 반복해서 장면 길이를 적당히 유지한다', () => {
    const photos = makePhotos(6, 'landscape');
    for (const tl of [buildTimeline(input(photos, 240)), buildTimeline(themed('romantic', photos, 240))]) {
      checkInvariants(tl);
      expect(tl.repeatedScenes).toBeGreaterThan(0);
      expect(tl.sceneDuration).toBeLessThanOrEqual(REPEAT_SCENE_DURATION + 1e-9);
      const scenes = tl.segments.filter((s): s is PhotoSegment => s.kind === 'photo');
      for (let i = 1; i < scenes.length; i++) {
        expect(scenes[i].photoIds).not.toEqual(scenes[i - 1].photoIds);
      }
    }
  });

  it('사진 1장도 처리한다', () => {
    for (const id of ['classic', 'romantic']) {
      const tl = buildTimeline(themed(id, makePhotos(1), 180));
      checkInvariants(tl);
      expect(tl.duration).toBe(180);
    }
  });

  it('같은 시드는 같은 결과, 다른 시드는 다른 결과', () => {
    const photos = makePhotos(40);
    const a = buildTimeline(themed('romantic', photos, 240, { seed: 7 }));
    const b = buildTimeline(themed('romantic', photos, 240, { seed: 7 }));
    const c = buildTimeline(themed('romantic', photos, 240, { seed: 8 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('대표 사진과 엔딩 사진을 지정할 수 있다', () => {
    const photos = makePhotos(20);
    const tl = buildTimeline(input(photos, 180, { coverId: 'p5', outroPhotoId: 'p7' }));
    const intro = tl.segments[0];
    const outro = tl.segments[tl.segments.length - 1];
    expect(intro.kind === 'intro' && intro.photoId).toBe('p5');
    expect(outro.kind === 'outro' && outro.photoId).toBe('p7');
    // 존재하지 않는 id면 기본값(첫/마지막 가로 사진)
    const tl2 = buildTimeline(input(photos, 180, { coverId: 'zzz' }));
    expect(tl2.segments[0].kind === 'intro' && tl2.segments[0].photoId).toBe('p0');
  });

  it('push·wipe 전환은 방향이 번갈아 바뀐다', () => {
    const tl = buildTimeline(
      input(makePhotos(60, 'landscape'), 300, {
        transitionTypes: [
          { type: 'push', weight: 1 },
          { type: 'wipe', weight: 1 },
        ],
      }),
    );
    const dirs = tl.segments
      .filter((s) => s.kind === 'photo' && s.index > 0)
      .map((s) => s.transitionIn!.direction);
    for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBe(-dirs[i - 1]);
  });

  it('특수 전환은 연달아 반복되지 않는다', () => {
    const tl = buildTimeline(themed('romantic', makePhotos(80), 300));
    const types = tl.segments.slice(2).map((s) => s.transitionIn!.type);
    let repeats = 0;
    for (let i = 1; i < types.length; i++) if (types[i] === types[i - 1] && types[i] !== 'crossfade') repeats++;
    expect(repeats).toBeLessThanOrEqual(1);
  });

  it('연도 챕터: 촬영일 순서이면 연도가 바뀌는 장면에 표시', () => {
    const photos: PhotoRef[] = makePhotos(45).map((p, i) => ({ ...p, year: 2018 + Math.floor(i / 15) }));
    const tl = buildTimeline(themed('romantic', photos, 200));
    const years = tl.segments.filter((s): s is PhotoSegment => s.kind === 'photo' && s.year !== undefined).map((s) => s.year);
    expect(years).toEqual([2018, 2019, 2020]);
  });
});

describe('activeSegments / photoIdsInRange', () => {
  const tl = buildTimeline(input(makePhotos(45), 240));

  it('모든 시각에서 해당 시각을 포함하는 1~2개 구간을 반환', () => {
    for (let t = 0; t <= tl.duration; t += 0.05) {
      const act = activeSegments(tl, t);
      expect(act.length).toBeGreaterThanOrEqual(1);
      for (const s of act) {
        expect(t).toBeGreaterThanOrEqual(s.start - 1e-9);
        expect(t).toBeLessThanOrEqual(s.end + 1e-9);
      }
      if (act.length === 2) expect(act[0].end).toBeGreaterThan(act[1].start);
    }
    expect(activeSegments(tl, -1)[0].kind).toBe('intro');
    const last = activeSegments(tl, tl.duration);
    expect(last[last.length - 1].kind).toBe('outro');
  });

  it('전환 구간 한가운데에서는 두 구간을 반환', () => {
    const s1 = tl.segments[2];
    const mid = s1.start + s1.transitionIn!.duration / 2;
    const act = activeSegments(tl, mid);
    expect(act).toHaveLength(2);
    expect(act[1]).toBe(s1);
  });

  it('구간 내 사진 id 수집', () => {
    const ids = photoIdsInRange(tl, 0, 1);
    expect(ids).toEqual(['p0']); // 인트로 대표 사진
    const all = photoIdsInRange(tl, 0, tl.duration);
    expect(all.length).toBe(45);
  });
});

describe('motionState', () => {
  it('확대 배율과 위치가 안전 범위 안에 있다', () => {
    const types = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'] as const;
    for (const type of types) {
      for (let p = 0; p <= 1; p += 0.1) {
        const st = motionState({ type, fx: 0.5, fy: -0.6 }, p);
        expect(st.s).toBeGreaterThanOrEqual(1);
        expect(st.s).toBeLessThanOrEqual(1.13);
        expect(Math.abs(st.ox)).toBeLessThanOrEqual(1);
        expect(Math.abs(st.oy)).toBeLessThanOrEqual(1);
      }
    }
    expect(motionState({ type: 'zoom-in', fx: 0, fy: 0 }, 0).s).toBe(1);
    expect(motionState({ type: 'zoom-out', fx: 0, fy: 0 }, 1).s).toBe(1);
  });
});

describe('autoDuration', () => {
  it('사진 수에 따라 3~5분 사이에서 늘어난다', () => {
    expect(autoDuration(0)).toBe(MIN_VIDEO_DURATION);
    expect(autoDuration(5)).toBe(MIN_VIDEO_DURATION);
    expect(autoDuration(200)).toBe(MAX_VIDEO_DURATION);
    expect(autoDuration(60)).toBeGreaterThan(autoDuration(50));
    expect(autoDuration(50)).toBeGreaterThan(MIN_VIDEO_DURATION);
    expect(autoDuration(60)).toBeLessThan(MAX_VIDEO_DURATION);
  });
});

describe('오프닝/엔딩 사진', () => {
  const photos: PhotoRef[] = [
    { id: 'portraitA', aspect: 0.66 },
    { id: 'portraitB', aspect: 0.7 },
    { id: 'land1', aspect: 1.5 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, aspect: 1.5 })),
    { id: 'land2', aspect: 1.6 },
    { id: 'square', aspect: 1 },
  ];

  it('기본값은 첫/마지막 가로 사진 (화면을 꽉 채우기 좋음)', () => {
    expect(defaultCoverId(photos)).toBe('land1');
    expect(defaultOutroId(photos)).toBe('land2');
    const onlyPortraits = [
      { id: 'a', aspect: 0.7 },
      { id: 'b', aspect: 0.7 },
    ];
    expect(defaultCoverId(onlyPortraits)).toBe('a');
    expect(defaultOutroId(onlyPortraits)).toBe('b');
    expect(defaultCoverId([])).toBeNull();
    const tl = buildTimeline(input(photos, 200));
    const intro = tl.segments[0];
    const outro = tl.segments[tl.segments.length - 1];
    expect(intro.kind === 'intro' && intro.photoId).toBe('land1');
    expect(outro.kind === 'outro' && outro.photoId).toBe('land2');
  });

  it('오프닝 사진이 첫 장면(화면 가득)과 같으면 움직임이 끊기지 않게 이어진다', () => {
    const list: PhotoRef[] = makePhotos(30, 'landscape');
    const tl = buildTimeline(input(list, 180));
    const intro = tl.segments[0];
    const first = tl.segments[1];
    expect(intro.kind === 'intro' && intro.photoId).toBe('p0');
    expect(first.kind === 'photo' && first.photoIds).toEqual(['p0']);
    expect(first.kind === 'photo' && first.layout).toBe('cover');
    expect(intro.motionSpan).toBeDefined();
    expect(intro.motionSpan).toBe(first.motionSpan);
    expect(intro.motion).toEqual(first.motion);
    expect(intro.motionSpan).toEqual({ start: intro.start, end: first.end });
  });

  it('다른 사진이면 연결하지 않는다', () => {
    const list = makePhotos(30, 'landscape');
    const tl = buildTimeline(input(list, 180, { coverId: 'p10', outroPhotoId: 'p3' }));
    expect(tl.segments[0].motionSpan).toBeUndefined();
    expect(tl.segments[1].motionSpan).toBeUndefined();
    expect(tl.segments[tl.segments.length - 1].motionSpan).toBeUndefined();
  });

  it('세로 사진 장면과는 연결하지 않는다', () => {
    const list: PhotoRef[] = [{ id: 'a', aspect: 0.7 }, { id: 'b', aspect: 0.7 }, ...makePhotos(20, 'landscape')];
    const tl = buildTimeline(input(list, 180, { coverId: 'a' }));
    expect(tl.segments[1].kind === 'photo' && tl.segments[1].layout).not.toBe('cover');
    expect(tl.segments[0].motionSpan).toBeUndefined();
  });
});
