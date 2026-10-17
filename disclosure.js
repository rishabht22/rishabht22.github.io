document.querySelectorAll('.prior-coursework').forEach((details) => {
  const summary = details.querySelector('summary');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animation;
  let expanded = details.open;

  summary.addEventListener('click', (event) => {
    if (reducedMotion.matches || !details.animate) return;
    event.preventDefault();
    const startHeight = details.getBoundingClientRect().height;
    animation?.cancel();
    expanded = !expanded;
    details.open = true;
    details.classList.toggle('is-closing', !expanded);
    const endHeight = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
    details.style.overflow = 'hidden';
    animation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: 220, easing: 'ease', fill: 'both' },
    );
    animation.onfinish = () => {
      details.open = expanded;
      animation.cancel();
      animation = undefined;
      details.style.overflow = '';
      details.classList.remove('is-closing');
    };
  });

  details.addEventListener('toggle', () => {
    if (!animation) expanded = details.open;
  });
});
