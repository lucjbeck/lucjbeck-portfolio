/**
 * about.ts — Two robotic arms assembling the Penn shield from individual 3D-block cells.
 *
 * Layout philosophy:
 * - Every shield cell is a separate 34×34 3D block (one per grid position, no merging).
 * - Scatter positions are in the LEFT columns (x=60,100,140) and RIGHT columns
 *   (x=460,500,540) at the same row heights as the shield — so nothing sits under
 *   the crest area (x=180–420, y=96–456) while it is being assembled.
 * - Arms start from (90,300) and (510,300), well clear of the finished crest.
 * - Stable IK prevents configuration flips. CRUISE is fast enough that the
 *   assembly finishes while the user is still reading the About text (~20s).
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS   = "http://www.w3.org/2000/svg";

// Longer arms from further-out bases. 2-link reach = 245px, +L3 wrist = 315px.
// Extra margin on the 2-link sum keeps the elbow away from the full-stretch
// singularity (the source of the elbow "flip"/teleport) at the farthest cells.
const L1 = 125, L2 = 120, L3 = 70;

const BASE = [
  { bx: 90,  by: 300 },   // left arm — clear of shield left edge (x=180)
  { bx: 510, by: 300 },   // right arm — clear of shield right edge (x=420)
] as const;

// After finishing, arms fold back to a park pose up-and-out beside their bases.
// Kept well clear of the base (dist > L3) so the wrist link never degenerates.
const PARK_EE = [
  { x: 60,  y: 168 },
  { x: 540, y: 168 },
] as const;

const GRID = [
  "NNNNNNN", "NNNNNNN", "NNRWRNN", "NRRRRRN",
  "RWRRRWR", "NNNNNNN", ".NNNNN.", "..NNN..", "...N...",
];
const CELL = 40;
const BW   = CELL - 6;   // block width/height = 34px
const colX = (c: number) => 180 + c * CELL;
const rowY = (r: number) =>  96 + r * CELL;

const DEPTH = 5;
const COLORS: Record<string, { top: string; side: string; base: string; stroke: string }> = {
  N: { top: "#0D2E80", side: "#041548", base: "#020B2A", stroke: "#1A3D9A" },
  R: { top: "#B80000", side: "#6B0000", base: "#420000", stroke: "#D41010" },
  W: { top: "#F0F0F0", side: "#A8A8A8", base: "#888888", stroke: "#FFFFFF" },
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Piece = { el: SVGGElement; tx: number; ty: number };

function ik2d(bx: number, by: number, tx: number, ty: number, side: number) {
  let dx = tx - bx, dy = ty - by;
  let d = Math.hypot(dx, dy);
  if (d === 0) return { ex: bx + L1, ey: by };
  const maxR = L1 + L2 - 1, minR = 2;
  if (d > maxR) { dx *= maxR / d; dy *= maxR / d; d = maxR; }
  if (d < minR) { dx *= minR / d; dy *= minR / d; d = minR; }
  const c2 = Math.max(-1, Math.min(1, (d*d - L1*L1 - L2*L2) / (2*L1*L2)));
  const a2  = Math.acos(c2);
  const a1  = Math.atan2(dy, dx) - Math.atan2(side * L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
  return { ex: bx + L1 * Math.cos(a1), ey: by + L1 * Math.sin(a1) };
}

// Stable 3-link IK: picks the elbow solution closest to prev position to avoid flips
function ik3stable(bx: number, by: number, tx: number, ty: number, prevEx: number, prevEy: number) {
  const dx = tx - bx, dy = ty - by;
  const d  = Math.hypot(dx, dy) || 1;
  const wx = tx - L3 * dx / d;
  const wy = ty - L3 * dy / d;
  const s1 = ik2d(bx, by, wx, wy, +1);
  const s2 = ik2d(bx, by, wx, wy, -1);
  const d1 = Math.hypot(s1.ex - prevEx, s1.ey - prevEy);
  const d2 = Math.hypot(s2.ex - prevEx, s2.ey - prevEy);
  const ch = d1 <= d2 ? s1 : s2;
  return { ex: ch.ex, ey: ch.ey, wx, wy };
}

function createBlock(w: number, h: number, colorKey: string, layer: SVGGElement): SVGGElement {
  const c = COLORS[colorKey];
  const g = document.createElementNS(SVGNS, "g");
  const hw = w / 2, hh = h / 2;

  const bot = document.createElementNS(SVGNS, "polygon");
  bot.setAttribute("fill", c.base);
  bot.setAttribute("points",
    `${-hw+DEPTH},${hh} ${hw+DEPTH},${hh} ${hw+DEPTH},${hh+DEPTH} ${-hw+DEPTH},${hh+DEPTH}`);

  const rgt = document.createElementNS(SVGNS, "polygon");
  rgt.setAttribute("fill", c.side);
  rgt.setAttribute("points",
    `${hw},${-hh} ${hw+DEPTH},${-hh+DEPTH} ${hw+DEPTH},${hh+DEPTH} ${hw},${hh}`);

  const top = document.createElementNS(SVGNS, "rect");
  top.setAttribute("x", String(-hw)); top.setAttribute("y", String(-hh));
  top.setAttribute("width", String(w)); top.setAttribute("height", String(h));
  top.setAttribute("rx", "2");
  top.setAttribute("fill", c.top);
  top.setAttribute("stroke", c.stroke); top.setAttribute("stroke-width", "1");

  g.appendChild(bot); g.appendChild(rgt); g.appendChild(top);
  layer.appendChild(g);
  return g as SVGGElement;
}

function createLetterBlock(letter: string, layer: SVGGElement): SVGGElement {
  const g = createBlock(BW, BW, "N", layer);
  const t = document.createElementNS(SVGNS, "text");
  t.setAttribute("x", "0"); t.setAttribute("y", "1");
  t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central");
  t.setAttribute("font-family", "var(--font-display)");
  t.setAttribute("font-weight", "800"); t.setAttribute("font-size", "24");
  t.setAttribute("fill", "#EDEDED"); t.setAttribute("opacity", "0.9");
  t.textContent = letter;
  g.appendChild(t);
  return g as SVGGElement;
}

export function initAboutAssembly(): void {
  if (typeof window === "undefined") return;
  const root  = document.querySelector<HTMLElement>("#about-assembly");
  if (!root) return;
  const layer  = root.querySelector<SVGGElement>("[data-pieces]");
  const armGs  = Array.from(root.querySelectorAll<SVGGElement>(".ab-arm-2d"));
  if (!layer || armGs.length < 2) return;
  const rnd = mulberry32(20259);

  // ── One 34×34 block per shield cell ──────────────────────────────────
  const pieces: Piece[] = [];
  GRID.forEach((row, r) => {
    for (let c = 0; c < 7; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      pieces.push({ el: createBlock(BW, BW, ch, layer), tx: colX(c), ty: rowY(r) });
    }
  });

  // PENN letters: packed close together, CENTERED under the crest (shield
  // centre x = 300). Four blocks spaced by CELL, symmetric about x=300.
  const PENN_CY = rowY(10);   // y = 496 — two rows below shield bottom
  const LETTERS = [
    { ch: "P", tx: 240 },
    { ch: "E", tx: 280 },
    { ch: "N", tx: 320 },
    { ch: "N", tx: 360 },
  ];
  const letterPieces: Piece[] = LETTERS.map(lt => ({
    el: createLetterBlock(lt.ch, layer),
    tx: lt.tx, ty: PENN_CY,
  }));
  const allPieces = [...pieces, ...letterPieces];

  // ── Assign pieces to arms: left arm handles tx<300, right handles tx≥300 ─
  const sorted = [...allPieces].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  const queues: Piece[][] = [[], []];
  for (const p of sorted) {
    if      (p.tx < 300) queues[0].push(p);
    else if (p.tx > 300) queues[1].push(p);
    else queues[queues[0].length <= queues[1].length ? 0 : 1].push(p);
  }

  // ── Scatter: pieces wait in side columns OUTSIDE the shield area ──────
  // Left arm pieces → 3 left columns (x=60,100,140), rows 0..11 (y=96..536)
  // Right arm pieces → 3 right columns (x=460,500,540), same rows
  // Positions that overlap each arm's base mount are excluded so no block
  // renders behind the base plate. Also excludes positions within 55px of the
  // arm pivot to avoid near-singularity IK glitches on pickup.
  const LEFT_COLS  = [60, 100, 140];
  const RIGHT_COLS = [460, 500, 540];
  // Extra rows (11, 12) give enough slots if middle rows are excluded
  const SCATTER_ROWS = Array.from({ length: 12 }, (_, r) => rowY(r));

  function makeSidePositions(
    cols: number[], baseCx: number, baseCy: number
  ): { x: number; y: number }[] {
    const BW2  = BW / 2 + DEPTH;        // half-block incl. 3D depth
    // Left-arm plate: x=baseCx-29..baseCx+29, y=baseCy-28..baseCy+12
    const px0 = baseCx - 29, px1 = baseCx + 29;
    const py0 = baseCy - 28, py1 = baseCy + 12;
    // Keep every scatter slot well outside the wrist-link length (L3=70) from the
    // pivot. Targets closer than ~L3 make the "third link points at target" math
    // overshoot the base and the wrist spins — the teleport the arms showed.
    const MIN_DIST = 95;

    const pos: { x: number; y: number }[] = [];
    for (const x of cols) {
      for (const y of SCATTER_ROWS) {
        // Block at (x,y) occupies x±BW2, y±BW2 (approx)
        const overlapMount =
          x - BW2 < px1 && x + BW2 > px0 &&
          y - BW2 < py1 && y + BW2 > py0;
        const tooClose = Math.hypot(x - baseCx, y - baseCy) < MIN_DIST;
        if (!overlapMount && !tooClose) pos.push({ x, y });
      }
    }
    // Shuffle deterministically
    for (let i = pos.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pos[i], pos[j]] = [pos[j], pos[i]];
    }
    return pos;
  }

  const leftSlots  = makeSidePositions(LEFT_COLS,  BASE[0].bx, BASE[0].by);
  const rightSlots = makeSidePositions(RIGHT_COLS, BASE[1].bx, BASE[1].by);

  // Add per-piece position jitter so scatter looks like a pile, not a perfect grid
  const jitter = mulberry32(59265);
  const jx = () => Math.round((jitter() - 0.5) * 16);  // ±8 px horizontal
  const jy = () => Math.round((jitter() - 0.5) * 16);  // ±8 px vertical

  const startPos = new Map<Piece, { x: number; y: number }>();
  queues[0].forEach((p, i) => {
    const s = leftSlots[i % leftSlots.length];
    startPos.set(p, { x: s.x + jx(), y: s.y + jy() });
  });
  queues[1].forEach((p, i) => {
    const s = rightSlots[i % rightSlots.length];
    startPos.set(p, { x: s.x + jx(), y: s.y + jy() });
  });

  // Place pieces at their scatter positions
  for (const p of allPieces) {
    const s = startPos.get(p)!;
    p.el.setAttribute("transform", `translate(${s.x} ${s.y})`);
  }

  const lockPiece = (p: Piece) =>
    p.el.setAttribute("transform", `translate(${p.tx} ${p.ty})`);

  if (window.matchMedia(REDUCED).matches) {
    for (const p of allPieces) lockPiece(p);
    return;
  }

  // ── Arm renderer ──────────────────────────────────────────────────────
  function makeArm(g: SVGGElement, cfg: typeof BASE[number]) {
    const ua   = g.querySelector<SVGLineElement>("[data-ua]")!;
    const ej   = g.querySelector<SVGCircleElement>("[data-ej]")!;
    const fa   = g.querySelector<SVGLineElement>("[data-fa]")!;
    const wj   = g.querySelector<SVGCircleElement>("[data-wj]")!;
    const wr   = g.querySelector<SVGLineElement>("[data-wr]")!;
    const grip = g.querySelector<SVGGElement>("[data-grip]")!;

    const side = cfg.bx < 300 ? +1 : -1;
    // Start at a comfortable mid-reach above the base (no near-singularity)
    const cur  = { x: cfg.bx + side * 120, y: cfg.by - 150 };
    const vel  = { x: 0, y: 0 };
    // Seed elbow hint above & slightly outward so first IK solution is "elbow down"
    let prevEx = cfg.bx + side * 40;
    let prevEy = cfg.by - 120;

    const render = () => {
      const ik = ik3stable(cfg.bx, cfg.by, cur.x, cur.y, prevEx, prevEy);
      prevEx = ik.ex; prevEy = ik.ey;
      ua.setAttribute("x1", String(cfg.bx)); ua.setAttribute("y1", String(cfg.by));
      ua.setAttribute("x2", ik.ex.toFixed(1)); ua.setAttribute("y2", ik.ey.toFixed(1));
      ej.setAttribute("cx", ik.ex.toFixed(1)); ej.setAttribute("cy", ik.ey.toFixed(1));
      fa.setAttribute("x1", ik.ex.toFixed(1)); fa.setAttribute("y1", ik.ey.toFixed(1));
      fa.setAttribute("x2", ik.wx.toFixed(1)); fa.setAttribute("y2", ik.wy.toFixed(1));
      wj.setAttribute("cx", ik.wx.toFixed(1)); wj.setAttribute("cy", ik.wy.toFixed(1));
      wr.setAttribute("x1", ik.wx.toFixed(1)); wr.setAttribute("y1", ik.wy.toFixed(1));
      wr.setAttribute("x2", cur.x.toFixed(1)); wr.setAttribute("y2", cur.y.toFixed(1));
      grip.setAttribute("transform", `translate(${cur.x.toFixed(1)} ${cur.y.toFixed(1)})`);
    };
    render();
    return { cur, vel, render, grip, g };
  }

  // ── Velocity-steering motion ──────────────────────────────────────────
  const CRUISE   = 13.0;
  const STEER    = 0.22;
  const R_COARSE = 14;    // px: pickup radius (small = block doesn't visibly jump on grab)
  const R_FINE   = 11;    // px: lock placed piece at target (must be > CRUISE for capture)

  type Phase = "reach" | "carry" | "park";
  interface ArmState {
    arm: ReturnType<typeof makeArm>;
    phase: Phase;
    idx: number;
    carry: Piece | null;
    target: { x: number; y: number };
    queue: Piece[];
    done: boolean;
  }

  function steer(vel: { x: number; y: number }, cur: { x: number; y: number },
                 tgt: { x: number; y: number }): number {
    const dx = tgt.x - cur.x, dy = tgt.y - cur.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.1) {
      vel.x += ((dx / dist) * CRUISE - vel.x) * STEER;
      vel.y += ((dy / dist) * CRUISE - vel.y) * STEER;
    }
    cur.x += vel.x; cur.y += vel.y;
    return dist;
  }

  function tickArm(s: ArmState): void {
    if (s.done) return;
    const dist = steer(s.arm.vel, s.arm.cur, s.target);
    s.arm.render();

    if (s.carry) {
      s.carry.el.setAttribute("transform",
        `translate(${s.arm.cur.x.toFixed(1)} ${s.arm.cur.y.toFixed(1)})`);
    }

    const thresh = s.phase === "carry" ? R_FINE : R_COARSE;
    if (dist < thresh) {
      if (s.phase === "reach") {
        s.carry = s.queue[s.idx];
        layer.appendChild(s.carry.el);  // carried piece renders on top
        s.arm.grip.classList.add("is-gripping");
        s.phase = "carry";
        s.target = { x: s.queue[s.idx].tx, y: s.queue[s.idx].ty };

      } else if (s.phase === "carry") {
        lockPiece(s.queue[s.idx]);
        s.carry = null;
        s.arm.grip.classList.remove("is-gripping");
        s.idx++;

        if (s.idx < s.queue.length) {
          s.phase = "reach";
          s.target = startPos.get(s.queue[s.idx])!;
        } else {
          s.phase = "park";
          s.target = PARK_EE[armGs.indexOf(s.arm.g)] ?? PARK_EE[0];
        }

      } else {
        s.done = true;
      }
    }
  }

  // ── Start on scroll ───────────────────────────────────────────────────
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.disconnect();

      const states: ArmState[] = BASE.map((cfg, ai) => ({
        arm: makeArm(armGs[ai], cfg),
        phase: "reach" as Phase,
        idx: 0,
        carry: null,
        target: startPos.get(queues[ai][0])!,
        queue: queues[ai],
        done: queues[ai].length === 0,
      }));

      const animate = () => {
        tickArm(states[0]);
        tickArm(states[1]);
        if (!states[0].done || !states[1].done) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      break;
    }
  }, { rootMargin: "0px 0px -15% 0px" });
  io.observe(root);
}
