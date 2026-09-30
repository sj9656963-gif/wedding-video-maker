// 기본 배경음악 생성기: 파헬벨 '캐논'(퍼블릭 도메인)의 화성 진행을 바탕으로 한
// 잔잔한 피아노/오르골 편곡을 즉석에서 합성. 저작권 걱정 없는 기본 음악.

import { mulberry32 } from './random';

type Timbre = 'piano' | 'bell' | 'bass' | 'pad';

interface TimbreDef {
  partials: readonly number[];
  amps: readonly number[];
  /** 부분음별 감쇠 시간상수(초) */
  decays: readonly number[];
  attack: number;
  /** 샘플 길이(초) */
  length: number;
  /** pad 전용: 지속 후 릴리즈 시작 시각(초) */
  sustainUntil?: number;
}

const TIMBRES: Record<Timbre, TimbreDef> = {
  piano: { partials: [1, 2, 3, 4], amps: [1, 0.42, 0.18, 0.07], decays: [0.85, 0.5, 0.32, 0.22], attack: 0.004, length: 2.6 },
  bell: { partials: [1, 2, 3, 4.17], amps: [1, 0.28, 0.1, 0.06], decays: [1.3, 0.75, 0.45, 0.12], attack: 0.003, length: 3.6 },
  bass: { partials: [1, 2, 3], amps: [1, 0.3, 0.08], decays: [1.5, 0.8, 0.4], attack: 0.012, length: 3.4 },
  pad: { partials: [1, 2, 3], amps: [1, 0.25, 0.08], decays: [0.35, 0.35, 0.35], attack: 0.7, length: 3.6, sustainUntil: 2.1 },
};

// 캐논 진행: D - A - Bm - F#m - G - D - G - A
const BASS = [50, 45, 47, 42, 43, 38, 43, 45];
const PAD = [
  [57, 62, 66],
  [57, 61, 64],
  [59, 62, 66],
  [57, 61, 66],
  [55, 59, 62],
  [57, 62, 66],
  [55, 59, 62],
  [57, 61, 64],
];
const ARP = [
  [62, 66, 69, 74],
  [61, 64, 69, 73],
  [62, 66, 71, 74],
  [61, 66, 69, 73],
  [62, 67, 71, 74],
  [62, 66, 69, 74],
  [62, 67, 71, 74],
  [61, 64, 69, 73],
];
const MEL1 = [78, 76, 74, 73, 71, 69, 71, 73];
const MEL2 = [74, 73, 71, 69, 67, 66, 67, 64];

type Section = 'intro' | 'arp' | 'mel1' | 'mel2' | 'mel1hi' | 'mel2hi' | 'breath';
const SECTION_CYCLE: readonly Section[] = ['arp', 'mel1', 'mel2', 'mel1hi', 'mel2hi', 'mel1', 'mel2', 'breath'];

