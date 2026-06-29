/**
 * engineering.ts — physics assembly line (landing).
 * A conveyor carries ambient parts (real belt friction + gravity + separation).
 * An inverse-kinematics arm picks the incoming parts off the line and assembles a
 * recognizable rover at the jig (chassis, two wheels, body, sensor head, antenna);
 * the finished rover then rolls off on the belt and the line repeats. Rollers turn
 * continuously. Transforms only. Lazy-inits near the viewport; gated by reduced-motion.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const DEG = 180 / Math.PI;

// arm geometry (mirrors EngineeringHero.astro)
const P = { x: 300, y: 250 };
const ELBOW0 = { x: 300, y: 158 };
const LA = 92, LB = 90;
const PICK = { x: 168, y: 264 };
const BELT_SURFACE = 266;

// rover part jig targets (assembled), in build order
const JIG = [
  { x: 420, y: 256 }, // chassis
  { x: 404, y: 266 }, // wheel L
  { x: 436, y: 266 }, // wheel R
  { x: 420, y: 236 }, // body
  { x: 420, y: 218 }, // head
  { x: 420, y: 212 }, // antenna
];

export function initEngineering(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;
  const root = document.querySelector<HTMLElement>("#eng-hero");
  if (!root) return;
  const shoulder = root.querySelector<SVGGElement>("[data-arm-sh]");
  const elbow = root.querySelector<SVGGElement>("[data-arm-el]");
  const grip = root.querySelector<SVGGElement>("[data-arm-grip]");
  const parts = Array.from(root.querySelectorAll<SVGGraphicsElement>("[data-part]"));
  const ambs = Array.from(root.querySelectorAll<SVGRectElement>("[data-amb]"));
  const rollers = Array.from(root.querySelectorAll<SVGGElement>("[data-roller]"));
  if (!shoulder || !elbow || !grip || parts.length < 6) return;

  const pst = parts.map(() => ({ x: 0, y: 0, vis: 0 }));
  const ambState = ambs.map((_, i) => ({ x: -40 - i * 90, y: BELT_SURFACE, vx: 1, on: true }));

  function ik(tx: number, ty: number) {
    let dx = tx - P.x, dy = ty - P.y; let D = Math.hypot(dx, dy);
    const maxR = LA + LB - 1, minR = Math.abs(LA - LB) + 2;
    if (D > maxR) { dx *= maxR / D; dy *= maxR / D; D = maxR; }
    if (D < minR && D > 0) { dx *= minR / D; dy *= minR / D; D = minR; }
    const c2 = Math.max(-1, Math.min(1, (D * D - LA * LA - LB * LB) / (2 * LA * LB)));
    const ang2 = Math.acos(c2), s = -1;
    const phi1 = Math.atan2(dy, dx) - Math.atan2(s * LB * Math.sin(ang2), LA + LB * Math.cos(ang2));
    return { r1: phi1 * DEG + 90, r2: s * ang2 * DEG };
  }

  const cur = { x: P.x, y: 140 };
  let phase = "feed", pT = 0, last = performance.now(), step = 0, g = 1, carry = -1, rang = 0;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const near = (x: number, y: number, d = 3.5) => Math.hypot(cur.x - x, cur.y - y) < d;
  const goal = (gx: number, gy: number, k = 0.1) => { cur.x = lerp(cur.x, gx, k); cur.y = lerp(cur.y, gy, k); };

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; pT += dt;

    // ---- rollers ----
    rang = (rang + 2.4) % 360;
    rollers.forEach((gr) => {
      const c = gr.querySelector("circle"); if (!c) return;
      gr.setAttribute("transform", `rotate(${rang.toFixed(1)} ${c.getAttribute("cx")} ${c.getAttribute("cy")})`);
    });

    // ---- ambient belt physics: friction toward belt speed + separation ----
    const BV = 1.0;
    for (const a of ambState) {
      a.vx += (BV - a.vx) * 0.08;
      a.x += a.vx;
      if (a.x > 580) { a.x = -30 - Math.random() * 60; }
    }
    // simple separation so they queue instead of overlapping
    ambState.sort((p, q) => p.x - q.x);
    for (let i = 1; i < ambState.length; i++) {
      const gap = ambState[i].x - ambState[i - 1].x;
      if (gap < 26) { ambState[i].x += (26 - gap) * 0.5; ambState[i - 1].x -= (26 - gap) * 0.2; }
    }
    ambs.forEach((el, i) => { el.setAttribute("x", ambState[i].x.toFixed(1)); el.setAttribute("y", (ambState[i].y - 7).toFixed(1)); el.style.opacity = "1"; });

    // ---- assembly state machine ----
    if (phase === "feed") {
      if (pT < 30) { pst[step].x = 20; pst[step].y = BELT_SURFACE; pst[step].vis = 1; }
      pst[step].x += (PICK.x - pst[step].x) * 0.08; // ride the belt to the pick point
      goal(PICK.x, PICK.y);
      g = lerp(g, 1, 0.2);
      if (Math.abs(pst[step].x - PICK.x) < 3 && near(PICK.x, PICK.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      g = lerp(g, 0.38, 0.2);
      if (pT > 300) { carry = step; phase = "lift"; pT = 0; }
    } else if (phase === "lift") {
      goal(PICK.x, 150);
      if (near(PICK.x, 150)) { phase = "carry"; pT = 0; }
    } else if (phase === "carry") {
      goal(JIG[step].x, JIG[step].y, 0.08);
      if (near(JIG[step].x, JIG[step].y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      g = lerp(g, 1, 0.2);
      pst[step].x = JIG[step].x; pst[step].y = JIG[step].y;
      if (pT > 280) { carry = -1; step++; phase = step < 6 ? "feed" : "ship"; pT = 0; }
    } else if (phase === "ship") {
      goal(P.x, 150);
      let done = true;
      for (let i = 0; i < 6; i++) { if (pst[i].vis) { pst[i].x += 4.5; if (pst[i].x < 600) done = false; else pst[i].vis = 0; } }
      if (done) { step = 0; phase = "feed"; pT = 0; }
    }

    if (carry >= 0) { pst[carry].x = cur.x; pst[carry].y = cur.y - 2; }

    // ---- apply IK + gripper ----
    const { r1, r2 } = ik(cur.x, cur.y);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${P.x} ${P.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    grip.setAttribute("transform", `translate(300 74) scale(${g.toFixed(3)} 1) translate(-300 -74)`);

    for (let i = 0; i < parts.length; i++) {
      parts[i].setAttribute("transform", `translate(${pst[i].x.toFixed(1)} ${pst[i].y.toFixed(1)})`);
      (parts[i] as unknown as SVGGElement).style.opacity = String(pst[i].vis);
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
