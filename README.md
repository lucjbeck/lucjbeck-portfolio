# Luc Beck — Portfolio

Personal site. Biophysics research (DNA nanoswitches) and EE/AI engineering, built as a work sample.

Concept: **"Specimen / Instrument."** Dark instrument-grade UI, one luminous accent, a monospace data texture, catalog numbering as the structural spine, and a signature anime.js hero: a stylized DNA nanoswitch that assembles, then morphs between open and closed conformations on hover, scroll, or click.

## Stack

- **Astro** (static output, TypeScript) — ships almost no JS.
- **anime.js v4** — the hero conformational switch, scroll-reveal, and spring micro-interactions. Loaded only where needed.
- **Hand-rolled CSS** with design tokens as CSS variables (`src/styles/tokens.css`). No Tailwind.
- **Self-hosted fonts** (woff2, `font-display: swap`): Cabinet Grotesk (display), Hanken Grotesk (body), JetBrains Mono (data texture). No Inter.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output to dist/
npm run preview    # serve the production build locally
```

Node 18+ (developed on Node 22).

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

Accessibility / quality floor: semantic HTML, one `<h1>` per page, visible `:focus-visible`, skip link, WCAG AA contrast, `prefers-reduced-motion` resolves the hero to its static state and disables reveals, responsive from 360px.

## Deploy — Vercel (primary)

Vercel auto-detects Astro; no adapter is needed for static output.

1. Push this repo to GitHub (see below).
2. In Vercel: **New Project** → import the repo. Framework preset **Astro**, build `npm run build`, output `dist`. Deploy.
3. **Custom domain `lucbeck.com`:**
   - Vercel → Project → **Settings → Domains** → add `lucbeck.com` and `www.lucbeck.com`.
   - At your domain registrar, point DNS at Vercel:
     - Apex `lucbeck.com`: **A** record → `76.76.21.21` (or the ALIAS/ANAME Vercel shows).
     - `www`: **CNAME** → `cname.vercel-dns.com`.
   - Vercel issues HTTPS automatically once DNS resolves.

### Push to GitHub

```bash
gh repo create lucbeck-portfolio --public --source=. --remote=origin --push
# or: git remote add origin git@github.com:<you>/lucbeck-portfolio.git && git push -u origin main
```

The repo is intended to be public — it doubles as a GitHub presence.

## Deploy — GitHub Pages (fallback)

A workflow is included at `.github/workflows/deploy-pages.yml`. To use it:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`; the workflow builds and deploys.
3. For the custom domain on Pages instead of Vercel: add `lucbeck.com` under Settings → Pages, create a `public/CNAME` file containing `lucbeck.com`, and point apex DNS at the GitHub Pages IPs with a `www` CNAME to `<you>.github.io`.

> If serving from a project subpath (e.g. `<you>.github.io/lucbeck-portfolio`) rather than a custom domain, set `base: '/lucbeck-portfolio'` and `site` accordingly in `astro.config.mjs`. With the `lucbeck.com` custom domain the current root config is correct.

## Notes

- Design tokens are committed in `design/tokens.css` (canonical) and mirrored to `src/styles/tokens.css` (shipped). Edit the accent in one place: the `--c-accent*` variables.
- The `/taste` design analyses of the reference sites are in `design/taste/`.
