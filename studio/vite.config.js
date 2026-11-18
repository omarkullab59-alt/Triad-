import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// "Send to TRIAD" talks to the TRIAD site's Worker. Its address is already in content/site.json (aiEndpoint),
// so the Studio picks it up automatically when it is built inside the TRIAD repo.
let darkroom = process.env.VITE_DARKROOM_URL || '';
if (!darkroom) {
  try { darkroom = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8')).aiEndpoint || ''; } catch { /* standalone */ }
}

// BASE_PATH is set by the deploy workflow (/Triad-/studio/). Relative paths work everywhere else.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  define: { 'import.meta.env.VITE_DARKROOM_URL': JSON.stringify(darkroom) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
});
