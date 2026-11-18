import { defineConfig } from 'vite';

// BASE_PATH is set by the GitHub Pages workflow (e.g. /triad-studio/). Relative paths work everywhere else.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined) },
    },
  },
});
