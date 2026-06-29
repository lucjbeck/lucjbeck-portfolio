/**
 * hand.ts — teleoperation imitation loop, hand-tracking style.
 *
 * The hand is modelled as 21 MediaPipe-style landmarks driven by forward
 * kinematics: each finger folds FORWARD at its joints (a natural curl, not a
 * sideways bend). We render a realistic hand (filled beige skin built from the
 * landmarks) with a dark tracking skeleton + white joint dots overlaid on top.
 * The robot hand (right) is the same model rendered mechanically and rigidly
 * mounted on a fixed, simple arm — it only copies the human's curl + wrist turn.
 * Joint-angle traces scroll along the bottom.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS   = "http://www.w3.org/2000/svg";
const deg = (d: number) => (d * Math.PI) / 180;

// Geometry — must match HandAnimation.astro
const LEFT_CX  = 20 + 340 / 2;         // 190
const RIGHT_CX = 440 + 340 / 2;        // 610
const STREAM_Y = 150;
const GRAPH_Y  = 316;
const GRAPH_H  = 520 - GRAPH_Y - 20;
const LEGEND_H = 28;
const GRAPH_X  = 20;
const GRAPH_W  = 760;
const CHAN_H   = Math.floor((GRAPH_H - LEGEND_H) / 4);

// ── Hand model ──────────────────────────────────────────────────────────────
// Rest pose: an open hand, fingers up (−y), origin at the wrist. Curl folds each
// finger forward at MCP/PIP/DIP by k·curl radians.
interface FingerModel { base: [number, number]; ang: number; len: number[]; k: number[]; }
const WRIST: [number, number] = [0, 0];
const FINGERS: FingerModel[] = [
  // index, middle, ring, pinky
  { base: [-22, -56], ang: deg(-97), len: [30, 20, 16], k: [deg(34), deg(95), deg(80)] },
  { base: [ -7, -62], ang: deg(-91), len: [33, 22, 17], k: [deg(34), deg(95), deg(80)] },
  { base: [  9, -59], ang: deg(-85), len: [30, 20, 15], k: [deg(36), deg(97), deg(82)] },
  { base: [ 22, -50], ang: deg(-78), len: [24, 17, 13], k: [deg(40), deg(99), deg(84)] },
];
const THUMB: FingerModel =
  { base: [-29, -14], ang: deg(-134), len: [24, 18, 16], k: [deg(18), deg(40), deg(42)] };

// Skin / finger tube widths (px)
const FW = [15, 15, 14, 12];   // index..pinky
const TW = 17;                  // thumb

// MediaPipe-style landmark order: 0 wrist; 1-4 thumb; 5-8 index; 9-12 middle;
// 13-16 ring; 17-20 pinky.
type Pt = [number, number];
function fk(m: FingerModel, curl: number): Pt[] {
  const pts: Pt[] = [[m.base[0], m.base[1]]];
  let a = m.ang;
  let [x, y] = m.base;
  for (let i = 0; i < 3; i++) {
    a += m.k[i] * curl;
    x += m.len[i] * Math.cos(a);
    y += m.len[i] * Math.sin(a);
    pts.push([x, y]);
  }
  return pts; // [MCP, PIP, DIP, tip]
}

// curls: [index, middle, ring, pinky, thumb] → 21 landmarks
function landmarks(curls: number[]): Pt[] {
  const idx = fk(FINGERS[0], curls[0]);
  const mid = fk(FINGERS[1], curls[1]);
  const rng = fk(FINGERS[2], curls[2]);
  const pky = fk(FINGERS[3], curls[3]);
  const thb = fk(THUMB,      curls[4]);
  return [WRIST, ...thb, ...idx, ...mid, ...rng, ...pky];
}

// Skeleton connections (pairs of landmark indices)
const CONNECTIONS: [number, number][] = [
  [0,1],[0,5],[5,9],[9,13],[13,17],[0,17],   // palm
  [1,2],[2,3],[3,4],                          // thumb
  [5,6],[6,7],[7,8],                          // index
  [9,10],[10,11],[11,12],                     // middle
  [13,14],[14,15],[15,16],                    // ring
  [17,18],[18,19],[19,20],                    // pinky
];
// Finger landmark chains (for the skin tubes)
const CHAINS = [[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
const THUMB_CHAIN = [1,2,3,4];
const PALM = [0,1,5,9,13,17];

type Mode = "human" | "robot";
interface HandRefs {
  root: SVGGElement;
  palm: SVGPolygonElement;
  fingers: SVGPolylineElement[];   // 4 + thumb = 5
  lines: SVGLineElement[];
  dots: SVGCircleElement[];
}

function el<K extends keyof SVGElementTagNameMap>(n: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVGNS, n);
}

function buildHand(group: SVGGElement, mode: Mode): HandRefs {
  const root = group.querySelector<SVGGElement>("[data-handroot]") ?? group;
  const palmFill   = mode === "human" ? "#D6AF87" : "#2B2F37";
  const fingerCol  = mode === "human" ? "#E0BD97" : "#363B45";
  const skinStroke = mode === "human" ? "#A87E58" : "#1C1F25";
  const lineCol    = mode === "human" ? "#15171C" : "var(--c-accent)";
  const dotFill    = mode === "human" ? "#FFFFFF" : "var(--c-accent)";
  const dotStroke  = mode === "human" ? "#15171C" : "#0A0B0D";

  // skin palm
  const palm = el("polygon");
  palm.setAttribute("fill", palmFill);
  palm.setAttribute("stroke", skinStroke);
  palm.setAttribute("stroke-width", "2");
  palm.setAttribute("stroke-linejoin", "round");
  root.appendChild(palm);

  // skin finger tubes (4 fingers + thumb)
  const fingers: SVGPolylineElement[] = [];
  const widths = [...FW, TW];
  for (let i = 0; i < 5; i++) {
    const pl = el("polyline");
    pl.setAttribute("fill", "none");
    pl.setAttribute("stroke", fingerCol);
    pl.setAttribute("stroke-width", String(widths[i]));
    pl.setAttribute("stroke-linecap", "round");
    pl.setAttribute("stroke-linejoin", "round");
    root.appendChild(pl);
    fingers.push(pl);
  }

  // skeleton overlay lines
  const lines: SVGLineElement[] = CONNECTIONS.map(() => {
    const l = el("line");
    l.setAttribute("stroke", lineCol);
    l.setAttribute("stroke-width", "2");
    l.setAttribute("stroke-linecap", "round");
    if (mode === "robot") l.setAttribute("opacity", "0.9");
    root.appendChild(l);
    return l;
  });

  // joint dots
  const dots: SVGCircleElement[] = Array.from({ length: 21 }, (_, i) => {
    const c = el("circle");
    c.setAttribute("r", i === 0 ? "3.4" : "2.7");
    c.setAttribute("fill", dotFill);
    c.setAttribute("stroke", dotStroke);
    c.setAttribute("stroke-width", "0.8");
    root.appendChild(c);
    return c;
  });

  return { root, palm, fingers, lines, dots };
}

function poly(pts: Pt[]) { return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "); }

function updateHand(refs: HandRefs, lm: Pt[], wristDeg: number) {
  refs.root.setAttribute("transform", `rotate(${wristDeg.toFixed(1)} 0 0)`);
  refs.palm.setAttribute("points", poly(PALM.map(i => lm[i])));
  [...CHAINS, THUMB_CHAIN].forEach((ch, i) => {
    refs.fingers[i].setAttribute("points", poly(ch.map(j => lm[j])));
  });
  CONNECTIONS.forEach(([a, b], i) => {
    const l = refs.lines[i];
    l.setAttribute("x1", lm[a][0].toFixed(1)); l.setAttribute("y1", lm[a][1].toFixed(1));
    l.setAttribute("x2", lm[b][0].toFixed(1)); l.setAttribute("y2", lm[b][1].toFixed(1));
  });
  refs.dots.forEach((d, i) => {
    d.setAttribute("cx", lm[i][0].toFixed(1)); d.setAttribute("cy", lm[i][1].toFixed(1));
  });
}

// ── Gesture timeline ────────────────────────────────────────────────────────
const GESTURES: [number, number, number, number][] = [
  [0.0, 0.0, 0.0, 0.0],   // open
  [1.0, 1.0, 1.0, 0.85],  // fist
  [0.0, 0.0, 0.0, 0.0],   // open
  [1.0, 0.0, 0.0, 0.7],   // point
  [0.0, 0.0, 0.0, 0.0],   // open
  [0.2, 0.55, 0.9, 0.1],  // wave
  [0.0, 0.0, 0.0, 0.0],
];
const HOLD_MS  = 650;
const BLEND_MS = 750;
const CYCLE_MS = GESTURES.length * (HOLD_MS + BLEND_MS);
const MAX_SAMPLES = 300;
const DOT_PERIOD  = 850;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

function getJoints(t: number): [number, number, number, number] {
  const cycle = ((t % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const stepLen = HOLD_MS + BLEND_MS;
  const i = Math.floor(cycle / stepLen);
  const rem = cycle - i * stepLen;
  const a = GESTURES[i % GESTURES.length];
  const b = GESTURES[(i + 1) % GESTURES.length];
  if (rem < HOLD_MS) return [...a] as [number, number, number, number];
  const t2 = easeInOut(clamp01((rem - HOLD_MS) / BLEND_MS));
  return [lerp(a[0],b[0],t2), lerp(a[1],b[1],t2), lerp(a[2],b[2],t2), lerp(a[3],b[3],t2)];
}
const toCurls = (j: [number, number, number, number]) => [j[0], j[1], j[2], j[2], j[3]];

export function initHand(): void {
  if (typeof window === "undefined") return;
  const root = document.querySelector<HTMLElement>("#hand-anim");
  if (!root) return;

  const demoGroup   = root.querySelector<SVGGElement>("#demo-hand");
  const policyGroup = root.querySelector<SVGGElement>("#policy-hand");
  const streamLayer = root.querySelector<SVGGElement>("#stream-dots");
  const recDot      = root.querySelector<SVGCircleElement>(".ha-rec-dot");
  const frameCounter= root.querySelector<SVGTextElement>("#frame-counter");
  const graphLines  = [0,1,2,3].map(i => root.querySelector<SVGPolylineElement>(`#graph-ch-${i}`));
  if (!demoGroup || !policyGroup) return;

  const demo   = buildHand(demoGroup, "human");
  const policy = buildHand(policyGroup, "robot");

  if (window.matchMedia(REDUCED).matches) {
    const lm = landmarks(toCurls([0,0,0,0]));
    updateHand(demo, lm, 0); updateHand(policy, lm, 0);
    return;
  }

  // Graph
  const samples: number[][] = [[],[],[],[]];
  let frameCount = 0;
  function updateGraph(j: [number, number, number, number]) {
    for (let ch = 0; ch < 4; ch++) {
      samples[ch].push(j[ch]);
      if (samples[ch].length > MAX_SAMPLES) samples[ch].shift();
      const line = graphLines[ch];
      if (!line) continue;
      const top = GRAPH_Y + LEGEND_H + ch * CHAN_H + 4;
      const bot = GRAPH_Y + LEGEND_H + (ch + 1) * CHAN_H - 4;
      const n = samples[ch].length;
      const pts: string[] = [];
      for (let s = 0; s < n; s++) {
        const px = GRAPH_X + 28 + (s / MAX_SAMPLES) * (GRAPH_W - 36);
        pts.push(`${px.toFixed(1)},${lerp(bot, top, samples[ch][s]).toFixed(1)}`);
      }
      line.setAttribute("points", pts.join(" "));
    }
  }

  // Stream dots
  interface Dot { progress: number; el: SVGCircleElement; }
  const dots: Dot[] = [];
  let lastDotSpawn = 0;
  function spawnDot() {
    if (!streamLayer) return;
    const c = el("circle");
    c.setAttribute("r", "3");
    c.style.cssText = "fill:var(--c-accent);opacity:0.7";
    streamLayer.appendChild(c);
    dots.push({ progress: 0, el: c });
  }

  let recVisible = true, lastRecBlink = 0;
  let last = performance.now(), elapsed = 0;

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; elapsed += dt;

    const joints = getJoints(elapsed);
    const curls  = toCurls(joints);
    const lm = landmarks(curls);
    const wristDeg = Math.sin(elapsed / 1000) * 9;   // subtle wrist turn

    updateHand(demo, lm, wristDeg);
    updateHand(policy, lm, wristDeg);

    if (elapsed - lastDotSpawn > DOT_PERIOD) { spawnDot(); lastDotSpawn = elapsed; }
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.progress += dt / 800;
      if (d.progress >= 1) { streamLayer?.removeChild(d.el); dots.splice(i, 1); continue; }
      const t = easeInOut(d.progress);
      const x = lerp(LEFT_CX + 150, RIGHT_CX - 150, t);
      const y = STREAM_Y - Math.sin(d.progress * Math.PI) * 12;
      d.el.setAttribute("cx", x.toFixed(1)); d.el.setAttribute("cy", y.toFixed(1));
      d.el.style.opacity = (0.7 * Math.sin(d.progress * Math.PI)).toFixed(2);
    }

    if (now - lastRecBlink > 500) {
      recVisible = !recVisible;
      if (recDot) recDot.style.opacity = recVisible ? "1" : "0";
      lastRecBlink = now;
    }

    frameCount++;
    updateGraph(joints);
    if (frameCounter) frameCounter.textContent = `F:${String(frameCount).padStart(4, "0")}`;
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { io.disconnect(); last = performance.now(); requestAnimationFrame(frame); break; }
      }
    }, { rootMargin: "200px" });
    io.observe(root);
  } else {
    requestAnimationFrame(frame);
  }
}
