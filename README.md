# Luc Beck — Portfolio

**🔗 Live at [www.lucbeck.com](https://www.lucbeck.com)**

My personal site and a deliberate work sample: a single, long, instrument-grade page covering my biophysics research (DNA nanoswitches) and my EE/AI engineering work.

## Concept — "Specimen / Instrument"

The site is designed to look and feel like a piece of scientific instrumentation rather than a typical résumé page:

- A dark, instrument-grade UI with a single luminous accent color.
- A monospace "data texture" and catalog numbering used as the structural spine of the page.
- A signature animated hero: a stylized **DNA nanoswitch** that assembles on load, then morphs between its open and closed conformations on hover, scroll, or click — a literal nod to the research it represents.
- Restraint throughout: one typographic voice for display, one for body, one for data; no decorative noise.

## What's built

A static, single-page portfolio composed of focused sections — hero, about, education, research, publications, projects, and roles — each rendered from its own component and tied together by the catalog-number system. The animation work (the conformational nanoswitch, scroll-reveal, and spring micro-interactions) is hand-built on anime.js and loaded only where it's needed, so the page ships almost no JavaScript.

Accessibility and quality were treated as a floor, not an afterthought: semantic HTML, a single `<h1>` per page, visible `:focus-visible` states, a skip link, WCAG AA contrast, responsive layout down to 360px, and full `prefers-reduced-motion` support that resolves the hero to its static state and disables reveals.

## Stack

- **[Astro](https://astro.build)** (static output, TypeScript) — ships almost no JS.
- **[anime.js](https://animejs.com) v4** — the hero conformational switch, scroll-reveal, and spring micro-interactions, loaded only where needed.
- **Hand-rolled CSS** with design tokens as CSS variables (`src/styles/tokens.css`). No Tailwind.
- **Self-hosted fonts** (woff2, `font-display: swap`): Cabinet Grotesk (display), Hanken Grotesk (body), JetBrains Mono (data texture).
- Deployed on **Vercel** with the `lucbeck.com` custom domain.

## Project shape

```
src/
  pages/         index.astro (the single long page), 404.astro
  components/    Hero, Nav, About, EducationList, ProjectEntry,
                 ResearchEntry, Publication, RoleEntry, SiteFooter,
                 Section, Container, CatalogNumber, NanoSwitch
  scripts/       nanoswitch.ts (hero), reveal.ts (scroll-reveal), micro.ts (springs)
  styles/        tokens.css, global.css, fonts.css
public/fonts/    self-hosted woff2
design/          design tokens source, /taste analyses, build plan, agent notes
```

## Running locally

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output to dist/
npm run preview    # serve the production build locally
```

Node 18+ (developed on Node 22).
