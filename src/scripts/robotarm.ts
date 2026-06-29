/**
 * robotarm.ts — inverse-kinematics pick-and-place (Engineering section).
 * A two-link arm tracks a moving end-effector target via closed-form IK: it
 * reaches a feeder on the right, closes its gripper on a block, carries it (the
 * block follows the effector), and stacks it on the left. After four it ships the
 * stack and repeats. SVG attribute transforms (rotate about explicit pivots) give
 * correct nested kinematics. Lazy-inits near the viewport; gated by reduced-motion.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

// geometry (mirrors RobotArm.astro)
const P = { x: 180, y: 256 };
const ELBOW0 = { x: 180, y: 162 };
const A = 94; // base -> elbow
const B = 98; // elbow -> gripper tip
const PICKUP = { x: 290, y: 248 };
const NEUTRAL = { x: 180, y: 150 };
const slot = (level: number) => ({ x: 80, y: 250 - level * 15 });
const BW = 26, BH = 15;
const DEG = 180 / Math.PI;

export function initRobotArm(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;
  const root = document.querySelector<HTMLElement>("#robot-arm");
  if (!root) return;
  const shoulder = root.querySelector<SVGGElement>("[data-shoulder]");
  const elbow = root.querySelector<SVGGElement>("[data-elbow]");
  const gripper = root.querySelector<SVGGElement>("[data-gripper]");
  const blocks = Array.from(root.querySelectorAll<SVGRectElement>("[data-block]"));
  if (!shoulder || !elbow || !gripper || blocks.length < 4) return;

  const blockState = blocks.map(() => ({ cx: 0, cy: 0, vis: 0 }));

  function ik(tx: number, ty: number) {
    let dx = tx - P.x, dy = ty - P.y;
    let D = Math.hypot(dx, dy);
    const maxR = A + B - 1, minR = Math.abs(A - B) + 2;
    if (D > maxR) { dx *= maxR / D; dy *= maxR / D; D = maxR; }
    if (D < minR) { dx *= minR / D; dy *= minR / D; D = minR; }
    const c2 = Math.max(-1, Math.min(1, (D * D - A * A - B * B) / (2 * A * B)));
    const ang2 = Math.acos(c2);
    const s = -1; // elbow config (bows to one side)
    const phi1 = Math.atan2(dy, dx) - Math.atan2(s * B * Math.sin(ang2), A + B * Math.cos(ang2));
    return { r1: phi1 * DEG + 90, r2: s * ang2 * DEG };
  }

  // motion state
  const cur = { x: NEUTRAL.x, y: NEUTRAL.y };
  let phase = "toPick";
  let pT = 0;
  let last = performance.now();
  let level = 0;
  let grip = 1; // 1 open, 0.38 closed
  let carry = -1; // index of carried block

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const near = (gx: number, gy: number) => Math.hypot(cur.x - gx, cur.y - gy) < 3;

  function setGoal(g: { x: number; y: number }, k = 0.1) {
    cur.x = lerp(cur.x, g.x, k);
    cur.y = lerp(cur.y, g.y, k);
  }

  function frame(now: number) {
    const dt = Math.min(40, now - last);
    last = now;
    pT += dt;

    if (phase === "toPick") {
      if (pT < 30) { // entering: present a fresh block at the feeder
        blockState[level].cx = PICKUP.x; blockState[level].cy = PICKUP.y; blockState[level].vis = 1;
      }
      grip = lerp(grip, 1, 0.2);
      setGoal(PICKUP);
      if (near(PICKUP.x, PICKUP.y)) { phase = "grip"; pT = 0; }
    } else if (phase === "grip") {
      grip = lerp(grip, 0.38, 0.18);
      if (pT > 320) { carry = level; phase = "lift"; pT = 0; }
    } else if (phase === "lift") {
      setGoal({ x: PICKUP.x, y: 150 });
      if (near(PICKUP.x, 150)) { phase = "place"; pT = 0; }
    } else if (phase === "place") {
      setGoal(slot(level), 0.08);
      const s = slot(level);
      if (near(s.x, s.y)) { phase = "release"; pT = 0; }
    } else if (phase === "release") {
      grip = lerp(grip, 1, 0.18);
      const s = slot(level);
      blockState[level].cx = s.x; blockState[level].cy = s.y;
      if (pT > 320) { carry = -1; level++; phase = "retreat"; pT = 0; }
    } else if (phase === "retreat") {
      setGoal(NEUTRAL);
      if (near(NEUTRAL.x, NEUTRAL.y)) {
        if (level >= 4) { phase = "ship"; pT = 0; } else { phase = "toPick"; pT = 0; }
      }
    } else if (phase === "ship") {
      let done = true;
      for (let i = 0; i < 4; i++) {
        if (blockState[i].vis) {
          blockState[i].cx += 5;
          if (blockState[i].cx < 400) done = false; else blockState[i].vis = 0;
        }
      }
      if (done) { level = 0; phase = "toPick"; pT = 0; }
    }

    // carried block follows the effector
    if (carry >= 0) { blockState[carry].cx = cur.x; blockState[carry].cy = cur.y - 4; }

    // solve + apply IK
    const { r1, r2 } = ik(cur.x, cur.y);
    shoulder.setAttribute("transform", `rotate(${r1.toFixed(2)} ${P.x} ${P.y})`);
    elbow.setAttribute("transform", `rotate(${r2.toFixed(2)} ${ELBOW0.x} ${ELBOW0.y})`);
    gripper.setAttribute("transform", `translate(180 72) scale(${grip.toFixed(3)} 1) translate(-180 -72)`);

    for (let i = 0; i < blocks.length; i++) {
      const b = blockState[i];
      blocks[i].setAttribute("x", (b.cx - BW / 2).toFixed(1));
      blocks[i].setAttribute("y", (b.cy - BH / 2).toFixed(1));
      blocks[i].style.opacity = String(b.vis);
    }

    raf = requestAnimationFrame(frame);
  }

  let raf = 0;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); last = performance.now(); raf = requestAnimationFrame(frame); break; }
    }, { rootMargin: "200px" });
    io.observe(root);
  } else {
    raf = requestAnimationFrame(frame);
  }
}
