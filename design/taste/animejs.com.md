# animejs.com — Design DNA

Extracted via Playwright (1440x900), DOM + viewport/full-page screenshot. Screenshot is ground truth; DOM colors from the live demo are flagged as decorative.

## Design Map

**Color**
- Page background: `#060606` (near-black, neutral, not pure black)
- Text, primary: `#F6F4F2` (warm off-white) on display; secondary `#B4B1AF` (warm grey) for body
- Accent: `#FF4B4B` coral-red — the one interactive/brand color (logo dot, "Sponsor" button border + heart)
- DECORATIVE (do not use as palette): the rainbow ring (`#FF4B4B`, `#8DFF55`, `#B7FF54`, `#FFCC2A`, `#FF7D36`, `#00FFAA`, blue) is the live particle demo, not the design system. It is the *content*, rendered on a strictly monochrome shell.

**Type**
- Display: a chunky rounded grotesque (`DIN`-family), set large with tight leading ("All-in-one animation engine.")
- Mono: monospace for the install chip (`npm i animejs`) and UI labels — the "data texture"
- Two roles only: oversized grotesque + mono. No serif.

**Layout / effects**
- Asymmetric: display headline pinned left, animation centered-right, action chips bottom-left, sponsor bottom-right. Not a centered stack.
- Generous negative space around a single focal animation.
- Small radii on chips/buttons; hairline borders. Restrained.
- `reducedMotion` media query: not detected in CSS (animation is canvas/JS-driven).

## Taste DNA

**1. Monochrome shell, polychrome content.**
Trigger: a site whose entire selling point is colorful motion. Decision: make the *frame* austere near-black + one accent, and let the animation be the only color. Reason: if the chrome competed with the demo, neither would read; restraint in the shell is what makes the motion feel like an instrument readout. Evidence: every structural surface is `#060606`/off-white/`#FF4B4B`; all saturation lives inside the animated ring.

**2. One accent, spent on the verb.**
Trigger: many places could be colored. Decision: reserve `#FF4B4B` for exactly the brand mark and the single most important action ("Sponsor"). Reason: a lone accent becomes a wayfinding signal instead of decoration. Evidence: nav links are off-white; only the logo dot and Sponsor button carry red.

**3. Mono as proof-of-engineering.**
Trigger: needing to signal "this is a real dev tool." Decision: use monospace for the install command and labels, not just code blocks. Reason: the mono texture reads as a terminal/datasheet and signals substance to a technical reader in under a second. Evidence: `npm i animejs` chip rendered in mono, bottom-left, as a primary CTA-adjacent element.

**4. (Restraint) The hero is one object, not a montage.**
Trigger: temptation to show many demos at once. Decision: a single centered structure that morphs, with the rest of the viewport empty. Reason: one well-staged object out-reads a grid of thumbnails and leaves room for the headline to breathe. Evidence: ~50% of the viewport is intentional negative space around one animation.

## Port to Luc's site
- Take the monochrome-shell + one-accent discipline directly.
- The morphing node/particle ring IS the conformational-switch reference: staggered assembly, settle, reconfigure.
- Keep the mono "data texture" for figure numbers and labels.
- Do NOT take the coral-red; reconcile to one committed instrument accent (see tokens.css).
