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
