/**
 * nanoswitch.ts — DNA nanoswitch as a flexible-polymer physics simulation.
 *
 * The backbone is a chain of point masses (Verlet integration) with distance
 * constraints, so it behaves like a flexible polymer: it jiggles in solution
 * under thermal noise and bends freely. Two biotins ride on two backbone nodes.
 * Streptavidin analytes drift (each its own little Brownian point). A binding-
 * cycle state machine runs forever:
 *
 *   WIGGLE  -> open strand jiggling, analytes drifting
 *   APPROACH-> one analyte homes in on biotin A and binds
 *   LOOP    -> a binding spring pulls the two biotins together; the slack between
 *              them buckles into a loop and the analyte bridges both
 *   RELEASE -> analyte detaches and drifts off; the chain relaxes; next analyte
 *
 * We draw the backbone `d` and position biotins/analytes ourselves each frame
 * (own rAF — not anime tweening, so no SVG-attribute pitfalls). Lazy-inits near
 * the viewport; gated by prefers-reduced-motion (static SSR strand stands).
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

type Pt = { x: number; y: number; px: number; py: number };

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
  const SITE_A = Number(root.dataset.siteA);
  const SITE_B = Number(root.dataset.siteB);
  const REST = (X1 - X0) / (N - 1);

  // ---- backbone nodes ----
  const home = Array.from({ length: N }, (_, i) => ({
    x: X0 + ((X1 - X0) * i) / (N - 1),
    y: BASE_Y,
  }));
  const nodes: Pt[] = home.map((h, i) => {
    const y = BASE_Y + 9 * Math.sin(i * 0.6);
    return { x: h.x, y, px: h.x, py: y };
  });

  // ---- analytes (each a small Brownian point around its float home) ----
  const aHome = analyteEls.map((el) => ({
    x: Number(el.dataset.fx),
    y: Number(el.dataset.fy),
  }));
  const aPts: Pt[] = aHome.map((h) => ({ x: h.x, y: h.y, px: h.x, py: h.y }));
  const aOpacity = analyteEls.map(() => 1);

  // ---- state machine ----
  type Phase = "wiggle" | "approach" | "loop" | "release";
  let phase: Phase = "wiggle";
  let t0 = performance.now();
  let active = 0; // index of the engaging analyte
  const DUR: Record<Phase, number> = {
    wiggle: 1500,
    approach: 950,
    loop: 2500,
    release: 1050,
  };

  const FRICTION = 0.9;
  const TEMP = 0.45; // thermal noise amplitude
  const rand = () => (Math.random() * 2 - 1) * TEMP;
  const mid = () => ({
    x: (nodes[SITE_A].x + nodes[SITE_B].x) / 2,
    y: (nodes[SITE_A].y + nodes[SITE_B].y) / 2,
  });

  function step(now: number) {
    const elapsed = now - t0;
    const phaseT = Math.min(1, elapsed / DUR[phase]);

    // binding strength + loop bias ramp during the loop phase
    const bind = phase === "loop" ? Math.min(1, phaseT * 1.6) : 0;

    // ---- integrate backbone ----
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      let vx = (n.x - n.px) * FRICTION;
      let vy = (n.y - n.py) * FRICTION;
      n.px = n.x;
      n.py = n.y;

      // thermal jiggle (the strand is always alive in solution)
      let fx = rand();
      let fy = rand();

      // weak restoring force toward home line (keeps it framed); endpoints firmer
      const kHome = i === 0 || i === N - 1 ? 0.012 : 0.005;
      // relax the middle's restoring force while looping so it can buckle
      const between = i > SITE_A && i < SITE_B;
      const kEff = between ? kHome * (1 - 0.85 * bind) : kHome;
      fx += (home[i].x - n.x) * kEff;
      fy += (home[i].y - n.y) * kEff;

      // buckle the slack between the sites downward into a loop
      if (between) fy += 0.7 * bind;

      n.x += vx + fx;
      n.y += vy + fy;
    }

    // binding spring: draw the two biotin sites together
    if (bind > 0) {
      const a = nodes[SITE_A];
      const b = nodes[SITE_B];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const k = 0.06 * bind;
      a.x += dx * k;
      a.y += dy * k;
      b.x -= dx * k;
      b.y -= dy * k;
    }

    // ---- distance constraints (keep polymer length ~constant) ----
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < N - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = ((d - REST) / d) * 0.5;
        dx *= diff;
        dy *= diff;
        a.x += dx;
        a.y += dy;
        b.x -= dx;
        b.y -= dy;
      }
    }

    // clamp to frame
    for (const n of nodes) {
      n.x = Math.max(20, Math.min(440, n.x));
      n.y = Math.max(16, Math.min(224, n.y));
    }

    // ---- analytes ----
    const bridge = mid();
    for (let i = 0; i < aPts.length; i++) {
      const p = aPts[i];
      if (i === active && phase !== "wiggle") {
        // scripted: home onto biotin A, then ride the bridge, then drift off
        let tx = aHome[i].x;
        let ty = aHome[i].y;
        if (phase === "approach") {
          tx = nodes[SITE_A].x;
          ty = nodes[SITE_A].y - 12;
        } else if (phase === "loop") {
          tx = bridge.x;
          ty = bridge.y - 12;
          aOpacity[i] = 1;
        } else if (phase === "release") {
          tx = bridge.x;
          ty = bridge.y - 60;
          aOpacity[i] = Math.max(0, 1 - phaseT);
        }
        p.x += (tx - p.x) * 0.18;
        p.y += (ty - p.y) * 0.18;
        p.px = p.x;
        p.py = p.y;
      } else {
        // free Brownian drift around float home
        const vx = (p.x - p.px) * FRICTION;
        const vy = (p.y - p.py) * FRICTION;
        p.px = p.x;
        p.py = p.y;
        p.x += vx + rand() + (aHome[i].x - p.x) * 0.01;
        p.y += vy + rand() + (aHome[i].y - p.y) * 0.01;
      }
    }

    // ---- phase transitions ----
    if (elapsed >= DUR[phase]) {
      t0 = now;
      if (phase === "wiggle") phase = "approach";
      else if (phase === "approach") phase = "loop";
      else if (phase === "loop") phase = "release";
      else {
        // release done: reset spent analyte, advance to next
        aOpacity[active] = 1;
        aPts[active].x = aHome[active].x;
        aPts[active].y = aHome[active].y;
        aPts[active].px = aHome[active].x;
        aPts[active].py = aHome[active].y;
        active = (active + 1) % aPts.length;
        phase = "wiggle";
      }
    }

    render();
    raf = requestAnimationFrame(step);
  }

  function render() {
    // smooth backbone via quadratic segments through node midpoints
    let d = `M${nodes[0].x.toFixed(1)},${nodes[0].y.toFixed(1)}`;
    for (let i = 1; i < N - 1; i++) {
      const mx = (nodes[i].x + nodes[i + 1].x) / 2;
      const my = (nodes[i].y + nodes[i + 1].y) / 2;
      d += ` Q${nodes[i].x.toFixed(1)},${nodes[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    d += ` L${nodes[N - 1].x.toFixed(1)},${nodes[N - 1].y.toFixed(1)}`;
    strand!.setAttribute("d", d);

    biotinEls[0].setAttribute("transform", `translate(${nodes[SITE_A].x.toFixed(1)} ${nodes[SITE_A].y.toFixed(1)})`);
    biotinEls[1].setAttribute("transform", `translate(${nodes[SITE_B].x.toFixed(1)} ${nodes[SITE_B].y.toFixed(1)})`);

    for (let i = 0; i < analyteEls.length; i++) {
      analyteEls[i].setAttribute("transform", `translate(${aPts[i].x.toFixed(1)} ${aPts[i].y.toFixed(1)})`);
      analyteEls[i].style.opacity = String(aOpacity[i]);
    }
  }

  let raf = 0;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            t0 = performance.now();
            raf = requestAnimationFrame(step);
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(root);
  } else {
    raf = requestAnimationFrame(step);
  }
}
