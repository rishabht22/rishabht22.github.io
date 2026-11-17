// A planar serial arm.
//
// Each frame:
//   1. FABRIK (Aristidou & Lasenby, 2011) solves inverse kinematics for the
//      target, starting from the arm's current pose so the elbow never flips.
//   2. The solution is turned into relative joint angles.
//   3. Each joint tracks its angle through its own spring-mass-damper, so the
//      arm has real inertia: it accelerates, decelerates, and settles.
//   4. Forward kinematics turns the integrated angles back into positions.
//
// No DOM here; it is plain math so it can be tested on its own.
(() => {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  class Arm {
    constructor(base, lengths, { stiffness = 58, dampingRatio = .86, floor = Infinity } = {}) {
      this.base = { ...base };
      this.L = lengths.slice();
      this.reach = lengths.reduce((a, b) => a + b, 0);
      this.floor = floor;
      this.k = stiffness;
      this.c = 2 * Math.sqrt(stiffness) * dampingRatio;
      // Start folded up and leaning in.
      this.q = [-Math.PI / 2 - .5, 1.1, .9].slice(0, lengths.length);
      while (this.q.length < lengths.length) this.q.push(.4);
      this.qd = this.q.map(() => 0);
      this.qt = this.q.slice();
      this.target = this.effector();
    }

    fk(q = this.q) {
      const pts = [{ ...this.base }];
      let a = 0;
      for (let i = 0; i < this.L.length; i += 1) {
        a += q[i];
        const p = pts[i];
        pts.push({ x: p.x + this.L[i] * Math.cos(a), y: p.y + this.L[i] * Math.sin(a) });
      }
      return pts;
    }

    effector() { const p = this.fk(); return p[p.length - 1]; }

    // FABRIK from the current pose. Returns the target joint angles.
    solve(target) {
      const n = this.L.length;
      const pts = this.fk();
      const dx = target.x - this.base.x;
      const dy = target.y - this.base.y;
      const dist = Math.hypot(dx, dy);
      let goal = { ...target };
      if (dist > this.reach * .995) {
        // Out of reach: point straight at it.
        const s = (this.reach * .995) / dist;
        goal = { x: this.base.x + dx * s, y: this.base.y + dy * s };
      }
      for (let iter = 0; iter < 16; iter += 1) {
        // Backward pass: pin the tip to the goal, walk toward the base.
        pts[n] = { ...goal };
        for (let i = n - 1; i >= 0; i -= 1) {
          const vx = pts[i].x - pts[i + 1].x;
          const vy = pts[i].y - pts[i + 1].y;
          const d = Math.hypot(vx, vy) || 1e-6;
          pts[i] = { x: pts[i + 1].x + (vx / d) * this.L[i], y: pts[i + 1].y + (vy / d) * this.L[i] };
        }
        // Forward pass: pin the base, walk back out to the tip.
        pts[0] = { ...this.base };
        for (let i = 0; i < n; i += 1) {
          const vx = pts[i + 1].x - pts[i].x;
          const vy = pts[i + 1].y - pts[i].y;
          const d = Math.hypot(vx, vy) || 1e-6;
          pts[i + 1] = { x: pts[i].x + (vx / d) * this.L[i], y: pts[i].y + (vy / d) * this.L[i] };
          // Joints stay above the floor the arm is mounted on.
          if (pts[i + 1].y > this.floor) pts[i + 1].y = this.floor;
        }
        if (Math.hypot(pts[n].x - goal.x, pts[n].y - goal.y) < .25) break;
      }
      // Positions -> relative joint angles, unwrapped next to the current ones.
      let prev = 0;
      const q = [];
      for (let i = 0; i < n; i += 1) {
        const abs = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        const rel = wrap(abs - prev);
        q.push(this.q[i] + wrap(rel - this.q[i]));
        prev = abs;
      }
      return q;
    }

    setTarget(target) {
      this.target = { ...target };
      this.qt = this.solve(target);
    }

    snapToTarget() {
      this.q = this.qt.slice();
      this.qd.fill(0);
    }

    // Integrate the joint springs. Returns true while the arm is moving.
    step(dt) {
      const h = 1 / 240;
      let remaining = Math.min(dt, .064);
      while (remaining > 1e-6) {
        const s = Math.min(h, remaining);
        for (let i = 0; i < this.q.length; i += 1) {
          const acc = -this.k * (this.q[i] - this.qt[i]) - this.c * this.qd[i];
          this.qd[i] += acc * s;
          this.q[i] += this.qd[i] * s;
        }
        remaining -= s;
      }
      return this.moving;
    }

    get moving() {
      return this.q.some((v, i) => Math.abs(v - this.qt[i]) > 1e-3 || Math.abs(this.qd[i]) > 1e-3);
    }
  }

  (typeof window !== 'undefined' ? window : globalThis).Arm = Arm;
})();
