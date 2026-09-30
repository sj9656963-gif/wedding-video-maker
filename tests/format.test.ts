import { describe, expect, it } from 'vitest';
import { compareNatural, formatBytes, formatKoreanDate, formatTime, safeFileName } from '../src/format';
import { wrapText } from '../src/text-layout';

describe('format', () => {
  it('formatTime', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(180)).toBe('3:00');
    expect(formatTime(245.4)).toBe('4:05');
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250.0 MB');
  });

  it('formatKoreanDate', () => {
    expect(formatKoreanDate('2026-10-24', '13:30')).toBe('2026년 10월 24일 토요일 오후 1시 30분');
    expect(formatKoreanDate('2026-10-25', '11:00')).toBe('2026년 10월 25일 일요일 오전 11시');
    expect(formatKoreanDate('2026-10-25', '12:00')).toBe('2026년 10월 25일 일요일 오후 12시');
    expect(formatKoreanDate('2026-10-25', '00:10')).toBe('2026년 10월 25일 일요일 오전 12시 10분');
    expect(formatKoreanDate('', '')).toBe('');
    expect(formatKoreanDate('', '15:00')).toBe('오후 3시');
  });

  it('safeFileName', () => {
    expect(safeFileName('식전영상_김철수/이영희?.mp4')).toBe('식전영상_김철수이영희.mp4');
    expect(safeFileName('  a   b  ')).toBe('a b');
  });

  it('compareNatural: 숫자를 자연스럽게 정렬', () => {
    const names = ['img10.jpg', 'img2.jpg', 'img1.jpg', 'IMG3.jpg'];
    expect([...names].sort(compareNatural)).toEqual(['img1.jpg', 'img2.jpg', 'IMG3.jpg', 'img10.jpg']);
  });
});

describe('wrapText', () => {
  // 글자당 폭 10으로 가정
  const measure = (s: string) => Array.from(s).length * 10;

  it('공백 기준으로 줄바꿈', () => {
    expect(wrapText('저희 두 사람의 새로운 시작을 축복해 주세요', 120, measure)).toEqual([
      '저희 두 사람의 새로운',
      '시작을 축복해 주세요',
    ]);
  });

  it('강제 줄바꿈과 긴 단어 분할', () => {
    expect(wrapText('가나다\n라마바사아자차카타파하', 50, measure)).toEqual(['가나다', '라마바사아', '자차카타파', '하']);
  });

  it('빈 문자열', () => {
    expect(wrapText('', 100, measure)).toEqual([]);
    expect(wrapText('\n\n', 100, measure)).toEqual([]);
  });

  it('문단 사이 빈 줄 유지', () => {
    expect(wrapText('첫째\n\n둘째', 100, measure)).toEqual(['첫째', '', '둘째']);
  });
});
