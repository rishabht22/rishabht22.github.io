// Text follows input directly. The arm catches up on its own animation frame.
(() => {
  const hero = document.querySelector('.hero3');
  const art = hero?.querySelector('.hero-arm-art');
  if (!art || !window.Arm || !window.Motion) return;

  const { Spring, reducedMotion } = window.Motion;
  const base = art.querySelector('.hero-arm-base');
  const sleeves = art.querySelector('.hero-arm-sleeves');
  const links = art.querySelector('.hero-arm-links');
  const joints = [...art.querySelectorAll('.hero-arm-joints circle')];
  const gripper = art.querySelector('.hero-arm-gripper');
  const status = hero.querySelector('#hero-arm-status');
  const hint = hero.querySelector('#hero-arm-hint');
  const mode = hero.querySelector('#hero-arm-mode');
  const reset = hero.querySelector('#hero-arm-reset');
  const coarse = matchMedia('(pointer: coarse)');
  const extension = new Spring(0, { stiffness: 310, damping: 34 });
  const claw = new Spring(1, { stiffness: 310, damping: 34 });
  const resetProgress = new Spring(0, { stiffness: 210, damping: 29 });
  const restAngles = [-2.57, -.74, -.44];
  const items = new Map([...document.querySelectorAll('[data-move-text]')].map(element => [
    element, { element, dx: 0, dy: 0 },
  ]));
  const controls = '.hero-arm-controls, .scroll-cue, .menu-button';
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));

  let arm;
  let lengths;
  let reach;
  let home;
  let target;
  let solvedExtension;
  let selection;
  let gesture;
  let suppressUntil = 0;
  let returning = false;
  let restoring = [];
  let arranging = false;
  let bounds;
  let scrollLeft = scrollX;
  let scrollTop = scrollY;
  let needsSolve = true;
  let onScreen = true;
  let frame = 0;
  let previousTime = 0;

  function moveText(item, dx, dy) {
    if (item.dx === dx && item.dy === dy) return;
    item.dx = dx;
    item.dy = dy;
    const moved = Math.abs(dx) > .01 || Math.abs(dy) > .01;
    if (moved) item.element.style.setProperty('--arm-offset', `${dx.toFixed(2)}px ${dy.toFixed(2)}px`);
    else item.element.style.removeProperty('--arm-offset');
    item.element.classList.toggle('arm-displaced', moved);
  }

  function name(item) {
    if (item.element.matches('.hero-rotator')) return item.element.querySelector('.rotator-word').textContent.trim();
    return item.element.textContent.trim();
  }

  function fromClient(event) {
    return { x: event.clientX + scrollLeft - bounds.left, y: event.clientY + scrollTop - bounds.top };
  }

  function aim(point, allowExtension = true) {
    if (target && distance(point, target) < .25) return;
    target = point;
    extension.target = allowExtension ? Math.max(0, distance(target, arm.base) / .94 - reach) : 0;
    needsSolve = true;
  }

  function draw() {
    const points = arm.fk();
    const tip = points.at(-1);
    const wrist = points.at(-2);
    const angle = Math.atan2(tip.y - wrist.y, tip.x - wrist.x);
    const sleeve = (from, to) => `M${from.x} ${from.y}l${(to.x - from.x) * .31} ${(to.y - from.y) * .31}`;
    sleeves.setAttribute('d', sleeve(points[0], points[1]) + sleeve(points[1], points[2]));
    links.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
    joints.forEach((joint, i) => {
      joint.setAttribute('cx', points[i].x);
      joint.setAttribute('cy', points[i].y);
    });
    const finger = side => {
      const a = angle + side * (.2 + claw.value * .48);
      return `M${tip.x} ${tip.y}l${Math.cos(a) * 11} ${Math.sin(a) * 11}`;
    };
    gripper.setAttribute('d', finger(-1) + finger(1));
  }

  function solve() {
    arm.setLengths([lengths[0] + extension.value * .55, lengths[1] + extension.value * .45, lengths[2]]);
    arm.setTarget(target);
    solvedExtension = extension.value;
    needsSolve = false;
  }

  function step(dt, immediate = false) {
    if (immediate) extension.set(extension.target);
    else extension.step(dt);
    if (needsSolve || Math.abs(solvedExtension - extension.value) > .15) solve();
    if (immediate) {
      arm.snapToTarget();
      claw.set(claw.target);
    } else {
      arm.step(dt);
      claw.step(dt);
    }

    if (restoring.length) {
      if (immediate) resetProgress.set(0);
      else resetProgress.step(dt);
      const done = resetProgress.settled || resetProgress.value < .004;
      const fraction = done ? 0 : Math.max(0, resetProgress.value);
      for (const { item, dx, dy } of restoring) moveText(item, dx * fraction, dy * fraction);
      if (done) {
        restoring = [];
        status.textContent = 'Hero text restored.';
        syncControls();
      }
    }

    if (returning && (immediate || (extension.settled && !arm.moving) ||
        (distance(arm.effector(), target) < 3 && Math.max(...arm.qd.map(Math.abs)) < .55))) {
      returning = false;
      aim(home, false);
    }
    draw();
    return needsSolve || !extension.settled || arm.moving || !claw.settled || restoring.length > 0;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }

  function tick(now) {
    frame = 0;
    if (!onScreen || document.hidden) return;
    const dt = previousTime ? Math.min(.05, (now - previousTime) / 1000) : 1 / 60;
    previousTime = now;
    if (step(dt)) frame = requestAnimationFrame(tick);
    else previousTime = 0;
  }

  function wake() {
    if (reducedMotion.matches) {
      if (step(0, true)) step(0, true);
    } else if (onScreen && !document.hidden && !frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  function syncControls() {
    mode.setAttribute('aria-pressed', String(arranging));
    mode.textContent = arranging ? 'Done' : 'Move text';
    document.body.classList.toggle('hero-arranging-text', arranging);
    const wasMoving = hero.classList.contains('is-moving-text');
    const moving = Boolean(selection) || restoring.length > 0;
    hero.classList.toggle('is-moving-text', moving);
    if (wasMoving !== moving) hero.dispatchEvent(new Event('hero-move-state'));
    hint.textContent = restoring.length ? 'Resetting…' : selection
      ? (coarse.matches ? 'Tap to place.' : 'Click to place.')
      : (arranging ? (coarse.matches ? 'Tap text to pick up.' : 'Drag or click text.')
        : (coarse.matches ? 'Tap a word to move it.' : 'Drag or click a word.'));
  }

  function release() {
    selection?.item.element.classList.remove('arm-gripped');
    selection = undefined;
    claw.target = 1;
    syncControls();
  }

  function cancelGesture() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    gesture = undefined;
  }

  function layout() {
    const rect = hero.getBoundingClientRect();
    const { width, height } = rect;
    const unchanged = bounds && Math.abs(width - bounds.width) < .5 && Math.abs(height - bounds.height) < .5;
    bounds = { width, height, left: rect.left + scrollX, top: rect.top + scrollY };
    if (unchanged || !width || !height) return;
    stop();
    cancelGesture();
    restoring = [];
    returning = false;
    release();
    items.forEach(item => moveText(item, 0, 0));
    const wide = width >= 900;
    reach = wide ? height * .69 : Math.min(width * .81, height * .65);
    lengths = [.45, .38, .17].map(ratio => reach * ratio);
    const mount = { x: wide ? width * .79 : width - 25, y: height - (wide ? 54 : 92) };
    arm = new window.Arm(mount, lengths, { stiffness: 320, dampingRatio: 1, floor: mount.y - 2 });
    arm.q = restAngles.slice();
    home = arm.effector();
    base.setAttribute('x', mount.x - 22);
    base.setAttribute('y', mount.y - 8);
    art.setAttribute('viewBox', `0 0 ${width} ${height}`);
    target = null;
    extension.set(0);
    claw.set(1);
    aim(home, false);
    solve();
    arm.snapToTarget();
    draw();
  }

  function pick(item, pointer) {
    if (selection || restoring.length || !onScreen ||
        (scrollTop > 8 && item.element.closest('.site-header'))) return false;
    const rect = item.element.getBoundingClientRect();
    const point = fromClient({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
    selection = {
      item,
      point,
      origin: { x: point.x - item.dx, y: point.y - item.dy },
      original: { x: item.dx, y: item.dy },
      offset: pointer ? { x: point.x - pointer.x, y: point.y - pointer.y } : { x: 0, y: 0 },
      width: rect.width,
      height: rect.height,
    };
    returning = false;
    item.element.classList.add('arm-gripped');
    claw.target = 0;
    status.textContent = `Holding ${name(item)}. Choose a place to drop it.`;
    syncControls();
    aim(point);
    wake();
    return true;
  }

  function place(point, drop = false) {
    if (!selection) return;
    const { width, height, item, origin } = selection;
    selection.point = {
      x: clamp(point.x, width / 2 + 8, bounds.width - width / 2 - 8),
      y: clamp(point.y, height / 2 + 10, arm.base.y - 19 - height / 2),
    };
    const next = selection.point;
    moveText(item, next.x - origin.x, next.y - origin.y);
    aim(next);
    if (drop) {
      status.textContent = `Placed ${name(item)}.`;
      returning = true;
      release();
    }
    wake();
  }

  function placeAtPointer(point, drop = false) {
    if (!selection) return;
    const offset = selection.offset;
    place({ x: point.x + offset.x, y: point.y + offset.y }, drop);
  }

  function cancelPick() {
    if (!selection) return;
    moveText(selection.item, selection.original.x, selection.original.y);
    returning = false;
    release();
    status.textContent = 'Move canceled.';
    aim(home, false);
    wake();
  }

  function hitScene(element) {
    return hero.contains(element) || items.has(element.closest('[data-move-text]'));
  }

  document.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0) return;
    // The next real press always starts a new gesture, even if a browser
    // omitted the synthetic click after the previous drag.
    suppressUntil = 0;
    if (!hitScene(event.target) || event.target.closest(controls)) return;
    const item = items.get(event.target.closest('[data-move-text]'));
    cancelGesture();
    gesture = { id: event.pointerId, item, start: fromClient(event), placing: Boolean(selection) };
    if (item?.element.matches('a') && !arranging && !selection && event.pointerType === 'touch') {
      gesture.timer = setTimeout(() => {
        if (pick(item)) gesture.longPress = true;
      }, 350);
    }
  });

  document.addEventListener('pointermove', event => {
    if (event.isPrimary === false || !onScreen) return;
    const point = fromClient(event);
    if (gesture?.id === event.pointerId && !gesture.dragging && distance(point, gesture.start) > 5) {
      clearTimeout(gesture.timer);
      if (gesture.item && !gesture.placing && (gesture.longPress || pick(gesture.item, gesture.start))) {
        gesture.dragging = true;
        gesture.item.element.setPointerCapture?.(event.pointerId);
      }
    }

    if (selection) {
      if (gesture?.dragging || (!gesture && event.pointerType === 'mouse' &&
          hero.contains(event.target) && !event.target.closest(controls))) placeAtPointer(point);
    } else if (!returning && !restoring.length && event.pointerType === 'mouse' && !reducedMotion.matches) {
      const nearby = hero.contains(event.target) && distance(point, arm.base) < reach * .87 && point.y < arm.base.y - 14;
      aim(nearby ? point : home, false);
      wake();
    }
  });

  document.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const { dragging, placing, longPress } = gesture;
    if (dragging || placing || longPress) {
      suppressUntil = performance.now() + 450;
      if (dragging || placing) placeAtPointer(fromClient(event), true);
    }
    cancelGesture();
  });

  document.addEventListener('pointercancel', event => {
    if (gesture?.id !== event.pointerId) return;
    if (gesture.dragging || gesture.longPress) cancelPick();
    cancelGesture();
  });

  document.addEventListener('click', event => {
    if (event.detail && performance.now() < suppressUntil) {
      suppressUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const item = items.get(event.target.closest('[data-move-text]'));
    if (!item || (item.element.matches('a') && !arranging) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (!selection && pick(item, event.detail && event.pointerType !== 'touch' ? fromClient(event) : null)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  const increments = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (selection || arranging)) {
      cancelPick();
      cancelGesture();
      arranging = false;
      syncControls();
      return;
    }
    const item = items.get(event.target.closest('[data-move-text]'));
    if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!selection && event.key === ' ' && !event.repeat) {
      if (pick(item)) event.preventDefault();
      return;
    }
    if (!selection) return;
    if (Object.hasOwn(increments, event.key)) {
      const [dx, dy] = increments[event.key];
      event.preventDefault();
      place({ x: selection.point.x + dx, y: selection.point.y + dy });
    } else if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      place(selection.point, true);
    }
  });

  mode.addEventListener('click', () => {
    arranging = !arranging;
    if (!arranging && selection) place(selection.point, true);
    syncControls();
  });

  reset.addEventListener('click', () => {
    cancelGesture();
    arranging = false;
    returning = false;
    restoring = [...items.values()].filter(item => item.dx || item.dy).map(item => ({
      item, dx: item.dx, dy: item.dy,
    }));
    resetProgress.set(1);
    resetProgress.target = 0;
    release();
    aim(home, false);
    hero.dispatchEvent(new Event('reset-hero-text'));
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    status.textContent = restoring.length ? 'Returning the hero text.' : 'Hero text restored.';
    wake();
  });

  window.addEventListener('scroll', () => { scrollLeft = scrollX; scrollTop = scrollY; }, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) wake();
      else stop();
    }).observe(hero);
  }
  reducedMotion.addEventListener('change', () => { stop(); wake(); });
  coarse.addEventListener('change', syncControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else wake();
  });
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero);
  else window.addEventListener('resize', layout);

  art.removeAttribute('hidden');
  hero.querySelector('.hero-arm-controls').hidden = false;
  document.body.classList.add('hero-arm-enabled');
  items.forEach(({ element }) => element.setAttribute('aria-describedby', 'hero-arm-keys'));
  layout();
})();
