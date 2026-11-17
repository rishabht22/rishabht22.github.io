// Homepage hero: the interactive dot field, and the "I build ___" rotator.
// Each time the word changes, a few hundred dots leave the grid and flow into
// an icon for that word, then flow on into the next one.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.querySelector('.dots');
  const rotator = document.querySelector('.rotator');

  /* ---------- Dot field ---------- */
  let formShape = () => {};
  if (canvas) {
    const hero = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const GAP = 26;
    const REACH = 150;
    let width = 0;
    let height = 0;
    let dots = [];
    const ripples = [];
    const pointer = { x: -1e4, y: -1e4, on: false };
    let shapeOn = false;
    const shape = { x: 0, y: 0, r: 0 };

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
          dots.push({ x, y, dx: 0, dy: 0, px: x, py: y, glow: 0, fade: 1, target: null, k: .055 + Math.random() * .06, phase: Math.random() * 6.28 });
        }
      }
      shapeOn = false;
    };

    /* Icons are drawn once on a small offscreen canvas and sampled into points. */
    const ICONS = {
      'software': (g) => {
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 15;
        g.beginPath();
        g.moveTo(66, 58); g.lineTo(24, 100); g.lineTo(66, 142);
        g.moveTo(116, 44); g.lineTo(84, 156);
        g.moveTo(134, 58); g.lineTo(176, 100); g.lineTo(134, 142);
        g.stroke();
      },
      'ML models': (g) => {
        const layers = [[62, 100, 138], [42, 82, 118, 158], [80, 120]];
        const xs = [36, 100, 164];
        g.lineWidth = 3.2;
        for (let l = 0; l < 2; l += 1) {
          for (const a of layers[l]) for (const b of layers[l + 1]) { g.beginPath(); g.moveTo(xs[l], a); g.lineTo(xs[l + 1], b); g.stroke(); }
        }
        layers.forEach((ys, l) => ys.forEach((y) => { g.beginPath(); g.arc(xs[l], y, 12, 0, Math.PI * 2); g.fill(); }));
      },
      'AI tools': (g) => {
        const star = (cx, cy, r, w) => {
          g.beginPath();
          g.moveTo(cx, cy - r);
          g.quadraticCurveTo(cx + w, cy - w, cx + r, cy);
          g.quadraticCurveTo(cx + w, cy + w, cx, cy + r);
          g.quadraticCurveTo(cx - w, cy + w, cx - r, cy);
          g.quadraticCurveTo(cx - w, cy - w, cx, cy - r);
          g.fill();
        };
        star(88, 112, 74, 12);
        star(160, 44, 28, 5);
        star(162, 160, 16, 3);
      },
      'robots': (g) => {
        g.lineCap = 'round';
        g.lineWidth = 14;
        g.fillRect(28, 166, 84, 20);
        g.beginPath(); g.moveTo(70, 166); g.lineTo(70, 150); g.lineTo(104, 84); g.lineTo(156, 64); g.stroke();
        g.lineWidth = 8;
        g.beginPath(); g.moveTo(156, 64); g.lineTo(182, 46); g.moveTo(156, 64); g.lineTo(184, 88); g.stroke();
        [[70, 150, 15], [104, 84, 13], [156, 64, 11]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
      },
    };
    const cache = {};
    const samplePoints = (key, STEP) => {
      const id = `${key}@${STEP}`;
      if (cache[id]) return cache[id];
      const off = document.createElement('canvas');
      off.width = 200;
      off.height = 200;
      const g = off.getContext('2d');
      g.fillStyle = '#fff';
      g.strokeStyle = '#fff';
      ICONS[key](g);
      const data = g.getImageData(0, 0, 200, 200).data;
      const points = [];
      for (let y = 0; y < 200; y += STEP) {
        for (let x = 0; x < 200; x += STEP) {
          if (data[(y * 200 + x) * 4 + 3] > 120) points.push([x, y]);
        }
      }
      cache[id] = points;
      return points;
    };

    formShape = (key) => {
      if (!ICONS[key] || reducedMotion.matches) return;
      // Wide screens: beside the name. Narrower screens: in the space above it.
      const wide = width >= 1180;
      const size = wide ? Math.min(300, height * .4) : Math.min(190, height * .22, width * .46);
      const cx = wide ? width * .86 : width / 2;
      const cy = wide ? height * .5 : height * .25;
      const scale = size / 200;
      shape.x = cx; shape.y = cy; shape.r = size * .62;
      // Keep about 9px between dots on screen, whatever the icon size.
      const step = Math.max(4, Math.round(9.5 / scale));
      const targets = samplePoints(key, step).map(([x, y]) => ({ x: cx + (x - 100) * scale, y: cy + (y - 100) * scale }));
      // Free every dot, then hand each target to the nearest free dot.
      dots.forEach((d) => { d.target = null; });
      const pool = dots.filter((d) => Math.abs(d.x - cx) < size * 1.6 && Math.abs(d.y - cy) < size * 1.4);
      for (const t of targets) {
        let best = null;
        let bestD = Infinity;
        for (const d of pool) {
          if (d.target) continue;
          const dist = (d.px - t.x) ** 2 + (d.py - t.y) ** 2;
          if (dist < bestD) { bestD = dist; best = d; }
        }
        if (best) best.target = t;
      }
      shapeOn = true;
      wake();
    };
    const release = () => { dots.forEach((d) => { d.target = null; }); shapeOn = false; wake(); };

    let settled = true;
    const draw = (now) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].t > 1600) ripples.splice(i, 1);
      settled = true;
      const t = now / 1000;

      for (const d of dots) {
        let tx = 0;
        let ty = 0;
        let glow = 0;
        const bx = d.target ? d.target.x : d.x;
        const by = d.target ? d.target.y : d.y;

        if (pointer.on) {
          const vx = d.px - pointer.x;
          const vy = d.py - pointer.y;
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
          const vx = d.px - r.x;
          const vy = d.py - r.y;
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
        // Dots in an icon shimmer very slightly so the shape feels alive.
        const shimmer = d.target ? Math.sin(t * 2 + d.phase) * .7 : 0;
        const wantX = bx + d.dx + shimmer;
        const wantY = by + d.dy + (d.target ? Math.cos(t * 2 + d.phase) * .7 : 0);
        const k = d.target ? d.k : Math.max(d.k, .09);
        d.px += (wantX - d.px) * k;
        d.py += (wantY - d.py) * k;
        if (Math.abs(wantX - d.px) > .3 || Math.abs(wantY - d.py) > .3) settled = false;

        const wantGlow = d.target ? .92 : glow;
        d.glow += (wantGlow - d.glow) * .08;

        // Grid dots sitting behind an icon step back so the icon reads clearly.
        const behind = shapeOn && !d.target && Math.hypot(d.px - shape.x, d.py - shape.y) < shape.r;
        d.fade += ((behind ? .18 : 1) - d.fade) * .08;
        const g = d.glow;
        const radius = 1.35 + g * (width >= 1180 ? 1.5 : .9);
        const r = Math.round(92 + (91 - 92) * g);
        const gr = Math.round(92 + (147 - 92) * g);
        const b = Math.round(100 + (255 - 100) * g);
        ctx.fillStyle = `rgba(${r}, ${gr}, ${b}, ${(.6 + g * .4) * d.fade})`;
        ctx.beginPath();
        ctx.arc(d.px, d.py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let running = false;
    let frame = 0;
    let onScreen = true;
    let idleFrames = 0;
    const loop = (now) => {
      draw(now);
      const busy = pointer.on || ripples.length || shapeOn || !settled;
      idleFrames = busy ? 0 : idleFrames + 1;
      if (idleFrames > 60) { running = false; return; }
      frame = window.requestAnimationFrame(loop);
    };
    function wake() {
      if (running || !onScreen || document.hidden || reducedMotion.matches) return;
      running = true;
      idleFrames = 0;
      frame = window.requestAnimationFrame(loop);
    }

    build();
    draw(performance.now());

    // Debug hook for checking shapes frame by frame: add ?debug to the URL.
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__hero = { formShape: (k) => formShape(k), step: (n = 1) => { let t = performance.now(); for (let i = 0; i < n; i += 1) { t += 16.7; draw(t); } }, stats: () => ({ width, dots: dots.length, targeted: dots.filter((d) => d.target).length }) };
    }

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

    /* Intro: the grid's dots stream into the shape of the name, the real
       text materializes from them, then they spill back out with a ripple. */
    const nameEl = document.querySelector('.hero3-name');
    const formName = () => {
      if (!nameEl || !window.textPoints) return false;
      const origin = hero.getBoundingClientRect();
      let step = 5;
      let points = window.textPoints(nameEl, origin, step);
      while (points.length > dots.length * .5 && step < 16) { step += 1; points = window.textPoints(nameEl, origin, step); }
      if (!points.length) return false;
      dots.forEach((d) => { d.target = null; });
      shape.r = 0;
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
      shapeOn = true;
      wake();
      return true;
    };
    const showName = () => nameEl?.classList.add('is-ready');
    const intro = () => {
      if (reducedMotion.matches) { showName(); startRotator(); return; }
      if (!formName()) { showName(); startRotator(); return; }
      window.setTimeout(() => {
        showName();
        release();
        const r = nameEl.getBoundingClientRect();
        const o = hero.getBoundingClientRect();
        ripples.push({ x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2, t: performance.now() });
        wake();
      }, 1500);
      window.setTimeout(() => { formShape('software'); startRotator(); }, 2300);
    };
    const begin = () => window.setTimeout(intro, 180);
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(begin);
    else begin();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) wake();
        else { running = false; window.cancelAnimationFrame(frame); }
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; window.cancelAnimationFrame(frame); } else wake();
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        build();
        draw(performance.now());
        const current = rotator?.querySelector('.is-in')?.textContent;
        if (current) formShape(current);
      }, 150);
    });
  }

  /* ---------- "I build ___" rotator ---------- */
  function startRotator() {
    if (!rotator || reducedMotion.matches || startRotator.started) return;
    startRotator.started = true;
    const words = ['software', 'ML models', 'AI tools', 'robots'];
    let index = 0;
    window.setInterval(() => {
      if (document.hidden) return;
      const existing = Array.from(rotator.querySelectorAll('.rotator-word'));
      const current = existing.find((w) => w.classList.contains('is-in')) || existing[existing.length - 1];
      existing.forEach((w) => { if (w !== current) w.remove(); });

      index = (index + 1) % words.length;
      const next = document.createElement('span');
      next.className = 'rotator-word';
      next.textContent = words[index];
      rotator.append(next);
      rotator.style.width = `${Math.ceil(next.getBoundingClientRect().width)}px`;
      void next.offsetWidth;
      current?.classList.remove('is-in');
      current?.classList.add('is-out');
      next.classList.add('is-in');
      window.setTimeout(() => current?.remove(), 560);
      formShape(words[index]);
    }, 2800);
  }
  if (!canvas) startRotator();
})();
