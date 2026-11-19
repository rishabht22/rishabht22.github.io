// Homepage hero.
//  - A field of dots that drifts right and leans away from the pointer.
//  - On load, the dots stream into the shape of the name, then hand over to
//    the real text and send a wave through the grid.
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
    const DRIFT_SPEED = 6; // CSS pixels per second
    const BURST_DURATION = 1550;
    const waveButton = hero.querySelector('.dot-wave-button');
    let width = 0;
    let height = 0;
    let fieldWidth = 0;
    let wrapRight = 0;
    let dots = [];
    let burst = null;
    const pointer = { x: -1e4, y: -1e4, on: false };
    let press = null;
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
      // Recycle columns beyond the reach of visible dot displacement.
      const wrapLeft = ox - 2 * GAP;
      fieldWidth = (Math.ceil(width / GAP) + 4) * GAP;
      wrapRight = wrapLeft + fieldWidth;
      for (let y = oy; y <= height; y += GAP) {
        for (let x = wrapLeft; x < wrapRight; x += GAP) {
          dots.push({ x, y, dx: 0, dy: 0, px: x, py: y, glow: 0, target: null, k: .07 + Math.random() * .05 });
        }
      }
    };

    const startWave = (x, y, { strength = 1, spin = 1, range = Infinity } = {}) => {
      if (reducedMotion.matches || introOn || hero.classList.contains('is-moving-text')) return;
      x = Math.max(0, Math.min(x, width));
      y = Math.max(0, Math.min(y, height));
      const farthestCorner = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
      const travel = Math.min(farthestCorner, range) + 7 * GAP;
      const duration = Math.min(BURST_DURATION, 450 + travel);
      burst = { x, y, travel, duration, strength, spin, startedAt: performance.now() };
      wake();
    };

    const draw = (now, drift = 0) => {
      ctx.clearRect(0, 0, width, height);
      if (burst && now - burst.startedAt >= burst.duration) burst = null;
      const radius = burst ? (now - burst.startedAt) / burst.duration * burst.travel : 0;
      const radial = press ? -27 : 14;
      const tangent = press ? press.spin * 43 : 0;

      for (const d of dots) {
        if (drift) {
          const shift = d.x + drift >= wrapRight ? drift - fieldWidth : drift;
          d.x += shift;
          d.px += shift;
        }
        let tx = 0;
        let ty = 0;
        let glow = 0;
        if (press || pointer.on) {
          const vx = d.px - pointer.x;
          const vy = d.py - pointer.y;
          const dist = Math.hypot(vx, vy);
          if (dist < REACH && dist > .01) {
            const falloff = (1 - dist / REACH) ** 2;
            const force = falloff / dist;
            tx += (vx * radial - vy * tangent) * force;
            ty += (vy * radial + vx * tangent) * force;
            glow = falloff * (press ? 1 : .8);
          }
        }
        if (burst) {
          const vx = d.x - burst.x;
          const vy = d.y - burst.y;
          const dist = Math.hypot(vx, vy) || 1;
          const wake = (radius - dist) / GAP;
          const crest = Math.max(0, 1 - Math.abs(wake) / 3.5) ** 2;
          const rebound = Math.max(0, 1 - Math.abs(wake - 4) / 3) ** 2;
          const strength = burst.strength * (1 - .38 * Math.min(dist / burst.travel, 1));
          const outward = (52 * crest - 19 * rebound) * strength;
          const sideways = (37 * crest + 10 * rebound) * strength * burst.spin;
          tx += (vx * outward - vy * sideways) / dist;
          ty += (vy * outward + vx * sideways) / dist;
          glow = Math.max(glow, .88 * crest * strength, .35 * rebound * strength);
        }
        d.dx += (tx - d.dx) * .14;
        d.dy += (ty - d.dy) * .14;
        const bx = d.target ? d.target.x : d.x;
        const by = d.target ? d.target.y : d.y;
        const k = d.target ? d.k : Math.max(d.k, .1);
        d.px += (bx + d.dx - d.px) * k;
        d.py += (by + d.dy - d.py) * k;
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
    let lastFrame = null;
    const loop = (now) => {
      if (reducedMotion.matches) { renderStatic(); return; }
      const elapsed = lastFrame === null ? 0 : Math.min(now - lastFrame, 50);
      lastFrame = now;
      draw(now, introOn ? 0 : DRIFT_SPEED * elapsed / 1000);
      frame = window.requestAnimationFrame(loop);
    };
    const pause = () => {
      press = null;
      pointer.on = false;
      running = false;
      window.cancelAnimationFrame(frame);
    };
    const renderStatic = () => {
      pause();
      burst = null;
      introOn = false;
      showName();
      build();
      draw(performance.now());
    };
    function wake() {
      if (running || !onScreen || document.hidden || hero.classList.contains('is-moving-text')) return;
      if (reducedMotion.matches) {
        draw(performance.now());
        return;
      }
      running = true;
      lastFrame = null;
      frame = window.requestAnimationFrame(loop);
    }

    build();
    draw(performance.now());

    /* ---------- Input ---------- */
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    document.addEventListener('pointermove', (e) => {
      if (!e.isPrimary || reducedMotion.matches || hero.classList.contains('is-moving-text')) return;
      if (press?.id === e.pointerId && e.pointerType === 'mouse' && !(e.buttons & 1)) press = null;
      const inside = hero.contains(e.target);
      if (press ? press.id !== e.pointerId : e.pointerType !== 'mouse' || !inside) return;
      const { x, y } = local(e);
      if (press && Math.abs(x - press.lastX) > 8) {
        press.spin = Math.sign(x - press.lastX);
        press.lastX = x;
      }
      Object.assign(pointer, { x, y, on: e.pointerType === 'mouse' && inside });
      wake();
    });
    hero.addEventListener('pointerleave', () => { pointer.on = false; });
    hero.addEventListener('pointerdown', (e) => {
      if (press || !e.isPrimary || e.button !== 0 || reducedMotion.matches || waveButton?.hidden ||
          hero.classList.contains('is-moving-text') || e.target.closest('a, button, [data-move-text]')) return;
      const { x, y } = local(e);
      Object.assign(pointer, { x, y, on: e.pointerType === 'mouse' });
      press = { id: e.pointerId, x, y, lastX: x, spin: 1 };
    });
    document.addEventListener('pointerup', (e) => {
      if (press?.id !== e.pointerId) return;
      const { x, y } = local(e);
      const strength = .7 + .3 * Math.min(Math.hypot(x - press.x, y - press.y) / 150, 1);
      const spin = press.spin;
      press = null;
      pointer.on = e.pointerType === 'mouse' && x >= 0 && x <= width && y >= 0 && y <= height;
      startWave(x, y, { strength, spin });
    });
    document.addEventListener('pointercancel', (e) => { if (press?.id === e.pointerId) press = null; });
    window.addEventListener('blur', () => { press = null; pointer.on = false; });
    waveButton?.addEventListener('click', () => {
      const r = waveButton.getBoundingClientRect();
      const { x, y } = local({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      startWave(x, y, { strength: .88 });
    });
    hero.addEventListener('hero-text-placed', ({ detail }) => {
      startWave(detail.x, detail.y, { strength: .53, range: 175 });
    });

    // Keep the dot field still while the foreground text is moving.
    hero.addEventListener('hero-move-state', () => {
      const movingText = hero.classList.contains('is-moving-text');
      if (waveButton) waveButton.disabled = movingText;
      if (movingText) pause(); else wake();
    });

    /* ---------- Intro: the dots spell the name ---------- */
    const nameEl = document.querySelector('.hero3-name');
    const formName = () => {
      if (!nameEl || !window.textPoints) return false;
      const origin = hero.getBoundingClientRect();
      const visibleDots = dots.filter((d) => d.px >= 0 && d.px <= width);
      let step = 5;
      let points = window.textPoints(nameEl, origin, step);
      while (points.length > visibleDots.length * .5 && step < 16) { step += 1; points = window.textPoints(nameEl, origin, step); }
      if (!points.length) return false;
      for (const t of points) {
        let best = null;
        let bestD = Infinity;
        for (const d of visibleDots) {
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
    const showName = () => {
      nameEl?.classList.add('is-ready');
      if (waveButton) waveButton.hidden = false;
    };
    const intro = () => {
      if (reducedMotion.matches || nameEl?.classList.contains('is-ready') || !formName()) {
        showName();
        startRotator();
        wake();
        return;
      }
      window.setTimeout(() => {
        if (!introOn) return;
        showName();
        dots.forEach((d) => { d.target = null; });
        introOn = false;
        const r = nameEl.getBoundingClientRect();
        const { x, y } = local({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
        startWave(x, y);
        startRotator();
        wake();
      }, 1100);
    };
    const begin = () => window.setTimeout(intro, 120);
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(begin); else begin();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) wake(); else pause();
      }).observe(hero);
    }
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) { renderStatic(); return; }
      if (nameEl?.classList.contains('is-ready')) startRotator();
      wake();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else wake();
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { burst = null; build(); wake(); }, 150);
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
      word.textContent = words[0];
    });
    window.setInterval(() => {
      if (document.hidden || !visible || reducedMotion.matches) return;
      index = (index + 1) % words.length;
      decode(word, words[index], { duration: 380, stagger: 34, jitter: 50 });
    }, 3000);
  };
  if (!canvas) startRotator();
})();
