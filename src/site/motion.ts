// 홈 화면 모션: 스크롤 등장, 제목 단어 분할 등장, 자석 버튼, 숫자 올라가기, 마키(스크롤 속도에 따라 기울어짐),
// 3D 화면 기울이기, 글자 모핑, '왜 직접' 장면 그림. 움직임 줄이기 설정이면 정지 상태(완성된 모습)로 보여줌.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** [data-split] 제목을 단어별로 나눠 차례로 떠오르게 */
export function splitHeadings(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-split]')) {
    let i = 0;
    const walk = (node: Node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const part of (child.textContent ?? '').split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              frag.append(' ');
              continue;
            }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--d', String(i++));
            w.append(inner);
            frag.append(w);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'BR') {
          walk(child);
        }
      }
    };
    walk(el);
    el.setAttribute('data-reveal', '');
  }
}

export function initReveal(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
  );
  els.forEach((e) => io.observe(e));
}

/** 커서를 살짝 따라오는 버튼 */
export function initMagnetic(): void {
  if (reduced || !finePointer) return;
  for (const el of document.querySelectorAll<HTMLElement>('.magnetic')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
      el.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.32).toFixed(1)}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  }
}

/** 화면에 들어오면 0부터 올라가는 숫자 */
export function initCounters(values: Record<string, number>): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const target = values[el.dataset.count ?? ''] ?? Number(el.textContent);
    el.textContent = String(target);
    if (reduced) continue;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((x) => x.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / 1500);
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
  }
}

/** 흐르는 띠 글자 두 줄. 스크롤을 빠르게 하면 기울어짐 */
export function initMarquee(rowA: string[], rowB: string[]): void {
  const fill = (id: string, items: string[]) => {
    const track = document.getElementById(id);
    if (!track) return;
    const seq = () => {
      const s = document.createElement('div');
      s.className = 'mq-seq';
      for (const x of items) {
        const t = document.createElement('span');
        t.textContent = x;
        const star = document.createElement('i');
        star.textContent = '✦';
        s.append(t, star);
      }
      return s;
    };
    track.replaceChildren(seq(), seq());
  };
  fill('mq-a', rowA);
  fill('mq-b', rowB);
  const mq = document.querySelector<HTMLElement>('.marquee');
  if (!mq || reduced) return;
  let lastY = window.scrollY;
  let vel = 0;
  let raf = 0;
  const tick = () => {
    vel *= 0.86;
    mq.style.setProperty('--skew', `${Math.max(-9, Math.min(9, vel * 0.14)).toFixed(2)}deg`);
    raf = Math.abs(vel) > 0.05 ? requestAnimationFrame(tick) : 0;
    if (!raf) mq.style.setProperty('--skew', '0deg');
  };
  window.addEventListener(
    'scroll',
    () => {
      vel += window.scrollY - lastY;
      lastY = window.scrollY;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true },
  );
}

/** 히어로의 3D 화면이 커서 방향으로 기울어짐 */
export function initTilt(): void {
  const stage = document.getElementById('stage3d');
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!stage || !hero || reduced || !finePointer) return;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    stage.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    stage.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    stage.style.setProperty('--tx', '0');
    stage.style.setProperty('--ty', '0');
  });
}

/** 두 단어가 녹아 섞이며 바뀌는 글자 모핑 (흐림 + SVG 문턱 필터) */
export function initMorph(el: HTMLElement, words: string[]): void {
  const [a, b] = Array.from(el.children) as HTMLElement[];
  if (!a || !b) return;
  a.textContent = words[0];
  if (reduced || words.length < 2) {
    b.textContent = '';
    return;
  }
  const MORPH = 1.2;
  const HOLD = 2.4;
  let index = 0;
  let morph = 0;
  let cooldown = HOLD;
  let last = performance.now();
  let visible = true;
  let raf = 0;
  // 화면 밖에서는 멈췄다가 다시 보이면 이어서
  const set = (fraction: number) => {
    el.classList.add('is-morphing');
    b.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
    b.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
    const inv = 1 - fraction;
    a.style.filter = `blur(${Math.min(8 / inv - 8, 100)}px)`;
    a.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
    a.textContent = words[index % words.length];
    b.textContent = words[(index + 1) % words.length];
  };
  const rest = () => {
    morph = 0;
    el.classList.remove('is-morphing');
    b.style.filter = '';
    b.style.opacity = '100%';
    a.style.filter = '';
    a.style.opacity = '0%';
  };
  a.style.opacity = '100%';
  b.style.opacity = '0%';
  const frame = (now: number) => {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible) return;
    const shouldAdvance = cooldown > 0;
    cooldown -= dt;
    if (cooldown <= 0) {
      if (shouldAdvance) index++;
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / MORPH;
      if (fraction > 1) {
        cooldown = HOLD;
        fraction = 1;
      }
      set(fraction);
    } else if (index > 0 || morph > 0) {
      rest();
    }
  };
  new IntersectionObserver((e) => {
    visible = e.some((x) => x.isIntersecting);
    if (visible && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }).observe(el);
  raf = requestAnimationFrame(frame);
}

