import { describe, expect, it } from 'vitest';
import { ChunkCollector } from '../src/chunk-collector';

const bytes = (...v: number[]) => new Uint8Array(v);

describe('ChunkCollector', () => {
  it('순차 쓰기를 이어 붙인다', () => {
    const c = new ChunkCollector();
    c.write({ position: 0, data: bytes(1, 2, 3) });
    c.write({ position: 3, data: bytes(4, 5) });
    expect(c.size).toBe(5);
    expect([...c.toUint8Array()]).toEqual([1, 2, 3, 4, 5]);
  });

  it('앞부분 덮어쓰기(여러 조각에 걸친 경우 포함)', () => {
    const c = new ChunkCollector();
    c.write({ position: 0, data: bytes(0, 0, 0, 0) });
    c.write({ position: 4, data: bytes(0, 0, 0, 0) });
    c.write({ position: 8, data: bytes(9, 9) });
    c.write({ position: 2, data: bytes(7, 7, 7, 7) }); // 두 조각에 걸침
    expect([...c.toUint8Array()]).toEqual([0, 0, 7, 7, 7, 7, 0, 0, 9, 9]);
    expect(c.size).toBe(10);
  });

  it('끝을 넘어가는 덮어쓰기는 나머지를 이어 붙인다', () => {
    const c = new ChunkCollector();
    c.write({ position: 0, data: bytes(1, 2, 3) });
    c.write({ position: 2, data: bytes(8, 9, 10) });
    expect([...c.toUint8Array()]).toEqual([1, 2, 8, 9, 10]);
  });

  it('건너뛴 구간은 0으로 채운다', () => {
    const c = new ChunkCollector();
    c.write({ position: 2, data: bytes(5) });
    expect([...c.toUint8Array()]).toEqual([0, 0, 5]);
  });

  it('입력 버퍼가 나중에 바뀌어도 영향이 없다', () => {
    const c = new ChunkCollector();
    const buf = bytes(1, 2, 3);
    c.write({ position: 0, data: buf });
    buf[0] = 99;
    expect(c.toUint8Array()[0]).toBe(1);
  });

  it('Blob 크기와 내용이 일치', async () => {
    const c = new ChunkCollector();
    for (let i = 0; i < 50; i++) c.write({ position: i * 4, data: bytes(i, i, i, i) });
    c.write({ position: 0, data: bytes(255) });
    const blob = c.toBlob('video/mp4');
    expect(blob.size).toBe(200);
    expect(blob.type).toBe('video/mp4');
    const arr = new Uint8Array(await blob.arrayBuffer());
    expect(arr[0]).toBe(255);
    expect(arr[199]).toBe(49);
  });

  it('무작위 쓰기 결과가 단순 배열 구현과 같다', () => {
    const c = new ChunkCollector();
    const ref: number[] = [];
    let seed = 1;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let k = 0; k < 400; k++) {
      const len = 1 + Math.floor(rnd() * 20);
      const pos = rnd() < 0.7 ? ref.length : Math.floor(rnd() * (ref.length + 5));
      const data = Array.from({ length: len }, () => Math.floor(rnd() * 256));
      while (ref.length < pos) ref.push(0);
      data.forEach((v, i) => (ref[pos + i] = v));
      c.write({ position: pos, data: new Uint8Array(data) });
    }
    expect([...c.toUint8Array()]).toEqual(ref);
  });
});
