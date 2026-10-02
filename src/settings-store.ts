// 입력값(문구·스타일·꾸미기 등)을 브라우저에 저장해 새로고침해도 유지. 사진·음악은 저장하지 않음.

import type { WeddingInfo } from './types';

const KEY = 'wedding-video-maker:v2';
const OLD_KEY = 'wedding-video-maker:v1';

export type DurationMode = 'auto' | 'music' | number;

export interface SavedSettings {
  info: Partial<WeddingInfo>;
  themeId: string;
  /** 스타일 안의 양식 (없으면 기본 양식) */
  variantId?: string | null;
  /** 예전 버전: 오프닝 디자인·흩날리는 효과 ('auto'면 스타일 추천). 지금은 custom 안에 저장 */
  titleDesign?: string;
  particle?: string;
  /** 꾸미기에서 고른 값 (글씨체·색감·효과·전환 등, 검사는 themes.sanitizeCustom) */
  custom?: Record<string, unknown>;
  groupPhotos: boolean;
  durationMode: DurationMode;
  quality: '1080p' | '720p';
  /** AI 자동 추천으로 고른 조합 (추천 표시용). 없으면 추천을 쓰지 않음 */
  ai?: { preset: string; rank: number; custom: Record<string, unknown> } | null;
}

export function loadSettings(): Partial<SavedSettings> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<SavedSettings>;
      return typeof data === 'object' && data ? data : {};
    }
    // 이전 버전: 입력한 문구만 이어받고 스타일은 새 기본값으로
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const data = JSON.parse(old) as Partial<SavedSettings> & { pairPortraits?: boolean };
      if (typeof data === 'object' && data) {
        return { info: data.info, durationMode: data.durationMode, quality: data.quality, groupPhotos: data.pairPortraits };
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function saveSettings(s: SavedSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 등은 무시 */
  }
}
