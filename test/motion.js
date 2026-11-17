// Shared motion kit for the whole site.
//  - Spring: a critically-tunable spring-mass-damper, integrated with
//    semi-implicit Euler in fixed sub-steps so it behaves the same at any
//    frame rate.
//  - decode(): restrained per-character text decoding for small labels.
//  - The nav indicator, which rides on two springs.
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Spring ---------- */
  class Spring {
    // stiffness k, damping c, mass m. Damping ratio zeta = c / (2 * sqrt(k * m)).
    constructor(value = 0, { stiffness = 170, damping = 24, mass = 1 } = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.k = stiffness;
      this.c = damping;
      this.m = mass;
    }

    set(value) { this.value = value; this.target = value; this.velocity = 0; }

    // Advance by dt seconds. Returns true while still moving.
    step(dt) {
      const h = 1 / 240;
      let remaining = Math.min(dt, .064);
      while (remaining > 1e-6) {
        const s = Math.min(h, remaining);
        const force = -this.k * (this.value - this.target) - this.c * this.velocity;
        this.velocity += (force / this.m) * s;
        this.value += this.velocity * s;
        remaining -= s;
      }
      return !this.settled;
    }

    get settled() {
      return Math.abs(this.value - this.target) < .01 && Math.abs(this.velocity) < .01;
    }
  }

  window.Motion = { Spring, reducedMotion };
})();
