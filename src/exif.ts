// JPEG EXIF에서 촬영 시각(DateTimeOriginal)과 회전 정보(Orientation)만 읽는 최소 파서.

export interface ExifInfo {
  /** 촬영 시각 (로컬 시간 기준 epoch ms) */
  dateTaken: number | null;
  /** EXIF Orientation (1~8) */
  orientation: number | null;
}

const TAG_ORIENTATION = 0x0112;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;

/** "YYYY:MM:DD HH:MM:SS" → epoch ms (로컬 시간) */
export function parseExifDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 60) return null;
  const date = new Date(y, mo - 1, d, h, mi, se);
  const t = date.getTime();
  return Number.isFinite(t) ? t : null;
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  /** 엔트리 값/오프셋 필드 위치 (TIFF 시작 기준) */
  valuePos: number;
}

class TiffReader {
  constructor(
    private view: DataView,
    private base: number,
    private little: boolean,
  ) {}

  get length() {
    return this.view.byteLength - this.base;
  }

  u16(pos: number) {
    return this.view.getUint16(this.base + pos, this.little);
  }

  u32(pos: number) {
    return this.view.getUint32(this.base + pos, this.little);
  }

  inRange(pos: number, len: number) {
    return pos >= 0 && len >= 0 && pos + len <= this.length;
  }

  entries(ifdPos: number): IfdEntry[] {
    if (!this.inRange(ifdPos, 2)) return [];
    const count = this.u16(ifdPos);
    const out: IfdEntry[] = [];
    for (let i = 0; i < count && i < 512; i++) {
      const p = ifdPos + 2 + i * 12;
      if (!this.inRange(p, 12)) break;
      out.push({ tag: this.u16(p), type: this.u16(p + 2), count: this.u32(p + 4), valuePos: p + 8 });
    }
    return out;
  }

  ascii(e: IfdEntry): string | null {
    if (e.type !== 2 || e.count === 0 || e.count > 256) return null;
    const pos = e.count <= 4 ? e.valuePos : this.u32(e.valuePos);
    if (!this.inRange(pos, e.count)) return null;
    let s = '';
    for (let i = 0; i < e.count; i++) {
      const c = this.view.getUint8(this.base + pos + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  short(e: IfdEntry): number | null {
    if (e.type !== 3 || e.count < 1) return null;
    return this.u16(e.valuePos);
  }

  long(e: IfdEntry): number | null {
    if (e.type !== 4 || e.count < 1) return null;
    return this.u32(e.valuePos);
  }
}

function parseTiff(view: DataView, base: number): ExifInfo {
  const empty: ExifInfo = { dateTaken: null, orientation: null };
  if (base + 8 > view.byteLength) return empty;
  const bo = view.getUint16(base, false);
  let little: boolean;
  if (bo === 0x4949) little = true;
  else if (bo === 0x4d4d) little = false;
  else return empty;
  const r = new TiffReader(view, base, little);
  if (r.u16(2) !== 0x002a) return empty;
  const ifd0 = r.u32(4);

  let orientation: number | null = null;
  let dateTime: string | null = null;
  let dateOriginal: string | null = null;
  let dateDigitized: string | null = null;
  let exifPos: number | null = null;

  for (const e of r.entries(ifd0)) {
    if (e.tag === TAG_ORIENTATION) orientation = r.short(e);
    else if (e.tag === TAG_DATETIME) dateTime = r.ascii(e);
    else if (e.tag === TAG_EXIF_IFD) exifPos = r.long(e);
  }
  if (exifPos !== null) {
    for (const e of r.entries(exifPos)) {
      if (e.tag === TAG_DATETIME_ORIGINAL) dateOriginal = r.ascii(e);
      else if (e.tag === TAG_DATETIME_DIGITIZED) dateDigitized = r.ascii(e);
    }
  }
  if (orientation !== null && (orientation < 1 || orientation > 8)) orientation = null;
  const dateTaken = parseExifDate(dateOriginal) ?? parseExifDate(dateDigitized) ?? parseExifDate(dateTime);
  return { dateTaken, orientation };
}

/** JPEG 바이트에서 EXIF 정보 추출. JPEG가 아니거나 EXIF가 없으면 null 값 반환. */
export function parseExif(buffer: ArrayBuffer | Uint8Array): ExifInfo {
  const empty: ExifInfo = { dateTaken: null, orientation: null };
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return empty;
  let pos = 2;
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) return empty;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xff) {
      pos += 1; // 채움 바이트
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return empty; // EOI / SOS: 더 이상 메타데이터 없음
    if (marker >= 0xd0 && marker <= 0xd7) {
      pos += 2;
      continue;
    }
    const len = view.getUint16(pos + 2, false);
    if (len < 2) return empty;
    if (marker === 0xe1 && pos + 10 <= view.byteLength) {
      // "Exif\0\0"
      const isExif =
        view.getUint32(pos + 4, false) === 0x45786966 && view.getUint16(pos + 8, false) === 0x0000;
      if (isExif) return parseTiff(view, pos + 10);
    }
    pos += 2 + len;
  }
  return empty;
}

/** 파일 앞부분만 읽어 EXIF 파싱 */
export async function readExif(file: Blob): Promise<ExifInfo> {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExif(head);
  } catch {
    return { dateTaken: null, orientation: null };
  }
}
