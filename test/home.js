// Homepage: rotating words under the name, and the interactive dot field.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* "I build ___" word rotator. */
  const rotator = document.querySelector('.rotator');
  if (rotator && !reducedMotion.matches) {
    const words = ['software', 'ML models', 'AI tools', 'robots', 'things that work'];
    let index = 0;
    window.setInterval(() => {
      const current = rotator.querySelector('.is-in');
      index = (index + 1) % words.length;
      const next = document.createElement('span');
      next.className = 'rotator-word';
      next.textContent = words[index];
      rotator.append(next);
      // Size the slot to the incoming word so the sentence never jumps mid-swap.
      rotator.style.width = `${next.offsetWidth}px`;
      window.requestAnimationFrame(() => {
        current?.classList.replace('is-in', 'is-out');
        next.classList.add('is-in');
      });
      window.setTimeout(() => current?.remove(), 600);
    }, 2400);
  }

  /* Dot field: dots lean away from the cursor; a click sends out a ripple. */
  const canvas = document.querySelector('.dots');
  if (!canvas) return;
  const hero = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const GAP = 26;
  const REACH = 150;
  let width = 0;
  let height = 0;
  let dots = [];
  const ripples = [];
  const pointer = { x: -1e4, y: -1e4, on: false };

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
      for (let x = ox; x <= width; x += GAP) dots.push({ x, y, dx: 0, dy: 0, glow: 0 });
    }
  };

  const draw = (now) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].t > 1600) ripples.splice(i, 1);

    for (const d of dots) {
      let tx = 0;
      let ty = 0;
      let glow = 0;

      if (pointer.on) {
        const vx = d.x - pointer.x;
        const vy = d.y - pointer.y;
        const dist = Math.hypot(vx, vy);
        if (dist < REACH && dist > .01) {
          const f = (1 - dist / REACH) ** 2;
          tx += (vx / dist) * f * 22;
          ty += (vy / dist) * f * 22;
          glow = Math.max(glow, f);
        }
      }
      for (const r of ripples) {
        const age = (now - r.t) / 1600;
        const radius = age * Math.max(width, height) * .75;
        const vx = d.x - r.x;
        const vy = d.y - r.y;
        const dist = Math.hypot(vx, vy) || 1;
        const band = 1 - Math.abs(dist - radius) / 46;
        if (band > 0) {
          const f = band * (1 - age);
          tx += (vx / dist) * f * 14;
          ty += (vy / dist) * f * 14;
          glow = Math.max(glow, f);
        }
      }

      d.dx += (tx - d.dx) * .14;
      d.dy += (ty - d.dy) * .14;
      d.glow += (glow - d.glow) * .12;

      const g = d.glow;
      const radius = 1.35 + g * 1.7;
      // Grey dots warming to electric blue near the cursor or a ripple.
      const r = Math.round(92 + (91 - 92) * g);
      const gr = Math.round(92 + (147 - 92) * g);
      const b = Math.round(100 + (255 - 100) * g);
      ctx.fillStyle = `rgba(${r}, ${gr}, ${b}, ${.6 + g * .4})`;
      ctx.beginPath();
      ctx.arc(d.x + d.dx, d.y + d.dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  let running = false;
  let frame = 0;
  let onScreen = true;
  let idleFrames = 0;
  const loop = (now) => {
    draw(now);
    // Go to sleep once everything has settled and nothing is happening.
    const busy = pointer.on || ripples.length;
    idleFrames = busy ? 0 : idleFrames + 1;
    if (idleFrames > 90) { running = false; return; }
    frame = window.requestAnimationFrame(loop);
  };
  const wake = () => {
    if (running || !onScreen || document.hidden || reducedMotion.matches) return;
    running = true;
    idleFrames = 0;
    frame = window.requestAnimationFrame(loop);
  };

  build();
  draw(performance.now());

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.on = true;
    wake();
  });
  hero.addEventListener('pointerleave', () => { pointer.on = false; wake(); });
  hero.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    const rect = canvas.getBoundingClientRect();
    ripples.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() });
    if (ripples.length > 4) ripples.shift();
    wake();
  });

  // A single ripple from the name on load, as a hello.
  if (!reducedMotion.matches) {
    window.setTimeout(() => {
      ripples.push({ x: width / 2, y: height / 2, t: performance.now() });
      wake();
    }, 650);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (!onScreen) { running = false; window.cancelAnimationFrame(frame); }
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { running = false; window.cancelAnimationFrame(frame); } });
  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { build(); draw(performance.now()); }, 150);
  });
})();
