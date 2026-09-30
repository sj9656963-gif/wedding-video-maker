// 스타일 쇼케이스: 카드 10장이 3D 고리 모양으로 천천히 돌아감. 끌어서 돌리고, 누르면 그 스타일로 스튜디오 이동.

import { MOODS, THEMES } from '../themes';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Ring {
  setPosters(get: (id: string) => string | undefined): void;
}

export function initRing(onPick: (id: string) => void): Ring {
  const scene = document.getElementById('ring-scene');
  const ring = document.getElementById('ring');
  if (!scene || !ring) return { setPosters: () => undefined };
  const n = THEMES.length;
  const step = 360 / n;
  const cards = THEMES.map((t, i) => {
    const moods = t.moods.map((m) => MOODS.find((x) => x.id === m)?.name ?? m).join(' · ');
    const card = document.createElement('div');
    card.className = 'ring-card';
    card.setAttribute('role', 'listitem');
    card.style.setProperty('--i', String(i));
    card.dataset.theme = t.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-in';
    btn.setAttribute('aria-label', `${t.name} 스타일로 만들기 (${moods})`);
    const img = document.createElement('img');
    img.className = 'rc-img';
    img.alt = '';
    img.decoding = 'async';
    img.style.background = `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`;
    const en = document.createElement('span');
    en.className = 'rc-en';
    en.textContent = t.label;
    const name = document.createElement('strong');
    name.textContent = t.name;
    const mood = document.createElement('span');
    mood.className = 'rc-mood';
    mood.textContent = `${moods} · 양식 ${t.variants.length}`;
    btn.append(img, en, name, mood);
    card.append(btn);
    ring.append(card);
    btn.addEventListener('click', (e) => {
      // 끌어서 돌린 직후의 클릭은 무시 (키보드로 누른 클릭은 detail이 0)
      if (moved > 6 && e.detail !== 0) {
        e.preventDefault();
        return;
      }
      onPick(t.id);
    });
    btn.addEventListener('focus', () => {
      // 초점이 간 카드가 앞으로 오도록
      let target = -i * step;
      while (target - rot > 180) target -= 360;
      while (target - rot < -180) target += 360;
      focusTarget = target;
    });
    return { card, img, id: t.id };
  });

  let rot = 0;
  let vel = 0;
  let dragging = false;
  let captured = false;
  let pointerId = -1;
  let moved = 0;
  let lastX = 0;
  let focusTarget: number | null = null;
  let hover = false;
  let visible = false;
  let raf = 0;
  let last = performance.now();
  let radius = 520;

  const layout = () => {
    const w = cards[0].card.offsetWidth || 300;
    radius = Math.round(w / 2 / Math.tan(Math.PI / n) + 36);
    scene.style.setProperty('--radius', `${radius}px`);
  };
  const apply = () => {
    ring.style.transform = `translateZ(${-radius}px) rotateY(${rot.toFixed(2)}deg)`;
    cards.forEach(({ card }, i) => {
      const face = Math.cos(((i * step + rot) * Math.PI) / 180);
      card.style.setProperty('--face', face.toFixed(3));
      card.classList.toggle('front', face > 0.95);
    });
  };
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      if (focusTarget !== null) {
        rot += (focusTarget - rot) * 0.14;
        if (Math.abs(focusTarget - rot) < 0.05) focusTarget = null;
      } else if (Math.abs(vel) > 0.01) {
        rot += vel;
        vel *= 0.94;
      } else if (!reduced && !hover) {
        rot -= 7 * dt;
      }
    }
    apply();
    if (visible) raf = requestAnimationFrame(frame);
  };
  const wake = () => {
    last = performance.now();
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  scene.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    captured = false;
    pointerId = e.pointerId;
    moved = 0;
    lastX = e.clientX;
    vel = 0;
    focusTarget = null;
  });
  scene.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    // 실제로 끌기 시작한 뒤에만 포인터를 붙잡음. 누르자마자 붙잡으면 클릭·탭이 카드 버튼 대신
    // 무대(#ring-scene)로 전달돼 카드를 눌러도 스타일이 선택되지 않음
    if (!captured) {
      if (moved <= 6) return;
      captured = true;
      try {
        scene.setPointerCapture(e.pointerId);
      } catch {
        /* 이미 끝난 포인터 */
      }
      scene.classList.add('dragging');
    }
    rot += dx * 0.28;
    vel = dx * 0.28;
    apply();
  });
  const end = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    captured = false;
    scene.classList.remove('dragging');
    wake();
  };
  scene.addEventListener('pointerup', end);
  scene.addEventListener('pointercancel', end);
  scene.addEventListener('pointerenter', () => (hover = true));
  scene.addEventListener('pointerleave', () => (hover = false));
  new IntersectionObserver((e) => {
    visible = e.some((x) => x.isIntersecting);
    wake();
  }).observe(scene);
  window.addEventListener('resize', () => {
    layout();
    apply();
  });
  layout();
  apply();

  return {
    setPosters(get) {
      for (const c of cards) {
        const url = get(c.id);
        if (url) c.img.src = url;
      }
    },
  };
}
