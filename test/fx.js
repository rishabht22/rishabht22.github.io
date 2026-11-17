// Homepage effects.
//  - Section titles assemble from a short stream of particles.
//  - A spring-driven rail follows the row you are on in the project and notes lists.
//  - The project preview follows the pointer on springs and tilts with velocity.
//  - Small labels decode (window.Motion.decode).
// No cursor changes of any kind.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const { Spring, decode } = window.Motion || {};
  if (reducedMotion) return;

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
      const delay = (pt.x / span) * 300 + Math.random() * 100;
      return {
        tx: pt.x,
        ty: pt.y,
        sx: pt.x - 90 - Math.random() * 160,
        sy: pt.y + (Math.random() - .5) * 120,
        bend: (Math.random() - .5) * 60,
        delay,
        dur: 380 + Math.random() * 180,
      };
    });
    const total = 300 + 100 + 560;
    const fadeStart = total - 120;
    const fadeLen = 340;
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


  /* ---------- Project preview on springs ---------- */
  // x and y each ride a spring toward the pointer; the tilt is read off the
  // x spring's velocity, so a fast flick leans the card and a slow move doesn't.
  const preview = document.querySelector('.row-preview');
  const previewRows = document.querySelectorAll('.row[data-preview]');
  if (preview && previewRows.length && fine && Spring) {
    preview.classList.add('is-spring');
    const px = new Spring(0, { stiffness: 150, damping: 22 });
    const py = new Spring(0, { stiffness: 150, damping: 22 });
    const ps = new Spring(.86, { stiffness: 220, damping: 26 });
    let on = false;
    let raf = 0;
    let last = 0;
    const tick = (now) => {
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const moving = [px.step(dt), py.step(dt), ps.step(dt)].some(Boolean);
      const tilt = Math.max(-9, Math.min(9, px.velocity * .012));
      preview.style.transform = `translate(${(px.value + 26).toFixed(1)}px, ${(py.value - 104).toFixed(1)}px) rotate(${tilt.toFixed(2)}deg) scale(${ps.value.toFixed(3)})`;
      if (moving || on) raf = requestAnimationFrame(tick); else { raf = 0; last = 0; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    previewRows.forEach((row) => {
      row.addEventListener('mouseenter', (e) => {
        if (preview.getAttribute('src') !== row.dataset.preview) preview.src = row.dataset.preview;
        if (!on) { px.set(e.clientX); py.set(e.clientY); }
        on = true;
        ps.target = 1;
        preview.classList.add('is-on');
        kick();
      });
      row.addEventListener('mousemove', (e) => { px.target = e.clientX; py.target = e.clientY; kick(); });
      row.addEventListener('mouseleave', () => { on = false; ps.target = .86; preview.classList.remove('is-on'); kick(); });
    });
  }

  /* ---------- Rail: a spring marker beside the row you are on ---------- */
  // y and height are springs, so moving between rows glides with momentum and
  // the bar stretches a little mid-move. Works with mouse and keyboard focus.
  if (Spring) {
    document.querySelectorAll('.rows, .notes3').forEach((list) => {
      const rail = document.createElement('span');
      rail.className = 'rail';
      rail.setAttribute('aria-hidden', 'true');
      list.classList.add('has-rail');
      list.append(rail);
      const y = new Spring(0, { stiffness: 210, damping: 25 });
      const h = new Spring(0, { stiffness: 210, damping: 25 });
      const o = new Spring(0, { stiffness: 180, damping: 26 });
      let raf = 0;
      let last = 0;
      let shown = false;
      const tick = (now) => {
        const dt = last ? (now - last) / 1000 : 1 / 60;
        last = now;
        const moving = [y.step(dt), h.step(dt), o.step(dt)].some(Boolean);
        // Stretch slightly with speed, like it is being pulled.
        const stretch = Math.min(18, Math.abs(y.velocity) * .02);
        rail.style.transform = `translateY(${(y.value - stretch / 2).toFixed(1)}px) scaleY(${Math.max(0, h.value + stretch).toFixed(1)})`;
        rail.style.opacity = Math.max(0, Math.min(1, o.value)).toFixed(3);
        if (moving) raf = requestAnimationFrame(tick); else { raf = 0; last = 0; }
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
      const goTo = (li) => {
        const top = li.offsetTop + 14;
        const height = li.offsetHeight - 28;
        if (!shown) { y.set(top); h.set(height); }
        y.target = top;
        h.target = height;
        o.target = 1;
        shown = true;
        kick();
      };
      const hide = () => { o.target = 0; shown = false; kick(); };
      list.querySelectorAll(':scope > li').forEach((li) => {
        const link = li.querySelector('a');
        li.addEventListener('mouseenter', () => goTo(li));
        link?.addEventListener('focus', () => goTo(li));
      });
      list.addEventListener('mouseleave', hide);
      list.addEventListener('focusout', (e) => { if (!list.contains(e.relatedTarget)) hide(); });
    });
  }

  /* ---------- Decode motif on small labels ---------- */
  if (decode) {
    // Column labels decode in once, when they first come into view.
    const labels = document.querySelectorAll('.col-label');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const text = entry.target.textContent;
          entry.target.style.minWidth = `${entry.target.getBoundingClientRect().width}px`;
          decode(entry.target, text, { duration: 520, stagger: 40, jitter: 80 });
        });
      }, { threshold: 1 });
      labels.forEach((l) => io.observe(l));
    }
    // Note dates re-decode when you land on the row.
    document.querySelectorAll('.notes3 a').forEach((a) => {
      const time = a.querySelector('time');
      if (!time) return;
      const text = time.textContent;
      time.style.display = 'inline-block';
      time.style.minWidth = `${time.getBoundingClientRect().width}px`;
      const run = () => decode(time, text, { duration: 300, stagger: 30, jitter: 40 });
      a.addEventListener('mouseenter', run);
      a.addEventListener('focus', run);
    });
  }

  /* ---------- Notes that demonstrate themselves ---------- */
  // Hover or keyboard-focus a note: a small plot computes the note's idea live
  // (see demos.js) and draws it in about a second, then holds still.
  if (window.NoteDemos) {
    document.querySelectorAll('.notes3 a[data-demo]').forEach((a) => {
      const demo = window.NoteDemos.DEMOS[a.dataset.demo];
      if (!demo) return;
      const W = 170;
      const H = 40;
      const wrap = document.createElement('span');
      wrap.className = 'note-demo';
      wrap.setAttribute('aria-hidden', 'true');
      const canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const caption = document.createElement('span');
      caption.className = 'note-demo-caption';
      caption.textContent = demo.caption;
      wrap.append(canvas, caption);
      a.append(wrap);
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);
      let data = null;
      let raf = 0;
      let lastRun = -1e9;
      const run = () => {
        wrap.classList.add('is-on');
        if (performance.now() - lastRun < 2500) return;
        lastRun = performance.now();
        data = data || demo.data();
        cancelAnimationFrame(raf);
        const t0 = performance.now();
        const frame = (now) => {
          const k = Math.min(1, (now - t0) / 1100);
          const p = 1 - (1 - k) ** 3;
          g.clearRect(0, 0, W, H);
          demo.draw(g, W, H, data, p);
          if (k < 1) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      };
      const stop = () => wrap.classList.remove('is-on');
      a.addEventListener('mouseenter', run);
      a.addEventListener('focus', run);
      a.addEventListener('mouseleave', stop);
      a.addEventListener('blur', stop);
    });
  }
})();
