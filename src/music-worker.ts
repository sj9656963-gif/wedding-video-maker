// 기본 배경음악 생성 워커 (합성에 1초 이상 걸려 메인 스레드를 막지 않도록 분리)

import { generateMusic } from './music-gen';

interface MusicRequest {
  id: number;
  duration: number;
  sampleRate: number;
  seed?: number;
}

type WorkerScope = {
  onmessage: ((e: MessageEvent<MusicRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, duration, sampleRate, seed } = e.data;
  try {
    const [left, right] = generateMusic(duration, sampleRate, { seed });
    scope.postMessage({ id, left, right }, [left.buffer, right.buffer]);
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
