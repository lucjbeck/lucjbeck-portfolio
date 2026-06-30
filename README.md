# Luc Beck — Portfolio

**🔗 Live at [www.lucbeck.com](https://www.lucbeck.com)**

My personal site and a deliberate work sample: a single, long, instrument-grade page covering my biophysics research (DNA nanoswitches) and my EE/AI engineering work.

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
