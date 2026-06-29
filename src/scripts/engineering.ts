/**
 * engineering.ts — overhead gantry assembly line (landing).
 * A carriage rides the ceiling rail (prismatic DOF); a two-link arm hangs from it
 * and is solved with closed-form IK. The carriage slides above each target so the
 * arm reaches straight down -- a real gantry kinematic that never reaches up from
 * the floor. It picks parts off a physics conveyor and assembles ONE OF THREE
 * products in rotation; the finished unit rolls off. Lazy-inits; reduced-motion safe.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS = "http://www.w3.org/2000/svg";
const DEG = 180 / Math.PI;

// gantry geometry (mirrors EngineeringHero.astro)
const REST_CX = 280;
const PIV = { x: 280, y: 54 };
const ELBOW0 = { x: 280, y: 162 };
const L1 = 108, L2 = 104;
const RAIL_MIN = 130, RAIL_MAX = 430;
const BELT = 264;            // part centre line on the belt
const PICK = { x: 140, y: BELT };
const JIG = { x: 392, y: 258 }; // assembly base

type Spec =
  | { t: "rect"; w: number; h: number; dx: number; dy: number; hot?: boolean }
  | { t: "circ"; r: number; dx: number; dy: number; hot?: boolean }
  | { t: "ant"; dx: number; dy: number };

// three products, bottom-up build order
const PRODUCTS: Spec[][] = [
  [ // rover
    { t: "rect", w: 50, h: 12, dx: 0, dy: -6 },
    { t: "circ", r: 7, dx: -16, dy: 2 },
    { t: "circ", r: 7, dx: 16, dy: 2 },
    { t: "rect", w: 30, h: 18, dx: 0, dy: -22 },
    { t: "ant", dx: 11, dy: -34 },
  ],
  [ // drone (side view)
    { t: "rect", w: 34, h: 10, dx: 0, dy: -8 },
    { t: "rect", w: 16, h: 4, dx: -18, dy: -18 },
    { t: "rect", w: 16, h: 4, dx: 18, dy: -18 },
    { t: "circ", r: 8, dx: -26, dy: -22 },
    { t: "circ", r: 8, dx: 26, dy: -22 },
    { t: "circ", r: 3, dx: 0, dy: -12, hot: true },
  ],
  [ // robot
    { t: "rect", w: 26, h: 8, dx: 0, dy: -4 },
    { t: "rect", w: 28, h: 22, dx: 0, dy: -20 },
    { t: "rect", w: 6, h: 16, dx: -17, dy: -20 },
    { t: "rect", w: 6, h: 16, dx: 17, dy: -20 },
    { t: "rect", w: 16, h: 14, dx: 0, dy: -40 },
    { t: "circ", r: 3, dx: 0, dy: -42, hot: true },
  ],
];

export function initEngineering(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;
  const root = document.querySelector<HTMLElement>("#eng-hero");
  if (!root) return;
  const carriage = root.querySelector<SVGGElement>("[data-carriage]");
  const shoulder = root.querySelector<SVGGElement>("[data-arm-sh]");
  const elbow = root.querySelector<SVGGElement>("[data-arm-el]");
  const grip = root.querySelector<SVGGElement>("[data-arm-grip]");
  const partsLayer = root.querySelector<SVGGElement>("[data-parts]");
  const ambs = Array.from(root.querySelectorAll<SVGRectElement>("[data-amb]"));
  const rollers = Array.from(root.querySelectorAll<SVGGElement>("[data-roller]"));
  if (!carriage || !shoulder || !elbow || !grip || !partsLayer) return;

  // IK for the downward-hanging arm, solved in the carriage-local frame.
  function ik(localTx: number, localTy: number) {
    let dx = localTx - PIV.x, dy = localTy - PIV.y; let D = Math.hypot(dx, dy);
    const maxR = L1 + L2 - 1, minR = Math.abs(L1 - L2) + 2;
    if (D > maxR) { dx *= maxR / D; dy *= maxR / D; D = maxR; }
    if (D < minR && D > 0) { dx *= minR / D; dy *= minR / D; D = minR; }
    const c2 = Math.max(-1, Math.min(1, (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const ang2 = Math.acos(c2), s = 1;
    const phi1 = Math.atan2(dy, dx) - Math.atan2(s * L2 * Math.sin(ang2), L1 + L2 * Math.cos(ang2));
    return { r1: phi1 * DEG - 90, r2: s * ang2 * DEG };
  }

  // ---- product part elements ----
  let prod = 0;
  let specs: Spec[] = [];
  let els: SVGGraphicsElement[] = [];
  let pos: { x: number; y: number; vis: number }[] = [];

  function buildProduct() {
    partsLayer!.innerHTML = "";
    specs = PRODUCTS[prod];
    els = []; pos = [];
    for (const sp of specs) {
      let el: SVGGraphicsElement;
      if (sp.t === "rect") {
        el = document.createElementNS(SVGNS, "rect");
        el.setAttribute("x", String(-sp.w / 2)); el.setAttribute("y", String(-sp.h / 2));
        el.setAttribute("width", String(sp.w)); el.setAttribute("height", String(sp.h)); el.setAttribute("rx", "2");
        el.setAttribute("class", sp.hot ? "eng-part-hot" : "eng-part");
      } else if (sp.t === "circ") {
        el = document.createElementNS(SVGNS, "circle");
        el.setAttribute("r", String(sp.r));
        el.setAttribute("class", sp.hot ? "eng-part-hot" : "eng-part");
      } else {
        el = document.createElementNS(SVGNS, "g");
        el.setAttribute("class", "eng-ant");
        const ln = document.createElementNS(SVGNS, "line");
        ln.setAttribute("x1", "0"); ln.setAttribute("y1", "8"); ln.setAttribute("x2", "0"); ln.setAttribute("y2", "-8");
        const dot = document.createElementNS(SVGNS, "circle");
        dot.setAttribute("cx", "0"); dot.setAttribute("cy", "-11"); dot.setAttribute("r", "3");
        el.appendChild(ln); el.appendChild(dot);
      }
      el.style.opacity = "0";
      partsLayer!.appendChild(el);
      els.push(el); pos.push({ x: 0, y: 0, vis: 0 });
    }
  }
  buildProduct();

  const jigTarget = (i: number) => ({ x: JIG.x + specs[i].dx, y: JIG.y + specs[i].dy });

  // ---- motion state ----
  const cur = { x: REST_CX, y: 150 };
  let cartX = REST_CX;
  let phase = "feed", pT = 0, last = performance.now(), step = 0, g = 1, carry = -1, rang = 0;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const near = (x: number, y: number, d = 4) => Math.hypot(cur.x - x, cur.y - y) < d;
  const goal = (gx: number, gy: number, k = 0.12) => { cur.x = lerp(cur.x, gx, k); cur.y = lerp(cur.y, gy, k); };

  // ambient belt boxes
  const amb = ambs.map((_, i) => ({ x: -40 - i * 95 }));

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; pT += dt;

    // rollers
    rang = (rang + 2.4) % 360;
    rollers.forEach((gr) => { const c = gr.querySelector("circle"); if (c) gr.setAttribute("transform", `rotate(${rang.toFixed(1)} ${c.getAttribute("cx")} ${c.getAttribute("cy")})`); });

    // ambient belt physics (constant flow + queue separation)
    for (const a of amb) { a.x += 1.0; if (a.x > 580) a.x = -30 - Math.random() * 50; }
    amb.sort((p, q) => p.x - q.x);
    for (let i = 1; i < amb.length; i++) { const gap = amb[i].x - amb[i - 1].x; if (gap < 26) amb[i].x += (26 - gap) * 0.5; }
    ambs.forEach((el, i) => { el.setAttribute("x", amb[i].x.toFixed(1)); el.setAttribute("y", String(BELT - 6)); el.style.opacity = "1"; });

    // assembly state machine
    if (phase === "feed") {
      if (pT < 30) { pos[step].x = 24; pos[step].y = BELT; pos[step].vis = 1; }
      pos[step].x += (PICK.x - pos[step].x) * 0.08;
      goal(PICK.x, PICK.y); g = lerp(g, 1, 0.2);
      if (Math.abs(pos[step].x - PICK.x) < 3 && near(PICK.x, PICK.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      g = lerp(g, 0.4, 0.2);
      if (pT > 280) { carry = step; phase = "lift"; pT = 0; }
    } else if (phase === "lift") {
      goal(PICK.x, 150);
      if (near(PICK.x, 150)) { phase = "carry"; pT = 0; }
    } else if (phase === "carry") {
      const t = jigTarget(step); goal(t.x, t.y, 0.09);
      if (near(t.x, t.y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      g = lerp(g, 1, 0.2);
      const t = jigTarget(step); pos[step].x = t.x; pos[step].y = t.y;
      if (pT > 260) { carry = -1; step++; phase = step < specs.length ? "feed" : "ship"; pT = 0; }
    } else if (phase === "ship") {
      goal(REST_CX, 150);
      let done = true;
      for (let i = 0; i < pos.length; i++) if (pos[i].vis) { pos[i].x += 4.5; if (pos[i].x < 620) done = false; else pos[i].vis = 0; }
      if (done) { prod = (prod + 1) % PRODUCTS.length; buildProduct(); step = 0; phase = "feed"; pT = 0; }
    }

    if (carry >= 0) { pos[carry].x = cur.x; pos[carry].y = cur.y; }

    // slide carriage above the target, then solve the hanging arm in local frame
    cartX = lerp(cartX, Math.max(RAIL_MIN, Math.min(RAIL_MAX, cur.x)), 0.12);
    const cdx = cartX - REST_CX;
    carriage.setAttribute("transform", `translate(${cdx.toFixed(1)} 0)`);
    const { r1, r2 } = ik(cur.x - cdx, cur.y);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${PIV.x} ${PIV.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    grip.setAttribute("transform", `translate(280 266) scale(${g.toFixed(3)} 1) translate(-280 -266)`);

    for (let i = 0; i < els.length; i++) {
      els[i].setAttribute("transform", `translate(${pos[i].x.toFixed(1)} ${pos[i].y.toFixed(1)})`);
      els[i].style.opacity = String(pos[i].vis);
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