// ───────────────────────── '왜 직접' 그림 ─────────────────────────
// 항목마다 작은 장면(견적서·타이머·편집 창·영상 화면·사진 타임라인)이 있고, 스크롤해 항목이 가운데에 오면
// 그 장면이 차례로 조립되며 나타남. 휴대폰에서는 같은 장면을 항목마다 글 위에 복제해 보여줌.

/** 장면 하나(원본 또는 휴대폰용 복제본)가 켜져 있는 동안 도는 움직임 */
interface SceneFx {
  stop(): void;
}

function fillCalendar(grid: Element): void {
  const cells = Array.from({ length: 21 }, (_, i) => {
    const c = document.createElement('i');
    c.style.setProperty('--c', String(i));
    // 앞의 12일은 지나간 날 (시안을 기다리며 보낸 날)
    if (i < 12) c.className = 'x';
    return c;
  });
  grid.replaceChildren(...cells);
}

/** 0 → 100% 숫자 (링이 차오르는 CSS 전환과 같은 시간) */
function countUp(el: HTMLElement): SceneFx {
  const num = el.querySelector<HTMLElement>('.t-num');
  if (!num) return { stop: () => undefined };
  if (reduced) {
    num.textContent = '100';
    return { stop: () => undefined };
  }
  const DELAY = 700;
  const DUR = 2200;
  const t0 = performance.now();
  let raf = 0;
  const ease = (x: number) => 1 - Math.pow(1 - x, 2.4);
  const step = (now: number) => {
    const p = Math.min(1, Math.max(0, (now - t0 - DELAY) / DUR));
    num.textContent = String(Math.round(100 * ease(p)));
    raf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  num.textContent = '0';
  raf = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(raf) };
}

/** 편집 창: 커서가 스타일 칩을 차례로 눌러 화면이 바로 바뀜 */
function editDemo(el: HTMLElement, visible: () => boolean): SceneFx {
  const imgs = Array.from(el.querySelectorAll<HTMLElement>('.win-view img'));
  const chips = Array.from(el.querySelectorAll<HTMLElement>('.win-chips span'));
  const cursor = el.querySelector<SVGElement>('.cursor');
  let i = 0;
  const show = (k: number) => {
    imgs.forEach((x, j) => x.classList.toggle('on', j === k));
    chips.forEach((x, j) => x.classList.toggle('on', j === k));
  };
  const aim = (k: number) => {
    const chip = chips[k];
    if (!cursor || !chip) return;
    const a = el.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    if (a.width === 0) return;
    cursor.style.transform = `translate(${(b.left - a.left + b.width * 0.62).toFixed(1)}px, ${(b.top - a.top + b.height * 0.5).toFixed(1)}px)`;
  };
  show(0);
  if (reduced) return { stop: () => undefined };
  const timers: ReturnType<typeof setTimeout>[] = [];
  // 조립 연출이 끝난 뒤 첫 칩 위로
  timers.push(setTimeout(() => aim(0), 1100));
  const iv = setInterval(() => {
    if (!visible()) return;
    const next = (i + 1) % chips.length;
    aim(next);
    timers.push(
      setTimeout(() => {
        i = next;
        show(i);
        cursor?.classList.remove('tap');
        void cursor?.getBoundingClientRect();
        cursor?.classList.add('tap');
      }, 650),
    );
  }, 1900);
  return {
    stop: () => {
      clearInterval(iv);
      timers.forEach(clearTimeout);
    },
  };
}

