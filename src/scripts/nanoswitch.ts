/**
 * nanoswitch.ts — smooth, autonomous DNA nanoswitch cycle (Research section).
 *
 * Runs a continuous, natural loop:
 *   approach -> a streptavidin glides in and binds biotin A
 *   fold     -> the strand smoothly bends into a loop, drawing biotin B in so the
 *               streptavidin bridges both sites (the bend is animated, eased)
 *   hold     -> bound/looped
 *   unfold   -> it releases, the strand eases back open, the analyte drifts off
 *   then repeats with the next analyte.
 *
 * The backbone is interpolated between a precomputed OPEN shape and a LOOPED shape
 * by an eased parameter, so the fold is a smooth animation (not a crossfade, not
 * jittery physics). A gentle idle sway keeps it alive. We draw the path ourselves
 * each frame. Lazy-inits near the viewport; gated by prefers-reduced-motion.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
type V = { x: number; y: number };

export function initNanoSwitch(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;

  const root = document.querySelector<HTMLElement>("#nanoswitch");
  if (!root) return;
  const strand = root.querySelector<SVGPathElement>("[data-strand]");
  const biotinEls = Array.from(root.querySelectorAll<SVGGElement>("[data-biotin]"));
  const analyteEls = Array.from(root.querySelectorAll<SVGGElement>("[data-analyte]"));
  if (!strand || biotinEls.length < 2 || !analyteEls.length) return;

  const N = Number(root.dataset.n);
  const X0 = Number(root.dataset.x0);
  const X1 = Number(root.dataset.x1);
  const BASE_Y = Number(root.dataset.baseY);
  const A = Number(root.dataset.siteA);
  const B = Number(root.dataset.siteB);
  const step = (X1 - X0) / (N - 1);
  const REST = step;

  // ---- precompute OPEN and LOOPED backbone shapes ----
  const open: V[] = Array.from({ length: N }, (_, i) => ({ x: X0 + step * i, y: BASE_Y }));

  const neckX = (open[A].x + open[B].x) / 2;
  const r = ((B - A) * REST) / (2 * Math.PI) * 1.5; // loop radius (slightly dramatized)
  const C = { x: neckX, y: BASE_Y + r };
  const looped: V[] = open.map((p, i) => {
    if (i < A) { const f = i / A; return { x: lerp(X0, neckX, f), y: BASE_Y }; }
    if (i > B) { const f = (i - B) / (N - 1 - B); return { x: lerp(neckX, X1, f), y: BASE_Y }; }
    const k = (i - A) / (B - A); // 0..1 around the loop, starting/ending at the neck (top)
    const th = (-90 + 360 * k) * (Math.PI / 180);
    return { x: C.x + r * Math.cos(th), y: C.y + r * Math.sin(th) };
  });

  // analyte float homes
  const home = analyteEls.map((el) => ({ x: Number(el.dataset.fx), y: Number(el.dataset.fy) }));

  // ---- cycle state ----
  const PH = { approach: 1100, fold: 1400, hold: 1000, unfold: 1400, rest: 700 };
  const order: (keyof typeof PH)[] = ["approach", "fold", "hold", "unfold", "rest"];
  let pi = 0;
  let pt = 0;
  let last = performance.now();
  let active = 0;
  let exit = { ...home[0] };

  const dock = { x: open[A].x, y: BASE_Y - 13 };
  const neck = { x: neckX, y: BASE_Y - 5 };

  function frame(now: number) {
    const dt = Math.min(48, now - last); last = now; pt += dt;
    const phase = order[pi];
    const local = Math.min(1, pt / PH[phase]);

    // fold parameter f: 0 open, 1 looped (eased)
    let f = 0;
    if (phase === "fold") f = smooth(local);
    else if (phase === "hold") f = 1;
    else if (phase === "unfold") f = smooth(1 - local);

    // ---- draw backbone (interpolate open<->looped + gentle idle sway) ----
    const swayAmp = 1.6 * (1 - 0.85 * f); // sway calms as it locks into the loop
    const pts: V[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = lerp(open[i].x, looped[i].x, f);
      const y = lerp(open[i].y, looped[i].y, f) + Math.sin(now * 0.0014 + i * 0.5) * swayAmp;
      pts[i] = { x, y };
    }
    strand!.setAttribute("d", smoothPath(pts));
    biotinEls[0].setAttribute("transform", `translate(${pts[A].x.toFixed(1)} ${pts[A].y.toFixed(1)})`);
    biotinEls[1].setAttribute("transform", `translate(${pts[B].x.toFixed(1)} ${pts[B].y.toFixed(1)})`);

    // ---- active analyte path ----
    let ax: number, ay: number;
    if (phase === "approach") { const e = smooth(local); ax = lerp(home[active].x, dock.x, e); ay = lerp(home[active].y, dock.y, e); }
    else if (phase === "fold") { const e = smooth(local); ax = lerp(dock.x, neck.x, e); ay = lerp(dock.y, neck.y, e); }
    else if (phase === "hold") { ax = neck.x; ay = neck.y; }
    else if (phase === "unfold") { const e = smooth(local); ax = lerp(neck.x, exit.x, e); ay = lerp(neck.y, exit.y, e); }
    else { ax = exit.x; ay = exit.y; }

    for (let i = 0; i < analyteEls.length; i++) {
      let x: number, y: number;
      if (i === active && phase !== "rest") { x = ax; y = ay; }
      else {
        // gentle smooth drift in solution
        x = home[i].x + Math.sin(now * 0.0009 + i * 1.7) * 6;
        y = home[i].y + Math.cos(now * 0.0011 + i * 2.3) * 6;
      }
      analyteEls[i].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    }

    // ---- advance phase ----
    if (pt >= PH[phase]) {
      pt = 0; pi = (pi + 1) % order.length;
      if (order[pi] === "approach") {
        active = (active + 1) % analyteEls.length;
        exit = { ...home[(active + 2) % home.length] }; // leave toward a different spot
      }
    }
    raf = requestAnimationFrame(frame);
  }

  let raf = 0;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); last = performance.now(); raf = requestAnimationFrame(frame); break; }
    }, { rootMargin: "200px" });
    io.observe(root);
  } else raf = requestAnimationFrame(frame);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smooth(t: number) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function smoothPath(p: V[]): string {
  let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
    d += ` Q${p[i].x.toFixed(1)},${p[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const n = p.length - 1;
  d += ` L${p[n].x.toFixed(1)},${p[n].y.toFixed(1)}`;
  return d;
}
