// Shared motion kit for the whole site.
//  - Spring: a critically-tunable spring-mass-damper, integrated with
//    semi-implicit Euler in fixed sub-steps so it behaves the same at any
//    frame rate.
//  - decode(): restrained per-character text decoding for small labels.
//  - The nav indicator, which rides on two springs.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Spring ---------- */
  class Spring {
    // stiffness k, damping c, mass m. Damping ratio zeta = c / (2 * sqrt(k * m)).
    constructor(value = 0, { stiffness = 170, damping = 24, mass = 1 } = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.k = stiffness;
      this.c = damping;
      this.m = mass;
    }

    set(value) { this.value = value; this.target = value; this.velocity = 0; }

    // Advance by dt seconds. Returns true while still moving.
    step(dt) {
      const h = 1 / 240;
      let remaining = Math.min(dt, .064);
      while (remaining > 1e-6) {
        const s = Math.min(h, remaining);
        const force = -this.k * (this.value - this.target) - this.c * this.velocity;
        this.velocity += (force / this.m) * s;
        this.value += this.velocity * s;
        remaining -= s;
      }
      return !this.settled;
    }

    get settled() {
      return Math.abs(this.value - this.target) < .01 && Math.abs(this.velocity) < .01;
    }
  }

  /* ---------- Decode ---------- */
  // Small, seeded PRNG so the "randomness" in a decode is controlled and
  // repeatable per string, not a different mess every time.
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const GLYPHS = '01<>/\\{}[]=+*#:;~^|_-';
  const running = new WeakMap();

  // Morph el's text into `text`. Every character gets its own start time,
  // resolve time and flicker rate; characters resolve left to right with a
  // little controlled jitter. Calling again on the same element cancels the
  // previous run cleanly. Resolves when done.
  const decode = (el, text, { duration = 420, stagger = 26, jitter = 70 } = {}) => {
    running.get(el)?.cancel();
    if (reducedMotion.matches) { el.textContent = text; return Promise.resolve(); }
    const from = el.textContent;
    const rand = mulberry32(hash(text) ^ (performance.now() | 0));
    const length = Math.max(from.length, text.length);
    const chars = Array.from({ length }, (_, i) => {
      const start = i * stagger + rand() * jitter;
      return {
        from: from[i] ?? '',
        to: text[i] ?? '',
        start,
        resolve: start + duration * (.45 + rand() * .55),
        rate: 40 + rand() * 45,
        glyph: GLYPHS[(rand() * GLYPHS.length) | 0],
        last: 0,
      };
    });
    let frame = 0;
    let done;
    const finished = new Promise((r) => { done = r; });
    const t0 = performance.now();
    const tick = (now) => {
      const t = now - t0;
      let out = '';
      let complete = true;
      for (const c of chars) {
        if (t < c.start) { out += c.from; complete = false; continue; }
        if (t >= c.resolve || c.to === ' ') { out += c.to; continue; }
        complete = false;
        if (now - c.last > c.rate) { c.glyph = GLYPHS[(rand() * GLYPHS.length) | 0]; c.last = now; }
        out += c.glyph;
      }
      el.textContent = out;
      if (complete) { el.textContent = text; running.delete(el); done(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    running.set(el, { cancel: () => { cancelAnimationFrame(frame); el.textContent = text; running.delete(el); done(); } });
    return finished;
  };

  window.Motion = { Spring, decode, reducedMotion };

  /* ---------- Nav indicator ---------- */
  // A single line under the nav. Its x position and width are two springs,
  // so moving between links carries a little momentum instead of snapping.
  const nav = document.querySelector('.site-nav');
  const desktop = window.matchMedia('(min-width: 761px)');
  if (nav) {
    const links = [...nav.querySelectorAll('a')];
    const indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.append(indicator);
    nav.classList.add('has-indicator');

    const x = new Spring(0, { stiffness: 260, damping: 28 });
    const w = new Spring(0, { stiffness: 260, damping: 28 });
    const o = new Spring(0, { stiffness: 200, damping: 26 });
    const home = links.find((a) => a.hasAttribute('aria-current'));
    let frame = 0;
    let last = 0;

    const measure = (a) => {
      const label = a.querySelector('.nav-label') || a;
      const nr = nav.getBoundingClientRect();
      const r = label.getBoundingClientRect();
      return { left: r.left - nr.left, width: r.width };
    };
    const render = () => {
      indicator.style.transform = `translateX(${x.value.toFixed(2)}px) scaleX(${Math.max(0, w.value).toFixed(2)})`;
      indicator.style.opacity = Math.max(0, Math.min(1, o.value)).toFixed(3);
    };
    const loop = (now) => {
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const moving = [x.step(dt), w.step(dt), o.step(dt)].some(Boolean);
      render();
      frame = moving ? requestAnimationFrame(loop) : 0;
      if (!moving) last = 0;
    };
    const go = (a, instant = false) => {
      if (!a) { o.target = 0; } else {
        const m = measure(a);
        x.target = m.left;
        w.target = m.width;
        o.target = 1;
        if (instant || reducedMotion.matches) { x.set(m.left); w.set(m.width); o.set(1); }
      }
      if (reducedMotion.matches) { if (!a) o.set(0); render(); return; }
      if (!frame) frame = requestAnimationFrame(loop);
    };

    // Wrap each label so the line measures the word, not the trailing period.
    links.forEach((a) => {
      const textNode = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!textNode) return;
      const span = document.createElement('span');
      span.className = 'nav-label';
      span.textContent = textNode.textContent;
      a.replaceChild(span, textNode);
      const word = span.textContent;
      const scramble = () => {
        // Lock the width first so the decode never nudges neighbouring links.
        span.style.width = `${span.getBoundingClientRect().width}px`;
        decode(span, word, { duration: 260, stagger: 22, jitter: 40 }).then(() => { span.style.width = ''; });
      };
      a.addEventListener('pointerenter', () => { if (desktop.matches) { go(a); scramble(); } });
      a.addEventListener('focus', () => { if (desktop.matches) { go(a); scramble(); } });
    });
    nav.addEventListener('pointerleave', () => go(home));
    nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) go(home); });

    const place = () => { if (desktop.matches) go(home, true); };
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(place); else place();
    window.addEventListener('resize', place);
  }
})();
