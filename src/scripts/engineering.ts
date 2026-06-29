/**
 * engineering.ts — legible assembly cell (landing).
 * Flow reads left to right: raw parts arrive on the INPUT belt, a ceiling-slider
 * arm picks them and assembles a product on the central station, and the finished
 * unit leaves on the OUTPUT belt. Parts never return to the belt they came from.
 * Builds one of three products in rotation. Lazy-inits; reduced-motion safe.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS = "http://www.w3.org/2000/svg";
const DEG = 180 / Math.PI;

const REST_CX = 300;
const PIV = { x: 300, y: 54 };
const ELBOW0 = { x: 300, y: 162 };
const L1 = 108, L2 = 104;
const RAIL_MIN = 190, RAIL_MAX = 320;
const BELT = 262;                 // part centre line on a belt
const PICK = { x: 206, y: BELT }; // end of the input belt
const PLAT = { x: 300, y: 250 };  // assembly station anchor

type Spec =
  | { t: "rect"; w: number; h: number; dx: number; dy: number; hot?: boolean }
  | { t: "circ"; r: number; dx: number; dy: number; hot?: boolean };

// three products, ~4 parts each (kept minimal), built bottom-up
const PRODUCTS: Spec[][] = [
  [ // rover
    { t: "rect", w: 48, h: 12, dx: 0, dy: -6 },
    { t: "circ", r: 7, dx: -15, dy: 2 },
    { t: "circ", r: 7, dx: 15, dy: 2 },
    { t: "rect", w: 28, h: 16, dx: 0, dy: -22 },
  ],
  [ // drone
    { t: "rect", w: 34, h: 10, dx: 0, dy: -8 },
    { t: "circ", r: 8, dx: -22, dy: -14 },
    { t: "circ", r: 8, dx: 22, dy: -14 },
    { t: "circ", r: 3, dx: 0, dy: -12, hot: true },
  ],
  [ // robot
    { t: "rect", w: 24, h: 8, dx: 0, dy: -4 },
    { t: "rect", w: 26, h: 22, dx: 0, dy: -20 },
    { t: "rect", w: 16, h: 12, dx: 0, dy: -38 },
    { t: "circ", r: 3, dx: 0, dy: -40, hot: true },
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
  const layer = root.querySelector<SVGGElement>("[data-parts]");
  const rollers = Array.from(root.querySelectorAll<SVGGElement>("[data-roller]"));
  if (!carriage || !shoulder || !elbow || !grip || !layer) return;

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

  let prod = 0;
  let specs: Spec[] = [];
  let els: SVGGraphicsElement[] = [];
  let pos: { x: number; y: number; vis: number }[] = [];
  let asm: { x: number; y: number }[] = [];

  function build() {
    layer!.innerHTML = "";
    specs = PRODUCTS[prod]; els = []; pos = []; asm = [];
    for (const sp of specs) {
      let el: SVGGraphicsElement;
      if (sp.t === "rect") {
        el = document.createElementNS(SVGNS, "rect");
        el.setAttribute("x", String(-sp.w / 2)); el.setAttribute("y", String(-sp.h / 2));
        el.setAttribute("width", String(sp.w)); el.setAttribute("height", String(sp.h)); el.setAttribute("rx", "2");
      } else {
        el = document.createElementNS(SVGNS, "circle");
        el.setAttribute("r", String(sp.r));
      }
      el.setAttribute("class", sp.hot ? "eng-part-hot" : "eng-part");
      el.style.opacity = "0";
      layer!.appendChild(el);
      els.push(el); pos.push({ x: 0, y: 0, vis: 0 }); asm.push({ x: 0, y: 0 });
    }
  }
  build();
  const slotOf = (i: number) => ({ x: PLAT.x + specs[i].dx, y: PLAT.y + specs[i].dy });

  const cur = { x: REST_CX, y: 150 };
  let cartX = REST_CX;
  let phase = "feed", pT = 0, last = performance.now(), step = 0, g = 1, carry = -1, rang = 0;
  let ex = 0, drop = 0;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const near = (x: number, y: number, d = 4) => Math.hypot(cur.x - x, cur.y - y) < d;
  const goal = (gx: number, gy: number, k = 0.12) => { cur.x = lerp(cur.x, gx, k); cur.y = lerp(cur.y, gy, k); };

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; pT += dt;

    rang = (rang + 2.4) % 360;
    rollers.forEach((gr) => { const c = gr.querySelector("circle"); if (c) gr.setAttribute("transform", `rotate(${rang.toFixed(1)} ${c.getAttribute("cx")} ${c.getAttribute("cy")})`); });

    if (phase === "feed") {
      if (pT < 30) { pos[step].x = 14; pos[step].y = BELT; pos[step].vis = 1; }
      pos[step].x += (PICK.x - pos[step].x) * 0.08;       // ride the input belt to the pick point
      goal(PICK.x, PICK.y); g = lerp(g, 1, 0.2);
      if (Math.abs(pos[step].x - PICK.x) < 3 && near(PICK.x, PICK.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      g = lerp(g, 0.4, 0.2);
      if (pT > 280) { carry = step; phase = "lift"; pT = 0; }
    } else if (phase === "lift") {
      goal(PICK.x, 150);
      if (near(PICK.x, 150)) { phase = "carry"; pT = 0; }
    } else if (phase === "carry") {
      const s = slotOf(step); goal(s.x, s.y, 0.09);
      if (near(s.x, s.y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      g = lerp(g, 1, 0.2);
      const s = slotOf(step); pos[step].x = s.x; pos[step].y = s.y; asm[step] = { x: s.x, y: s.y };
      if (pT > 260) { carry = -1; step++; phase = step < specs.length ? "feed" : "eject"; pT = 0; ex = 0; drop = 0; }
    } else if (phase === "eject") {
      // finished product leaves on the OUTPUT belt: settle onto the belt, roll right
      goal(REST_CX, 150);
      drop = Math.min(BELT - PLAT.y + 6, drop + dt * 0.05);
      ex += 4.6;
      let off = true;
      for (let i = 0; i < asm.length; i++) { pos[i].x = asm[i].x + ex; pos[i].y = asm[i].y + drop; if (pos[i].x < 610) off = false; }
      if (off) { prod = (prod + 1) % PRODUCTS.length; build(); step = 0; phase = "feed"; pT = 0; }
    }

    if (carry >= 0) { pos[carry].x = cur.x; pos[carry].y = cur.y; }

    cartX = lerp(cartX, Math.max(RAIL_MIN, Math.min(RAIL_MAX, cur.x)), 0.12);
    const cdx = cartX - REST_CX;
    carriage.setAttribute("transform", `translate(${cdx.toFixed(1)} 0)`);
    const { r1, r2 } = ik(cur.x - cdx, cur.y);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${PIV.x} ${PIV.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    grip.setAttribute("transform", `translate(300 266) scale(${g.toFixed(3)} 1) translate(-300 -266)`);

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
