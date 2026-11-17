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
      const setLabel = (t) => { if (!label) return; if (window.Motion?.decode) window.Motion.decode(label, t, { duration: 260, stagger: 30, jitter: 30 }); else label.textContent = t; };
      setLabel('Copied');
      if (status) status.textContent = 'Email address copied to clipboard.';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        button.classList.remove('is-copied');
        setLabel('Copy');
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

  /* Hello, fellow view-source enjoyer. */
  if (document.body.dataset.page === 'home') {
    console.log('%cHi! You found the console.', 'font: 600 13px system-ui; color: #88ABDF');
    console.log('This site is hand-written HTML, CSS, and a little JavaScript. No framework.\nIf you want to talk robots: rishabh.thakur@berkeley.edu');
  }
})();

(() => {
  /* Dock: show the back-to-top button once you've scrolled. */
  const dock = document.querySelector('.dock');
  if (dock) {
    const onScroll = () => dock.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * .6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
