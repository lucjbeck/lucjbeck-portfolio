/**
 * hand.ts — teleoperation imitation loop.
 * The human hand (left) curls its fingers (each finger bends at 3 joints) and
 * turns at the wrist. The robot hand (right) is rigidly mounted on a fixed,
 * simple arm — it has no arm degrees of freedom, it only copies the human's
 * finger curls and wrist turn. Joint-angle traces scroll along the bottom.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS   = "http://www.w3.org/2000/svg";

// Geometry — must match HandAnimation.astro
const LEFT_CX  = 20 + 340 / 2;         // 190 — teleop panel centre x
const RIGHT_CX = 440 + 340 / 2;        // 610 — robot panel centre x
const STREAM_Y = 150;                   // y of the training-signal stream
const GRAPH_Y  = 316;
const GRAPH_H  = 520 - GRAPH_Y - 20;   // 184
const LEGEND_H = 28;
const GRAPH_X  = 20;
const GRAPH_W  = 760;
const CHAN_H   = Math.floor((GRAPH_H - LEGEND_H) / 4); // 39

// Finger kinematics. Pivots are the rotation centres for the three nested joint
// groups (data-j1 = MCP, data-j2 = PIP, data-j3 = DIP); they MUST match the
// segment coordinates rendered in HandAnimation.astro. `k` = degrees of bend per
// joint at full curl. Order: index, middle, ring, pinky, thumb.
interface FingerSpec { piv: [number, number][]; k: number[]; }
const FINGERS: FingerSpec[] = [
  { piv: [[-16, -28], [-16, -54], [-16, -74]], k: [42, 55, 48] }, // index
  { piv: [[ -4, -28], [ -4, -58], [ -4, -80]], k: [42, 55, 48] }, // middle
  { piv: [[  9, -28], [  9, -54], [  9, -74]], k: [40, 52, 46] }, // ring
  { piv: [[ 22, -24], [ 22, -44], [ 22, -60]], k: [38, 50, 44] }, // pinky
  { piv: [[-26,  -8], [-26, -28]],             k: [34, 42]     }, // thumb (2 joints)
];
// Curl folds fingers toward the palm (clockwise in SVG's y-down frame).
const CURL_SIGN = 1;

// Gesture keyframes: [index, middle, ring+pinky, thumb] curl 0–1
const GESTURES: [number, number, number, number][] = [
  [0.0, 0.0, 0.0, 0.0],   // open
  [1.0, 1.0, 1.0, 0.85],  // fist
  [0.0, 0.0, 0.0, 0.0],   // open
  [1.0, 0.0, 0.0, 0.7],   // point (index out, thumb tucked)
  [0.0, 0.0, 0.0, 0.0],   // open
  [0.2, 0.55, 0.9, 0.1],  // wave / staggered
  [0.0, 0.0, 0.0, 0.0],   // open
];
const HOLD_MS  = 650;
const BLEND_MS = 750;
const CYCLE_MS = GESTURES.length * (HOLD_MS + BLEND_MS);

const MAX_SAMPLES = 300;
const DOT_PERIOD  = 850;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

// Returns the four control signals (index, middle, ring/pinky, thumb), each 0–1.
function getJoints(t: number): [number, number, number, number] {
  const cycle = ((t % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const stepLen = HOLD_MS + BLEND_MS;
  const idx = Math.floor(cycle / stepLen);
  const rem = cycle - idx * stepLen;
  const a = GESTURES[idx % GESTURES.length];
  const b = GESTURES[(idx + 1) % GESTURES.length];
  if (rem < HOLD_MS) return [...a] as [number, number, number, number];
  const blend = easeInOut(clamp01((rem - HOLD_MS) / BLEND_MS));
  return [lerp(a[0],b[0],blend), lerp(a[1],b[1],blend),
          lerp(a[2],b[2],blend), lerp(a[3],b[3],blend)];
}

// Expand the four control signals to five finger curls (ring & pinky share ch.2).
function toCurls(j: [number, number, number, number]): number[] {
  return [j[0], j[1], j[2], j[2], j[3]];
}

// Apply finger curls (5) + wrist rotation to a hand group (human or robot).
function applyHandPose(handEl: Element, curls: number[], wristDeg: number) {
  const wrist = handEl.querySelector<SVGGElement>("[data-wrist]");
  if (wrist) wrist.setAttribute("transform", `rotate(${wristDeg.toFixed(1)} 0 2)`);

  const fingers = handEl.querySelectorAll<SVGGElement>("[data-finger]");
  fingers.forEach((fg) => {
    const i = Number(fg.dataset.finger);
    const spec = FINGERS[i];
    if (!spec) return;
    const c = curls[i] ?? 0;
    const j1 = fg.querySelector<SVGGElement>("[data-j1]");
    const j2 = j1?.querySelector<SVGGElement>("[data-j2]") ?? null;
    const j3 = j2?.querySelector<SVGGElement>("[data-j3]") ?? null;
    const set = (g: SVGGElement | null, n: number) => {
      if (!g || spec.k[n] == null) return;
      const a = c * spec.k[n] * CURL_SIGN;
      g.setAttribute("transform",
        `rotate(${a.toFixed(1)} ${spec.piv[n][0]} ${spec.piv[n][1]})`);
    };
    set(j1, 0); set(j2, 1); set(j3, 2);
  });
}

export function initHand(): void {
  if (typeof window === "undefined") return;

  const root = document.querySelector<HTMLElement>("#hand-anim");
  if (!root) return;

  const demoHand     = root.querySelector<SVGGElement>("#demo-hand");
  const policyHand   = root.querySelector<SVGGElement>("#policy-hand");
  const streamLayer  = root.querySelector<SVGGElement>("#stream-dots");
  const recDot       = root.querySelector<SVGCircleElement>(".ha-rec-dot");
  const frameCounter = root.querySelector<SVGTextElement>("#frame-counter");
  const graphLines   = [0,1,2,3].map(i =>
    root.querySelector<SVGPolylineElement>(`#graph-ch-${i}`));

  if (!demoHand || !policyHand) return;

  // Reduced motion: render a single resting open-hand pose and stop.
  if (window.matchMedia(REDUCED).matches) {
    const rest = toCurls([0, 0, 0, 0]);
    applyHandPose(demoHand, rest, 0);
    applyHandPose(policyHand, rest, 0);
    return;
  }

  // ── Graph ─────────────────────────────────────────────────────
  const samples: number[][] = [[], [], [], []];
  let frameCount = 0;

  function updateGraph(joints: [number, number, number, number]) {
    for (let ch = 0; ch < 4; ch++) {
      samples[ch].push(joints[ch]);
      if (samples[ch].length > MAX_SAMPLES) samples[ch].shift();
    }
    for (let ch = 0; ch < 4; ch++) {
      const line = graphLines[ch];
      if (!line) continue;
      const chanTop = GRAPH_Y + LEGEND_H + ch * CHAN_H + 4;
      const chanBot = GRAPH_Y + LEGEND_H + (ch + 1) * CHAN_H - 4;
      const n = samples[ch].length;
      const pts: string[] = [];
      for (let s = 0; s < n; s++) {
        const px = GRAPH_X + 28 + (s / MAX_SAMPLES) * (GRAPH_W - 36);
        const py = lerp(chanBot, chanTop, samples[ch][s]);
        pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
      }
      line.setAttribute("points", pts.join(" "));
    }
  }

  // ── Stream dots (human → robot) ────────────────────────────────
  interface Dot { progress: number; el: SVGCircleElement; }
  const dots: Dot[] = [];
  let lastDotSpawn = 0;
  function spawnDot() {
    if (!streamLayer) return;
    const el = document.createElementNS(SVGNS, "circle");
    el.setAttribute("r", "3");
    el.style.cssText = "fill:var(--c-accent);opacity:0.7";
    streamLayer.appendChild(el);
    dots.push({ progress: 0, el });
  }

  // ── REC blink ──────────────────────────────────────────────────
  let recVisible = true;
  let lastRecBlink = 0;

  // ── RAF loop ───────────────────────────────────────────────────
  let last = performance.now();
  let elapsed = 0;

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; elapsed += dt;

    const joints = getJoints(elapsed);
    const curls  = toCurls(joints);
    // Wrist turns back and forth slowly; robot copies it exactly.
    const wristDeg = Math.sin(elapsed / 950) * 16;

    applyHandPose(demoHand!, curls, wristDeg);
    applyHandPose(policyHand!, curls, wristDeg);

    // Stream dots across the gap
    if (elapsed - lastDotSpawn > DOT_PERIOD) { spawnDot(); lastDotSpawn = elapsed; }
    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      dot.progress += dt / 800;
      if (dot.progress >= 1) {
        streamLayer?.removeChild(dot.el);
        dots.splice(i, 1);
        continue;
      }
      const t = easeInOut(dot.progress);
      const x = lerp(LEFT_CX + 150, RIGHT_CX - 150, t);
      const y = STREAM_Y - Math.sin(dot.progress * Math.PI) * 12;
      dot.el.setAttribute("cx", x.toFixed(1));
      dot.el.setAttribute("cy", y.toFixed(1));
      dot.el.style.opacity = (0.7 * Math.sin(dot.progress * Math.PI)).toFixed(2);
    }

    // REC blink (1 Hz)
    if (now - lastRecBlink > 500) {
      recVisible = !recVisible;
      if (recDot) recDot.style.opacity = recVisible ? "1" : "0";
      lastRecBlink = now;
    }

    // Graph
    frameCount++;
    updateGraph(joints);
    if (frameCounter) frameCounter.textContent = `F:${String(frameCount).padStart(4, "0")}`;

    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.disconnect();
          last = performance.now();
          requestAnimationFrame(frame);
          break;
        }
      }
    }, { rootMargin: "200px" });
    io.observe(root);
  } else {
    requestAnimationFrame(frame);
  }
}
