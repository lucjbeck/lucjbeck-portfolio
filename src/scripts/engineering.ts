/**
 * engineering.ts — legible assembly cell (landing).
 * Flow reads left to right: raw parts arrive on the INPUT belt, a ceiling-slider
 * arm with a suction end-effector picks them and assembles a product on the
 * central station, and the finished unit leaves on the OUTPUT belt. Parts never
 * return to the belt they came from. Builds one of three products in rotation.
 *
 * The end-effector is a suction pad (kept upright) that descends onto the top of
 * each part and lifts it, so the grab reads correctly for any part width.
 * Lazy-inits; reduced-motion safe.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS = "http://www.w3.org/2000/svg";
const DEG = 180 / Math.PI;

const REST_CX = 300;
const PIV = { x: 300, y: 54 };
const ELBOW0 = { x: 300, y: 162 };
const L1 = 108, L2 = 104;
const RAIL_MIN = 190, RAIL_MAX = 320;
const BELT_SURFACE = 276;         // top of the belt rect (parts rest here)
const BELT = 269;                 // part centre line riding on the belt
const PICK = { x: 206, y: BELT }; // end of the input belt
const STATION_TOP = 248;          // top surface of the central station
const PLAT_X = 300;
const GRAB_DY = 15;               // wrist sits this far above the held part's centre

type Spec =
  | { t: "rect"; w: number; h: number; dx: number; dy: number; hot?: boolean }
  | { t: "circ"; r: number; dx: number; dy: number; hot?: boolean }
  | { t: "head"; w: number; h: number; dx: number; dy: number }
  | { t: "minarm"; dx: number; dy: number };

const half = (s: Spec) => (s.t === "circ" ? s.r : s.t === "minarm" ? 0 : s.h / 2);

// three products, ~4 parts each (minimal), built bottom-up
const PRODUCTS: Spec[][] = [
  [ // rover with a mini robot arm on top
    { t: "circ", r: 7, dx: -15, dy: 0 },
    { t: "circ", r: 7, dx: 15, dy: 0 },
    { t: "rect", w: 48, h: 12, dx: 0, dy: -8 },
    { t: "rect", w: 28, h: 16, dx: 0, dy: -24 },
    { t: "minarm", dx: 4, dy: -32 },
  ],
  [ // drone
    { t: "rect", w: 34, h: 10, dx: 0, dy: 0 },
    { t: "circ", r: 8, dx: -22, dy: -6 },
    { t: "circ", r: 8, dx: 22, dy: -6 },
    { t: "circ", r: 3, dx: 0, dy: -4, hot: true },
  ],
  [ // walker robot (legs, arms, face)
    { t: "rect", w: 7, h: 16, dx: -8, dy: 0 },
    { t: "rect", w: 7, h: 16, dx: 8, dy: 0 },
    { t: "rect", w: 26, h: 20, dx: 0, dy: -18 },
    { t: "rect", w: 5, h: 16, dx: -16, dy: -16 },
    { t: "rect", w: 5, h: 16, dx: 16, dy: -16 },
    { t: "head", w: 18, h: 14, dx: 0, dy: -37 },
  ],
];

// how each finished unit leaves: rover rolls, drone flies, robot walks
const EXITS = ["roll", "fly", "walk"] as const;

export function initEngineering(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;
  const root = document.querySelector<HTMLElement>("#eng-hero");
  if (!root) return;
  const carriage = root.querySelector<SVGGElement>("[data-carriage]");
  const shoulder = root.querySelector<SVGGElement>("[data-arm-sh]");
  const elbow = root.querySelector<SVGGElement>("[data-arm-el]");
  const hand = root.querySelector<SVGGElement>("[data-arm-hand]");
  const layer = root.querySelector<SVGGElement>("[data-parts]");
  const rollers = Array.from(root.querySelectorAll<SVGGElement>("[data-roller]"));
  if (!carriage || !shoulder || !elbow || !hand || !layer) return;

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
  let yShift = 0;

  function build() {
    layer!.innerHTML = "";
    specs = PRODUCTS[prod]; els = []; pos = []; asm = [];
    // shift the whole product so its lowest part rests on the station top
    let lowest = -Infinity;
    for (const s of specs) lowest = Math.max(lowest, s.dy + half(s));
    yShift = STATION_TOP - lowest;
    const mkRect = (w: number, h: number, cls: string) => { const r = document.createElementNS(SVGNS, "rect"); r.setAttribute("x", String(-w / 2)); r.setAttribute("y", String(-h / 2)); r.setAttribute("width", String(w)); r.setAttribute("height", String(h)); r.setAttribute("rx", "2"); r.setAttribute("class", cls); return r; };
    const mkCirc = (cx: number, cy: number, r: number, cls: string) => { const c = document.createElementNS(SVGNS, "circle"); c.setAttribute("cx", String(cx)); c.setAttribute("cy", String(cy)); c.setAttribute("r", String(r)); c.setAttribute("class", cls); return c; };
    const mkLine = (x1: number, y1: number, x2: number, y2: number, cls: string) => { const l = document.createElementNS(SVGNS, "line"); l.setAttribute("x1", String(x1)); l.setAttribute("y1", String(y1)); l.setAttribute("x2", String(x2)); l.setAttribute("y2", String(y2)); l.setAttribute("class", cls); return l; };
    for (const sp of specs) {
      let el: SVGGraphicsElement;
      if (sp.t === "rect") {
        el = mkRect(sp.w, sp.h, sp.hot ? "eng-part-hot" : "eng-part");
      } else if (sp.t === "circ") {
        el = mkCirc(0, 0, sp.r, sp.hot ? "eng-part-hot" : "eng-part");
      } else if (sp.t === "head") {
        el = document.createElementNS(SVGNS, "g");
        el.appendChild(mkRect(sp.w, sp.h, "eng-part"));
        el.appendChild(mkCirc(-sp.w / 4, -sp.h / 8, 1.8, "eng-eye"));
        el.appendChild(mkCirc(sp.w / 4, -sp.h / 8, 1.8, "eng-eye"));
      } else { // minarm: a small 2-joint arm with a gripper, mounted at the origin
        el = document.createElementNS(SVGNS, "g");
        el.appendChild(mkRect(10, 4, "eng-part"));
        el.appendChild(mkLine(0, -2, -8, -13, "eng-mini"));
        el.appendChild(mkCirc(-8, -13, 2, "eng-mini-joint"));
        el.appendChild(mkLine(-8, -13, 3, -21, "eng-mini"));
        el.appendChild(mkLine(0, -21, 0, -27, "eng-mini-grip"));
        el.appendChild(mkLine(6, -21, 6, -27, "eng-mini-grip"));
        el.appendChild(mkLine(0, -21, 6, -21, "eng-mini-grip"));
      }
      el.style.opacity = "0";
      layer!.appendChild(el);
      els.push(el); pos.push({ x: 0, y: 0, vis: 0 }); asm.push({ x: 0, y: 0 });
    }
  }
  build();
  const slotOf = (i: number) => ({ x: PLAT_X + specs[i].dx, y: yShift + specs[i].dy });

  const cur = { x: REST_CX, y: 150 };
  let cartX = REST_CX;
  let phase = "feed", pT = 0, last = performance.now(), step = 0, carry = -1, rang = 0;
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
      goal(PICK.x, PICK.y);
      if (Math.abs(pos[step].x - PICK.x) < 3 && near(PICK.x, PICK.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      if (pT > 240) { carry = step; phase = "lift"; pT = 0; }   // suction engages
    } else if (phase === "lift") {
      goal(PICK.x, 150);
      if (near(PICK.x, 150)) { phase = "carry"; pT = 0; }
    } else if (phase === "carry") {
      const s = slotOf(step); goal(s.x, s.y, 0.09);
      if (near(s.x, s.y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      const s = slotOf(step); pos[step].x = s.x; pos[step].y = s.y; asm[step] = { x: s.x, y: s.y };
      if (pT > 220) { carry = -1; step++; phase = step < specs.length ? "feed" : "done"; pT = 0; }
    } else if (phase === "done") {
      goal(REST_CX, 150);                            // hold so the finished unit is seen
      if (pT > 850) { phase = "eject"; pT = 0; ex = 0; drop = 0; }
    } else if (phase === "eject") {
      // the finished unit leaves under its own locomotion
      goal(REST_CX, 150);
      const mode = EXITS[prod];
      let off = true;
      if (mode === "fly") {
        ex += 2.2; drop -= dt * 0.16;                 // rotors lift it up and away
        for (let i = 0; i < asm.length; i++) { pos[i].x = asm[i].x + ex; pos[i].y = asm[i].y + drop; if (pos[i].x < 610 && pos[i].y > -55) off = false; }
      } else {
        drop = Math.min(BELT_SURFACE - STATION_TOP, drop + dt * 0.06); // settle onto the belt first
        const settled = drop >= BELT_SURFACE - STATION_TOP - 0.5;
        if (settled) ex += mode === "walk" ? 2.2 : 2.9;
        const bob = mode === "walk" && settled ? -Math.abs(Math.sin(ex * 0.18)) * 3 : 0; // footsteps
        for (let i = 0; i < asm.length; i++) { pos[i].x = asm[i].x + ex; pos[i].y = asm[i].y + drop + bob; if (pos[i].x < 610) off = false; }
      }
      if (off) { prod = (prod + 1) % PRODUCTS.length; build(); step = 0; phase = "feed"; pT = 0; }
    }

    if (carry >= 0) { pos[carry].x = cur.x; pos[carry].y = cur.y; }

    // wrist sits above the held part; carriage slides above the target
    const wristX = cur.x, wristY = cur.y - GRAB_DY;
    cartX = lerp(cartX, Math.max(RAIL_MIN, Math.min(RAIL_MAX, wristX)), 0.12);
    const cdx = cartX - REST_CX;
    carriage.setAttribute("transform", `translate(${cdx.toFixed(1)} 0)`);
    const { r1, r2 } = ik(wristX - cdx, wristY);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${PIV.x} ${PIV.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    hand.setAttribute("transform", `translate(${wristX.toFixed(1)} ${wristY.toFixed(1)})`);

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
