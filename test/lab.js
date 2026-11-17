(() => {
  const { Spring, reducedMotion } = window.Motion;

  // Discrete interactions only. Resolve to a final frame when scrolled away.
  function animateWithin(element, update, finish) {
    let frame;
    let previous = performance.now();
    const end = () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', end);
      reducedMotion.removeEventListener('change', end);
      finish();
    };
    const tick = time => {
      const box = element.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= innerHeight || !update((time - previous) / 1000)) {
        end();
        return;
      }
      previous = time;
      frame = requestAnimationFrame(tick);
    };

    if (reducedMotion.matches) {
      finish();
      return () => {};
    }
    document.addEventListener('visibilitychange', end);
    reducedMotion.addEventListener('change', end);
    frame = requestAnimationFrame(tick);
    return end;
  }

  const formation = document.getElementById('formation-lab');
  const nodes = [...formation.querySelectorAll('.lab-nodes circle')];
  const links = [...formation.querySelectorAll('.lab-links line')];
  const centroid = document.getElementById('formation-center');
  const formationStatus = document.getElementById('formation-status');
  const nominal = [[128, 42], [212, 42], [212, 108], [128, 108]];
  let disturbed = -1;
  let finishFormation = () => {};

  document.getElementById('disturb-formation').addEventListener('click', () => {
    finishFormation();
    disturbed = (disturbed + 1) % nodes.length;
    const displaceX = Math.sign(nominal[disturbed][0] - 170) * 56;
    const displaceY = Math.sign(nominal[disturbed][1] - 75) * 22;
    nodes.forEach((node, i) => node.classList.toggle('is-disturbed', disturbed === i));
    centroid.setAttribute('cx', 170 + displaceX / 4);
    centroid.setAttribute('cy', 75 + displaceY / 4);

    function drawFormation(time) {
      // Exact solution of ė = −L e for the four-node cycle.
      const simple = Math.exp(-2 * time);
      const double = simple ** 2;
      const weights = [(1 + 2 * simple + double) / 4, (1 - double) / 4, (1 - 2 * simple + double) / 4];
      const points = nominal.map(([x, y], i) => {
        const distance = Math.abs(i - disturbed);
        const weight = weights[Math.min(distance, 4 - distance)];
        return [x + weight * displaceX, y + weight * displaceY];
      });
      points.forEach(([x, y], i) => {
        const next = points[(i + 1) % points.length];
        nodes[i].setAttribute('cx', x);
        nodes[i].setAttribute('cy', y);
        links[i].setAttribute('x1', x);
        links[i].setAttribute('y1', y);
        links[i].setAttribute('x2', next[0]);
        links[i].setAttribute('y2', next[1]);
      });
    }

    let elapsed = 0;
    drawFormation(0);
    formationStatus.textContent = `Robot ${disturbed + 1} displaced.`;
    finishFormation = animateWithin(formation, dt => {
      elapsed += dt;
      drawFormation(elapsed * 1.7);
      return elapsed < 1.8;
    }, () => {
      drawFormation(Infinity);
      nodes[disturbed].classList.remove('is-disturbed');
      formationStatus.textContent = 'Spacing restored at a new center.';
    });
  });
  formation.hidden = false;

  const drive = document.getElementById('drive-lab');
  const chassis = document.getElementById('drive-chassis');
  const trail = document.getElementById('drive-trail');
  const status = document.getElementById('drive-status');
  const wheels = [...chassis.querySelectorAll('.drive-wheels path')];
  const powers = [...drive.querySelectorAll('.wheel-powers dd')];
  const commands = {
    w: { motion: [1, 0, 0], label: 'Forward' },
    s: { motion: [-1, 0, 0], label: 'Backward' },
    a: { motion: [0, -1, 0], label: 'Strafe left' },
    d: { motion: [0, 1, 0], label: 'Strafe right' },
    q: { motion: [0, 0, -1], label: 'Turn left' },
    e: { motion: [0, 0, 1], label: 'Turn right' },
  };
  const arrowKeys = { ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd' };
  const pose = [170, 80, 0].map(value => new Spring(value, { stiffness: 155, damping: 25 }));
  const positions = [[170, 80]];
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  let finishDrive = () => {};

  function driveStep(key) {
    const { motion: [forward, strafe, turn], label } = commands[key];
    const [x, y, angle] = pose.map(spring => spring.target);
    const head = angle * Math.PI / 180;
    const destination = [
      clamp(x + 29 * (strafe * Math.cos(head) + forward * Math.sin(head)), 30, 310),
      clamp(y + 29 * (strafe * Math.sin(head) - forward * Math.cos(head)), 30, 130),
      angle + 30 * turn,
    ];

    if (x !== destination[0] || y !== destination[1]) {
      positions.push(destination.slice(0, 2));
      if (positions.length > 8) positions.shift();
    }

    const mix = [forward + strafe + turn, forward - strafe - turn, forward - strafe + turn, forward + strafe - turn];
    const signed = mix.map(power => power > 0 ? '+1' : power < 0 ? '−1' : '0');
    signed.forEach((power, i) => {
      powers[i].textContent = power;
      wheels[i].dataset.power = power[0];
    });
    status.textContent = `${label} · ${signed.join(' / ')}`;

    const current = pose.map(spring => spring.value);
    finishDrive();
    pose.forEach((spring, i) => {
      spring.set(current[i]);
      spring.target = destination[i];
    });

    function drawChassis() {
      const [drawX, drawY, drawAngle] = pose.map(spring => spring.value);
      chassis.setAttribute('transform', `translate(${drawX} ${drawY}) rotate(${drawAngle})`);
      trail.setAttribute('points', [...positions.slice(0, -1), [drawX, drawY]].map(point => point.join(',')).join(' '));
    }

    finishDrive = animateWithin(drive, dt => {
      const moving = pose.map(spring => spring.step(dt)).some(Boolean);
      drawChassis();
      return moving;
    }, () => {
      pose.forEach(spring => spring.set(spring.target));
      drawChassis();
    });
  }

  drive.querySelectorAll('[data-drive]').forEach(button => {
    button.addEventListener('click', () => driveStep(button.dataset.drive));
  });
  drive.addEventListener('keydown', event => {
    const key = arrowKeys[event.key] || event.key.toLowerCase();
    if (!Object.hasOwn(commands, key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    driveStep(key);
  });
  drive.hidden = false;

  const springLab = document.getElementById('spring-lab');
  const zetaInput = document.getElementById('spring-zeta');
  const zetaValue = document.getElementById('spring-value');
  const regime = document.getElementById('spring-regime');
  const curve = document.getElementById('spring-curve');

  function stepResponse(t, zeta) {
    // Unit displacement step for x″ + 2ζω x′ + ω² x = ω², with ω = 5 rad/s.
    const w = 5;
    if (zeta === 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    if (zeta < 1) {
      const k = Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-w * zeta * t) * (Math.cos(w * k * t) + zeta / k * Math.sin(w * k * t));
    }
    const k = Math.sqrt(zeta * zeta - 1);
    return 1 - ((zeta + k) * Math.exp(-w * (zeta - k) * t) - (zeta - k) * Math.exp(-w * (zeta + k) * t)) / (2 * k);
  }

  function drawSpring() {
    const zeta = Number(zetaInput.value);
    zetaValue.textContent = zeta.toFixed(2);
    regime.textContent = zeta < 1 ? 'Underdamped · overshoots'
      : zeta > 1 ? 'Overdamped · slower to settle' : 'Critically damped · fastest without overshoot';
    curve.setAttribute('d', Array.from({ length: 101 }, (_, i) => {
      const x = 20 + 3 * i;
      const y = 116 - 62 * stepResponse(.03 * i, zeta);
      return `${i ? 'L' : 'M'}${x} ${y.toFixed(2)}`;
    }).join(' '));
  }

  zetaInput.addEventListener('input', drawSpring);
  drawSpring();
  springLab.hidden = false;
})();
