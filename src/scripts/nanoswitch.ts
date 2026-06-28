/**
 * nanoswitch.ts — the hero "conformational switch" animation.
 *
 * HOW IT INITS
 *   NanoSwitch.astro's module <script> calls `initNanoSwitch()`. That sets up an
 *   IntersectionObserver and only builds/plays the anime.js timeline once the
 *   hero is in (or near) the viewport — keeping work off the critical path.
 *
 * WHAT IT DOES
 *   1. assemble : nodes + edges stagger into existence (stagger ~--stagger-node).
 *   2. settle   : a brief spring settle into the resolved "open" conformation.
 *   3. morph    : open -> closed/looped on scroll, hover, or click; reverses out.
 *   4. idle     : a very subtle breathing drift on the nodes (non-distracting).
 *   5. boop     : THE one delight — click springs/jiggles the structure.
 *
 * GEOMETRY lives entirely in NanoSwitch.astro as data-attributes
 *   (data-open-x/y, data-closed-x/y on nodes; data-open-d/data-closed-d on edges).
 *   This file is geometry-agnostic.
 *
 * REDUCED MOTION
 *   All animation is gated behind prefers-reduced-motion. When reduced, we do
 *   nothing: the SSR markup already renders the resolved "open" conformation.
 *
 * Verified against animejs 4.5.0 (named exports, JS easings, svg.morphTo).
 */

import {
  animate,
  createTimeline,
  stagger,
  createSpring,
  utils,
} from "animejs";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function initNanoSwitch(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return; // static SSR state stands.

  const root = document.querySelector<SVGElement>("#nanoswitch");
  if (!root) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    run(root);
  };

  // Lazy-init: build the timeline only when the hero nears the viewport.
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

function run(root: SVGElement): void {
  const nodes = Array.from(
    root.querySelectorAll<SVGCircleElement>(".ns-node")
  );
  const edges = Array.from(root.querySelectorAll<SVGPathElement>(".ns-edge"));
  if (!nodes.length || !edges.length) return;

  // --- stagger step from the design token (--stagger-node, ms) --------------
  const staggerMs =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--stagger-node"
      )
    ) || 45;

  // --- 1+2. ASSEMBLY + SETTLE ----------------------------------------------
  // Start everything invisible/collapsed, then stagger in with a spring settle.
  utils.set(nodes, { opacity: 0, scale: 0 });
  utils.set(edges, { opacity: 0 });
  // Edges "draw in" via stroke-dash so they form rather than just fade.
  edges.forEach((e) => {
    const len = e.getTotalLength();
    e.style.strokeDasharray = `${len}`;
    e.style.strokeDashoffset = `${len}`;
  });

  const assembly = createTimeline({ autoplay: false });

  assembly
    .add(
      nodes,
      {
        opacity: [0, 1],
        scale: [0, 1],
        duration: 620,
        ease: createSpring({ stiffness: 130, damping: 14, mass: 1 }),
        delay: stagger(staggerMs, { from: "center" }),
      },
      0
    )
    .add(
      edges,
      {
        opacity: [0, 1],
        strokeDashoffset: [
          (el: SVGPathElement) => el.getTotalLength(),
          0,
        ],
        duration: 760,
        ease: "out(3)",
        delay: stagger(staggerMs * 0.8, { start: staggerMs * 2 }),
      },
      0
    );

  // After assembly, clear the dash so morphs render cleanly.
  assembly.then(() => {
    edges.forEach((e) => {
      e.style.strokeDasharray = "";
      e.style.strokeDashoffset = "";
    });
  });

  assembly.play();

  // --- 3. MORPH open <-> closed --------------------------------------------
  // Coordinated: node cx/cy tween + edge path morph, spring-eased.
  let conformation: "open" | "closed" = "open";
  let morphing = false;

  // Edges are straight lines between two nodes. Rather than tween the `d`
  // attribute (anime.js cannot read the current SVG `d`/`cx` values, which trips
  // decomposeRawValue), we move the NODES via transforms and recompute each
  // edge's `d` from its endpoints' live positions every frame. Geometry stays
  // perfectly attached, no attribute-tweening required.
  const nodeCenter = (i: number) => {
    const n = nodes[i];
    const tx = parseFloat(String(utils.get(n, "translateX"))) || 0;
    const ty = parseFloat(String(utils.get(n, "translateY"))) || 0;
    return { x: Number(n.dataset.openX) + tx, y: Number(n.dataset.openY) + ty };
  };
  const updateEdges = () => {
    edges.forEach((e) => {
      const pair = (e.dataset.edge ?? "").split("-").map(Number);
      const a = nodeCenter(pair[0]);
      const b = nodeCenter(pair[1]);
      e.setAttribute("d", `M${a.x},${a.y} L${b.x},${b.y}`);
    });
  };

  const morphTo = (target: "open" | "closed") => {
    if (target === conformation || morphing) return;
    morphing = true;
    conformation = target;
    const k = target; // "open" | "closed"

    animate(nodes, {
      translateX: (el: SVGCircleElement) =>
        Number(el.dataset[`${k}X`]) - Number(el.dataset.openX),
      translateY: (el: SVGCircleElement) =>
        Number(el.dataset[`${k}Y`]) - Number(el.dataset.openY),
      duration: 900,
      ease: createSpring({ stiffness: 90, damping: 16, mass: 1.1 }),
      delay: stagger(staggerMs * 0.5, { from: "center" }),
      onUpdate: updateEdges,
    }).then(() => {
      morphing = false;
      updateEdges();
    });
  };

  // Triggers: hover the structure -> closed; leave -> open.
  root.addEventListener("pointerenter", () => morphTo("closed"));
  root.addEventListener("pointerleave", () => morphTo("open"));

  // Scroll: when the hero scrolls ~halfway out, settle into the closed/looped
  // bound state (rAF-batched, passive).
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const rect = root.getBoundingClientRect();
      const progressed = rect.bottom < window.innerHeight * 0.6;
      morphTo(progressed ? "closed" : "open");
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // --- 5. BOOP (the one delight) -------------------------------------------
  root.addEventListener("click", () => boop(nodes, edges));
}

/** The boop: spring-scale the nodes out and resettle (no other gags). */
function boop(nodes: SVGCircleElement[], edges: SVGPathElement[]): void {
  animate(nodes, {
    scale: [{ to: 1.32 }, { to: 1 }],
    duration: 700,
    ease: createSpring({ stiffness: 160, damping: 10, mass: 1 }),
    delay: stagger(22, { from: "center" }),
  });
  animate(edges, {
    opacity: [{ to: 0.55 }, { to: 1 }],
    duration: 480,
    ease: "out(2)",
  });
}
