/**
 * hand.ts — teleoperation training animation.
 * Demo hand (left) cycles through gestures; policy hand (right) follows in sync.
 * Robot arm (right panel) springs between waypoints via 2-link IK — the policy
 * hand rides at the arm tip. Scrolling motor-position graph at bottom.
 * Ghost divergence shows the policy momentarily desync then snap to match.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
const SVGNS   = "http://www.w3.org/2000/svg";

// Geometry — must match HandAnimation.astro
const LEFT_CX  = 20 + 360 / 2;         // 200 — teleop panel centre x
const RIGHT_CX = 460 + 360 / 2;        // 640 — robot panel centre x
const STREAM_Y = 140;                   // y of the training-signal stream arc
const GRAPH_Y  = 316;
const GRAPH_H  = 520 - GRAPH_Y - 20;   // 184
const LEGEND_H = 28;
const GRAPH_X  = 20;
const GRAPH_W  = 760;
const CHAN_H   = Math.floor((GRAPH_H - LEGEND_H) / 4); // 39

// Robot arm constants (shoulder joint SVG position, link lengths, elbow side)
const ARM_BASE_X = 640;
const ARM_BASE_Y = 258;  // shoulder joint SVG y — top of turret
const ARM_L1     = 80;
const ARM_L2     = 70;
const ARM_SIDE   = 1;    // +1 = elbow bends left when arm reaches up

// Waypoints for the robot arm end-effector (absolute SVG coords)
const ARM_WAYPOINTS = [
  { x: 640, y: 143 },  // centre-up
  { x: 702, y: 162 },  // upper-right
  { x: 640, y: 150 },  // centre slightly lower
  { x: 578, y: 162 },  // upper-left
];
const ARM_STEP_MS = 2200;

// Finger pivot positions (MCP joints), relative to hand group origin
const FINGER_DEFS = [
  { mx: -28, my: -6  },  // thumb
  { mx: -18, my: -20 },  // index
  { mx:  -6, my: -20 },  // middle
  { mx:   8, my: -20 },  // ring
  { mx:  22, my: -16 },  // pinky
];

// Gesture keyframes: [index, middle, ring+pinky, thumb] 0–1
const GESTURES: [number,number,number,number][] = [
  [0.0, 0.0, 0.0, 0.0],
  [0.9, 0.9, 0.9, 0.3],
  [0.0, 0.0, 0.0, 0.0],
  [0.85, 0.0, 0.0, 0.6],
  [0.0, 0.0, 0.0, 0.0],
  [0.4,  0.4, 0.7, 0.1],
  [0.0, 0.0, 0.0, 0.0],
];
const HOLD_MS  = 600;
const BLEND_MS = 700;
const CYCLE_MS = GESTURES.length * (HOLD_MS + BLEND_MS);

const MAX_SAMPLES = 300;
const DOT_PERIOD  = 900;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

function getJoints(t: number): [number,number,number,number] {
  const cycle = ((t % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const stepLen = HOLD_MS + BLEND_MS;
  const idx = Math.floor(cycle / stepLen);
  const rem = cycle - idx * stepLen;
  const a = GESTURES[idx % GESTURES.length];
  const b = GESTURES[(idx + 1) % GESTURES.length];
  if (rem < HOLD_MS) return [...a] as [number,number,number,number];
  const blend = easeInOut(clamp01((rem - HOLD_MS) / BLEND_MS));
  return [lerp(a[0],b[0],blend), lerp(a[1],b[1],blend),
          lerp(a[2],b[2],blend), lerp(a[3],b[3],blend)];
}

function jointsToCurls(j: [number,number,number,number]) {
  return [
    j[3] * 45,  // thumb abduction
    j[0] * 75,  // index curl
    j[1] * 75,  // middle curl
    j[2] * 65,  // ring curl
    j[2] * 55,  // pinky curl
  ];
}

function applyHandPose(handEl: Element, curls: number[]) {
  const fingers = handEl.querySelectorAll<SVGGElement>("[data-finger]");
  fingers.forEach((fg, i) => {
    const curl = curls[i] ?? 0;
    fg.setAttribute("transform",
      `rotate(${curl.toFixed(1)} ${FINGER_DEFS[i].mx} ${FINGER_DEFS[i].my})`);
  });
}

// 2-link IK: returns elbow position for shoulder → elbow → end-effector chain
function ik2d(bx: number, by: number, tx: number, ty: number,
               L1: number, L2: number, side: number) {
  let dx = tx - bx, dy = ty - by;
  let d  = Math.hypot(dx, dy);
  if (d < 1) return { ex: bx, ey: by - L1 };
  const maxR = L1 + L2 - 1, minR = Math.abs(L1 - L2) + 2;
  if (d > maxR) { dx *= maxR / d; dy *= maxR / d; d = maxR; }
  if (d < minR) { dx *= minR / d; dy *= minR / d; d = minR; }
  const c2 = Math.max(-1, Math.min(1, (d*d - L1*L1 - L2*L2) / (2*L1*L2)));
  const a2 = Math.acos(c2);
  const a1 = Math.atan2(dy, dx)
           - Math.atan2(side * L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
  return { ex: bx + L1*Math.cos(a1), ey: by + L1*Math.sin(a1) };
}

export function initHand(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia(REDUCED).matches) return;

  const root = document.querySelector<HTMLElement>("#hand-anim");
  if (!root) return;

  const demoHand     = root.querySelector<SVGGElement>("#demo-hand");
  const policyHand   = root.querySelector<SVGGElement>("#policy-hand");
  const streamLayer  = root.querySelector<SVGGElement>("#stream-dots");
  const ghostLayer   = root.querySelector<SVGGElement>("#ghost-traces");
  const recDot       = root.querySelector<SVGCircleElement>(".ha-rec-dot");
  const frameCounter = root.querySelector<SVGTextElement>("#frame-counter");
  const graphLines   = [0,1,2,3].map(i =>
    root.querySelector<SVGPolylineElement>(`#graph-ch-${i}`));
  const robUa    = root.querySelector<SVGLineElement>("#rob-ua");
  const robEj    = root.querySelector<SVGCircleElement>("#rob-ej");
  const robFa    = root.querySelector<SVGLineElement>("#rob-fa");
  const robWrist = root.querySelector<SVGCircleElement>("#rob-wrist");

  if (!demoHand || !policyHand || !streamLayer || !ghostLayer) return;

  // ── Graph ─────────────────────────────────────────────────────
  const samples: number[][] = [[], [], [], []];
  let frameCount = 0;

  function updateGraph(joints: [number,number,number,number]) {
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

  // ── Ghost divergence — pre-allocated lines, no DOM churn ──────
  let ghostActive   = false;
  let ghostStartT   = 0;
  let ghostDuration = 1200;
  let nextGhostT    = 2400;
  let ghostJoints: [number,number,number,number] = [0,0,0,0];

  const ghostLineEls: SVGLineElement[] = [];
  for (let i = 0; i < 4; i++) {
    const l = document.createElementNS(SVGNS, "line");
    l.setAttribute("stroke", "var(--c-accent)");
    l.setAttribute("stroke-width", "1.5");
    l.setAttribute("stroke-dasharray", "3 3");
    l.setAttribute("stroke-linecap", "round");
    l.style.opacity = "0";
    ghostLayer.appendChild(l);
    ghostLineEls.push(l);
  }

  // armEff declared before ghost helpers (they close over it at call time)
  const armEff = { x: ARM_WAYPOINTS[0].x, y: ARM_WAYPOINTS[0].y };

  function updateGhostLines(divergedCurls: number[], targetCurls: number[], fade: number) {
    for (let i = 0; i < 4; i++) {
      const def = FINGER_DEFS[i];
      const px  = armEff.x + def.mx;
      const py  = armEff.y + def.my;
      const fromAngle = (divergedCurls[i] ?? 0) * Math.PI / 180;
      const toAngle   = (targetCurls[i]   ?? 0) * Math.PI / 180;
      const segLen = 24 + i * 3;
      const fx1 = px + Math.sin(fromAngle) * segLen;
      const fy1 = py - Math.cos(fromAngle) * segLen;
      const fx2 = px + Math.sin(toAngle)   * segLen;
      const fy2 = py - Math.cos(toAngle)   * segLen;
      if (Math.hypot(fx1-fx2, fy1-fy2) < 2) {
        ghostLineEls[i].style.opacity = "0";
      } else {
        ghostLineEls[i].setAttribute("x1", fx1.toFixed(1));
        ghostLineEls[i].setAttribute("y1", fy1.toFixed(1));
        ghostLineEls[i].setAttribute("x2", fx2.toFixed(1));
        ghostLineEls[i].setAttribute("y2", fy2.toFixed(1));
        ghostLineEls[i].style.opacity = (fade * 0.45).toFixed(2);
      }
    }
  }

  function hideGhostLines() {
    for (const l of ghostLineEls) l.style.opacity = "0";
  }

  // ── Stream dots ────────────────────────────────────────────────
  interface Dot { progress: number; el: SVGCircleElement; }
  const dots: Dot[] = [];
  let lastDotSpawn = 0;

  function spawnDot() {
    const el = document.createElementNS(SVGNS, "circle");
    el.setAttribute("r", "3");
    el.style.cssText = "fill:var(--c-accent);opacity:0.7";
    streamLayer!.appendChild(el);
    dots.push({ progress: 0, el });
  }

  // ── REC blink ──────────────────────────────────────────────────
  let recVisible  = true;
  let lastRecBlink = 0;

  // ── Robot arm spring state ─────────────────────────────────────
  let armVx = 0, armVy = 0;
  let armWptIdx = 0;
  let armStepElapsed = 0;

  // ── RAF loop ───────────────────────────────────────────────────
  let last    = performance.now();
  let elapsed = 0;

  function frame(now: number) {
    const dt = Math.min(40, now - last); last = now; elapsed += dt;

    // Gesture animation
    const joints = getJoints(elapsed);
    const curls  = jointsToCurls(joints);
    applyHandPose(demoHand!, curls);

    // Ghost divergence
    if (!ghostActive && elapsed > nextGhostT) {
      ghostActive   = true;
      ghostStartT   = elapsed;
      ghostDuration = 900 + Math.random() * 600;
      nextGhostT    = elapsed + ghostDuration + 2000 + Math.random() * 1000;
      ghostJoints   = [
        clamp01(joints[0] + (Math.random()-0.5)*0.4),
        clamp01(joints[1] + (Math.random()-0.5)*0.4),
        clamp01(joints[2] + (Math.random()-0.5)*0.4),
        clamp01(joints[3] + (Math.random()-0.5)*0.4),
      ];
    }
    if (ghostActive) {
      const gT = (elapsed - ghostStartT) / ghostDuration;
      if (gT >= 1) {
        ghostActive = false;
        hideGhostLines();
        applyHandPose(policyHand!, curls);
      } else {
        const snap        = gT > 0.5 ? easeInOut((gT-0.5)*2) : 0;
        const ghostCurls  = jointsToCurls(ghostJoints);
        const displayCurls = curls.map((c, i) => lerp(ghostCurls[i], c, snap));
        const fade        = gT < 0.5 ? easeInOut(gT*2) : 1-easeInOut((gT-0.5)*2);
        applyHandPose(policyHand!, displayCurls);
        updateGhostLines(ghostCurls, curls, fade);
      }
    } else {
      applyHandPose(policyHand!, curls);
    }

    // Robot arm — spring toward current waypoint, then IK
    armStepElapsed += dt;
    if (armStepElapsed > ARM_STEP_MS) {
      armWptIdx = (armWptIdx + 1) % ARM_WAYPOINTS.length;
      armStepElapsed = 0;
    }
    const wpt = ARM_WAYPOINTS[armWptIdx];
    armVx = (armVx + (wpt.x - armEff.x) * 0.06) * 0.76;
    armVy = (armVy + (wpt.y - armEff.y) * 0.06) * 0.76;
    armEff.x += armVx;
    armEff.y += armVy;

    const { ex, ey } = ik2d(ARM_BASE_X, ARM_BASE_Y, armEff.x, armEff.y,
                             ARM_L1, ARM_L2, ARM_SIDE);
    robUa?.setAttribute("x1", ARM_BASE_X.toFixed(1));
    robUa?.setAttribute("y1", ARM_BASE_Y.toFixed(1));
    robUa?.setAttribute("x2", ex.toFixed(1));
    robUa?.setAttribute("y2", ey.toFixed(1));
    robEj?.setAttribute("cx", ex.toFixed(1));
    robEj?.setAttribute("cy", ey.toFixed(1));
    robFa?.setAttribute("x1", ex.toFixed(1));
    robFa?.setAttribute("y1", ey.toFixed(1));
    robFa?.setAttribute("x2", armEff.x.toFixed(1));
    robFa?.setAttribute("y2", armEff.y.toFixed(1));
    robWrist?.setAttribute("cx", armEff.x.toFixed(1));
    robWrist?.setAttribute("cy", armEff.y.toFixed(1));
    policyHand?.setAttribute("transform",
      `translate(${armEff.x.toFixed(1)} ${armEff.y.toFixed(1)})`);

    // Stream dots across the gap
    if (elapsed - lastDotSpawn > DOT_PERIOD) {
      spawnDot();
      lastDotSpawn = elapsed;
    }
    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      dot.progress += dt / 800;
      if (dot.progress >= 1) {
        streamLayer!.removeChild(dot.el);
        dots.splice(i, 1);
        continue;
      }
      const t = easeInOut(dot.progress);
      const x = lerp(LEFT_CX + 180, RIGHT_CX - 180, t);
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
