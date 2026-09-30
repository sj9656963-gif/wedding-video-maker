// 오프닝/엔딩 문구 그리기: 클래식 디자인은 여기서, 나머지 디자인은 titles.ts에서

import { DESIGN_H as H, DESIGN_W as W, clamp01, easeOutCubic, smoothstep } from './design';
import { fillSpaced } from './draw-utils';
import { formatKoreanDate } from './format';
import { wrapText } from './text-layout';
import { fontSpec, type Theme } from './themes';
import { DESIGN_TEXTS, HANGUL, drawDesignedIntro, drawDesignedOutro, drawDividerAt, drawNamesRow, fitFont, type TextEnv } from './titles';
import type { WeddingInfo } from './types';

const CX = W / 2;

interface Item {
  h: number;
  /** 등장 시각 (구간 시작 기준, 초) */
  at: number;
  draw: (cy: number) => void;
  /** 추가 투명도 배율 */
  alpha?: number;
}

function shadow(env: TextEnv, blur = 18): void {
  const { ctx, theme, k } = env;
  ctx.shadowColor = theme.colors.textShadow;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2 * k;
}

function drawTitle(env: TextEnv, text: string, cy: number, scriptSize: number): void {
  const { ctx, theme } = env;
  const f = theme.fonts;
  ctx.fillStyle = theme.colors.accent;
  ctx.textAlign = 'center';
  if (HANGUL.test(text)) {
    fitFont(ctx, text, 1600, (s) => fontSpec(f.body, s, f.nameWeight), 68);
    ctx.fillText(text, CX, cy);
  } else if (theme.titleStyle === 'script') {
    fitFont(ctx, text, 1600, (s) => fontSpec(f.title, s, f.titleWeight, f.titleItalic), scriptSize);
    ctx.fillText(text, CX, cy + scriptSize * 0.06);
  } else {
    const up = text.toUpperCase();
    const size = fitFont(ctx, up, 1400, (s) => fontSpec(f.title, s, f.titleWeight, f.titleItalic), 58);
    fillSpaced(ctx, up, CX, cy, size * 0.26);
  }
}

function drawNames(env: TextEnv, info: WeddingInfo, cy: number, size: number): void {
  const { theme } = env;
  const f = theme.fonts;
  drawNamesRow(env, info, CX, cy, size, (s) => fontSpec(f.body, s, f.nameWeight), theme.colors.text, theme.colors.accent, 'center', 1700);
}

function drawLine(env: TextEnv, text: string, cy: number, size: number, color: string, weight?: number): void {
  const { ctx, theme } = env;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  fitFont(ctx, text, 1700, (s) => fontSpec(theme.fonts.body, s, weight ?? theme.fonts.bodyWeight), size);
  ctx.fillText(text, CX, cy);
}

/** 항목들을 세로 가운데 정렬로 배치하며 등장 애니메이션 적용 */
function layoutItems(env: TextEnv, items: Item[], u: number, gap: number, globalAlpha: number, fadeIn = 1.3): void {
  const { ctx } = env;
  const total = items.reduce((s, it) => s + it.h, 0) + gap * Math.max(0, items.length - 1);
  let y = H / 2 - total / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  shadow(env);
  for (const it of items) {
    const e = easeOutCubic(clamp01((u - it.at) / fadeIn));
    const a = e * globalAlpha * (it.alpha ?? 1);
    if (a > 0.002) {
      ctx.globalAlpha = a;
      it.draw(y + it.h / 2 + (1 - e) * 26);
    }
    y += it.h + gap;
  }
  ctx.restore();
}

/**
 * 오프닝 문구. u = 구간 시작 후 경과 시간, dur = 구간 길이.
 * pace < 1이면 문구가 더 빨리 나타나고 사라짐 (짧은 예시 영상용)
 */
