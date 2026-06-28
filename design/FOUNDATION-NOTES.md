# Foundation Notes — Luc Beck Portfolio

The verified Astro foundation other agents build on. Stack, file structure,
component contracts, the hero mount-point contract, and font method.

## Stack (verified)
- **Astro 7.0.3**, static output (`output: 'static'`), `site: 'https://lucbeck.com'`. TypeScript (`astro/tsconfigs/strict`).
- **animejs 4.5.0** installed (verified 4.x). Ships its own types via its `exports` map — no `@types/animejs` needed (that package is v3-only and was intentionally NOT installed). Import named exports: `import { animate, createTimeline, stagger, createSpring, svg, utils } from "animejs"`.
- Hand-rolled CSS with the committed design tokens as CSS variables. No Tailwind.
- Node 22.

## Commands
- **Dev:** `npm run dev` → http://localhost:4321
- **Build:** `npm run build` → outputs to `dist/` (verified: builds clean, 1 page).
- **Preview built site:** `npm run preview`

## File structure (created by this agent)
```
package.json            scripts + deps (astro, animejs)
astro.config.mjs        static output, site=https://lucbeck.com
tsconfig.json           extends astro strict
.gitignore              node_modules, dist, .astro, .vercel, .DS_Store, .env
public/
  favicon.svg           placeholder (nanoswitch motif, accent + off-white nodes)
  fonts/                self-hosted woff2 (8 files, see Fonts)
src/
  styles/
    tokens.css          shipped COPY of design/tokens.css (design/ stays canonical)
    fonts.css           @font-face for all three families
    global.css          imports tokens+fonts, reset, base type, links, focus, a11y
  layouts/
    Base.astro          full HTML doc, head meta, OG/Twitter, font preloads
  components/
    Container.astro     centered max-width wrapper
    CatalogNumber.astro mono catalog tag (the structural-spine device)
    Section.astro       semantic section w/ rhythm + optional editorial header
    NanoSwitch.astro    HERO MOUNT STUB — animation agent owns this file
  pages/
    index.astro         minimal: Base + NanoSwitch mount + "sections go here"
```
`design/tokens.css` remains the canonical source. `src/styles/tokens.css` is the
shipped copy — if tokens change, update `design/tokens.css` first, then re-copy.

## Fonts — method used
**One consistent method: all three families self-hosted as woff2 in `public/fonts/`,
declared by hand in `src/styles/fonts.css`, all `font-display: swap`.** No @fontsource
runtime import, no CDN `<link>`. No fallback was needed — all downloads succeeded.

| Role | Family | Source | Weights (files) |
|------|--------|--------|-----------------|
| Display | Cabinet Grotesk | Fontshare CSS → woff2 | 500 `-Medium`, 700 `-Bold`, 800 `-Extrabold` |
| Body | Hanken Grotesk | Fontsource jsDelivr woff2 (latin) | 400, 500, 700 |
| Mono | JetBrains Mono | Fontsource jsDelivr woff2 (latin) | 400, 500 |

**Preloaded** in `Base.astro` `<head>` (the two most critical faces):
`CabinetGrotesk-Bold.woff2` (display 700) and `HankenGrotesk-400.woff2` (body 400),
both `crossorigin`.

Token font stacks (in `tokens.css`, do not redefine): `--font-display` (Cabinet),
`--font-body` (Hanken), `--font-mono` (JetBrains Mono).

## Component contracts (props)

### Container.astro
Centered max-width wrapper with gutter padding.
- `as?` — element tag, default `"div"`.
- `width?` — `"default"` (`--maxw` 1240px) | `"prose"` (`--maxw-prose` 68ch). Default `"default"`.
- `class?` — extra classes (merged).

### CatalogNumber.astro
Mono catalog tag (`FIG. 01`, `SPEC-01`, `ROLE-02`) — the structural spine.
- `label` (required) — tag text.
- `tone?` — `"accent"` (default) | `"faint"` (uses `--c-text-faint`).
- `as?` — element tag, default `"span"`.
- `boxed?` — wrap in a hairline pill cell. Default `false`.
- `class?`.
Styled with `--font-mono`, `--fs-mono-label`, `--ls-label`, uppercase, tabular-nums.

### Section.astro
Semantic `<section>` with vertical rhythm (`--section-y`) and an optional
editorial (not forced-centered) header. Wraps content in a `Container`.
- `id?` — anchor id.
- `eyebrow?` — catalog tag text; renders a `CatalogNumber`. Omit for no eyebrow.
- `eyebrowTone?` — `"accent"` (default) | `"faint"`.
- `heading?` — convenience, renders an `<h2>`. Or use the `heading` named slot for custom markup.
- `rule?` — draw a hairline top rule (datasheet divider). Default `false`.
- `class?`.
- Slots: `"heading"` (custom heading, overrides `heading` prop), default (content).

### Base.astro (layout)
Full HTML doc. Owns head meta, OG/Twitter, favicon, font preloads, global.css import.
- `title?` — default `"Luc Beck — EE & AI at Penn"`.
- `description?` — default is the brief one-liner.
- `path?` — page path for canonical/OG url, default `"/"`.
`lang="en"`, `color-scheme: dark`, `theme-color: #0A0B0D`.

### Hairline grid / drawn-border utilities (in global.css)
Structure via borders, not shadow (the wodniack datasheet device):
- `.hairline-cell` — single ruled cell (`--border` + `--r-md`).
- `.hairline-grid` — grid where every cell is divided by 1px hairlines (set `grid-template-columns` on it; children get the bg).
- `.hairline-rule` — a drawn top rule / section divider.

## Hero mount-point contract (NanoSwitch.astro)
**The animation agent OWNS and will OVERWRITE `src/components/NanoSwitch.astro`.**
The full contract is duplicated at the top of that file. Summary:

1. **Mount id:** the container is `#nanoswitch`. The anime.js timeline selects it
   and its inner SVG nodes/edges.
2. **SVG structure:** inline `<svg>` inside `#nanoswitch` with
   `<circle class="ns-node" data-node="N">` nodes and `<line class="ns-edge" data-edge="A-B">` edges.
3. **Script entry point:** a module `<script>` at the bottom of the file. Astro
   bundles it automatically. Expected pattern:
   ```js
   import { animate, createTimeline, stagger, svg, utils } from "animejs";
   const root = document.querySelector("#nanoswitch");
   if (root && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
     // assembly -> settle -> morph timeline
   }
   ```
4. **Reduced motion:** when `prefers-reduced-motion: reduce`, render the final
   resolved conformation statically (the stub already draws a complete, legible
   structure with zero animation — keep this guarantee).
5. **Sizing:** SVG uses a `viewBox` and scales to its container; no fixed pixel
   heights. The hero section (owned by the content agent) controls the box; the
   hero must fit the initial viewport.

The stub currently renders a static 5-node "open" conformation so the page is
legible before the animation agent takes over.

## index.astro
Intentionally minimal (foundation stub): `Base` → `Container` → `NanoSwitch`
mount, plus a `SECTIONS GO HERE` comment. The content agent adds About,
Education, Engineering (`FIG.`), Research (`SPEC.`), Experience (`ROLE.`),
and Footer using `Section` + `CatalogNumber`. No page content or real hero
animation was written by this agent — those are other agents' jobs.

## Accessibility baseline wired in global.css
- Visible keyboard focus: `:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }`
- Selection color uses `--c-accent-dim`.
- `prefers-reduced-motion: reduce` neutralizes animations/transitions globally
  (tokens.css also zeroes the motion duration variables).
- Dark theme locked at the page level (`color-scheme: dark`).