interface NoteEvent {
  time: number;
  midi: number;
  timbre: Timbre;
  vel: number;
  pan: number;
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** 한 음을 미리 렌더링한 샘플 (모노) */
function renderNote(timbre: Timbre, midi: number, sampleRate: number): Float32Array {
  const def = TIMBRES[timbre];
  const n = Math.round(def.length * sampleRate);
  const out = new Float32Array(n);
  const f0 = midiToFreq(midi);
  const attackN = Math.max(1, Math.round(def.attack * sampleRate));
  const nyquist = sampleRate / 2;
  for (let h = 0; h < def.partials.length; h++) {
    const f = f0 * def.partials[h];
    if (f > nyquist * 0.9) continue;
    const w = (2 * Math.PI * f) / sampleRate;
    const c = 2 * Math.cos(w);
    // 사인 점화식 오실레이터: y[n] = c·y[n-1] − y[n-2]
    let y2 = -Math.sin(w);
    let y1 = 0;
    const amp = def.amps[h];
    const k = Math.exp(-1 / (def.decays[h] * sampleRate));
    let env = 1;
    if (def.sustainUntil !== undefined) {
      const sus = Math.round(def.sustainUntil * sampleRate);
      for (let i = 0; i < n; i++) {
        const y = c * y1 - y2;
        y2 = y1;
        y1 = y;
        let a = i < attackN ? Math.sin((Math.PI / 2) * (i / attackN)) : 1;
        if (i >= sus) {
          env *= k;
          a *= env;
        }
        out[i] += y2 * amp * a;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const y = c * y1 - y2;
        y2 = y1;
        y1 = y;
        const a = i < attackN ? i / attackN : 1;
        out[i] += y2 * amp * a * env;
        env *= k;
      }
    }
  }
  // 샘플 끝을 부드럽게 (클릭 방지)
  const tail = Math.min(n, Math.round(0.05 * sampleRate));
  for (let i = 0; i < tail; i++) out[n - 1 - i] *= i / tail;
  return out;
}

function buildEvents(duration: number, bpm: number, rnd: () => number): NoteEvent[] {
  const beat = 60 / bpm;
  const chordDur = beat * 2;
  const cycleDur = chordDur * 8;
  const events: NoteEvent[] = [];
  const cycles = Math.ceil(duration / cycleDur) + 1;
  const jitter = () => (rnd() - 0.5) * 0.016;
  const human = () => 0.88 + rnd() * 0.24;
  for (let c = 0; c < cycles; c++) {
    const section: Section = c === 0 ? 'intro' : SECTION_CYCLE[(c - 1) % SECTION_CYCLE.length];
    for (let j = 0; j < 8; j++) {
      const t0 = c * cycleDur + j * chordDur;
      if (t0 >= duration) break;
      events.push({ time: t0, midi: BASS[j], timbre: 'bass', vel: 0.5, pan: 0 });
      PAD[j].forEach((m, i) => events.push({ time: t0, midi: m, timbre: 'pad', vel: 0.085, pan: (i - 1) * 0.35 }));
      if (section !== 'intro') {
        const fast = section === 'mel1hi' || section === 'mel2hi';
        const pattern = fast ? [0, 1, 2, 3, 1, 2, 3, 2] : [0, 1, 2, 3];
        const step = chordDur / pattern.length;
        const baseVel = section === 'breath' ? 0.14 : fast ? 0.15 : 0.2;
        pattern.forEach((idx, i) => {
          events.push({
            time: t0 + i * step + (i === 0 ? 0 : jitter()),
            midi: ARP[j][idx],
            timbre: 'piano',
            vel: baseVel * human(),
            pan: i % 2 === 0 ? -0.25 : 0.25,
          });
        });
      }
      if (section.startsWith('mel')) {
        const line = section.startsWith('mel1') ? MEL1 : MEL2;
        const hi = section.endsWith('hi');
        events.push({
          time: t0 + jitter(),
          midi: line[j] + (hi ? 12 : 0),
          timbre: 'bell',
          vel: (hi ? 0.2 : 0.3) * human(),
          pan: 0.1,
        });
      }
    }
  }
  return events.filter((e) => e.time < duration);
}

/** 간단한 스테레오 리버브 (Schroeder/Freeverb 계열) */
function applyReverb(left: Float32Array, right: Float32Array, sampleRate: number, wet = 0.24, dry = 0.9) {
  const scale = sampleRate / 44100;
  const combTunings = [1557, 1617, 1491, 1422];
  const allpassTunings = [556, 441];
  const spread = 23;
  const feedback = 0.8;
  const damp = 0.3;
  const process = (buf: Float32Array, offset: number) => {
    const combs = combTunings.map((t) => ({ buf: new Float32Array(Math.round((t + offset) * scale)), idx: 0, store: 0 }));
    const aps = allpassTunings.map((t) => ({ buf: new Float32Array(Math.round((t + offset) * scale)), idx: 0 }));
    const n = buf.length;
    for (let i = 0; i < n; i++) {
      const x = buf[i];
      const input = x * 0.12;
      let acc = 0;
      for (let k = 0; k < combs.length; k++) {
        const cmb = combs[k];
        const y = cmb.buf[cmb.idx];
        cmb.store = y * (1 - damp) + cmb.store * damp;
        cmb.buf[cmb.idx] = input + cmb.store * feedback;
        if (++cmb.idx >= cmb.buf.length) cmb.idx = 0;
        acc += y;
      }
      for (let k = 0; k < aps.length; k++) {
        const ap = aps[k];
        const bo = ap.buf[ap.idx];
        ap.buf[ap.idx] = acc + bo * 0.5;
        acc = bo - acc;
        if (++ap.idx >= ap.buf.length) ap.idx = 0;
      }
      buf[i] = x * dry + acc * wet;
    }
  };
  process(left, 0);
  process(right, spread);
}

export interface MusicOptions {
  seed?: number;
  bpm?: number;
}

/** duration(초) 길이의 스테레오 배경음악 생성 */
export function generateMusic(
  duration: number,
  sampleRate: number,
  options: MusicOptions = {},
): [Float32Array, Float32Array] {
  const total = Math.max(1, Math.round(duration * sampleRate));
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const rnd = mulberry32(options.seed ?? 1685);
  const events = buildEvents(duration, options.bpm ?? 60, rnd);

  const cache = new Map<string, Float32Array>();
  for (const e of events) {
    const key = `${e.timbre}:${e.midi}`;
    let sample = cache.get(key);
    if (!sample) {
      sample = renderNote(e.timbre, e.midi, sampleRate);
      cache.set(key, sample);
    }
    const start = Math.max(0, Math.round(e.time * sampleRate));
    const n = Math.min(sample.length, total - start);
    const angle = ((e.pan + 1) * Math.PI) / 4;
    const gl = Math.cos(angle) * e.vel;
    const gr = Math.sin(angle) * e.vel;
    for (let i = 0; i < n; i++) {
      const s = sample[i];
      left[start + i] += s * gl;
      right[start + i] += s * gr;
    }
  }

  applyReverb(left, right, sampleRate);

  // 피크 정규화
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const a = Math.abs(left[i]);
    const b = Math.abs(right[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  if (peak > 0) {
    const g = 0.8 / peak;
    for (let i = 0; i < total; i++) {
      left[i] *= g;
      right[i] *= g;
    }
  }
  return [left, right];
}
