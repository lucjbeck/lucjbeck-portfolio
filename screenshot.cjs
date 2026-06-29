#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE = 'http://localhost:4322';
const OUT  = path.join(__dirname, '.screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  // Go to about section and take snapshots at 0s, 6s, 14s, 22s
  await page.goto(BASE + '/#about');

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'about-0s.png') });
  console.log('saved: about-0s.png');

  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, 'about-6s.png') });
  console.log('saved: about-6s.png');

  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, 'about-14s.png') });
  console.log('saved: about-14s.png');

  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, 'about-22s.png') });
  console.log('saved: about-22s.png');

  await browser.close();
})();
