# wodniack.dev — Design DNA

Extracted via Playwright (1440x900). The viewport capture caught the intro wipe (full-bleed `#F40C3F`); the base theme is warm near-black, confirmed by DOM (`#160000`) and the bordered header cells visible over the wipe.

## Design Map

**Color**
- Base: `#160000` (warm near-black, red-shifted, not neutral)
- Text: warm off-white on dark; inverts to `#160000` on the red
- Accent: `#F40C3F` (hot red-pink) — used as a full-surface state (intro/hover/section flip) and for emphasis links ("Hire me")
- High contrast, two-color logic: dark + one loud accent, nothing in between.

**Type (three roles, the core of the look)**
- Display: `Bigger Display` — huge (h1 `216px`), weight 700, line-height `0.8` (172.8px), tracking `-0.4px`. Oversized and tight.
- Editorial serif: `Editorial New` — the running microcopy ("Coding globally from France.", "Available for freelance work")
- Mono: `Fraktion Mono` — nav labels (`ABOUT WORK CONTACT`), data, the datasheet texture
- The serif + mono pairing over near-black is the signature.

**Layout / effects**
- Bordered grid cells across the header: logo | spacer | nav | socials | toggle | status | QR. Reads like an instrument panel / datasheet.
- A literal QR code and a light/dark toggle as first-class header furniture — lab-notebook personality.
- Hairline borders define structure (not shadows). Sharp, near-zero radii.
- Catalog/index structure for work lower on the page (numbered).

## Taste DNA

**1. Type carries the whole design.**
Trigger: a near-empty dark canvas. Decision: spend everything on type — a 216px display, an editorial serif, and a mono, with almost no imagery. Reason: at that scale, type *is* the graphic; it signals confidence and removes the need for decoration. Evidence: h1 line-height 0.8 and tracking -0.4px — set tighter than default, a deliberate craft choice.

**2. The grid is drawn, not implied.**
Trigger: a header with many small utilities (nav, socials, status, QR, toggle). Decision: enclose each in a visible bordered cell. Reason: hairline cells turn clutter into an instrument panel and telegraph precision. Evidence: every header item sits in its own ruled box; structure comes from 1px borders, not shadows.

**3. One accent as a full-surface event.**
Trigger: wanting motion/feedback without effects soup. Decision: deploy the single red as an entire-screen wipe and section flips, not as scattered highlights. Reason: a whole-surface color change is more memorable and more disciplined than ten small colored accents. Evidence: the intro renders the viewport fully `#F40C3F` before resolving to dark.

**4. (Restraint) Personality lives in microcopy and furniture, not in styling.**
Trigger: wanting the site to feel human. Decision: a QR code, a status line ("Available for freelance work"), and a theme toggle — real utilities with character — instead of decorative flourishes. Reason: functional furniture reads as craft; ornament reads as filler. Evidence: no gradients, no stock icons; character comes from the status cell and QR.

## Port to Luc's site
- Take the three-role type system (oversized display + editorial + mono) and tight display leading.
- Take the drawn-grid / datasheet header and the numbered catalog/index.
- Take "personality via functional furniture" for the one delight touch.
- Do NOT take the red base or the full-screen wipe (too loud for a research hiring site); keep the accent quieter and reserve a single conformational morph as the one bold moment.
