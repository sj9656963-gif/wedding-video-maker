import { describe, expect, it } from 'vitest';
import { parseExif, parseExifDate } from '../src/exif';

/** 테스트용 EXIF(APP1) 포함 JPEG 바이트 생성 */
function buildJpeg(opts: { little: boolean; orientation?: number; dateOriginal?: string; dateTime?: string }): Uint8Array {
  const { little } = opts;
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff]);
  const u32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const ascii = (s: string) => [...Array.from(s).map((c) => c.charCodeAt(0)), 0];

  // IFD0 엔트리
  const ifd0Entries: { tag: number; type: number; count: number; value: number[] }[] = [];
  if (opts.orientation !== undefined) {
    ifd0Entries.push({ tag: 0x0112, type: 3, count: 1, value: [...u16(opts.orientation), 0, 0] });
  }
  const dataAreas: { entryIndex: number; bytes: number[]; ifd: 0 | 1 }[] = [];
  if (opts.dateTime) {
    ifd0Entries.push({ tag: 0x0132, type: 2, count: opts.dateTime.length + 1, value: [0, 0, 0, 0] });
    dataAreas.push({ entryIndex: ifd0Entries.length - 1, bytes: ascii(opts.dateTime), ifd: 0 });
  }
  const exifEntries: typeof ifd0Entries = [];
  if (opts.dateOriginal) {
    exifEntries.push({ tag: 0x9003, type: 2, count: opts.dateOriginal.length + 1, value: [0, 0, 0, 0] });
    dataAreas.push({ entryIndex: 0, bytes: ascii(opts.dateOriginal), ifd: 1 });
  }
  if (exifEntries.length) ifd0Entries.push({ tag: 0x8769, type: 4, count: 1, value: [0, 0, 0, 0] });

  const ifd0Size = 2 + ifd0Entries.length * 12 + 4;
  const exifIfdSize = exifEntries.length ? 2 + exifEntries.length * 12 + 4 : 0;
  const ifd0Pos = 8;
  const exifIfdPos = ifd0Pos + ifd0Size;
  let dataPos = exifIfdPos + exifIfdSize;
  for (const area of dataAreas) {
    const list = area.ifd === 0 ? ifd0Entries : exifEntries;
    list[area.entryIndex].value = u32(dataPos);
    dataPos += area.bytes.length;
  }
  const exifPtr = ifd0Entries.find((e) => e.tag === 0x8769);
  if (exifPtr) exifPtr.value = u32(exifIfdPos);

  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(0x2a), ...u32(ifd0Pos));
  const writeIfd = (entries: typeof ifd0Entries) => {
    tiff.push(...u16(entries.length));
    for (const e of entries) tiff.push(...u16(e.tag), ...u16(e.type), ...u32(e.count), ...e.value);
    tiff.push(...u32(0));
  };
  writeIfd(ifd0Entries);
  if (exifEntries.length) writeIfd(exifEntries);
  for (const area of dataAreas) tiff.push(...area.bytes);

  const app1Payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1Payload.length + 2;
  const bytes = [
    0xff, 0xd8,
    // APP0 (JFIF) 먼저 넣어 세그먼트 건너뛰기도 검사
    0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00,
    0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...app1Payload,
    0xff, 0xda, 0x00, 0x02,
    0xff, 0xd9,
  ];
  return new Uint8Array(bytes);
}

describe('parseExifDate', () => {
  it('EXIF 날짜 문자열을 로컬 시각으로 변환', () => {
    const t = parseExifDate('2019:05:17 14:03:09');
    expect(t).toBe(new Date(2019, 4, 17, 14, 3, 9).getTime());
    expect(parseExifDate('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDate('garbage')).toBeNull();
    expect(parseExifDate(null)).toBeNull();
  });
});

describe('parseExif', () => {
  it.each([true, false])('리틀엔디언=%s: 촬영일과 회전 정보를 읽는다', (little) => {
    const jpeg = buildJpeg({ little, orientation: 6, dateOriginal: '2021:10:03 11:22:33', dateTime: '2022:01:01 00:00:00' });
    const info = parseExif(jpeg);
    expect(info.orientation).toBe(6);
    // DateTimeOriginal 우선
    expect(info.dateTaken).toBe(new Date(2021, 9, 3, 11, 22, 33).getTime());
  });

  it('DateTimeOriginal이 없으면 DateTime 사용', () => {
    const info = parseExif(buildJpeg({ little: true, dateTime: '2020:02:02 02:02:02' }));
    expect(info.dateTaken).toBe(new Date(2020, 1, 2, 2, 2, 2).getTime());
    expect(info.orientation).toBeNull();
  });

  it('JPEG가 아니거나 손상된 데이터는 안전하게 null', () => {
    expect(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({ dateTaken: null, orientation: null });
    expect(parseExif(new Uint8Array([]))).toEqual({ dateTaken: null, orientation: null });
    const broken = buildJpeg({ little: true, orientation: 3, dateOriginal: '2021:10:03 11:22:33' }).slice(0, 30);
    expect(() => parseExif(broken)).not.toThrow();
    // 무작위 바이트
    const rnd = new Uint8Array(4096);
    rnd[0] = 0xff;
    rnd[1] = 0xd8;
    for (let i = 2; i < rnd.length; i++) rnd[i] = (i * 7919) & 0xff;
    expect(() => parseExif(rnd)).not.toThrow();
  });
});
