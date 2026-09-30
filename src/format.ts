// 표시용 포맷 도우미

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec + 1e-6);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** "2026-10-24", "13:30" → "2026년 10월 24일 토요일 오후 1시 30분" */
export function formatKoreanDate(date: string, time: string): string {
  const parts: string[] = [];
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (dm) {
    const y = Number(dm[1]);
    const mo = Number(dm[2]);
    const d = Number(dm[3]);
    const wd = new Date(y, mo - 1, d).getDay();
    parts.push(`${y}년 ${mo}월 ${d}일 ${WEEKDAYS[wd]}`);
  }
  const tm = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (tm) {
    const h = Number(tm[1]);
    const mi = Number(tm[2]);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    parts.push(mi === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${mi}분`);
  }
  return parts.join(' ');
}

/** 파일 이름에 쓸 수 없는 문자를 제거 */
export function safeFileName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** 자연스러운 파일 이름 정렬 (img2 < img10) */
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
export function compareNatural(a: string, b: string): number {
  return collator.compare(a, b);
}
