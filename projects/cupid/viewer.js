import { ModelViewerElement } from "../../vendor/model-viewer-4.4.0.min.js";

ModelViewerElement.dracoDecoderLocation = new URL("../../vendor/draco/", import.meta.url).href;

(() => {
  const viewer = document.querySelector('#cupid-viewer');
  const stage = document.querySelector('#cad-stage');
  const defaultOrbit = viewer.getAttribute('camera-orbit');
  const rotate = document.querySelector('#rotate-model');
  const reset = document.querySelector('#reset-model');
  const expand = document.querySelector('#expand-model');
  const progress = document.querySelector('#cad-progress');
  const error = document.querySelector('#cad-error');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let lastProgress = -1;

  viewer.addEventListener('progress', (event) => {
    const percent = Math.round(event.detail.totalProgress * 100);
    document.querySelector('#cad-progress-fill').style.width = `${percent}%`;
    if (Math.floor(percent / 10) !== lastProgress) {
      lastProgress = Math.floor(percent / 10);
      document.querySelector('#cad-loading').textContent = percent < 100 ? `Loading CAD ${percent}%` : 'Preparing model…';
    }
  });
  viewer.addEventListener('load', () => {
    progress.hidden = true;
    error.hidden = true;
    rotate.disabled = false;
    reset.disabled = false;
    stage.classList.add('is-loaded');
  });
  viewer.addEventListener('error', () => {
    progress.hidden = true;
    error.hidden = false;
  });
  document.querySelector('#retry-model').addEventListener('click', () => {
    error.hidden = true;
    progress.hidden = false;
    const source = viewer.src;
    viewer.removeAttribute('src');
    viewer.src = source;
  });
  function setRotation(active) {
    viewer.autoRotateDelay = 0;
    viewer.rotationPerSecond = '20deg';
    viewer.toggleAttribute('auto-rotate', active);
    rotate.setAttribute('aria-pressed', String(active));
    const label = active ? 'Stop rotation' : 'Auto-rotate';
    rotate.setAttribute('aria-label', label);
    rotate.title = label;
    rotate.querySelector('.rotation-play').toggleAttribute('hidden', active);
    rotate.querySelector('.rotation-pause').toggleAttribute('hidden', !active);
  }
  rotate.addEventListener('click', () => {
    setRotation(rotate.getAttribute('aria-pressed') !== 'true');
  });
  reset.addEventListener('click', () => {
    setRotation(false);
    viewer.resetTurntableRotation();
    viewer.cameraOrbit = defaultOrbit;
    viewer.cameraTarget = 'auto auto auto';
    viewer.fieldOfView = '35deg';
    if (reducedMotion.matches) viewer.jumpCameraToGoal();
  });
  function setExpanded(active) {
    // Switch the same viewer between inline and modal display without reloading it.
    stage.close();
    stage.classList.toggle('is-expanded', active);
    stage.setAttribute('role', active ? 'dialog' : 'region');
    if (active) stage.showModal();
    else stage.setAttribute('open', '');
    expand.setAttribute('aria-expanded', String(active));
    const label = active ? 'Close full screen' : 'Full screen';
    expand.setAttribute('aria-label', label);
    expand.title = label;
    expand.querySelector('.expand-corners').toggleAttribute('hidden', active);
    expand.querySelector('.collapse-corners').toggleAttribute('hidden', !active);
    expand.focus({ preventScroll: true });
  }
  if (typeof stage.showModal === 'function') {
    expand.addEventListener('click', () => setExpanded(!stage.classList.contains('is-expanded')));
    stage.addEventListener('cancel', (event) => {
      event.preventDefault();
      setExpanded(false);
    });
    stage.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || !stage.classList.contains('is-expanded')) return;
      // The model's keyboard surface lives inside its shadow root.
      const modelInput = viewer.shadowRoot?.querySelector('[tabindex="0"]');
      const first = modelInput ?? stage.querySelector('button:not(:disabled)');
      const onFirst = document.activeElement === (modelInput ? viewer : first);
      if (event.shiftKey && onFirst) {
        event.preventDefault();
        expand.focus();
      } else if (!event.shiftKey && document.activeElement === expand) {
        event.preventDefault();
        first.focus();
      }
    });
  } else {
    expand.hidden = true;
  }
  viewer.src = viewer.dataset.src;
  customElements.whenDefined('model-viewer').then(() => {
    if (viewer.loaded) viewer.dispatchEvent(new Event('load'));
  });
})();
