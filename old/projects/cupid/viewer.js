import { ModelViewerElement } from "../../vendor/model-viewer-4.4.0.min.js";

ModelViewerElement.dracoDecoderLocation = new URL("../../vendor/draco/", import.meta.url).href;

(() => {
  const viewer = document.querySelector('#cupid-viewer');
  const stage = document.querySelector('#cad-stage');
  const rotate = document.querySelector('#rotate-model');
  const reset = document.querySelector('#reset-model');
  const expand = document.querySelector('#expand-model');
  const progress = document.querySelector('#cad-progress');
  const error = document.querySelector('#cad-error');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let previousFocus;
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
    viewer.cameraOrbit = '35deg 65deg 130%';
    viewer.cameraTarget = 'auto auto auto';
    viewer.fieldOfView = '35deg';
    if (reducedMotion.matches) viewer.jumpCameraToGoal();
  });
  function setExpanded(active) {
    if (active) previousFocus = document.activeElement;
    stage.classList.toggle('is-expanded', active);
    document.body.classList.toggle('viewer-open', active);
    expand.setAttribute('aria-expanded', String(active));
    const label = active ? 'Close full screen' : 'Full screen';
    expand.setAttribute('aria-label', label);
    expand.title = label;
    expand.querySelector('.expand-corners').toggleAttribute('hidden', active);
    expand.querySelector('.collapse-corners').toggleAttribute('hidden', !active);
    if (active) {
      stage.setAttribute('role', 'dialog');
      stage.setAttribute('aria-modal', 'true');
      stage.setAttribute('aria-label', 'Cupid 3D model');
      expand.focus();
    } else {
      stage.removeAttribute('role');
      stage.removeAttribute('aria-modal');
      stage.removeAttribute('aria-label');
      previousFocus?.focus();
    }
  }
  expand.addEventListener('click', () => setExpanded(!stage.classList.contains('is-expanded')));
  document.addEventListener('keydown', (event) => {
    if (!stage.classList.contains('is-expanded')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setExpanded(false);
    }
    if (event.key === 'Tab') {
      const controls = Array.from(stage.querySelectorAll('button:not(:disabled), model-viewer'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  viewer.src = viewer.dataset.src;
  customElements.whenDefined('model-viewer').then(() => {
    if (viewer.loaded) viewer.dispatchEvent(new Event('load'));
  });
})();
