# Build Plan — Luc Beck Portfolio

**Design read:** developer/researcher portfolio for technical hiring managers (labs, AI/ML, quant, hardware). Language: "Specimen / Instrument." Dials: VARIANCE 7, MOTION 5 (function-is-the-flex restraint), DENSITY 4. Brief wins on stack + content; taste-skill wins on polish + anti-slop.

## Stack (brief-mandated)
- **Astro** (static, minimal JS), TypeScript.
- **anime.js v4** (named exports), loaded only on pages that need it. API verified against docs before writing.
- Hand-rolled CSS with the design tokens in `design/tokens.css` as CSS variables. No Tailwind (one approach, applied consistently).
- Self-hosted fonts (woff2, `font-display: swap`): Cabinet Grotesk / Hanken Grotesk / JetBrains Mono.

## Design system (committed — see `design/tokens.css`)
- **Palette:** base `#0A0B0D`, off-white `#ECEFF3`, muted `#A6ADB8`, hairline grid borders. One accent.
- **Accent:** Specimen cyan `#34D6C9` (luminous blue-green = fluorescence/oscilloscope readout; deliberately not acid-green/vermilion/coral). Documented alternate: amber `#F2B450` (swap 3 vars). **Needs your sign-off.**
- **Type:** 3 roles, no Inter. Display Cabinet Grotesk (large, tight leading 0.96), body Hanken Grotesk, mono JetBrains Mono (figure numbers, labels, code chips).
- **Radius:** one near-square scale (3/6/10/pill). **Motion:** restrained; one bold moment (the hero morph). Reduced-motion resolves to final state.

## Structure (single long home page + minimal routes)
Catalog numbering is the spine. Sections, in order:
1. **Hero** — name, one-line, the conformational-switch animation (the one bold thing).
2. **About / interests** — the real paragraph; `[PLACEHOLDER]` personal-interests line flagged.
3. **Education** `00 / —` — Penn, EE+AI, GPA 3.96, honors. `[PLACEHOLDER]` grad year + coursework.
4. **Engineering** `FIG. 01` — Robotic Arm + ACT. `[PLACEHOLDER]` capability/demo/repo.
5. **Research** `SPEC-01` — Wong Lab; first-author JEI pub (`[PLACEHOLDER]` URL); optional Lancet (default include as credit).
6. **Experience** `ROLE-01/02` — Northpond, Construct.
7. **Footer / contact** — email, `[PLACEHOLDER]` GitHub + LinkedIn, one sign-off line.
- **404** page candidate for the single delight touch.

## Signature animation (anime.js v4)
- Hero = a stylized nanoswitch: node-and-edge SVG. Timeline: staggered assembly (stagger 45ms) → settle into "open" conformation → morph to "closed/looped" on scroll/hover/click (coordinated node transforms + SVG path morph). Subtle idle.
- Scroll-reveal: anime.js + IntersectionObserver, one orchestrated stagger.
- Micro-interactions: a few `createSpring` hovers (links, molecule reacts to cursor).
- **One delight touch:** hero molecule "boops" + springs on click (pick one only).
- Reduced-motion: render final resolved conformation, no animation. Perf budget: hero JS lazy, no scroll jank.

## Subagents (parallel, then converge)
1. **design-system** — finalize global CSS from tokens, wire + self-host the 3 fonts, base layout primitives (container, catalog-number component, hairline grid).
2. **signature-animation** — verify anime.js v4 API, build hero switch + scroll-reveal + spring hovers + reduced-motion fallback, perf budget.
3. **content+pages** — scaffold Astro, implement every section with exact brief copy, semantic HTML, responsive (360px+), catalog numbering, meta + OpenGraph.
4. **integration+qa** — assemble, run the section-8 pre-flight checklist, screenshot desktop+mobile, critique vs brief, fix, repeat once.

## Deploy
- Vercel primary (custom domain `lucbeck.com` + auto HTTPS); GitHub Pages documented fallback. README with DNS notes. Clean public repo.

## Acceptance (brief section 8) — run before "done"
Hero fits viewport + reduced-motion fallback · one accent/radius/theme · 3 type roles, no Inter · real copy, no em dashes, no invented facts · responsive 360px+, visible focus, AA contrast · Lighthouse perf+a11y strong · every `[PLACEHOLDER]` filled or flagged · screenshot-critique-fix twice.

## Open placeholders to surface (none block the build except where noted)
Grad year · coursework · personal-interests line · robot capability/demo/repo · JEI URL · GitHub + LinkedIn URLs · Lancet include? (default: include as credit). I will build with tasteful placeholders and flag each in the final summary.
