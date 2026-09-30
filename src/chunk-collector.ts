// mediabunny StreamTarget이 내보내는 {position, data} 쓰기 조각을 모아 하나의 Blob으로 만드는 수집기.
// 대부분 순차 쓰기지만, 파일 끝에서 앞부분 헤더(mdat 크기 등)를 덮어쓰는 경우도 처리한다.

export interface WriteChunk {
  position: number;
  data: Uint8Array;
}

interface Part {
  start: number;
  bytes: Uint8Array;
}

export class ChunkCollector {
  private parts: Part[] = [];
  private end = 0;

  /** 지금까지 쓰인 전체 크기(바이트) */
  get size(): number {
    return this.end;
  }

  write(chunk: WriteChunk): void {
    const { position } = chunk;
    // 호출자가 버퍼를 재사용할 수 있으므로 복사해 보관
    const data = chunk.data.slice();
    if (data.length === 0) return;
    if (position < 0 || !Number.isFinite(position)) throw new RangeError(`잘못된 쓰기 위치: ${position}`);

    if (position > this.end) {
      // 빈 구간은 0으로 채움
      this.parts.push({ start: this.end, bytes: new Uint8Array(position - this.end) });
      this.end = position;
    }
    if (position === this.end) {
      this.parts.push({ start: position, bytes: data });
      this.end += data.length;
      return;
    }

    // 이미 쓰인 영역을 덮어쓰기
    const writeEnd = position + data.length;
    const overlapEnd = Math.min(writeEnd, this.end);
    let idx = this.findPart(position);
    while (idx < this.parts.length && this.parts[idx].start < overlapEnd) {
      const part = this.parts[idx];
      const from = Math.max(position, part.start);
      const to = Math.min(overlapEnd, part.start + part.bytes.length);
      if (to > from) {
        part.bytes.set(data.subarray(from - position, to - position), from - part.start);
      }
      idx++;
    }
    if (writeEnd > this.end) {
      const tail = data.subarray(this.end - position);
      this.parts.push({ start: this.end, bytes: tail.slice() });
      this.end = writeEnd;
    }
  }

  /** position을 포함하는 조각의 인덱스 (이진 탐색) */
  private findPart(position: number): number {
    let lo = 0;
    let hi = this.parts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.parts[mid].start <= position) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** 테스트/검증용: 전체 바이트를 하나로 합침 */
  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.end);
    for (const p of this.parts) out.set(p.bytes, p.start);
    return out;
  }

  toBlob(type: string): Blob {
    return new Blob(
      this.parts.map((p) => p.bytes as Uint8Array<ArrayBuffer>),
      { type },
    );
  }

  clear(): void {
    this.parts = [];
    this.end = 0;
  }
}
