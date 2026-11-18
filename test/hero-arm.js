// Pick and place the hero's text with the same spring-driven planar arm.
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
  const reset = hero.querySelector('#hero-arm-reset');
  const extension = new Spring(0, { stiffness: 210, damping: 29 });
  const claw = new Spring(1, { stiffness: 250, damping: 30 });
  const restAngles = [-2.48, -.72, -.40];
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
  let selection;
  let gesture;
  let suppressClick;
  let bounds;
  let elapsed = 0;
  let needsSolve = true;
  let onScreen = true;
  let frame = 0;
  let previousTime = 0;

  function moveText(item, dx, dy) {
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
    const view = hero.getBoundingClientRect();
    return { x: event.clientX - view.left, y: event.clientY - view.top };
  }

  function aim(point) {
    if (target && distance(point, target) < .25) return;
    target = point;
    extension.target = Math.max(0, distance(target, arm.base) / .89 - reach);
    needsSolve = true;
    elapsed = 0;
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
    if (selection && selection.phase !== 'reach') {
      moveText(selection.item, tip.x - selection.origin.x, tip.y - selection.origin.y);
    }
  }

  function release() {
    selection?.item.element.classList.remove('arm-gripped');
    selection = undefined;
    claw.target = 1;
    hero.classList.remove('is-moving-text');
    aim(home);
  }

  function solve() {
    arm.setLengths([lengths[0] + extension.value * .55, lengths[1] + extension.value * .45, lengths[2]]);
    arm.setTarget(target);
    needsSolve = false;
  }

  function step(dt, immediate = false) {
    const before = extension.value;
    if (immediate) extension.set(extension.target);
    else extension.step(dt);
    if (needsSolve || Math.abs(before - extension.value) > .00001) solve();
    if (immediate) {
      arm.snapToTarget();
      claw.set(claw.target);
    } else {
      arm.step(dt);
      claw.step(dt);
      elapsed += dt;
    }

    const atTarget = distance(arm.effector(), target) < 2 && Math.max(...arm.qd.map(Math.abs)) < .4;
    if (selection && (immediate || atTarget || elapsed > 1.6)) {
      if (selection.phase === 'reach') {
        selection.phase = selection.drop ? 'place' : 'hold';
        selection.item.element.classList.add('arm-gripped');
        claw.target = 0;
        status.textContent = `Holding ${name(selection.item)}. Choose a place to drop it.`;
        aim(selection.drop ?? selection.point);
      } else if (selection.phase === 'place') {
        const { item, drop, origin } = selection;
        moveText(item, drop.x - origin.x, drop.y - origin.y);
        status.textContent = `Placed ${name(item)}.`;
        release();
      }
    }
    draw();
    return needsSolve || !extension.settled || arm.moving || !claw.settled
      || selection?.phase === 'reach' || selection?.phase === 'place';
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
      // Finish discrete pick, carry, and drop states without rendering travel.
      for (let i = 0; i < 4 && step(0, true); i += 1) { /* finish queued steps */ }
    } else if (onScreen && !document.hidden && !frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  function park() {
    stop();
    arm.setLengths(lengths);
    arm.q = restAngles.slice();
    home = arm.effector();
    target = null;
    extension.set(0);
    claw.set(1);
    aim(home);
    solve();
    arm.snapToTarget();
    draw();
  }

  function layout() {
    const { width, height } = hero.getBoundingClientRect();
    if (bounds && Math.abs(width - bounds.width) < .5 && Math.abs(height - bounds.height) < .5) return;
    bounds = { width, height };
    stop();
    cancelGesture();
    selection?.item.element.classList.remove('arm-gripped');
    selection = undefined;
    hero.classList.remove('is-moving-text');
    items.forEach(item => moveText(item, 0, 0));
    const wide = width >= 900;
    reach = wide ? height * .59 : Math.min(width * .69, height * .56);
    lengths = [.45, .38, .17].map(ratio => reach * ratio);
    const mount = { x: wide ? width * .79 : width - 25, y: height - (wide ? 54 : 92) };
    arm = new window.Arm(mount, lengths, { stiffness: 155, dampingRatio: .92, floor: mount.y - 2 });
    base.setAttribute('x', mount.x - 22);
    base.setAttribute('y', mount.y - 8);
    art.setAttribute('viewBox', `0 0 ${width} ${height}`);
    park();
  }

  function canPick(item) {
    const view = hero.getBoundingClientRect();
    return view.bottom > 0 && view.top < innerHeight && !(scrollY > 8 && item.element.closest('.site-header'));
  }

  function pick(item) {
    if (selection || !canPick(item)) return false;
    const rect = item.element.getBoundingClientRect();
    const view = hero.getBoundingClientRect();
    const point = { x: rect.left - view.left + rect.width / 2, y: rect.top - view.top + rect.height / 2 };
    selection = {
      item,
      point,
      origin: { x: point.x - item.dx, y: point.y - item.dy },
      original: { x: item.dx, y: item.dy },
      width: rect.width,
      height: rect.height,
      phase: 'reach',
      drop: null,
    };
    hero.classList.add('is-moving-text');
    status.textContent = `Reaching for ${name(item)}.`;
    aim(point);
    wake();
    return true;
  }

  function confined(goal) {
    const { width, height } = selection;
    return {
      x: clamp(goal.x, width / 2 + 8, bounds.width - width / 2 - 8),
      y: clamp(goal.y, height / 2 + 10, arm.base.y - 19 - height / 2),
    };
  }

  function carry(point, drop = false) {
    if (!selection || selection.phase === 'place') return;
    selection.point = confined(point);
    if (drop) selection.drop = selection.point;
    if (selection.phase !== 'reach') {
      if (drop) selection.phase = 'place';
      aim(selection.point);
    }
    wake();
  }

  function cancelGesture() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    gesture = undefined;
  }

  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    // Only the synthetic click following this gesture can need suppression.
    suppressClick = undefined;
    if (event.target.closest(controls)) return;
    const source = event.target.closest('[data-move-text]');
    const item = items.get(source);
    const inside = hero.contains(event.target) || Boolean(item);
    if (!inside) return;
    cancelGesture();
    gesture = { id: event.pointerId, item, start: fromClient(event), placing: Boolean(selection) };
    if (item?.element.matches('a') && !selection && event.pointerType === 'touch') {
      gesture.timer = setTimeout(() => {
        if (pick(item)) gesture.longPress = true;
      }, 350);
    }
  });

  document.addEventListener('pointermove', event => {
    if (!event.isPrimary) return;
    const point = fromClient(event);
    if (gesture?.id === event.pointerId && distance(point, gesture.start) > 7) {
      clearTimeout(gesture.timer);
      if (gesture.item && !gesture.placing && !gesture.dragging &&
          (gesture.longPress || pick(gesture.item))) {
        gesture.dragging = true;
        gesture.item.element.setPointerCapture?.(event.pointerId);
      }
    }

    if (selection) {
      if (gesture?.dragging || (!gesture && event.pointerType === 'mouse' && hero.contains(event.target))) {
        carry(point);
      }
    } else if (event.pointerType === 'mouse' && !reducedMotion.matches && onScreen) {
      const nearby = hero.contains(event.target) && distance(point, arm.base) < reach * .87 && point.y < arm.base.y - 14;
      aim(nearby ? point : home);
      wake();
    }
  });

  document.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const { dragging, placing, longPress } = gesture;
    if (dragging || placing || longPress) {
      suppressClick = { id: event.pointerId, expires: performance.now() + 500 };
      if (dragging || placing) carry(fromClient(event), true);
    }
    cancelGesture();
  });

  document.addEventListener('pointercancel', event => {
    if (gesture?.id !== event.pointerId) return;
    if (gesture.dragging || gesture.longPress) cancelPick();
    cancelGesture();
  });

  document.addEventListener('click', event => {
    if (event.detail && suppressClick && performance.now() < suppressClick.expires &&
        (event.pointerId === suppressClick.id || event.pointerId === undefined)) {
      suppressClick = undefined;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const item = items.get(event.target.closest('.hero-word'));
    if (item && !selection) pick(item);
  }, true);

  function cancelPick() {
    if (!selection) return;
    moveText(selection.item, selection.original.x, selection.original.y);
    release();
    status.textContent = 'Move canceled.';
    wake();
  }

  document.addEventListener('keydown', event => {
    const item = items.get(event.target.closest('[data-move-text]'));
    if (event.key === 'Escape' && selection) {
      cancelPick();
      cancelGesture();
      return;
    }
    if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!selection && event.key === ' ' && !event.repeat) {
      if (pick(item)) event.preventDefault();
      return;
    }
    if (!selection) return;
    const increments = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
    if (Object.hasOwn(increments, event.key)) {
      const [dx, dy] = increments[event.key];
      event.preventDefault();
      carry({ x: selection.point.x + dx, y: selection.point.y + dy });
    } else if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      carry(selection.point, true);
    }
  });

  reset.addEventListener('click', () => {
    cancelGesture();
    items.forEach(item => moveText(item, 0, 0));
    release();
    hero.dispatchEvent(new Event('reset-hero-text'));
    window.scrollTo({ top: 0, behavior: 'instant' });
    status.textContent = 'Hero text restored.';
    park();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) wake();
      else stop();
    }).observe(hero);
  }
  reducedMotion.addEventListener('change', () => { stop(); wake(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else wake();
  });
  new ResizeObserver(layout).observe(hero);

  art.removeAttribute('hidden');
  hero.querySelector('.hero-arm-controls').hidden = false;
  document.body.classList.add('hero-arm-enabled');
  const coarse = matchMedia('(pointer: coarse)').matches;
  hero.querySelector('#hero-arm-hint').textContent = coarse ? 'Tap a word, then tap to place.' : 'Drag text to move it.';
  items.forEach(({ element }) => element.setAttribute('aria-describedby', 'hero-arm-keys'));
  layout();
})();
