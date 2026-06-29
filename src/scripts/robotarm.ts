/**
 * robotarm.ts — 3-DOF pick-and-place (Engineering section).
 * Shoulder + elbow position the WRIST via closed-form 2-link IK; a separate hand
 * stays vertical (the wrist DOF) so the gripper descends onto parts from above and
 * the linkage never goes below the floor. The arm grips blocks from a feeder table
 * on the right, carries them, and stacks them on the left table; after four it
 * ships the stack and repeats. Lazy-inits near the viewport; gated by reduced-motion.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const DEG = 180 / Math.PI;

const P = { x: 180, y: 256 };
const ELBOW0 = { x: 180, y: 172 };
const L1 = 84; // base -> elbow
const L2 = 78; // elbow -> wrist
const GRIP = 22; // wrist -> block (gripper reaches down this far)
const PICK = { x: 288, y: 224 }; // block centre on the feeder table
const slot = (lvl: number) => ({ x: 75, y: 224 - lvl * 15 });
const BW = 26, BH = 15;

export function initRobotArm(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;
  const root = document.querySelector<HTMLElement>("#robot-arm");
  if (!root) return;
  const shoulder = root.querySelector<SVGGElement>("[data-shoulder]");
  const elbow = root.querySelector<SVGGElement>("[data-elbow]");
  const hand = root.querySelector<SVGGElement>("[data-hand]");
  const blocks = Array.from(root.querySelectorAll<SVGRectElement>("[data-block]"));
  if (!shoulder || !elbow || !hand || blocks.length < 4) return;

  const bs = blocks.map(() => ({ cx: 0, cy: 0, vis: 0 }));

  // IK to the WRIST point W; elbow-up config keeps links high.
  function ik(wx: number, wy: number) {
    let dx = wx - P.x, dy = wy - P.y; let D = Math.hypot(dx, dy);
    const maxR = L1 + L2 - 1, minR = Math.abs(L1 - L2) + 2;
    if (D > maxR) { dx *= maxR / D; dy *= maxR / D; D = maxR; }
    if (D < minR && D > 0) { dx *= minR / D; dy *= minR / D; D = minR; }
    const c2 = Math.max(-1, Math.min(1, (D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const ang2 = Math.acos(c2);
    // pick the elbow side that puts the elbow toward the base (higher up)
    const s = wx >= P.x ? 1 : -1;
    const phi1 = Math.atan2(dy, dx) - Math.atan2(s * L2 * Math.sin(ang2), L1 + L2 * Math.cos(ang2));
    return { r1: phi1 * DEG + 90, r2: s * ang2 * DEG };
  }

  const cur = { x: P.x, y: 150 }; // tracked BLOCK position (hand reaches above it)
  let phase = "toPick", pT = 0, last = performance.now(), level = 0, g = 1, carry = -1;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const near = (x: number, y: number) => Math.hypot(cur.x - x, cur.y - y) < 3.5;
  const goal = (gx: number, gy: number, k = 0.1) => { cur.x = lerp(cur.x, gx, k); cur.y = lerp(cur.y, gy, k); };

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; pT += dt;

    if (phase === "toPick") {
      if (pT < 30) { bs[level].cx = PICK.x; bs[level].cy = PICK.y; bs[level].vis = 1; }
      g = lerp(g, 1, 0.2); goal(PICK.x, PICK.y);
      if (near(PICK.x, PICK.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      g = lerp(g, 0.4, 0.2);
      if (pT > 300) { carry = level; phase = "lift"; pT = 0; }
    } else if (phase === "lift") {
      goal(PICK.x, 150);
      if (near(PICK.x, 150)) { phase = "carry"; pT = 0; }
    } else if (phase === "carry") {
      const s = slot(level); goal(s.x, s.y, 0.08);
      if (near(s.x, s.y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      g = lerp(g, 1, 0.2);
      const s = slot(level); bs[level].cx = s.x; bs[level].cy = s.y;
      if (pT > 300) { carry = -1; level++; phase = level >= 4 ? "ship" : "toPick"; pT = 0; }
    } else if (phase === "ship") {
      goal(P.x, 150);
      let done = true;
      for (let i = 0; i < 4; i++) if (bs[i].vis) { bs[i].cx += 5; if (bs[i].cx < 400) done = false; else bs[i].vis = 0; }
      if (done) { level = 0; phase = "toPick"; pT = 0; }
    }

    if (carry >= 0) { bs[carry].cx = cur.x; bs[carry].cy = cur.y; }

    // wrist target = above the block by the gripper length
    const W = { x: cur.x, y: cur.y - GRIP - BH / 2 };
    const { r1, r2 } = ik(W.x, W.y);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${P.x} ${P.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    hand.setAttribute("transform", `translate(${W.x.toFixed(1)} ${W.y.toFixed(1)}) scale(${g.toFixed(3)} 1)`);

    for (let i = 0; i < blocks.length; i++) {
      blocks[i].setAttribute("x", (bs[i].cx - BW / 2).toFixed(1));
      blocks[i].setAttribute("y", (bs[i].cy - BH / 2).toFixed(1));
      blocks[i].style.opacity = String(bs[i].vis);
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
