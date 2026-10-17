(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pendingNavigation;
  let restorePage;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) {
      return;
    }

    const link = event.target instanceof Element ? event.target.closest('nav a') : null;
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) {
      return;
    }

    const destination = new URL(link.href);
    const page = document.querySelector('main.page');
    if (!page || destination.origin !== window.location.origin ||
        destination.href === window.location.href) {
      return;
    }

    event.preventDefault();
    window.clearTimeout(pendingNavigation);
    window.clearTimeout(restorePage);
    page.classList.add('is-leaving');
    pendingNavigation = window.setTimeout(() => {
      window.location.assign(destination.href);
      restorePage = window.setTimeout(() => page.classList.remove('is-leaving'), 600);
    }, 90);
  });

  window.addEventListener('pageshow', () => {
    window.clearTimeout(pendingNavigation);
    window.clearTimeout(restorePage);
    document.querySelector('main.page')?.classList.remove('is-leaving');
  });
})();
