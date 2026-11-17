// Turns the rendered text of an element into a list of points, so dots and
// particles can assemble into the exact letter shapes on screen.
// Each character is redrawn on an offscreen canvas at its real position, size,
// weight and style, then the canvas is sampled on a grid.
window.textPoints = (el, origin, step) => {
  const width = Math.ceil(origin.width);
  const height = Math.ceil(origin.height);
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const g = off.getContext('2d');
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('.visually-hidden, svg')) continue;
    const cs = getComputedStyle(parent);
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = node.textContent;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (!ch.trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      const m = g.measureText(ch);
      const ascent = m.fontBoundingBoxAscent ?? rect.height * .8;
      const descent = m.fontBoundingBoxDescent ?? rect.height * .2;
      const baseline = rect.top + (rect.height - (ascent + descent)) / 2 + ascent;
      g.fillText(ch, rect.left - origin.left, baseline - origin.top);
    }
  }

  const data = g.getImageData(0, 0, width, height).data;
  const points = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 140) points.push({ x, y });
    }
  }
  return points;
};
