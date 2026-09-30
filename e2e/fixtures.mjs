// E2E용 테스트 사진 생성: 브라우저 캔버스로 그림을 그리고, EXIF(촬영일·회전)를 끼워 넣어 JPEG로 저장.
import fs from 'node:fs';
import path from 'node:path';

/** EXIF APP1 세그먼트 (리틀엔디언) 생성 */
function exifSegment({ orientation, dateOriginal }) {
  const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
  const ascii = (s) => [...Array.from(s).map((c) => c.charCodeAt(0)), 0];
  const ifd0 = [];
  if (orientation) ifd0.push({ tag: 0x0112, type: 3, count: 1, value: [...u16(orientation), 0, 0] });
  const hasExif = !!dateOriginal;
  if (hasExif) ifd0.push({ tag: 0x8769, type: 4, count: 1, value: [0, 0, 0, 0] });
  const ifd0Pos = 8;
  const ifd0Size = 2 + ifd0.length * 12 + 4;
  const exifPos = ifd0Pos + ifd0Size;
  const exifSize = hasExif ? 2 + 12 + 4 : 0;
  const dataPos = exifPos + exifSize;
  const ptr = ifd0.find((e) => e.tag === 0x8769);
  if (ptr) ptr.value = u32(exifPos);
  const tiff = [0x49, 0x49, ...u16(0x2a), ...u32(ifd0Pos), ...u16(ifd0.length)];
  for (const e of ifd0) tiff.push(...u16(e.tag), ...u16(e.type), ...u32(e.count), ...e.value);
  tiff.push(...u32(0));
  if (hasExif) {
    const bytes = ascii(dateOriginal);
    tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(bytes.length), ...u32(dataPos), ...u32(0), ...bytes);
  }
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = payload.length + 2;
  return Buffer.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload]);
}

function insertExif(jpeg, exif) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a jpeg');
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

/**
 * 사진 스펙 목록. order = 의도한 시간 순서(1부터), 파일명은 시간 순서와 다르게 섞음.
 * rotated: 가로로 저장하되 EXIF Orientation=6 → 화면에서는 세로
 */
export function fixtureSpecs() {
  const kinds = [];
  // 시간 순서대로: 가로 위주, 중간중간 세로 2장 연속, 정사각·파노라마 섞기
  const pattern = [
    'L', 'L', 'P', 'P', 'L', 'S', 'L', 'L', 'P', 'P', 'W', 'L', 'L', 'R', 'P', 'L', 'L', 'P', 'P', 'L',
    'N', 'L', 'L', 'P', 'L', 'S', 'L', 'P', 'P', 'L', 'W', 'L', 'L', 'P', 'L', 'L', 'L', 'P', 'L', 'L',
  ];
  pattern.forEach((k, i) => kinds.push({ kind: k, order: i + 1 }));
  // 파일명: 순서와 무관한 번호
  const names = kinds.map((_, i) => 1000 + ((i * 7919) % 9000));
  return kinds.map((k, i) => {
    const dims = {
      L: [3000, 2000],
      P: [2000, 3000],
      S: [2400, 2400],
      W: [4200, 1600],
      R: [3000, 2000], // 저장은 가로, EXIF로 90° 회전 → 세로로 보임
      N: [1600, 1200], // PNG
    }[k.kind];
    const day = new Date(2019, 3, 1 + k.order * 9, 10 + (k.order % 8), 15, 0);
    const date = `${day.getFullYear()}:${pad(day.getMonth() + 1)}:${pad(day.getDate())} ${pad(day.getHours())}:15:00`;
    const ext = k.kind === 'N' ? 'png' : 'jpg';
    return {
      ...k,
      width: dims[0],
      height: dims[1],
      file: `IMG_${names[i]}.${ext}`,
      date: k.kind === 'N' ? null : date,
      orientation: k.kind === 'R' ? 6 : null,
    };
  });
}

/** page: 아무 페이지나 열린 Playwright Page */
export async function generateFixtures(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const specs = fixtureSpecs();
  for (const spec of specs) {
    const out = path.join(dir, spec.file);
    if (fs.existsSync(out)) continue;
    const b64 = await page.evaluate(async (s) => {
      const c = document.createElement('canvas');
      c.width = s.width;
      c.height = s.height;
      const g = c.getContext('2d');
      const hue = (s.order * 37) % 360;
      // 회전 저장 사진은 세로 그림을 반시계 90°로 눕혀 저장 (EXIF 6 = 시계 90° 회전 표시)
      let W = s.width;
      let H = s.height;
      if (s.kind === 'R') {
        g.translate(0, s.height);
        g.rotate(-Math.PI / 2);
        W = s.height;
        H = s.width;
      }
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, `hsl(${hue},55%,70%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360},50%,35%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      // 산과 해
      g.fillStyle = `hsla(${(hue + 180) % 360},40%,25%,0.8)`;
      g.beginPath();
      g.moveTo(0, H * 0.8);
      for (let x = 0; x <= W; x += W / 8) g.lineTo(x, H * (0.62 + 0.12 * Math.sin(x / W * 9 + s.order)));
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.fillStyle = 'rgba(255,245,220,0.9)';
      g.beginPath();
      g.arc(W * 0.75, H * 0.28, Math.min(W, H) * 0.09, 0, Math.PI * 2);
      g.fill();
      // 두 사람 실루엣
      g.fillStyle = 'rgba(30,20,20,0.85)';
      const base = H * 0.82;
      const r = Math.min(W, H) * 0.05;
      for (const [cx, hr] of [[W * 0.44, 1], [W * 0.56, 0.9]]) {
        g.beginPath();
        g.arc(cx, base - r * 6.2 * hr, r * hr, 0, Math.PI * 2);
        g.fill();
        g.fillRect(cx - r * 0.9 * hr, base - r * 5 * hr, r * 1.8 * hr, r * 5 * hr);
      }
      // 번호와 정보 (위쪽 = 방향 확인용)
      g.fillStyle = '#ffffff';
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = Math.min(W, H) * 0.012;
      g.textAlign = 'center';
      g.font = `bold ${Math.round(Math.min(W, H) * 0.22)}px sans-serif`;
      g.strokeText(`#${s.order}`, W / 2, H * 0.36);
      g.fillText(`#${s.order}`, W / 2, H * 0.36);
      g.font = `${Math.round(Math.min(W, H) * 0.05)}px sans-serif`;
      g.fillText(`${s.kind} ${W}x${H} ▲TOP`, W / 2, H * 0.08);
      const type = s.kind === 'N' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise((res) => c.toBlob(res, type, 0.88));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    }, spec);
    let bytes = Buffer.from(b64, 'base64');
    if (spec.kind !== 'N' && (spec.date || spec.orientation)) {
      bytes = insertExif(bytes, exifSegment({ orientation: spec.orientation, dateOriginal: spec.date }));
    }
    fs.writeFileSync(out, bytes);
  }
  // 열 수 없는 파일과 사진이 아닌 파일
  fs.writeFileSync(path.join(dir, 'broken.jpg'), Buffer.from('this is not really a jpeg file'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), '메모');
  return specs;
}
