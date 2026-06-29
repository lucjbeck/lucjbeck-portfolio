/**
 * engineering.ts — landing-page assembly-line choreography.
 * A chassis travels the conveyor and is built in three stages: at each station an
 * articulated arm swings down and a part appears on the chassis (deck -> body ->
 * cabin -> accent detail); the finished unit exits and the cycle repeats. Rollers
 * turn continuously. Transforms/opacity only. Lazy-inits near the viewport; gated
 * by prefers-reduced-motion (the SSR static frame stands).
 *
 * Verified against animejs 4.5.0 (createTimeline, animate, utils).
 */
import { createTimeline, animate, utils } from "animejs";

const REDUCED = "(prefers-reduced-motion: reduce)";

// Arm joint angles (degrees): folded-up rest vs. reach-down place.
const REST_SH = -26;
const REST_EL = 46;
const DIP_SH = 12;
const DIP_EL = -8;

// Chassis x at each station (matches `stations` in EngineeringHero.astro), plus
// the offscreen start and exit.
const START_X = -90;
const STATION_X = [150, 270, 390];
const EXIT_X = 600;
const CHASSIS_Y = 250;

export function initEngineering(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;

  const root = document.querySelector<HTMLElement>("#eng-hero");
  if (!root) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;

    const chassis = root.querySelector<SVGGElement>("[data-chassis]");
    const parts = Array.from(root.querySelectorAll<SVGRectElement>("[data-part]"));
    const shoulders = Array.from(root.querySelectorAll<SVGGElement>("[data-arm-sh]"));
    const elbows = Array.from(root.querySelectorAll<SVGGElement>("[data-arm-el]"));
    const rollers = Array.from(root.querySelectorAll<SVGGElement>("[data-roller]"));
    if (!chassis || parts.length < 3 || shoulders.length < 3) return;

    // transform-box for rotating groups + rollers
    [...shoulders, ...elbows, ...rollers].forEach((g) =>
      utils.set(g, { transformBox: "view-box" })
    );

    // Continuous rollers.
    animate(rollers, { rotate: 360, duration: 2600, ease: "linear", loop: true });

    const reset = () => {
      utils.set(chassis, { translateX: START_X, translateY: CHASSIS_Y });
      utils.set(parts, { opacity: 0, scale: 0 });
      shoulders.forEach((s) => utils.set(s, { rotate: REST_SH }));
      elbows.forEach((e) => utils.set(e, { rotate: REST_EL }));
    };

    const TRAVEL = 1300;
    const DIP = 1100;

    const build = () => {
      reset();
      const tl = createTimeline();

      // approach station 1
      tl.add(chassis, { translateX: STATION_X[0], duration: TRAVEL, ease: "inOut(2)" }, 0);

      let t = TRAVEL;
      for (let i = 0; i < 3; i++) {
        const sx = i;
        // arm dips and places
        tl.add(shoulders[sx], { rotate: [REST_SH, DIP_SH, REST_SH], duration: DIP, ease: "inOut(2)" }, t);
        tl.add(elbows[sx], { rotate: [REST_EL, DIP_EL, REST_EL], duration: DIP, ease: "inOut(2)" }, t);
        // the part snaps onto the chassis at the bottom of the dip
        tl.add(
          parts[sx],
          { opacity: [0, 1], scale: [0, 1], duration: 340, ease: "out(2)" },
          t + DIP * 0.42
        );
        t += DIP;
        // travel to the next station (or exit after the last)
        if (i < 2) {
          tl.add(chassis, { translateX: STATION_X[i + 1], duration: TRAVEL, ease: "inOut(2)" }, t);
          t += TRAVEL;
        }
      }

      // finished unit exits
      tl.add(chassis, { translateX: EXIT_X, duration: TRAVEL + 200, ease: "in(2)" }, t + 250);

      tl.then(build); // loop with a clean reset each pass
    };

    build();
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
