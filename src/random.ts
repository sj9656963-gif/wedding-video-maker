// 결정적(재현 가능한) 난수 유틸리티. 미리보기와 내보내기 결과가 항상 같도록 사용.

/** mulberry32 PRNG: 0 이상 1 미만의 실수를 반환하는 함수 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 정수 해시 → 0 이상 1 미만 실수 */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** 가중치 기반 선택 */
export function pickWeighted<T>(items: readonly { value: T; weight: number }[], rnd: () => number): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (items.length === 0) throw new Error('pickWeighted: empty list');
  if (total <= 0) return items[0].value;
  let r = rnd() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item.value;
  }
  return items[items.length - 1].value;
}
