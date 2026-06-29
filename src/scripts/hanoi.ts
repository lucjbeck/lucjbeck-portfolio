/**
 * hanoi.ts — top-down 2-link arm that SOLVES Tower of Hanoi (3 disks) for real.
 *
 * The move list comes from the actual recursive algorithm, and peg state is held
 * as real stacks. Every move is validated: only the top disk may move, and never
 * onto a smaller disk; the run must end with all disks on the destination peg.
 * The arm reaches each target with closed-form 2-link IK; joint angles are driven
 * by an under-damped spring integrator (smooth, settles, no jank). Plays on
 * scroll-in and loops; prefers-reduced-motion shows the solved state at rest.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const BASE = { x: 300, y: 600 };
const L1 = 190, L2 = 180;
const PEGX = [150, 300, 450];
const BASE_Y = 470, DH = 36, CARRY_Y = 330;
const cy = (level: number) => BASE_Y - level * DH - 18;

// recursive solver -> ordered [{disk, from, to}]
function solve(n: number, from: number, to: number, via: number, out: { disk: number; from: number; to: number }[] = []) {
  if (n === 0) return out;
  solve(n - 1, from, via, to, out);
  out.push({ disk: n, from, to });
  solve(n - 1, via, to, from, out);
  return out;
}

export function initHanoi(): void {
  if (typeof window === "undefined") return;
  const root = document.querySelector<HTMLElement>("#hanoi");
  if (!root) return;
  const upper = root.querySelector<SVGLineElement>("[data-upper]");
  const fore = root.querySelector<SVGLineElement>("[data-fore]");
  const elbowC = root.querySelector<SVGCircleElement>("[data-elbow]");
  const grip = root.querySelector<SVGGElement>("[data-grip]");
  const diskEls = new Map<number, SVGRectElement>();
  root.querySelectorAll<SVGRectElement>("[data-disk]").forEach((el) => diskEls.set(Number(el.dataset.size), el));
  if (!upper || !fore || !elbowC || !grip || diskEls.size < 3) return;

  const arm = { a1: -Math.PI / 2, a2: 0 };
  let carry: SVGRectElement | null = null;

  const fk = () => {
    const ex = BASE.x + L1 * Math.cos(arm.a1);
    const ey = BASE.y + L1 * Math.sin(arm.a1);
    const tx = ex + L2 * Math.cos(arm.a1 + arm.a2);
    const ty = ey + L2 * Math.sin(arm.a1 + arm.a2);
    return { ex, ey, tx, ty };
  };
  const render = () => {
    const { ex, ey, tx, ty } = fk();
    upper.setAttribute("x2", ex.toFixed(1)); upper.setAttribute("y2", ey.toFixed(1));
    fore.setAttribute("x1", ex.toFixed(1)); fore.setAttribute("y1", ey.toFixed(1));
    fore.setAttribute("x2", tx.toFixed(1)); fore.setAttribute("y2", ty.toFixed(1));
    elbowC.setAttribute("cx", ex.toFixed(1)); elbowC.setAttribute("cy", ey.toFixed(1));
    grip.setAttribute("transform", `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`);
    if (carry) carry.setAttribute("transform", `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`);
  };

  const ik = (tx: number, ty: number) => {
    let dx = tx - BASE.x, dy = ty - BASE.y;
    let D = Math.hypot(dx, dy);
    const maxR = L1 + L2 - 1, minR = Math.abs(L1 - L2) + 1;
    if (D > maxR) { dx *= maxR / D; dy *= maxR / D; D = maxR; }
    if (D < minR && D > 0) { dx *= minR / D; dy *= minR / D; D = minR; }
    const c2 = Math.max(-1, Math.min(1, (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const m = Math.acos(c2);
    const opts = [m, -m].map((a2) => {
      let a1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
      while (a1 - arm.a1 > Math.PI) a1 -= 2 * Math.PI;
      while (a1 - arm.a1 < -Math.PI) a1 += 2 * Math.PI;
      return { a1, a2 };
    });
    const cost = (o: { a1: number; a2: number }) => Math.abs(o.a1 - arm.a1) + Math.abs(o.a2 - arm.a2);
    return cost(opts[0]) <= cost(opts[1]) ? opts[0] : opts[1];
  };

  const springTo = (tx: number, ty: number, k = 0.13, damp = 0.62) =>
    new Promise<void>((res) => {
      const t = ik(tx, ty);
      let v1 = 0, v2 = 0, frames = 0;
      const step = () => {
        v1 = (v1 + (t.a1 - arm.a1) * k) * damp;
        v2 = (v2 + (t.a2 - arm.a2) * k) * damp;
        arm.a1 += v1; arm.a2 += v2; render(); frames++;
        const done = Math.abs(t.a1 - arm.a1) < 0.008 && Math.abs(t.a2 - arm.a2) < 0.008 && Math.abs(v1) < 0.006 && Math.abs(v2) < 0.006;
        if (done || frames > 150) { arm.a1 = t.a1; arm.a2 = t.a2; render(); res(); }
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const pulse = (el: SVGRectElement, px: number, py: number) => {
    const t0 = performance.now(), D = 240;
    const step = (now: number) => {
      const kk = Math.min(1, (now - t0) / D);
      const s = 1 + 0.12 * Math.sin(kk * Math.PI);
      el.setAttribute("transform", `translate(${px} ${py}) scale(${s.toFixed(3)})`);
      if (kk < 1) requestAnimationFrame(step); else el.setAttribute("transform", `translate(${px} ${py})`);
    };
    requestAnimationFrame(step);
  };
  const wobble = (el: SVGRectElement, px: number, py: number) => {
    const t0 = performance.now(), D = 460;
    const step = (now: number) => {
      const kk = Math.min(1, (now - t0) / D);
      const s = 1 + 0.12 * Math.exp(-4 * kk) * Math.cos(kk * 13);
      el.setAttribute("transform", `translate(${px} ${py}) scale(${s.toFixed(3)})`);
      if (kk < 1) requestAnimationFrame(step); else el.setAttribute("transform", `translate(${px} ${py})`);
    };
    requestAnimationFrame(step);
  };

  const setDisk = (size: number, p: number, level: number) =>
    diskEls.get(size)!.setAttribute("transform", `translate(${PEGX[p]} ${cy(level)})`);

  const resetPegs = () => {
    const pegs: number[][] = [[3, 2, 1], [], []];
    pegs.forEach((stack, p) => stack.forEach((size, level) => setDisk(size, p, level)));
    return pegs;
  };

  // reduced motion: show the solved tower, arm at rest
  if (window.matchMedia(REDUCED).matches) {
    [3, 2, 1].forEach((size, level) => setDisk(size, 2, level));
    render();
    return;
  }

  async function solveOnce() {
    const pegs = resetPegs();
    const moves = solve(3, 0, 2, 1);
    console.log("[Hanoi] move list:", moves.map((m) => `disk ${m.disk}: peg ${m.from} -> ${m.to}`).join("  |  "));

    for (const m of moves) {
      const from = pegs[m.from], to = pegs[m.to];
      // invariants
      if (from[from.length - 1] !== m.disk) console.error(`[Hanoi] ILLEGAL: top of peg ${m.from} is ${from[from.length - 1]}, not ${m.disk}`);
      if (to.length && to[to.length - 1] < m.disk) console.error(`[Hanoi] ILLEGAL: placing ${m.disk} on smaller ${to[to.length - 1]}`);

      const el = diskEls.get(m.disk)!;
      const sx = PEGX[m.from], sy = cy(from.length - 1);
      const dx2 = PEGX[m.to], dy2 = cy(to.length);

      await springTo(sx, sy);                 // reach the top disk
      grip.classList.add("is-gripping");
      el.classList.add("is-active");
      pulse(el, sx, sy);
      await wait(150);
      carry = el;
      await springTo(sx, CARRY_Y, 0.11, 0.66);     // lift
      await springTo(dx2, CARRY_Y, 0.1, 0.68);      // carry across (arched, high)
      await springTo(dx2, dy2, 0.11, 0.66);         // lower onto destination
      carry = null;
      el.setAttribute("transform", `translate(${dx2} ${dy2})`);
      grip.classList.remove("is-gripping");
      wobble(el, dx2, dy2);
      from.pop(); to.push(m.disk);            // commit the real move
      await wait(120);
      el.classList.remove("is-active");
      await wait(280);                        // brief pause between moves
    }

    if (pegs[2].length === 3 && pegs[2].join() === "3,2,1") console.log("[Hanoi] solved: all 3 disks on peg 2");
    else console.error("[Hanoi] did NOT finish on peg 2", JSON.stringify(pegs));
  }

  async function loop() {
    while (true) {
      await solveOnce();
      await springTo(300, 250, 0.07, 0.72);   // park the arm, hold
      await wait(2600);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); loop(); break; }
  }, { rootMargin: "0px 0px -15% 0px" });
  io.observe(root);
}
