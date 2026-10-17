(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pendingNavigation;
  let restorePage;
  let activeRequest;
  let navigationSequence = 0;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) {
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
    activeRequest?.abort();
    const sequence = ++navigationSequence;
    const request = new AbortController();
    activeRequest = request;

    // Refresh the destination's cached HTML so its navigation includes recent updates.
    const requestTimeout = window.setTimeout(() => request.abort(), 2000);
    const refreshed = window.fetch(destination.href, {
      cache: 'reload',
      credentials: 'same-origin',
      signal: request.signal,
    }).then(response => response.arrayBuffer())
      .catch(() => {})
      .finally(() => window.clearTimeout(requestTimeout));

    if (!reducedMotion.matches) page.classList.add('is-leaving');
    restorePage = window.setTimeout(() => page.classList.remove('is-leaving'), 600);
    pendingNavigation = window.setTimeout(async () => {
      await refreshed;
      if (sequence !== navigationSequence) return;
      window.location.assign(destination.href);
    }, reducedMotion.matches ? 0 : 90);
  });

  window.addEventListener('pageshow', () => {
    navigationSequence += 1;
    activeRequest?.abort();
    window.clearTimeout(pendingNavigation);
    window.clearTimeout(restorePage);
    document.querySelector('main.page')?.classList.remove('is-leaving');
  });
})();
