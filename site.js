// Small, dependency-free interactions shared by every page.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* Header: translucent background once the page scrolls, compact menu on mobile. */
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.site-nav');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  if (header && menuButton && nav) {
    const setOpen = (open) => {
      header.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.querySelector('.menu-text').textContent = open ? 'Close' : 'Menu';
    };
    menuButton.addEventListener('click', () => setOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); menuButton.focus(); }
    });
    window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches) setOpen(false); });
  }

  /* Active section indicator on the homepage. */
  const sectionLinks = Array.from(document.querySelectorAll('.site-nav a[data-section]'));
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(sectionLinks.map((link) => [link.dataset.section, link]));
    const visible = new Map();
    const update = () => {
      let current = null;
      let best = 0;
      visible.forEach((ratio, id) => { if (ratio > best) { best = ratio; current = id; } });
      sectionLinks.forEach((link) => {
        if (link.dataset.section === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
        else visible.delete(entry.target.id);
      });
      update();
    }, { rootMargin: '-35% 0px -50% 0px', threshold: [0, .25, .5, 1] });
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
  }

  /* Reveal sections once as they enter the viewport. */
  const revealables = document.querySelectorAll('[data-reveal]');
  if (revealables.length) {
    if (!('IntersectionObserver' in window) || reducedMotion.matches) {
      revealables.forEach((el) => el.classList.add('is-visible'));
    } else {
      const revealer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      revealables.forEach((el) => revealer.observe(el));
    }
  }

  /* Project previews: play the muted demo on hover, where hover exists. */
  document.querySelectorAll('[data-hover-video]').forEach((card) => {
    const media = card.querySelector('.feature-media');
    const video = card.querySelector('video');
    if (!media || !video) return;
    let loaded = false;
    const start = () => {
      if (!canHover.matches || reducedMotion.matches) return;
      if (!loaded) { video.src = video.dataset.src; loaded = true; }
      const playing = video.play();
      if (playing) playing.then(() => media.classList.add('is-playing')).catch(() => {});
    };
    const stop = () => {
      media.classList.remove('is-playing');
      video.pause();
    };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('focus', start);
    card.addEventListener('blur', stop);
  });

  /* Click to copy the email address. */
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.querySelector('.copy-label');
    const status = document.getElementById(button.getAttribute('aria-describedby') || '');
    let timer;
    button.addEventListener('click', async () => {
      const value = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'absolute';
        field.style.left = '-9999px';
        document.body.append(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      button.classList.add('is-copied');
      if (label) label.textContent = 'Copied';
      if (status) status.textContent = 'Email address copied to clipboard.';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.classList.remove('is-copied');
        if (label) label.textContent = 'Copy';
        if (status) status.textContent = '';
      }, 1800);
    });
  });

  /* Footer clock: what time it is in Berkeley right now. */
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const format = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
    const tick = () => { clock.textContent = `${format.format(new Date())} in Berkeley`; };
    tick();
    window.setInterval(tick, 30000);
  }

  /* fig. 0: a small, illustrative picture of decentralized coordination. */
  const figure = document.querySelector('.figure-0');
  if (figure) {
    const svg = figure.querySelector('svg');
    const frame = figure.querySelector('.figure-0-frame');
    const readout = figure.querySelector('.readout');
    const defaultReadout = readout ? readout.textContent : '';
    const RANGE = 205;
    const agents = Array.from(svg.querySelectorAll('.agent')).map((el) => ({
      el,
      id: Number(el.dataset.agent),
      path: svg.querySelector(`#path-${el.dataset.agent}`),
      sense: svg.querySelector(`#sense-${el.dataset.agent}`),
      phase: Number(el.dataset.phase || 0),
      period: Number(el.dataset.period || 9000),
      x: 0,
      y: 0,
    }));
    const pairs = [];
    agents.forEach((a, i) => agents.slice(i + 1).forEach((b) => {
      pairs.push({ a, b, line: svg.querySelector(`#link-${a.id}${b.id}`), pulse: svg.querySelector(`#pulse-${a.id}${b.id}`) });
    }));
    let active = null;

    const place = (agent, t) => {
      const length = agent.path.getTotalLength();
      // Ease back and forth along the planned path.
      const s = (1 - Math.cos(2 * Math.PI * ((t / agent.period + agent.phase) % 1))) / 2;
      const point = agent.path.getPointAtLength(s * length);
      const ahead = agent.path.getPointAtLength(Math.min(length, s * length + 1));
      const behind = agent.path.getPointAtLength(Math.max(0, s * length - 1));
      const heading = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;
      agent.x = point.x;
      agent.y = point.y;
      agent.el.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
      agent.el.querySelector('.frame').setAttribute('transform', `rotate(${heading.toFixed(1)})`);
      agent.sense.setAttribute('cx', point.x.toFixed(2));
      agent.sense.setAttribute('cy', point.y.toFixed(2));
    };

    const neighbors = (agent) => pairs.filter((p) => (p.a === agent || p.b === agent) && p.near).length;

    const describe = (agent) => {
      if (!readout) return;
      const x = ((agent.x - 240) / 100).toFixed(2);
      const y = ((240 - agent.y) / 100).toFixed(2);
      const n = neighbors(agent);
      readout.textContent = `agent ${agent.id} · (${x}, ${y}) · ${n} in range`;
    };

    const draw = (t) => {
      agents.forEach((agent) => place(agent, t));
      pairs.forEach((pair) => {
        const dx = pair.b.x - pair.a.x;
        const dy = pair.b.y - pair.a.y;
        const distance = Math.hypot(dx, dy);
        pair.near = distance < RANGE;
        pair.line.setAttribute('x1', pair.a.x.toFixed(2));
        pair.line.setAttribute('y1', pair.a.y.toFixed(2));
        pair.line.setAttribute('x2', pair.b.x.toFixed(2));
        pair.line.setAttribute('y2', pair.b.y.toFixed(2));
        pair.line.classList.toggle('is-near', pair.near);
        pair.line.setAttribute('stroke-dasharray', pair.near ? '' : '3 5');
        if (pair.pulse) {
          const k = ((t / 2600) + (pair.a.id + pair.b.id) * .31) % 1;
          pair.pulse.setAttribute('cx', (pair.a.x + dx * k).toFixed(2));
          pair.pulse.setAttribute('cy', (pair.a.y + dy * k).toFixed(2));
          pair.pulse.style.opacity = pair.near ? String(.85 * Math.sin(Math.PI * k)) : '0';
        }
      });
      if (active) describe(active);
    };

    const focusAgent = (agent) => {
      active = agent;
      figure.classList.toggle('has-focus', Boolean(agent));
      agents.forEach((a) => {
        a.el.classList.toggle('is-active', a === agent);
        a.sense.classList.toggle('is-active', a === agent);
      });
      pairs.forEach((p) => p.line.classList.toggle('is-active', Boolean(agent) && (p.a === agent || p.b === agent)));
      if (agent) describe(agent);
      else if (readout) readout.textContent = defaultReadout;
    };

    agents.forEach((agent) => {
      agent.el.addEventListener('mouseenter', () => focusAgent(agent));
      agent.el.addEventListener('mouseleave', () => focusAgent(null));
      agent.el.addEventListener('focus', () => focusAgent(agent));
      agent.el.addEventListener('blur', () => focusAgent(null));
      agent.el.addEventListener('click', () => focusAgent(active === agent ? null : agent));
    });

    // Animate only while visible, and never when motion is reduced.
    let frameId = 0;
    let running = false;
    let onScreen = true;
    const startTime = performance.now();
    const loop = (now) => {
      draw(now - startTime);
      frameId = window.requestAnimationFrame(loop);
    };
    const sync = () => {
      const shouldRun = onScreen && !reducedMotion.matches && !document.hidden;
      if (shouldRun && !running) { running = true; frameId = window.requestAnimationFrame(loop); }
      if (!shouldRun && running) { running = false; window.cancelAnimationFrame(frameId); }
    };
    draw(2200);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }).observe(svg);
    }
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', () => { sync(); if (reducedMotion.matches) draw(2200); });
    sync();

    // A few pixels of parallax on the frame, desktop only.
    if (frame) {
      let raf = 0;
      figure.addEventListener('pointermove', (event) => {
        if (!canHover.matches || reducedMotion.matches) return;
        const rect = figure.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - .5;
        const py = (event.clientY - rect.top) / rect.height - .5;
        window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(() => { frame.style.transform = `translate(${(px * 6).toFixed(2)}px, ${(py * 6).toFixed(2)}px)`; });
      });
      figure.addEventListener('pointerleave', () => { frame.style.transform = ''; });
    }
  }

  /* Hello, fellow view-source enjoyer. */
  if (document.body.dataset.page === 'home') {
    console.log('%cHi! You found the console.', 'font: 600 13px system-ui; color: #88ABDF');
    console.log('This site is hand-written HTML, CSS, and a little JavaScript. No framework.\nIf you want to talk robots: rishabh.thakur@berkeley.edu');
  }
})();

