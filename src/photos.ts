// 사진 가져오기(디코딩, 썸네일 생성, 촬영일 읽기)와 정렬

import { readExif } from './exif';
import { compareNatural } from './format';
import { mulberry32 } from './random';
import type { PhotoItem } from './types';

export const THUMB_LONG_SIDE = 480;
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i;

export interface ImportedPhoto {
  item: PhotoItem;
  thumb: ImageBitmap;
}

export interface ImportFailure {
  name: string;
  reason: string;
}

export interface ImportResult {
  photos: ImportedPhoto[];
  failed: ImportFailure[];
  duplicates: number;
  skipped: number;
}

let seq = 0;
const nextId = () => `ph${Date.now().toString(36)}${(seq++).toString(36)}`;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT.test(file.name);
}

export const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

// 원본 해상도 디코딩은 메모리를 많이 쓰므로(24MP ≈ 96MB) 동시에 2개까지만
const MAX_DECODES = 2;
let activeDecodes = 0;
const decodeWaiters: (() => void)[] = [];

async function withDecodeSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDecodes < MAX_DECODES) activeDecodes++;
  else await new Promise<void>((resolve) => decodeWaiters.push(resolve)); // 슬롯을 그대로 넘겨받음
  try {
    return await fn();
  } finally {
    const next = decodeWaiters.shift();
    if (next) next();
    else activeDecodes--;
  }
}

/** 원본을 방향 보정해 디코딩한 뒤 scale(0~1]로 축소 */
export function decodeScaled(file: Blob, scaleFor: (w: number, h: number) => number): Promise<ImageBitmap> {
  return withDecodeSlot(async () => {
    const full = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, scaleFor(full.width, full.height));
    if (scale >= 0.98) return full;
    const w = Math.max(1, Math.round(full.width * scale));
    const h = Math.max(1, Math.round(full.height * scale));
    try {
      return await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    } finally {
      full.close();
    }
  });
}

async function thumbToUrl(thumb: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = thumb.width;
  canvas.height = thumb.height;
  canvas.getContext('2d')!.drawImage(thumb, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('썸네일을 만들 수 없어요.');
  return URL.createObjectURL(blob);
}

function failureReason(file: File): string {
  if (/\.(heic|heif)$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    return 'HEIC 형식은 이 브라우저에서 열 수 없어요. JPG로 변환해서 올려 주세요.';
  }
  return '이미지를 열 수 없어요. 파일이 손상되었거나 지원하지 않는 형식이에요.';
}

async function importOne(file: File, addedIndex: number): Promise<ImportedPhoto> {
  const [exif, bitmap] = await Promise.all([
    readExif(file),
    createImageBitmap(file, { imageOrientation: 'from-image' }),
  ]);
  const width = bitmap.width;
  const height = bitmap.height;
  let thumb: ImageBitmap;
  try {
    const s = Math.min(1, THUMB_LONG_SIDE / Math.max(width, height));
    thumb =
      s >= 1
        ? await createImageBitmap(bitmap)
        : await createImageBitmap(bitmap, {
            resizeWidth: Math.max(1, Math.round(width * s)),
            resizeHeight: Math.max(1, Math.round(height * s)),
            resizeQuality: 'high',
          });
  } finally {
    bitmap.close();
  }
  const thumbUrl = await thumbToUrl(thumb);
  return {
    thumb,
    item: {
      id: nextId(),
      file,
      name: file.name,
      width,
      height,
      aspect: width / height,
      dateTaken: exif.dateTaken,
      lastModified: file.lastModified,
      thumbUrl,
      addedIndex,
      caption: '',
    },
  };
}

/**
 * 파일들을 가져온다. 이미 있는 파일(이름·크기·수정시각이 같은 경우)은 건너뜀.
 * 동시에 3장씩 디코딩해 메모리 사용을 제한.
 */
export async function importPhotos(
  files: readonly File[],
  existingKeys: ReadonlySet<string>,
  firstAddedIndex: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const seen = new Set(existingKeys);
  const queue: { file: File; index: number }[] = [];
  let duplicates = 0;
  let skipped = 0;
  for (const file of files) {
    if (!isImageFile(file)) {
      skipped++;
      continue;
    }
    const key = fileKey(file);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    queue.push({ file, index: firstAddedIndex + queue.length });
  }

  const results: (ImportedPhoto | null)[] = new Array(queue.length).fill(null);
  const failed: ImportFailure[] = [];
  let done = 0;
  let next = 0;
  onProgress?.(0, queue.length);
  const worker = async () => {
    while (next < queue.length) {
      const i = next++;
      const { file, index } = queue[i];
      try {
        results[i] = await importOne(file, index);
      } catch {
        failed.push({ name: file.name, reason: failureReason(file) });
      }
      done++;
      onProgress?.(done, queue.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  return { photos: results.filter((r): r is ImportedPhoto => r !== null), failed, duplicates, skipped };
}

export type SortMode = 'date' | 'name' | 'added' | 'shuffle';

/** 정렬된 새 배열 반환 */
export function sortPhotos(photos: readonly PhotoItem[], mode: SortMode, seed = Date.now()): PhotoItem[] {
  const list = [...photos];
  switch (mode) {
    case 'date':
      return list.sort(
        (a, b) =>
          (a.dateTaken ?? a.lastModified) - (b.dateTaken ?? b.lastModified) || compareNatural(a.name, b.name),
      );
    case 'name':
      return list.sort((a, b) => compareNatural(a.name, b.name) || a.addedIndex - b.addedIndex);
    case 'added':
      return list.sort((a, b) => a.addedIndex - b.addedIndex);
    case 'shuffle': {
      const rnd = mulberry32(seed);
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    }
  }
}
