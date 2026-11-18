// Homepage hero.
//  - A field of dots that leans away from the pointer.
//  - On load, the dots stream into the shape of the name, then hand over to
//    the real text and fall back into the grid.
//  - "I build ___" decodes from one word to the next.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.querySelector('.dots');
  const rotator = document.querySelector('.rotator');
  const { decode } = window.Motion || {};

  let startRotator = () => {};

  if (canvas) {
    const hero = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const GAP = 26;
    const REACH = 120;
    let width = 0;
    let height = 0;
    let dots = [];
    const ripples = [];
    const pointer = { x: -1e4, y: -1e4, on: false };
    let introOn = false;

    const build = () => {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const ox = (width % GAP) / 2;
      const oy = (height % GAP) / 2;
      for (let y = oy; y <= height; y += GAP) {
        for (let x = ox; x <= width; x += GAP) {
          dots.push({ x, y, dx: 0, dy: 0, px: x, py: y, glow: 0, target: null, k: .07 + Math.random() * .05 });
        }
      }
    };

    let settled = true;
    const draw = (now) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].t > 1400) ripples.splice(i, 1);
      settled = true;

      for (const d of dots) {
        let tx = 0;
        let ty = 0;
        let glow = 0;
        if (pointer.on) {
          const vx = d.px - pointer.x;
          const vy = d.py - pointer.y;
          const dist = Math.hypot(vx, vy);
          if (dist < REACH && dist > .01) {
            const f = (1 - dist / REACH) ** 2;
            tx += (vx / dist) * f * 14;
            ty += (vy / dist) * f * 14;
            glow = Math.max(glow, f * .8);
          }
        }
        for (const r of ripples) {
          const age = (now - r.t) / 1400;
          const radius = age * Math.max(width, height) * .7;
          const vx = d.px - r.x;
          const vy = d.py - r.y;
          const dist = Math.hypot(vx, vy) || 1;
          const band = 1 - Math.abs(dist - radius) / 40;
          if (band > 0) {
            const f = band * (1 - age);
            tx += (vx / dist) * f * 10;
            ty += (vy / dist) * f * 10;
            glow = Math.max(glow, f);
          }
        }
        d.dx += (tx - d.dx) * .14;
        d.dy += (ty - d.dy) * .14;
        const bx = d.target ? d.target.x : d.x;
        const by = d.target ? d.target.y : d.y;
        const k = d.target ? d.k : Math.max(d.k, .1);
        d.px += (bx + d.dx - d.px) * k;
        d.py += (by + d.dy - d.py) * k;
        if (Math.abs(bx + d.dx - d.px) > .3 || Math.abs(by + d.dy - d.py) > .3) settled = false;
        const wantGlow = d.target ? .92 : glow;
        d.glow += (wantGlow - d.glow) * .1;
        const g = d.glow;
        const r = Math.round(92 + (91 - 92) * g);
        const gr = Math.round(92 + (147 - 92) * g);
        const b = Math.round(100 + (255 - 100) * g);
        ctx.fillStyle = `rgba(${r}, ${gr}, ${b}, ${.6 + g * .4})`;
        ctx.beginPath();
        ctx.arc(d.px, d.py, 1.35 + g * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /* ---------- Loop ---------- */
    let running = false;
    let frame = 0;
    let onScreen = true;
    let idleFrames = 0;
    const loop = (now) => {
      draw(now);
      const busy = ripples.length || introOn || !settled;
      idleFrames = busy ? 0 : idleFrames + 1;
      if (idleFrames > 30) { running = false; return; }
      frame = window.requestAnimationFrame(loop);
    };
    function wake() {
      if (running || !onScreen || document.hidden || hero.classList.contains('is-moving-text')) return;
      if (reducedMotion.matches) {
        draw(performance.now());
        return;
      }
      running = true;
      idleFrames = 0;
      frame = window.requestAnimationFrame(loop);
    }

    build();
    draw(performance.now());

    /* ---------- Input ---------- */
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reducedMotion.matches || hero.classList.contains('is-moving-text')) return;
      const p = local(e);
      pointer.x = p.x; pointer.y = p.y; pointer.on = true;
      wake();
    });
    hero.addEventListener('pointerleave', () => {
      pointer.on = false;
      wake();
    });

    // Keep the dot field still while the foreground text is moving.
    hero.addEventListener('hero-move-state', () => {
      if (hero.classList.contains('is-moving-text')) {
        pointer.on = false;
        running = false;
        cancelAnimationFrame(frame);
      } else wake();
    });

    /* ---------- Intro: the dots spell the name ---------- */
    const nameEl = document.querySelector('.hero3-name');
    const formName = () => {
      if (!nameEl || !window.textPoints) return false;
      const origin = hero.getBoundingClientRect();
      let step = 5;
      let points = window.textPoints(nameEl, origin, step);
      while (points.length > dots.length * .5 && step < 16) { step += 1; points = window.textPoints(nameEl, origin, step); }
      if (!points.length) return false;
      for (const t of points) {
        let best = null;
        let bestD = Infinity;
        for (const d of dots) {
          if (d.target) continue;
          const dist = (d.px - t.x) ** 2 + (d.py - t.y) ** 2;
          if (dist < bestD) { bestD = dist; best = d; }
        }
        if (best) best.target = { x: t.x, y: t.y };
      }
      introOn = true;
      wake();
      return true;
    };
    const showName = () => nameEl?.classList.add('is-ready');
    const intro = () => {
      if (reducedMotion.matches || !formName()) { showName(); startRotator(); wake(); return; }
      window.setTimeout(() => {
        showName();
        dots.forEach((d) => { d.target = null; });
        introOn = false;
        const r = nameEl.getBoundingClientRect();
        const o = hero.getBoundingClientRect();
        ripples.push({ x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2, t: performance.now() });
        startRotator();
        wake();
      }, 1100);
    };
    const begin = () => window.setTimeout(intro, 120);
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(begin); else begin();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) wake(); else { running = false; window.cancelAnimationFrame(frame); }
      }).observe(hero);
    }
    reducedMotion.addEventListener('change', () => {
      running = false;
      window.cancelAnimationFrame(frame);
      wake();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; window.cancelAnimationFrame(frame); } else wake();
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { build(); wake(); }, 150);
    });
  }

  /* ---------- "I build ___" decodes between words ---------- */
  startRotator = () => {
    if (!rotator || reducedMotion.matches || startRotator.started || !decode) return;
    startRotator.started = true;
    const word = rotator.querySelector('.rotator-word');
    const hero = rotator.closest('.hero3');
    const words = ['software', 'ML models', 'AI tools', 'robots'];
    let index = 0;
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(rotator);
    hero?.addEventListener('reset-hero-text', () => {
      index = 0;
      decode(word, words[0], { duration: 0, stagger: 0, jitter: 0 });
    });
    window.setInterval(() => {
      if (document.hidden || !visible || hero?.classList.contains('is-moving-text') || rotator.closest('.arm-displaced')) return;
      index = (index + 1) % words.length;
      decode(word, words[index], { duration: 380, stagger: 34, jitter: 50 });
    }, 3000);
  };
  if (!canvas) startRotator();
})();
