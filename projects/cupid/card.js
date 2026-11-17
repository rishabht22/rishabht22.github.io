// Live Cupid preview for the project card. The 8.6 MB model only starts
// downloading once the card is close to the viewport.
import { ModelViewerElement } from "../../vendor/model-viewer-4.4.0.min.js";

ModelViewerElement.dracoDecoderLocation = new URL("../../vendor/draco/", import.meta.url).href;

const viewer = document.querySelector('#cupid-card-viewer');
if (viewer) {
  const bar = viewer.querySelector('.live-progress span');
  viewer.addEventListener('progress', (event) => {
    if (bar) bar.style.width = `${Math.round(event.detail.totalProgress * 100)}%`;
  });
  viewer.addEventListener('load', () => viewer.closest('.feature-media')?.classList.add('is-loaded'));

  const load = () => { if (!viewer.src) viewer.src = viewer.dataset.src; };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { load(); observer.disconnect(); }
    }, { rootMargin: '300px 0px' });
    observer.observe(viewer);
  } else {
    load();
  }
}