export function drawIntroText(env: TextEnv, info: WeddingInfo, u: number, dur: number, pace = 1): void {
  if (env.theme.titleDesign !== 'classic') {
    drawDesignedIntro(env, info, u, dur, pace);
    return;
  }
  const f = Math.min(1, pace);
  const fadeOut = 1 - smoothstep(dur - 2.9 * f, dur - 1.7 * f, u);
  if (fadeOut <= 0) return;
  const { theme } = env;
  const title = info.introTitle.trim() || theme.introScript;
  const scriptTitle = theme.titleStyle === 'script' && !HANGUL.test(title);
  const dateText = formatKoreanDate(info.date, info.time);
  const venue = info.venue.trim();
  const items: Item[] = [
    { h: scriptTitle ? 150 : 84, at: 0.5 * f, draw: (cy) => drawTitle(env, title, cy, 150) },
    { h: 24, at: 1.1 * f, draw: (cy) => drawDividerAt(env.ctx, theme.look, CX, cy, theme.colors.accent) },
  ];
  if (info.groom.trim() || info.bride.trim()) {
    items.push({ h: 104, at: 1.6 * f, draw: (cy) => drawNames(env, info, cy, 80) });
  }
  if (dateText) items.push({ h: 52, at: 2.3 * f, draw: (cy) => drawLine(env, dateText, cy, 38, theme.colors.sub) });
  if (venue) items.push({ h: 48, at: 2.7 * f, draw: (cy) => drawLine(env, venue, cy, 36, theme.colors.sub) });
  layoutItems(env, items, u, 20, fadeOut, 1.3 * Math.max(0.5, f));
}

/** 엔딩 문구 */
export function drawOutroText(env: TextEnv, info: WeddingInfo, u: number, pace = 1): void {
  if (env.theme.titleDesign !== 'classic') {
    drawDesignedOutro(env, info, u, pace);
    return;
  }
  const { ctx, theme } = env;
  const f = Math.min(1, pace);
  const items: Item[] = [
    { h: theme.titleStyle === 'script' ? 150 : 84, at: 1.4 * f, draw: (cy) => drawTitle(env, theme.outroScript, cy, 150) },
  ];
  const message = info.outroMessage.trim();
  if (message) {
    ctx.font = fontSpec(theme.fonts.body, 46, theme.fonts.bodyWeight);
    const lines = wrapText(message, 1400, (s) => ctx.measureText(s).width).slice(0, 5);
    lines.forEach((line, i) => {
      items.push({ h: 70, at: (2.3 + i * 0.25) * f, draw: (cy) => line && drawLine(env, line, cy, 46, theme.colors.text) });
    });
  }
  if (info.groom.trim() || info.bride.trim()) {
    items.push({ h: 84, at: 3.4 * f, draw: (cy) => drawNames(env, info, cy, 52) });
  }
  const notice = info.outroNotice.trim();
  if (notice) {
    items.push({
      h: 56,
      at: 4.2 * f,
      alpha: 0.8 + 0.2 * Math.sin(u * 2.2),
      draw: (cy) => drawLine(env, notice, cy, 36, theme.colors.accent),
    });
  }
  layoutItems(env, items, u, 16, 1, 1.3 * Math.max(0.5, f));
}

/** 캔버스에 그릴 모든 문구 (글꼴 미리 불러오기용). extra = 사진 문구 등 */
export function collectTexts(theme: Theme, info: WeddingInfo, extra: readonly string[] = []): string[] {
  return [
    info.introTitle || theme.introScript,
    theme.outroScript,
    theme.outroScript.toUpperCase(),
    (info.introTitle || theme.introScript).toUpperCase(),
    info.groom,
    info.bride,
    formatKoreanDate(info.date, info.time),
    info.venue,
    info.outroMessage,
    info.outroNotice,
    info.quotes,
    theme.look.magazineLabel,
    theme.look.magazineLabel.toUpperCase(),
    theme.look.posterWord,
    'Our story O U R S T O R Y 0123456789. ▸A No.-…',
    '&',
    ...DESIGN_TEXTS,
    ...extra,
  ];
}