/* ---------- Homepage v2 ---------- */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* Typing line under the name. */
  const typer = document.querySelector('.typer-text');
  if (typer && !reducedMotion.matches) {
    let phrases = [];
    try { phrases = JSON.parse(typer.dataset.phrases); } catch { phrases = []; }
    if (phrases.length > 1) {
      typer.setAttribute('aria-live', 'off');
      let index = 0;
      let length = phrases[0].length;
      let deleting = true;
      const step = () => {
        const phrase = phrases[index];
        if (deleting) {
          length -= 1;
          typer.textContent = phrase.slice(0, length);
          if (length <= 0) { deleting = false; index = (index + 1) % phrases.length; }
          window.setTimeout(step, 28);
        } else {
          const next = phrases[index];
          length += 1;
          typer.textContent = next.slice(0, length);
          if (length >= next.length) { deleting = true; window.setTimeout(step, 2600); }
          else window.setTimeout(step, 46 + Math.random() * 40);
        }
      };
      window.setTimeout(step, 3200);
    }
  }

  /* Years-of-building-robots counter. */
  const counter = document.querySelector('.counter-value');
  if (counter) {
    const since = new Date(counter.dataset.since).getTime();
    const year = 365.2425 * 24 * 3600 * 1000;
    counter.innerHTML = '<span class="int"></span><span class="frac"></span>';
    const intEl = counter.querySelector('.int');
    const fracEl = counter.querySelector('.frac');
    const render = () => {
      const value = (Date.now() - since) / year;
      const [whole, frac] = value.toFixed(9).split('.');
      intEl.textContent = whole;
      fracEl.textContent = `.${frac}`;
    };
    render();
    if (!reducedMotion.matches) {
      let visible = true;
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(counter);
      const loop = () => { if (visible && !document.hidden) render(); window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    }
  }

  /* Project rows: a small preview image follows the cursor. */
  const preview = document.querySelector('.row-preview');
  if (preview && canHover.matches) {
    let raf = 0;
    let x = 0;
    let y = 0;
    const move = () => { preview.style.transform = `translate(${x + 24}px, ${y - 90}px)`; };
    document.querySelectorAll('.build-row[data-preview]').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (preview.getAttribute('src') !== row.dataset.preview) preview.src = row.dataset.preview;
        preview.classList.add('is-on');
      });
      row.addEventListener('mouseleave', () => preview.classList.remove('is-on'));
      row.addEventListener('mousemove', (event) => {
        x = event.clientX; y = event.clientY;
        window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(move);
      });
    });
  }

  /* Dock: show the back-to-top button once you've scrolled. */
  const dock = document.querySelector('.dock');
  if (dock) {
    const onScroll = () => dock.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * .6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Intro field: decentralized agents that link up with nearby neighbors.
     The cursor joins as one more agent. Illustrative, not a simulation of real data. */
  const canvas = document.querySelector('.swarm');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const section = canvas.parentElement;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let agents = [];
  const pointer = { x: -9999, y: -9999, active: false };

  const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const build = () => {
    const rect = section.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = seeded(11039);
    const count = Math.round(Math.min(46, Math.max(16, (width * height) / 26000)));
    agents = Array.from({ length: count }, () => ({
      x: rand() * width,
      y: rand() * height,
      vx: (rand() - .5) * .32,
      vy: (rand() - .5) * .32,
      heading: rand() * Math.PI * 2,
    }));
  };

  const RANGE = () => Math.min(170, Math.max(110, width / 9));

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    const range = RANGE();

    // faint grid
    ctx.strokeStyle = 'rgba(39, 52, 71, .32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = (width / 2) % 48; gx < width; gx += 48) { ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, height); }
    for (let gy = (height / 2) % 48; gy < height; gy += 48) { ctx.moveTo(0, gy + .5); ctx.lineTo(width, gy + .5); }
    ctx.stroke();

    const nodes = pointer.active ? agents.concat([{ x: pointer.x, y: pointer.y, you: true }]) : agents;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > range) continue;
        const strength = 1 - d / range;
        const isYou = a.you || b.you;
        ctx.strokeStyle = isYou ? `rgba(168, 197, 238, ${.75 * strength})` : `rgba(136, 171, 223, ${.32 * strength})`;
        ctx.lineWidth = isYou ? 1.1 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    agents.forEach((a) => {
      // heading tick, like a little coordinate frame
      ctx.strokeStyle = 'rgba(165, 179, 199, .45)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + Math.cos(a.heading) * 9, a.y + Math.sin(a.heading) * 9);
      ctx.stroke();
      ctx.fillStyle = '#0B1018';
      ctx.strokeStyle = 'rgba(165, 179, 199, .7)';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    if (pointer.active) {
      ctx.strokeStyle = 'rgba(168, 197, 238, .35)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#A8C5EE';
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(165, 179, 199, .9)';
      ctx.font = '11px "Geist Mono", ui-monospace, monospace';
      ctx.fillText('you', pointer.x + 10, pointer.y - 10);
    }
  };

  const update = () => {
    const range = RANGE();
    agents.forEach((a) => {
      // gentle alignment with neighbors: a tiny bit of "coordination"
      let ax = 0; let ay = 0; let n = 0;
      agents.forEach((b) => {
        if (a === b) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < range) { ax += b.vx; ay += b.vy; n += 1; }
      });
      if (n) { a.vx += (ax / n - a.vx) * .004; a.vy += (ay / n - a.vy) * .004; }
      if (pointer.active) {
        const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (d < range && d > 1) { a.vx += (pointer.x - a.x) / d * .004; a.vy += (pointer.y - a.y) / d * .004; }
      }
      const speed = Math.hypot(a.vx, a.vy);
      const max = .45;
      if (speed > max) { a.vx *= max / speed; a.vy *= max / speed; }
      if (speed < .08) { a.vx *= 1.05; a.vy *= 1.05; }
      a.x += a.vx;
      a.y += a.vy;
      a.heading = Math.atan2(a.vy, a.vx);
      if (a.x < -20) a.x = width + 20; if (a.x > width + 20) a.x = -20;
      if (a.y < -20) a.y = height + 20; if (a.y > height + 20) a.y = -20;
    });
  };

  let running = false;
  let frame = 0;
  let onScreen = true;
  const loop = () => { update(); draw(); frame = window.requestAnimationFrame(loop); };
  const sync = () => {
    const go = onScreen && !document.hidden && !reducedMotion.matches;
    if (go && !running) { running = true; frame = window.requestAnimationFrame(loop); }
    if (!go && running) { running = false; window.cancelAnimationFrame(frame); }
    if (!go) draw();
  };

  build();
  for (let i = 0; i < 120; i += 1) update();
  draw();
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(section);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  let resizeTimer;
  window.addEventListener('resize', () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { build(); for (let i = 0; i < 60; i += 1) update(); draw(); }, 150); });

  if (canHover.matches) {
    section.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      if (!running) draw();
    });
    section.addEventListener('pointerleave', () => { pointer.active = false; if (!running) draw(); });
  }
  sync();
})();
