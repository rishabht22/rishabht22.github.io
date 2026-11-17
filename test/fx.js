// Homepage effects: magnetic name, decoding headings, physics project preview,
// copy-email particle burst, cursor spotlight, and scroll progress.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reducedMotion) return;

  /* ---------- Magnetic name: each letter leans toward the cursor ---------- */
  const name = document.querySelector('.hero3-name');
  const hero = document.querySelector('.hero3');
  if (name && hero) {
    const textNode = name.firstChild;
    const word = textNode.textContent;
    name.setAttribute('aria-label', `${word}.`);
    const frag = document.createDocumentFragment();
    const letters = [...word].map((ch, i) => {
      const span = document.createElement('span');
      span.className = 'mag';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--i', i);
      span.textContent = ch;
      frag.append(span);
      return { el: span, x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0, c: 0, tc: 0 };
    });
    name.replaceChild(frag, textNode);
    const dot = name.querySelector('span:not(.mag)');
    if (dot) dot.setAttribute('aria-hidden', 'true');

    let mx = -1e4;
    let my = -1e4;
    let raf = 0;
    let active = false;
    const tick = () => {
      let moving = false;
      letters.forEach((l) => {
        const rect = l.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 - l.x;
        const cy = rect.top + rect.height / 2 - l.y;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.hypot(dx, dy);
        const reach = 260;
        const f = active ? Math.max(0, 1 - dist / reach) : 0;
        const ease = f * f * (3 - 2 * f);
        l.tx = (dx / (dist || 1)) * ease * 14;
        l.ty = (dy / (dist || 1)) * ease * 18 - ease * 6;
        l.tr = (dx / (dist || 1)) * ease * 8;
        l.tc = ease;
        l.x += (l.tx - l.x) * .16;
        l.y += (l.ty - l.y) * .16;
        l.r += (l.tr - l.r) * .16;
        l.c += (l.tc - l.c) * .12;
        l.el.style.transform = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px) rotate(${l.r.toFixed(2)}deg)`;
        l.el.style.setProperty('--heat', l.c.toFixed(3));
        if (Math.abs(l.tx - l.x) > .05 || Math.abs(l.ty - l.y) > .05 || Math.abs(l.tc - l.c) > .005) moving = true;
      });
      raf = moving || active ? window.requestAnimationFrame(tick) : 0;
    };
    if (fine) {
      hero.addEventListener('pointermove', (e) => {
        mx = e.clientX; my = e.clientY; active = true;
        if (!raf) raf = window.requestAnimationFrame(tick);
      });
      hero.addEventListener('pointerleave', () => { active = false; if (!raf) raf = window.requestAnimationFrame(tick); });
    }
  }

  /* ---------- Section titles assemble from a stream of particles ---------- */
  // Each title starts hidden. When it scrolls into view, a stream of tiny blue
  // dots flows in from the left and settles into the exact letter shapes,
  // then the real text fades in and the dots dissolve.
  const assemble = (el) => {
    const box = el.getBoundingClientRect();
    const pad = 40;
    const origin = { left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
    const points = window.textPoints ? window.textPoints(el, origin, 3) : [];
    if (!points.length) { el.classList.remove('assemble-pending'); return; }

    const canvas = document.createElement('canvas');
    canvas.className = 'assemble-canvas';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(origin.width * dpr);
    canvas.height = Math.round(origin.height * dpr);
    canvas.style.width = `${origin.width}px`;
    canvas.style.height = `${origin.height}px`;
    canvas.style.left = `${origin.left + window.scrollX}px`;
    canvas.style.top = `${origin.top + window.scrollY}px`;
    document.body.append(canvas);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const span = origin.width;
    const parts = points.map((pt) => {
      const delay = (pt.x / span) * 520 + Math.random() * 160;
      return {
        tx: pt.x,
        ty: pt.y,
        sx: pt.x - 140 - Math.random() * 260,
        sy: pt.y + (Math.random() - .5) * 120,
        bend: (Math.random() - .5) * 60,
        delay,
        dur: 620 + Math.random() * 260,
      };
    });
    const total = 520 + 160 + 880;
    const fadeStart = total - 120;
    const fadeLen = 520;
    const start = performance.now();
    let revealed = false;
    const ease = (t) => 1 - (1 - t) ** 4;

    const frame = (now) => {
      const t = now - start;
      // Follow the title in case it is still sliding into place.
      const live = el.getBoundingClientRect();
      canvas.style.left = `${live.left - pad + window.scrollX}px`;
      canvas.style.top = `${live.top - pad + window.scrollY}px`;
      g.clearRect(0, 0, origin.width, origin.height);
      const fade = Math.max(0, Math.min(1, (t - fadeStart) / fadeLen));
      if (!revealed && t >= fadeStart) { revealed = true; el.classList.remove('assemble-pending'); }
      for (const p of parts) {
        const k = Math.max(0, Math.min(1, (t - p.delay) / p.dur));
        if (k <= 0) continue;
        const e = ease(k);
        const x = p.sx + (p.tx - p.sx) * e;
        const y = p.sy + (p.ty - p.sy) * e + Math.sin(e * Math.PI) * p.bend;
        // Bright while travelling, settling into a softer blue as it lands.
        const alpha = (k < 1 ? .95 : .8) * (1 - fade);
        g.fillStyle = `rgba(${k < 1 ? '141, 180, 255' : '91, 147, 255'}, ${alpha})`;
        g.fillRect(x - .9, y - .9, 1.8, 1.8);
      }
      if (fade < 1) window.requestAnimationFrame(frame);
      else canvas.remove();
    };
    window.requestAnimationFrame(frame);
  };

  const titles = document.querySelectorAll('.sec-title, .contact3-title');
  if ('IntersectionObserver' in window && titles.length) {
    titles.forEach((t) => t.classList.add('assemble-pending'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const run = () => assemble(entry.target);
        if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(run);
        else run();
      });
    }, { threshold: .5 });
    titles.forEach((t) => io.observe(t));
    // Never leave a title hidden: if anything goes wrong, show it after a while.
    window.addEventListener('load', () => window.setTimeout(() => {
      titles.forEach((t) => { if (t.getBoundingClientRect().top < window.innerHeight && t.classList.contains('assemble-pending') && !document.querySelector('.assemble-canvas')) t.classList.remove('assemble-pending'); });
    }, 6000));
  }

  /* ---------- Project preview: trails the cursor, tilts with velocity ---------- */
  const preview = document.querySelector('.row-preview');
  const rows = document.querySelectorAll('.row[data-preview]');
  if (preview && rows.length && fine) {
    preview.classList.add('is-physics');
    let x = 0; let y = 0; let tx = 0; let ty = 0; let vx = 0; let rot = 0; let scale = .8; let tScale = .8; let on = false; let raf = 0;
    const tick = () => {
      const nx = x + (tx - x) * .14;
      vx = nx - x;
      x = nx;
      y += (ty - y) * .14;
      rot += (Math.max(-14, Math.min(14, vx * .9)) - rot) * .12;
      scale += (tScale - scale) * .15;
      preview.style.transform = `translate(${(x + 28).toFixed(1)}px, ${(y - 110).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      const still = Math.abs(tx - x) < .2 && Math.abs(ty - y) < .2 && Math.abs(rot) < .05 && Math.abs(tScale - scale) < .002;
      raf = on || !still ? window.requestAnimationFrame(tick) : 0;
    };
    rows.forEach((row) => {
      row.addEventListener('mouseenter', (e) => {
        if (preview.getAttribute('src') !== row.dataset.preview) preview.src = row.dataset.preview;
        if (!on) { x = tx = e.clientX; y = ty = e.clientY; }
        on = true; tScale = 1;
        preview.classList.add('is-on');
        if (!raf) raf = window.requestAnimationFrame(tick);
      });
      row.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
      row.addEventListener('mouseleave', () => {
        on = false; tScale = .8;
        preview.classList.remove('is-on');
      });
    });
  }

  /* ---------- Copy email: a burst of blue particles ---------- */
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => {
      const rect = button.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (let i = 0; i < 22; i += 1) {
        const p = document.createElement('span');
        p.className = 'spark';
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;
        document.body.append(p);
        const angle = (Math.PI * 2 * i) / 22 + Math.random() * .4;
        const dist = 40 + Math.random() * 60;
        p.animate([
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(.2)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.22, 1, .36, 1)' }).onfinish = () => p.remove();
      }
    });
    // A little magnetism on the button itself.
    if (fine) {
      const row = button.closest('.email-row') || button;
      row.addEventListener('pointermove', (e) => {
        const r = button.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        button.style.transform = `translate(${(dx * .18).toFixed(1)}px, ${(dy * .25).toFixed(1)}px)`;
      });
      row.addEventListener('pointerleave', () => { button.style.transform = ''; });
    }
  });

  /* ---------- Cursor spotlight + scroll progress ---------- */
  if (fine) {
    const root = document.documentElement;
    let sx = 0; let sy = 0; let raf = 0;
    window.addEventListener('pointermove', (e) => {
      sx = e.clientX; sy = e.clientY;
      if (!raf) raf = window.requestAnimationFrame(() => {
        root.style.setProperty('--sx', `${sx}px`);
        root.style.setProperty('--sy', `${sy}px`);
        raf = 0;
      });
    }, { passive: true });
    document.body.classList.add('has-spotlight');
  }
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
