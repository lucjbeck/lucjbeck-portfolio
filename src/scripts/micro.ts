/**
 * micro.ts — restrained spring-physics micro-interactions.
 *
 * HOW IT INITS
 *   Self-inits on DOMContentLoaded (and immediately if the DOM is ready).
 *   You may also call initMicro() manually after injecting markup; it is
 *   idempotent (skips already-wired elements via a data flag).
 *
 * WHAT IT DOES (two restrained touches only)
 *   1. [data-spring] elements (e.g. nav links, buttons): a tactile spring
 *      lift on pointerenter, spring back on pointerleave. Pointer-driven,
 *      anime.js spring easing — NOT per-frame state.
 *   2. The hero #nanoswitch reacts to cursor PROXIMITY: a gentle parallax
 *      drift of the whole structure toward the pointer, rAF-batched, eased via
 *      a persistent animatable target (motion-value style, no per-frame React
 *      state). Falls back silently if the hero is absent.
 *
 * REDUCED MOTION
 *   Gated: when prefers-reduced-motion is set, nothing is wired.
 *
 * Verified against animejs 4.5.0 (animate, createSpring, JS easings).
 */

import { animate, createSpring } from "animejs";

const REDUCED = "(prefers-reduced-motion: reduce)";
const WIRED = "data-micro-wired";

export function initMicro(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;

  wireSprings();
  wireHeroProximity();
}

/** 1. Spring lift on hover for opted-in elements. */
function wireSprings(): void {
  const els = document.querySelectorAll<HTMLElement>(
    `[data-spring]:not([${WIRED}])`
  );
  els.forEach((el) => {
    el.setAttribute(WIRED, "");
    const enter = () =>
      animate(el, {
        translateY: -3,
        scale: 1.04,
        duration: 520,
        ease: createSpring({ stiffness: 200, damping: 12, mass: 1 }),
      });
    const leave = () =>
      animate(el, {
        translateY: 0,
        scale: 1,
        duration: 520,
        ease: createSpring({ stiffness: 180, damping: 16, mass: 1 }),
      });
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", enter);
    el.addEventListener("blur", leave);
  });
}

/** 2. Hero drifts toward the cursor (proximity parallax), rAF-batched. */
function wireHeroProximity(): void {
  const hero = document.querySelector<SVGElement>("#nanoswitch .ns-svg");
  const host = document.querySelector<HTMLElement>("#nanoswitch");
  if (!hero || !host || host.hasAttribute(WIRED)) return;
  host.setAttribute(WIRED, "");

  const MAX = 10; // px max drift
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let raf = 0;
  let active = false;

  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    targetX = clamp(((e.clientX - cx) / r.width) * 2, -1, 1) * MAX;
    targetY = clamp(((e.clientY - cy) / r.height) * 2, -1, 1) * MAX;
    if (!active) loop();
  };
  const onLeave = () => {
    targetX = 0;
    targetY = 0;
    if (!active) loop();
  };

  const loop = () => {
    active = true;
    curX += (targetX - curX) * 0.12; // critically-damped-ish lerp
    curY += (targetY - curY) * 0.12;
    hero.style.transform = `translate(${curX.toFixed(2)}px, ${curY.toFixed(2)}px)`;
    if (Math.abs(targetX - curX) > 0.05 || Math.abs(targetY - curY) > 0.05) {
      raf = requestAnimationFrame(loop);
    } else {
      active = false;
      cancelAnimationFrame(raf);
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerout", onLeave, { passive: true });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Self-init.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMicro, { once: true });
  } else {
    initMicro();
  }
}
