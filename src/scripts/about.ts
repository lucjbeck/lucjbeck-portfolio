/**
 * about.ts — TWO gantry cranes assemble a colored Penn shield + "PENN" in parallel.
 *
 * Each crane is a carriage on the ceiling rail (X) + a vertical hoist with a gripper
 * (Y) -- two prismatic DOF, so it always stays in frame. The shield is a 7x9 color
 * grid merged into rounded-rect pieces; pieces already carry their Penn color
 * (navy/red/white) and lock in with a seeded slight rotation/offset. Spring-eased
 * effector motion. Plays on scroll-in; reduced-motion shows the finished result.
 * Mode: two cranes working in parallel (left half / right half).
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS = "http://www.w3.org/2000/svg";
const RAIL_Y = 42;
const LIFT_Y = 64; // hoist-up height, above the shield top

const GRID = [
  "NNNNNNN", "NNNNNNN", "NNRWRNN", "NRRRRRN",
  "RWRRRWR", "NNNNNNN", ".NNNNN.", "..NNN..", "...N...",
];
const CELL = 40;
const colX = (c: number) => 180 + c * CELL;
const rowY = (r: number) => 96 + r * CELL;
const COLORCLASS: Record<string, string> = { N: "navy", R: "red", W: "white" };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Piece = { el: SVGGraphicsElement; tx: number; ty: number; rot: number; ox: number; oy: number };

export function initAboutAssembly(): void {
  if (typeof window === "undefined") return;
  const root = document.querySelector<HTMLElement>("#about-assembly");
  if (!root) return;
  const layer = root.querySelector<SVGGElement>("[data-pieces]");
  const armGs = Array.from(root.querySelectorAll<SVGGElement>(".ab-arm"));
  if (!layer || armGs.length < 2) return;
  const rnd = mulberry32(20259);

  // ---- shield pieces: merge horizontal runs, split runs longer than 4 ----
  const specs: { cls: string; cs: number; ce: number; r: number }[] = [];
  GRID.forEach((row, r) => {
    let c = 0;
    while (c < 7) {
      const ch = row[c];
      if (ch === ".") { c++; continue; }
      let ce = c; while (ce + 1 < 7 && row[ce + 1] === ch) ce++;
      const len = ce - c + 1;
      if (len > 4) { const mid = c + Math.ceil(len / 2) - 1; specs.push({ cls: COLORCLASS[ch], cs: c, ce: mid, r }); specs.push({ cls: COLORCLASS[ch], cs: mid + 1, ce, r }); }
      else specs.push({ cls: COLORCLASS[ch], cs: c, ce, r });
      c = ce + 1;
    }
  });

  const pieces: Piece[] = [];
  for (const s of specs) {
    const w = (s.ce - s.cs + 1) * CELL - 6, h = CELL - 6;
    const el = document.createElementNS(SVGNS, "rect");
    el.setAttribute("class", `ab-pc ${s.cls}`);
    el.setAttribute("x", String(-w / 2)); el.setAttribute("y", String(-h / 2));
    el.setAttribute("width", String(w)); el.setAttribute("height", String(h)); el.setAttribute("rx", "6");
    layer.appendChild(el);
    pieces.push({ el, tx: (colX(s.cs) + colX(s.ce)) / 2, ty: rowY(s.r), rot: rnd() * 6 - 3, ox: rnd() * 4 - 2, oy: rnd() * 4 - 2 });
  }

  // ---- PENN letters ----
  const letterPieces: Piece[] = [];
  [{ ch: "P", x: 150 }, { ch: "E", x: 250 }, { ch: "N", x: 350 }, { ch: "N", x: 450 }].forEach((lt) => {
    const el = document.createElementNS(SVGNS, "text");
    el.setAttribute("class", "ab-letter");
    el.textContent = lt.ch;
    layer.appendChild(el);
    letterPieces.push({ el, tx: lt.x, ty: 516, rot: rnd() * 8 - 4, ox: rnd() * 4 - 2, oy: rnd() * 4 - 2 });
  });

  // ---- order (shield top-rows first, then letters) + assign by side ----
  const all = [...pieces].sort((a, b) => a.ty - b.ty).concat(letterPieces);
  const queues: Piece[][] = [[], []];
  // left handles left targets, right handles right; centre-column pieces go to
  // whichever queue is smaller, so both cranes finish at about the same time.
  for (const p of all) {
    if (p.tx < 300) queues[0].push(p);
    else if (p.tx > 300) queues[1].push(p);
    else queues[queues[0].length <= queues[1].length ? 0 : 1].push(p);
  }

  // ---- deterministic scattered starts in each side's lower bin ----
  const start = new Map<Piece, { x: number; y: number }>();
  queues.forEach((q, a) => q.forEach((p, j) => {
    const col = j % 4, row = Math.floor(j / 4);
    start.set(p, { x: (a === 0 ? 120 : 330) + col * 42 + (rnd() * 8 - 4), y: 470 + row * 30 + (rnd() * 8 - 4) });
  }));
  for (const p of all) { const s = start.get(p)!; p.el.setAttribute("transform", `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`); }

  const lock = (p: Piece) => p.el.setAttribute("transform", `translate(${(p.tx + p.ox).toFixed(1)} ${(p.ty + p.oy).toFixed(1)}) rotate(${p.rot.toFixed(1)})`);

  // ---- crane controller (carriage X on rail + vertical hoist Y) ----
  function makeCrane(g: SVGGElement) {
    const restX = Number(g.dataset.restx), min = Number(g.dataset.min), max = Number(g.dataset.max);
    const cart = g.querySelector<SVGRectElement>("[data-cart]")!;
    const r1 = g.querySelector<SVGCircleElement>("[data-roll]")!;
    const r2 = g.querySelector<SVGCircleElement>("[data-roll2]")!;
    const hoist = g.querySelector<SVGLineElement>("[data-hoist]")!;
    const grip = g.querySelector<SVGGElement>("[data-grip]")!;
    const cur = { x: restX, y: 120 };
    let carry: Piece | null = null;
    const render = () => {
      const cx = Math.max(min, Math.min(max, cur.x));
      cart.setAttribute("x", (cx - 18).toFixed(1));
      r1.setAttribute("cx", (cx - 10).toFixed(1)); r2.setAttribute("cx", (cx + 10).toFixed(1));
      hoist.setAttribute("x1", cx.toFixed(1)); hoist.setAttribute("x2", cx.toFixed(1)); hoist.setAttribute("y2", cur.y.toFixed(1));
      grip.setAttribute("transform", `translate(${cx.toFixed(1)} ${cur.y.toFixed(1)})`);
      if (carry) carry.el.setAttribute("transform", `translate(${cx.toFixed(1)} ${cur.y.toFixed(1)})`);
    };
    const springTo = (gx: number, gy: number, k = 0.2, damp = 0.56) =>
      new Promise<void>((res) => {
        let vx = 0, vy = 0, f = 0;
        const step = () => {
          vx = (vx + (gx - cur.x) * k) * damp; vy = (vy + (gy - cur.y) * k) * damp;
          cur.x += vx; cur.y += vy; render(); f++;
          if ((Math.hypot(gx - cur.x, gy - cur.y) < 0.7 && Math.hypot(vx, vy) < 0.5) || f > 150) { cur.x = gx; cur.y = gy; render(); res(); }
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    return { cur, restX, render, springTo, grip, setCarry: (c: Piece | null) => (carry = c) };
  }

  // reduced motion: finished colored result, cranes parked up at rest
  if (window.matchMedia(REDUCED).matches) {
    for (const p of all) lock(p);
    armGs.forEach((g) => { const c = makeCrane(g); c.cur.x = c.restX; c.cur.y = 70; c.render(); });
    return;
  }

  async function runCrane(g: SVGGElement, q: Piece[]) {
    const cr = makeCrane(g);
    for (const p of q) {
      const s = start.get(p)!;
      await cr.springTo(s.x, s.y);              // slide over piece, hoist down
      cr.grip.classList.add("is-gripping");
      cr.setCarry(p);
      await new Promise((r) => setTimeout(r, 80));
      await cr.springTo(p.tx, p.ty, 0.2, 0.55); // straight to its place (carriage + hoist together)
      cr.setCarry(null);
      lock(p);
      cr.grip.classList.remove("is-gripping");
      await new Promise((r) => setTimeout(r, 120));
    }
    await cr.springTo(cr.restX, 70, 0.1, 0.7);  // park up at rest
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); runCrane(armGs[0], queues[0]); runCrane(armGs[1], queues[1]); break; }
  }, { rootMargin: "0px 0px -15% 0px" });
  io.observe(root);
}
