// Homepage hero.
//  - A field of dots that leans away from the pointer.
//  - On load, the dots stream into the shape of the name, then hand over to
//    the real text and fall back into the grid.
//  - A small planar robot arm (see arm.js) stands in the corner. It reaches
//    toward the pointer, and clicking a dot makes it pick that dot up; the
//    next click places it somewhere else. The grid remembers.
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

    /* ---------- Arm ---------- */
    let arm = null;
    let armState = 'rest'; // rest | track | reach | carry | place
    let held = null;       // the dot in the gripper
    let pending = null;    // the dot we are reaching for
    let grip = 1;          // gripper opening, 1 open -> 0 closed (spring below)
    let gripV = 0;
    let gripT = 1;

    const restPoint = () => {
      const R = arm.reach;
      return { x: arm.base.x - R * .34, y: arm.base.y - R * .3 };
    };
    const buildArm = () => {
      const wide = width >= 900;
      const scale = wide ? height : Math.min(width * 1.25, height * .72);
      const lengths = wide ? [.24, .2, .085] : [.24, .2, .09];
      const base = wide ? { x: width * .79, y: height - 64 } : { x: width - 22, y: height - 92 };
      const prev = arm;
      arm = new window.Arm(base, lengths.map((f) => f * scale), { floor: base.y - 4 });
      if (prev) { arm.q = prev.q.slice(); arm.qd = prev.qd.map(() => 0); }
      arm.setTarget(held ? arm.effector() : restPoint());
    };
    const setTarget = (p) => { if (arm) arm.setTarget(p); };

    const build = () => {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      held = null;
      pending = null;
      const ox = (width % GAP) / 2;
      const oy = (height % GAP) / 2;
      for (let y = oy; y <= height; y += GAP) {
        for (let x = ox; x <= width; x += GAP) {
          dots.push({ x, y, dx: 0, dy: 0, px: x, py: y, glow: 0, target: null, k: .07 + Math.random() * .05, moved: false });
        }
      }
      if (window.Arm) buildArm();
    };

    /* ---------- Drawing ---------- */
    const drawArm = () => {
      if (!arm) return;
      const pts = arm.fk();
      const n = pts.length - 1;
      // Faint workspace while you are interacting with it.
      if (armState !== 'rest') {
        ctx.strokeStyle = 'rgba(122, 122, 130, .12)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(arm.base.x, arm.base.y, arm.reach, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Base mount.
      ctx.fillStyle = '#1B1B1D';
      ctx.strokeStyle = 'rgba(166, 166, 173, .5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(arm.base.x - 22, arm.base.y - 8, 44, 8);
      ctx.fill();
      ctx.stroke();
      // Links.
      ctx.strokeStyle = 'rgba(210, 210, 216, .85)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= n; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      // Joints.
      for (let i = 0; i < n; i += 1) {
        ctx.fillStyle = '#0E0E0F';
        ctx.strokeStyle = 'rgba(200, 200, 207, .8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, i === 0 ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Gripper: two fingers that open and close.
      const tip = pts[n];
      const a = Math.atan2(tip.y - pts[n - 1].y, tip.x - pts[n - 1].x);
      const spread = .18 + grip * .42;
      ctx.strokeStyle = held ? 'rgba(141, 180, 255, .95)' : 'rgba(200, 200, 207, .8)';
      ctx.lineWidth = 1.6;
      for (const side of [-1, 1]) {
        const fa = a + side * spread;
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x + Math.cos(fa) * 11, tip.y + Math.sin(fa) * 11);
        ctx.stroke();
      }
    };

    const drawReadout = () => {
      if (!arm) return;
      const deg = (r) => `${Math.round((r * 180) / Math.PI)}°`.padStart(5, ' ');
      const label = {
        rest: held ? 'holding a dot · click to place' : 'click a dot',
        track: held ? 'holding a dot · click to place' : 'tracking · click a dot',
        reach: 'reaching',
        carry: 'holding a dot · click to place',
        place: 'placing',
      }[armState];
      ctx.font = '10.5px "Geist Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(122, 122, 130, .9)';
      ctx.textAlign = 'right';
      const x = arm.base.x - 34;
      ctx.fillText(`q = [${arm.q.map(deg).join(' ')} ]`, x, arm.base.y - 16);
      ctx.fillText(label, x, arm.base.y - 2);
      ctx.textAlign = 'left';
    };

    let settled = true;
    const draw = (now) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].t > 1400) ripples.splice(i, 1);
      settled = true;
      const tip = arm ? arm.effector() : null;

      for (const d of dots) {
        if (d === held && tip) {
          d.px = tip.x; d.py = tip.y; d.glow = 1;
        } else {
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
          if (d === pending) glow = Math.max(glow, .9);
          d.dx += (tx - d.dx) * .14;
          d.dy += (ty - d.dy) * .14;
          const bx = d.target ? d.target.x : d.x;
          const by = d.target ? d.target.y : d.y;
          const k = d.target ? d.k : Math.max(d.k, .1);
          d.px += (bx + d.dx - d.px) * k;
          d.py += (by + d.dy - d.py) * k;
          if (Math.abs(bx + d.dx - d.px) > .3 || Math.abs(by + d.dy - d.py) > .3) settled = false;
          const wantGlow = d.target ? .92 : Math.max(glow, d.moved ? .35 : 0);
          d.glow += (wantGlow - d.glow) * .1;
        }
        const g = d.glow;
        const r = Math.round(92 + (91 - 92) * g);
        const gr = Math.round(92 + (147 - 92) * g);
        const b = Math.round(100 + (255 - 100) * g);
        ctx.fillStyle = `rgba(${r}, ${gr}, ${b}, ${.6 + g * .4})`;
        ctx.beginPath();
        ctx.arc(d.px, d.py, 1.35 + g * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!introOn) { drawArm(); drawReadout(); }
    };

    /* ---------- Arm state machine ---------- */
    const nearestDot = (x, y, maxDist) => {
      let best = null;
      let bestD = maxDist * maxDist;
      for (const d of dots) {
        const dist = (d.px - x) ** 2 + (d.py - y) ** 2;
        if (dist < bestD) { bestD = dist; best = d; }
      }
      return best;
    };
    const inReach = (p) => arm && Math.hypot(p.x - arm.base.x, p.y - arm.base.y) < arm.reach * .97 && p.y < arm.base.y - 10;

    const updateArm = (dt) => {
      if (!arm || introOn) return false;
      const moving = arm.step(dt);
      // Gripper opening is its own little spring.
      const ga = -320 * (grip - gripT) - 30 * gripV;
      gripV += ga * dt;
      grip += gripV * dt;
      const tip = arm.effector();
      const close = (p) => Math.hypot(tip.x - p.x, tip.y - p.y) < 3 && Math.max(...arm.qd.map(Math.abs)) < .25;

      if (armState === 'reach' && pending && close({ x: pending.px, y: pending.py })) {
        held = pending;
        pending = null;
        gripT = 0;
        armState = pointer.on ? 'track' : 'carry';
        if (!pointer.on) setTarget(restPoint());
      } else if (armState === 'place' && held && close(arm.target)) {
        held.x = tip.x;
        held.y = tip.y;
        held.dx = 0; held.dy = 0;
        held.moved = true;
        held = null;
        gripT = 1;
        armState = pointer.on ? 'track' : 'rest';
        if (!pointer.on) setTarget(restPoint());
      }
      return moving || Math.abs(grip - gripT) > .01 || armState === 'reach' || armState === 'place';
    };

    /* ---------- Loop ---------- */
    let running = false;
    let frame = 0;
    let onScreen = true;
    let idleFrames = 0;
    let last = 0;
    const loop = (now) => {
      const dt = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
      last = now;
      const armBusy = updateArm(dt);
      draw(now);
      const busy = pointer.on || ripples.length || introOn || !settled || armBusy;
      idleFrames = busy ? 0 : idleFrames + 1;
      if (idleFrames > 30) { running = false; last = 0; return; }
      frame = window.requestAnimationFrame(loop);
    };
    function wake() {
      if (running || !onScreen || document.hidden) return;
      if (reducedMotion.matches) { draw(performance.now()); return; }
      running = true;
      idleFrames = 0;
      frame = window.requestAnimationFrame(loop);
    }

    build();
    draw(performance.now());

    /* ---------- Input ---------- */
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = local(e);
      pointer.x = p.x; pointer.y = p.y; pointer.on = true;
      if (!introOn && (armState === 'rest' || armState === 'track' || armState === 'carry')) {
        armState = 'track';
        setTarget(p);
      }
      wake();
    });
    hero.addEventListener('pointerleave', () => {
      pointer.on = false;
      if (armState === 'track' || armState === 'carry') { armState = held ? 'carry' : 'rest'; setTarget(restPoint()); }
      wake();
    });
    hero.addEventListener('pointerdown', (e) => {
      if (introOn || e.target.closest('a, button') || !arm) return;
      const p = local(e);
      if (held) {
        if (!inReach(p)) return;
        armState = 'place';
        setTarget(p);
      } else {
        const d = nearestDot(p.x, p.y, 22);
        if (!d || !inReach({ x: d.px, y: d.py })) return;
        pending = d;
        armState = 'reach';
        setTarget({ x: d.px, y: d.py });
      }
      wake();
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

    // Debug hook for stepping the scene by hand: add ?debug to the URL.
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__hero = {
        step: (n = 1) => { for (let i = 0; i < n; i += 1) { updateArm(1 / 60); draw(performance.now()); } },
        state: () => ({ armState, holding: !!held, tip: arm && arm.effector(), q: arm && arm.q, reach: arm && arm.reach, base: arm && arm.base, moved: dots.filter((d) => d.moved).length }),
        click: (x, y) => hero.dispatchEvent(new PointerEvent('pointerdown', { clientX: canvas.getBoundingClientRect().left + x, clientY: canvas.getBoundingClientRect().top + y, bubbles: true })),
        dotNear: (x, y) => { const d = nearestDot(x, y, 40); return d && { x: d.px, y: d.py }; },
      };
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) wake(); else { running = false; last = 0; window.cancelAnimationFrame(frame); }
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; last = 0; window.cancelAnimationFrame(frame); } else wake();
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { build(); armState = 'rest'; wake(); }, 150);
    });
  }

  /* ---------- "I build ___" decodes between words ---------- */
  startRotator = () => {
    if (!rotator || reducedMotion.matches || startRotator.started || !decode) return;
    startRotator.started = true;
    const word = rotator.querySelector('.rotator-word');
    const words = ['software', 'ML models', 'AI tools', 'robots'];
    let index = 0;
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(rotator);
    window.setInterval(() => {
      if (document.hidden || !visible) return;
      index = (index + 1) % words.length;
      decode(word, words[index], { duration: 380, stagger: 34, jitter: 50 });
    }, 3000);
  };
  if (!canvas) startRotator();
})();
