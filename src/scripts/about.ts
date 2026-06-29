/**
 * about.ts — top-down assembly animation (About section).
 * A 2-link arm (closed-form IK: law of cosines for the elbow, atan2 for the
 * shoulder) picks up scattered pieces and carries each to a deterministic target,
 * assembling a blocky Penn shield. Arm moves use a small under-damped spring
 * integrator (controllable pace; spring-physical with overshoot) plus a settle
 * wobble on each placed piece. Plays once when the section scrolls into view.
 * prefers-reduced-motion renders the finished shield with the arm at rest.
 */
// Arm motion uses a small custom spring integrator so the pace is controllable
// (anime.js createSpring sets its own long settle, which overran 14 pieces).
// It is still spring-physical: under-damped with overshoot, plus a settle wobble.

const REDUCED = "(prefers-reduced-motion: reduce)";
const BASE = { x: 300, y: 600 };
const L1 = 250, L2 = 240;

export function initAboutAssembly(): void {
  if (typeof window === "undefined") return;
  const root = document.querySelector<HTMLElement>("#about-assembly");
  if (!root) return;
  const upper = root.querySelector<SVGLineElement>("[data-upper]");
  const fore = root.querySelector<SVGLineElement>("[data-fore]");
  const elbowC = root.querySelector<SVGCircleElement>("[data-elbow]");
  const grip = root.querySelector<SVGGElement>("[data-grip]");
  const pieces = Array.from(root.querySelectorAll<SVGRectElement>("[data-piece]"));
  if (!upper || !fore || !elbowC || !grip || !pieces.length) return;

  const arm = { a1: -Math.PI / 2, a2: 0 };
  let carrying = -1;

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
    if (carrying >= 0) pieces[carrying].setAttribute("transform", `translate(${tx.toFixed(1)} ${ty.toFixed(1)})`);
  };

  // closed-form 2-link IK; choose the elbow config nearest the current pose
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
    // nearest to current joint state
    const cost = (o: { a1: number; a2: number }) => Math.abs(o.a1 - arm.a1) + Math.abs(o.a2 - arm.a2);
    return cost(opts[0]) <= cost(opts[1]) ? opts[0] : opts[1];
  };

  // under-damped spring integrator on the joint angles (k = pull, damp = retention)
  const springTo = (tx: number, ty: number, k = 0.09, damp = 0.68) =>
    new Promise<void>((res) => {
      const t = ik(tx, ty);
      let v1 = 0, v2 = 0, frames = 0;
      const step = () => {
        v1 = (v1 + (t.a1 - arm.a1) * k) * damp;
        v2 = (v2 + (t.a2 - arm.a2) * k) * damp;
        arm.a1 += v1; arm.a2 += v2;
        render();
        frames++;
        const settled =
          Math.abs(t.a1 - arm.a1) < 0.008 && Math.abs(t.a2 - arm.a2) < 0.008 &&
          Math.abs(v1) < 0.006 && Math.abs(v2) < 0.006;
        if (settled || frames > 150) { arm.a1 = t.a1; arm.a2 = t.a2; render(); res(); }
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

  // small settle wobble on a just-placed piece (scale overshoot, damped)
  const wobble = (el: SVGRectElement, px: number, py: number) => {
    const t0 = performance.now(), D = 520;
    const step = (now: number) => {
      const kk = Math.min(1, (now - t0) / D);
      const s = 1 + 0.16 * Math.exp(-4 * kk) * Math.cos(kk * 14);
      el.setAttribute("transform", `translate(${px} ${py}) scale(${s.toFixed(3)})`);
      if (kk < 1) requestAnimationFrame(step);
      else el.setAttribute("transform", `translate(${px} ${py})`);
    };
    requestAnimationFrame(step);
  };

  const finished = () => {
    pieces.forEach((p) => {
      p.setAttribute("transform", `translate(${p.dataset.tx} ${p.dataset.ty})`);
      p.classList.add("is-placed");
    });
  };

  // reduced motion: show the completed shield, arm at rest, no animation
  if (window.matchMedia(REDUCED).matches) { finished(); render(); return; }

  async function run() {
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const sx = Number(p.dataset.sx), sy = Number(p.dataset.sy);
      const tx = Number(p.dataset.tx), ty = Number(p.dataset.ty);
      await springTo(sx, sy, 0.14, 0.6);            // reach the piece (fast, crisp)
      grip.classList.add("is-gripping");            // grip flash
      carrying = i;
      await springTo(tx, ty, 0.085, 0.72);          // carry it to its slot (slight overshoot)
      carrying = -1;
      p.setAttribute("transform", `translate(${tx} ${ty})`);
      p.classList.add("is-placed");                 // lock into the accent
      grip.classList.remove("is-gripping");
      wobble(p, tx, ty);                            // settle (non-blocking)
    }
    await springTo(300, 150, 0.06, 0.74);           // return toward neutral, hold
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { io.disconnect(); run(); break; }
    }
  }, { rootMargin: "0px 0px -15% 0px" });
  io.observe(root);
}