export function initWhy(): void {
  const stage = document.getElementById('why-stage');
  const section = document.getElementById('why');
  const items = Array.from(document.querySelectorAll<HTMLElement>('.why-item'));
  const scenes = stage ? Array.from(stage.querySelectorAll<HTMLElement>(':scope > .ws')) : [];
  const dots = Array.from(document.querySelectorAll<HTMLElement>('#why-dots li'));
  const num = document.getElementById('ws-num');
  if (!stage || !section || items.length === 0 || scenes.length !== items.length) return;
  for (const grid of stage.querySelectorAll('.cal-grid')) fillCalendar(grid);

  let sectionVisible = false;
  const fx = new Map<HTMLElement, SceneFx>();
  const start = (el: HTMLElement) => {
    // 화면에 그려지지 않는 쪽(넓은 화면의 복제본, 휴대폰의 원본)은 움직이지 않음
    if (el.getClientRects().length === 0) return;
    const list: SceneFx[] = [];
    if (el.classList.contains('s-time')) list.push(countUp(el));
    if (el.classList.contains('s-edit')) list.push(editDemo(el, () => sectionVisible));
    fx.set(el, { stop: () => list.forEach((f) => f.stop()) });
  };
  const setOn = (el: HTMLElement, on: boolean) => {
    if (el.classList.contains('on') === on) return;
    el.classList.toggle('on', on);
    fx.get(el)?.stop();
    fx.delete(el);
    if (on) start(el);
  };

  // 휴대폰용: 항목마다 같은 그림을 글 위에 복제
  const inline = items.map((item, i) => {
    const art = document.createElement('div');
    art.className = 'why-art';
    art.setAttribute('aria-hidden', 'true');
    const box = document.createElement('div');
    box.className = 'why-stage mini';
    const sc = scenes[i].cloneNode(true) as HTMLElement;
    sc.classList.remove('on');
    box.append(sc);
    art.append(box);
    item.prepend(art);
    return sc;
  });

  let active = -1;
  const go = (i: number) => {
    if (i === active || i < 0) return;
    active = i;
    scenes.forEach((s, j) => setOn(s, j === i));
    items.forEach((el, j) => el.classList.toggle('on', j === i));
    dots.forEach((el, j) => el.classList.toggle('on', j === i));
    if (num) num.innerHTML = `<em>${String(i + 1).padStart(2, '0')}</em> / ${String(items.length).padStart(2, '0')}`;
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) go(items.indexOf(e.target as HTMLElement));
    },
    { rootMargin: '-42% 0px -42% 0px' },
  );
  items.forEach((el) => io.observe(el));

  // 휴대폰 그림: 35% 이상 보이면 조립되고, 화면에서 완전히 벗어나면 되돌려 다음에 다시 재생
  const arts = inline.map((sc) => sc.closest<HTMLElement>('.why-art')!);
  const io2 = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const sc = inline[arts.indexOf(e.target as HTMLElement)];
        if (!sc) continue;
        if (e.intersectionRatio >= 0.35) setOn(sc, true);
        else if (!e.isIntersecting) setOn(sc, false);
      }
    },
    { threshold: [0, 0.35] },
  );
  arts.forEach((a) => io2.observe(a));

  new IntersectionObserver((e) => {
    sectionVisible = e.some((x) => x.isIntersecting);
  }).observe(section);
  go(0);
}

/** 상단 메뉴: 스크롤하면 배경이 생기고, 읽은 만큼 진행 막대, 지금 보는 구역 표시 */
export function initNav(): void {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--progress', (max > 0 ? window.scrollY / max : 0).toFixed(4));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const links = new Map<string, HTMLAnchorElement>();
  for (const a of nav.querySelectorAll<HTMLAnchorElement>('.nav-links a')) links.set(a.hash.slice(1), a);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const a = links.get(e.target.id);
        // 메뉴에 없는 구역(히어로·스튜디오)이면 표시를 지움
        for (const x of links.values()) if (x !== a) x.removeAttribute('aria-current');
        a?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  for (const id of [...links.keys(), 'top', 'studio']) {
    const s = document.getElementById(id);
    if (s) io.observe(s);
  }
}
