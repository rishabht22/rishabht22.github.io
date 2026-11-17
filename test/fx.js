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

})();
