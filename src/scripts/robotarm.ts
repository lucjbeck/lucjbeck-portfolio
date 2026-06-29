/**
 * robotarm.ts — Engineering section pick-and-place loop.
 * Rotates the shoulder and elbow joints through a cycle and opens/closes the
 * gripper. Nested groups rotate about their pivots (transform-box: view-box set
 * here; transform-origin set inline in the markup). Transforms only.
 * Lazy-inits near the viewport; gated by prefers-reduced-motion.
 *
 * Verified against animejs 4.5.0 (animate, utils).
 */
import { animate, utils } from "animejs";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function initRobotArm(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;

  const root = document.querySelector<HTMLElement>("#robot-arm");
  if (!root) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;

    const shoulder = root.querySelector<SVGGElement>("[data-shoulder]");
    const elbow = root.querySelector<SVGGElement>("[data-elbow]");
    const gripper = root.querySelector<SVGGElement>("[data-gripper]");
    if (!shoulder || !elbow || !gripper) return;

    [shoulder, elbow, gripper].forEach((g) =>
      utils.set(g, { transformBox: "view-box" })
    );

    const cycle = 5200;
    // Reach toward the target, close, lift, swing back, release. One smooth loop.
    animate(shoulder, {
      rotate: [
        { to: 0, duration: cycle * 0.1 },
        { to: 38, duration: cycle * 0.25 }, // reach to the work surface (right)
        { to: 38, duration: cycle * 0.12 },
        { to: -22, duration: cycle * 0.28 }, // swing back to place (left)
        { to: 0, duration: cycle * 0.25 },
      ],
      ease: "inOutSine",
      loop: true,
    });
    animate(elbow, {
      rotate: [
        { to: 0, duration: cycle * 0.1 },
        { to: -46, duration: cycle * 0.25 },
        { to: -46, duration: cycle * 0.12 },
        { to: 34, duration: cycle * 0.28 },
        { to: 0, duration: cycle * 0.25 },
      ],
      ease: "inOutSine",
      loop: true,
    });
    // Gripper: open while travelling, pinch closed at the pick and place moments.
    animate(gripper, {
      scaleX: [
        { to: 1, duration: cycle * 0.33 },
        { to: 0.5, duration: cycle * 0.04 }, // close on pick
        { to: 0.5, duration: cycle * 0.3 },
        { to: 1, duration: cycle * 0.04 }, // release at place
        { to: 1, duration: cycle * 0.29 },
      ],
      ease: "inOut(2)",
      loop: true,
    });
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            start();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(root);
  } else {
    start();
  }
}
