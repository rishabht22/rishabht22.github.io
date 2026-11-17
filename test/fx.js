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

  /* ---------- Section titles decode from random glyphs ---------- */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const decode = (el) => {
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const final = node.textContent;
    const start = performance.now();
    const duration = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      let out = '';
      for (let i = 0; i < final.length; i += 1) {
        const ch = final[i];
        const reveal = i / final.length;
        if (ch === ' ' || p >= reveal * .7 + .3) out += ch;
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      node.textContent = out;
      if (p < 1) window.requestAnimationFrame(step);
      else node.textContent = final;
    };
    window.requestAnimationFrame(step);
  };
  const titles = document.querySelectorAll('.sec-title, .contact3-title');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        decode(entry.target);
      });
    }, { threshold: .6 });
    titles.forEach((t) => io.observe(t));
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
