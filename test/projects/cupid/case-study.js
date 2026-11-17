(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function springTo(element, from, target, draw) {
    if (reducedMotion.matches || !window.Motion) {
      draw(target);
      return () => {};
    }

    const spring = new window.Motion.Spring(from, { stiffness: 150, damping: 25 });
    spring.target = target;
    let frame;
    let previous = performance.now();

    const finish = () => {
      cancelAnimationFrame(frame);
      reducedMotion.removeEventListener('change', finish);
      document.removeEventListener('visibilitychange', finish);
      draw(target);
    };

    function tick(now) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight || !spring.step((now - previous) / 1000)) {
        finish();
        return;
      }
      draw(spring.value);
      previous = now;
      frame = requestAnimationFrame(tick);
    }

    reducedMotion.addEventListener('change', finish);
    document.addEventListener('visibilitychange', finish);
    frame = requestAnimationFrame(tick);
    return finish;
  }

  const headingInput = document.getElementById('chassis-heading');
  const headingOutput = document.getElementById('heading-output');
  const headingVector = document.getElementById('heading-vector');
  const robotBody = document.getElementById('pose-robot');
  const turretArc = document.getElementById('turret-arc');
  const bearing = Math.atan2(140, 405);
  const radians = degrees => degrees * Math.PI / 180;
  const pointFromRobot = (angle, radius) => [
    230 + Math.cos(angle) * radius,
    220 - Math.sin(angle) * radius,
  ].map(value => value.toFixed(2)).join(' ');

  let drawnHeading = Number(headingInput.value);
  let finishHeading = () => {};

  function drawHeading(heading) {
    drawnHeading = heading;
    headingVector.setAttribute('d', 'M230 220L' + pointFromRobot(radians(heading), 172));
    robotBody.setAttribute('transform', `translate(230 220) rotate(${-heading})`);
    const sweep = radians(heading) > bearing ? 1 : 0;
    turretArc.setAttribute('d', `M${pointFromRobot(radians(heading), 65)} A65 65 0 0 ${sweep} ${pointFromRobot(bearing, 65)}`);
  }

  function updateHeading(animate) {
    const heading = Number(headingInput.value);
    const relative = bearing * 180 / Math.PI - heading;
    headingOutput.textContent = `${heading}° chassis · ${formatSigned(relative, 1)}° turret`;
    const from = drawnHeading;
    finishHeading();
    if (animate) finishHeading = springTo(robotBody.closest('svg'), from, heading, drawHeading);
    else drawHeading(heading);
  }

  headingInput.addEventListener('input', () => updateHeading(true));
  updateHeading(false);

  const trajectoryPanels = document.getElementById('trajectory-panels');
  const velocity = document.getElementById('lateral-velocity');
  const velocityOutput = document.getElementById('velocity-output');
  const trajectoryReadout = document.getElementById('trajectory-readout');
  const panels = [
    { title: 'Stationary', description: 'No chassis motion', className: '' },
    { title: 'Moving, uncorrected', description: 'Inherits lateral drift', className: 'uncorrected' },
    { title: 'Moving, compensated', description: 'Cancels lateral drift', className: '' },
  ];
  for (const panel of panels) {
    const template = document.getElementById('trajectory-template');
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('h4').textContent = panel.title;
    fragment.querySelector('.trajectory-note').textContent = panel.description;
    panel.path = fragment.querySelector('.flight-path');
    panel.path.classList.add(panel.className || 'corrected');
    panel.endpoint = fragment.querySelector('.flight-endpoint');
    trajectoryPanels.append(fragment);
  }

  function formatSigned(number, decimals) {
    if (Math.abs(number) < .5 * 10 ** -decimals) return (0).toFixed(decimals);
    return (number > 0 ? '+' : '−') + Math.abs(number).toFixed(decimals);
  }

  function drawTrajectories() {
    const time = .8;
    const speed = Number(velocity.value);
    const gravity = 9.81;
    const rise = .6;
    const verticalVelocity = (rise + .5 * gravity * time ** 2) / time;
    velocityOutput.textContent = `${formatSigned(speed, 1)} m/s`;
    trajectoryReadout.textContent = `At the target plane: ${formatSigned(speed * time, 2)} m lateral error without compensation. 0.00 m with compensation.`;

    panels.forEach((panel, index) => {
      const netLateralVelocity = index === 1 ? speed : 0;
      const points = Array.from({ length: 33 }, (_, i) => {
        const elapsed = time * i / 32;
        const lateral = netLateralVelocity * elapsed;
        const height = verticalVelocity * elapsed - .5 * gravity * elapsed ** 2;
        return [
          23 + 172 * elapsed / time + 10 * lateral,
          95 - 40 * height - 14 * lateral,
        ];
      });
      panel.path.setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' '));
      panel.endpoint.setAttribute('cx', points.at(-1)[0]);
      panel.endpoint.setAttribute('cy', points.at(-1)[1]);
    });
  }

  velocity.addEventListener('input', drawTrajectories);
  drawTrajectories();

  const current = document.getElementById('sort-current');
  const motif = document.getElementById('sort-target');
  const candidates = document.getElementById('sort-candidates');
  const result = document.getElementById('sort-result');
  const apply = document.getElementById('sort-apply');
  const rotor = document.getElementById('sort-rotor');
  const artifacts = [...rotor.querySelectorAll('.artifact-node')];
  let selected;
  let angle = 0;
  let finishRotation = () => {};

  function drawRotation(rotation) {
    angle = rotation;
    rotor.setAttribute('transform', `rotate(${rotation} 150 140)`);
    for (const artifact of artifacts) {
      artifact.querySelector('text').setAttribute('transform', `rotate(${-rotation})`);
    }
  }

  function scoreRotations() {
    finishRotation();
    drawRotation(0);
    const configuration = current.value;
    const target = motif.value;
    artifacts.forEach((artifact, i) => {
      artifact.dataset.artifact = configuration[i];
      artifact.querySelector('text').textContent = configuration[i];
    });

    const rotations = [0, 1, 2].map(steps => {
      const slots = configuration.slice(steps) + configuration.slice(0, steps);
      const matches = [...slots].filter((artifact, i) => artifact === target[i]).length;
      return { steps, slots, matches };
    });
    selected = rotations.reduce((best, candidate) => candidate.matches > best.matches ? candidate : best);

    candidates.replaceChildren(...rotations.map(candidate => {
      const row = document.createElement('tr');
      if (candidate === selected) row.classList.add('chosen');
      for (const value of [candidate.steps, candidate.slots, `${candidate.matches}/3${candidate === selected ? ' · best' : ''}`]) {
        const cell = row.insertCell();
        cell.textContent = value;
      }
      return row;
    }));

    const match = selected.matches === 3 ? 'Exact match' : 'Best partial match';
    result.textContent = `${match}: ${selected.slots} in ${selected.steps} ${selected.steps === 1 ? 'step' : 'steps'}.`;
  }

  current.addEventListener('change', scoreRotations);
  motif.addEventListener('change', scoreRotations);
  apply.addEventListener('click', () => {
    const from = angle;
    finishRotation();
    finishRotation = springTo(rotor.closest('svg'), from, -120 * selected.steps, drawRotation);
    result.textContent = selected.steps
      ? `Selected ${selected.slots}, matching ${selected.matches} of 3 positions.`
      : `Keep ${selected.slots}, matching ${selected.matches} of 3 positions. No rotation needed.`;
  });
  scoreRotations();

  document.querySelectorAll('[data-cupid-demo]').forEach(element => { element.hidden = false; });

  // Draw the figure rule once when it enters view. The content is visible throughout.
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        springTo(target, 0, 1, value => target.style.setProperty('--figure-entry', Math.min(value, 1)));
      }
    }, { threshold: .15 });
    document.querySelectorAll('.hardware-overview, .spindexer-video').forEach(figure => observer.observe(figure));
  }
})();
