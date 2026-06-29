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

// Two NEAR-EQUAL links. This is deliberate: a 2-link arm's inner singularity
// (where the elbow can flip) sits at distance |L1-L2| from the base. Making the
// links almost equal collapses that singularity to ~0px from the base, which the
// end-effector never reaches — so the elbow never flips, even when the EE path
// grazes the base. Total reach L1+L2 = 315px covers the farthest cell (~273px).
// The "wrist" is purely cosmetic: a marker placed partway along the 2nd link.
const L1 = 158, L2 = 157;
const WRIST_FRAC = 0.55;   // wrist joint sits 55% from elbow → grip along link 2

const BASE = [
  { bx: 90,  by: 300 },   // left arm — clear of shield left edge (x=180)
  { bx: 510, by: 300 },   // right arm — clear of shield right edge (x=420)
] as const;

// After finishing, arms fold back to a park pose up-and-out beside their bases.
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
    // Keep scatter slots away from the base so the arm isn't grabbing from a
    // fully-folded pose, and so piles read as piles around the workspace edge.
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

    // Fixed elbow branch per arm — the one that keeps the elbow on-canvas across
    // the whole workspace. With a fixed side there is no solution-switching, so
    // the elbow can never flip. Left arm bends one way, right arm mirrors it.
    const side = cfg.bx < 300 ? -1 : +1;
    // Start at a sensible in-frame rest pose reaching up toward the work area.
    const cur  = { x: cfg.bx + (cfg.bx < 300 ? 90 : -90), y: cfg.by - 130 };
    const vel  = { x: 0, y: 0 };

    const render = () => {
      const { ex, ey } = ik2d(cfg.bx, cfg.by, cur.x, cur.y, side);
      // cosmetic wrist marker partway along the rigid 2nd link (elbow → grip)
      const wx = ex + WRIST_FRAC * (cur.x - ex);
      const wy = ey + WRIST_FRAC * (cur.y - ey);

      ua.setAttribute("x1", String(cfg.bx)); ua.setAttribute("y1", String(cfg.by));
      ua.setAttribute("x2", ex.toFixed(1)); ua.setAttribute("y2", ey.toFixed(1));
      ej.setAttribute("cx", ex.toFixed(1)); ej.setAttribute("cy", ey.toFixed(1));
      fa.setAttribute("x1", ex.toFixed(1)); fa.setAttribute("y1", ey.toFixed(1));
      fa.setAttribute("x2", wx.toFixed(1)); fa.setAttribute("y2", wy.toFixed(1));
      wj.setAttribute("cx", wx.toFixed(1)); wj.setAttribute("cy", wy.toFixed(1));
      wr.setAttribute("x1", wx.toFixed(1)); wr.setAttribute("y1", wy.toFixed(1));
      wr.setAttribute("x2", cur.x.toFixed(1)); wr.setAttribute("y2", cur.y.toFixed(1));
      grip.setAttribute("transform", `translate(${cur.x.toFixed(1)} ${cur.y.toFixed(1)})`);
    };
    render();
    return { cur, vel, render, grip, g, base: cfg };
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
                 tgt: { x: number; y: number },
                 base: { bx: number; by: number }): number {
    const dx = tgt.x - cur.x, dy = tgt.y - cur.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.1) {
      vel.x += ((dx / dist) * CRUISE - vel.x) * STEER;
      vel.y += ((dy / dist) * CRUISE - vel.y) * STEER;
    }
    // Slow the end-effector as it passes near the base. Near the base the arm is
    // nearly folded, so the kinematics amplify EE motion into large elbow swings;
    // crawling through that zone spreads the elbow sweep smoothly across frames
    // instead of whipping it in one frame.
    const db   = Math.hypot(cur.x - base.bx, cur.y - base.by);
    const slow = Math.max(0.22, Math.min(1, (db - 50) / 110));
    cur.x += vel.x * slow; cur.y += vel.y * slow;
    return dist;
  }

  function tickArm(s: ArmState): void {
    if (s.done) return;
    const dist = steer(s.arm.vel, s.arm.cur, s.target, s.arm.base);
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
