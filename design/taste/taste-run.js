// Drives Playwright the same way the /taste skill's Phase 1 does:
// resize 1440x900 -> navigate -> wait for hydration -> screenshots -> run extract.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || '.';
const TARGETS = [
  { url: 'https://animejs.com', domain: 'animejs.com' },
  { url: 'https://wodniack.dev', domain: 'wodniack.dev' },
];

// The extractor from ~/.claude/skills/taste/references/extract.js, with the
// one undefined-reference (isVisible) aliased to isRendered so it runs clean.
const EXTRACT = fs.readFileSync(
  path.join(process.env.HOME, '.claude/skills/taste/references/extract.js'),
  'utf8'
);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const t of TARGETS) {
    console.log(`\n=== ${t.url} ===`);
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000); // hydration
      await page.screenshot({ path: path.join(OUT, `${t.domain}-viewport.jpeg`), type: 'jpeg', quality: 80 });
      await page.screenshot({ path: path.join(OUT, `${t.domain}-fullpage.jpeg`), type: 'jpeg', quality: 70, fullPage: true });

      // Inject isVisible alias, then run the extractor body.
      const fn = `(() => { const isVisible = (el)=>{const s=getComputedStyle(el);if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0")return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}; const __extract = ${EXTRACT}; return __extract(); })()`;
      const data = await page.evaluate(fn);
      fs.writeFileSync(path.join(OUT, `${t.domain}.domdata.json`), JSON.stringify(data, null, 2));
      console.log(`  saved ${t.domain}.domdata.json + 2 screenshots`);
      console.log(`  pageBg: ${data.colors.pageBackground}`);
      console.log(`  bg: ${JSON.stringify(data.colors.backgroundColors)}`);
      console.log(`  text: ${JSON.stringify(data.colors.textColors)}`);
      console.log(`  accents: ${JSON.stringify(data.colors.accentCandidates)}`);
      console.log(`  families: ${JSON.stringify(data.typography.uniqueFamilies)}`);
      console.log(`  h1: ${JSON.stringify(data.typography.headings.h1)}`);
      console.log(`  reducedMotion=${data.reducedMotion} focusVisible=${data.focusVisible}`);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }
  await browser.close();
})();
