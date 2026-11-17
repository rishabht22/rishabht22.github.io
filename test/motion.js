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
})();
