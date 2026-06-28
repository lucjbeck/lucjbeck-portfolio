/**
 * reveal.ts — scroll-reveal system (the CONTRACT with the content agent).
 *
 * HOW IT INITS
 *   Self-inits on DOMContentLoaded (and immediately if the DOM is already
 *   ready) by scanning for [data-reveal]. You may also call initReveal()
 *   manually after injecting markup dynamically; it is idempotent (already
 *   revealed / already observed elements are skipped).
 *
 * DATA-ATTRIBUTE CONTRACT (what the content agent annotates)
 *   data-reveal
 *     Mark ANY element to reveal on scroll. It enters with a coherent
 *     opacity+translateY rise (anime.js), once, then is unobserved.
 *   data-reveal-group="x"
 *     Elements sharing the same group value reveal together as a staggered
 *     batch when the FIRST member of the group intersects. Use for lists,
 *     grids, a heading + its items. Ungrouped [data-reveal] elements reveal
 *     individually.
 *   data-reveal-delay="120"   (optional, ms)
 *     Extra per-element delay added on top of any group stagger.
 *
 *   No layout shift: reveal animates opacity + transform only. The pre-reveal
 *   hidden state is applied by JS (so no-JS users see content), unless
 *   prefers-reduced-motion is set, in which case nothing is hidden and nothing
 *   animates — everything is visible at rest.
 *
 * Verified against animejs 4.5.0 (animate, stagger, utils, JS easings).
 */

import { animate, utils } from "animejs";

const REDUCED = "(prefers-reduced-motion: reduce)";
const RISE = 18; // px translateY entrance distance
const SEEN = "data-reveal-done";

let observer: IntersectionObserver | null = null;

export function initReveal(): void {
  if (typeof window === "undefined") return;

  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-reveal]")
  ).filter((el) => !el.hasAttribute(SEEN) && !el.dataset.revealObserved);

  if (!els.length) return;

  // Reduced motion / no IO: reveal everything immediately, no transform.
  if (
    window.matchMedia(REDUCED).matches ||
    !("IntersectionObserver" in window)
  ) {
    els.forEach((el) => el.setAttribute(SEEN, ""));
    return;
  }

  // Apply hidden start state (JS-only, so no-JS users keep content visible).
  els.forEach((el) => {
    el.dataset.revealObserved = "1";
    utils.set(el, { opacity: 0, translateY: RISE });
  });

  if (!observer) {
    observer = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12,
    });
  }
  els.forEach((el) => observer!.observe(el));
}

function onIntersect(
  entries: IntersectionObserverEntry[],
  io: IntersectionObserver
): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target as HTMLElement;
    const group = el.dataset.revealGroup;

    if (group) {
      revealGroup(group, io);
    } else {
      io.unobserve(el);
      revealElements([el], io);
    }
  }
}

function revealGroup(group: string, io: IntersectionObserver): void {
  const members = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-reveal][data-reveal-group="${CSS.escape(group)}"]`
    )
  ).filter((el) => !el.hasAttribute(SEEN));
  if (!members.length) return;
  members.forEach((el) => io.unobserve(el));
  revealElements(members, io, true);
}

function revealElements(
  els: HTMLElement[],
  _io: IntersectionObserver,
  grouped = false
): void {
  els.forEach((el) => el.setAttribute(SEEN, ""));
  animate(els, {
    opacity: [0, 1],
    translateY: [RISE, 0],
    duration: 720,
    ease: "out(3)",
    delay: (el: HTMLElement, i: number) => {
      const base = grouped ? i * 70 : 0; // group stagger
      const extra = Number((el as HTMLElement).dataset.revealDelay) || 0;
      return base + extra;
    },
  });
}

// Self-init.
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal, { once: true });
  } else {
    initReveal();
  }
}
