// Tiny live demonstrations for the notes. Each one actually computes the idea
// the note is about; nothing here is a canned animation.
(() => {
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  /* Diffusion: probability-flow ODE for a two-Gaussian mixture.
     Data: 0.5 N(-0.6, s^2) + 0.5 N(0.6, s^2). Noised by sigma (variance
     exploding), the density stays a mixture with variance s^2 + sigma^2, so the
     score is exact. We integrate dx/dsigma = -sigma * score(x, sigma) from
     sigma = 1 down to 0.01 in log-spaced Euler steps. */
  const diffusionPaths = ({ n = 24, steps = 48, seed = 7 } = {}) => {
    const r = rng(seed);
    const mus = [-.6, .6];
    const s2 = .08 * .08;
    const score = (x, sigma) => {
      const v = s2 + sigma * sigma;
      let num = 0;
      let den = 0;
      for (const mu of mus) {
        const w = Math.exp(-((x - mu) ** 2) / (2 * v));
        num += w * (mu - x) / v;
        den += w;
      }
      return num / (den || 1e-12);
    };
    const sigmas = Array.from({ length: steps + 1 }, (_, i) => Math.exp(Math.log(1) + (Math.log(.01) - Math.log(1)) * (i / steps)));
    return Array.from({ length: n }, () => {
      let x = gauss(r) * Math.sqrt(1 + s2);
      const path = [x];
      for (let i = 0; i < steps; i += 1) {
        const sg = sigmas[i];
        const dsg = sigmas[i + 1] - sg;
        x += dsg * (-sg * score(x, sg));
        path.push(x);
      }
      return path;
    });
  };

  /* Gradient clipping: SGD on f(x) = x^2 / 2 with zero-mean but skewed noise:
     -0.4 with probability 0.9, +3.6 with probability 0.1. Unclipped SGD is
     unbiased and hovers around x* = 0. Clipping the stochastic gradient to
     [-1, 1] removes the rare big positive kicks, so the expected clipped
     gradient is zero at x = 0.289 instead: a biased fixed point. */
  const clippingPaths = ({ steps = 140, lr = .05, clip = 1, x0 = 2, seed = 11 } = {}) => {
    const r = rng(seed);
    let a = x0;
    let b = x0;
    const raw = [a];
    const clipped = [b];
    for (let i = 0; i < steps; i += 1) {
      const xi = r() < .9 ? -.4 : 3.6;
      a -= lr * (a + xi);
      b -= lr * Math.max(-clip, Math.min(clip, b + xi));
      raw.push(a);
      clipped.push(b);
    }
    return { raw, clipped, fixedPoint: .26 / .9 };
  };

  const DEMOS = {
    diffusion: {
      data: () => diffusionPaths(),
      draw(g, w, h, paths, p) {
        const steps = paths[0].length - 1;
        const X = (i) => 6 + (i / steps) * (w - 12);
        const Y = (v) => h / 2 - (v / 1.6) * (h / 2 - 4);
        g.setLineDash([2, 4]);
        g.strokeStyle = 'rgba(122, 122, 130, .45)';
        g.lineWidth = 1;
        for (const mu of [-.6, .6]) { g.beginPath(); g.moveTo(6, Y(mu)); g.lineTo(w - 6, Y(mu)); g.stroke(); }
        g.setLineDash([]);
        const upto = Math.max(1, Math.floor(p * steps));
        g.strokeStyle = 'rgba(91, 147, 255, .55)';
        g.lineWidth = 1;
        for (const path of paths) {
          g.beginPath();
          g.moveTo(X(0), Y(path[0]));
          for (let i = 1; i <= upto; i += 1) g.lineTo(X(i), Y(path[i]));
          g.stroke();
        }
      },
      caption: 'noise → two modes, probability-flow ODE',
    },
    clipping: {
      data: () => clippingPaths(),
      draw(g, w, h, d, p) {
        const steps = d.raw.length - 1;
        const X = (i) => 6 + (i / steps) * (w - 12);
        const Y = (v) => h - 6 - ((v + .6) / 2.8) * (h - 12);
        g.setLineDash([2, 4]);
        g.strokeStyle = 'rgba(122, 122, 130, .55)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(6, Y(0)); g.lineTo(w - 6, Y(0)); g.stroke();
        g.setLineDash([]);
        const upto = Math.max(1, Math.floor(p * steps));
        const line = (arr, color, width) => {
          g.strokeStyle = color;
          g.lineWidth = width;
          g.beginPath();
          g.moveTo(X(0), Y(arr[0]));
          for (let i = 1; i <= upto; i += 1) g.lineTo(X(i), Y(arr[i]));
          g.stroke();
        };
        line(d.raw, 'rgba(166, 166, 173, .5)', 1);
        line(d.clipped, 'rgba(91, 147, 255, .95)', 1.4);
      },
      caption: 'clipped SGD settles off x* = 0',
    },
  };

  const api = { diffusionPaths, clippingPaths, DEMOS };
  (typeof window !== 'undefined' ? window : globalThis).NoteDemos = api;
})();
