// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.lucbeck.com',
  output: 'static',
  // Pre-bundle animejs (imported lazily across several component scripts) so the
  // dev server doesn't re-optimize and 504 on each load.
  vite: {
    optimizeDeps: { include: ['animejs'] },
  },
});
