import { defineConfig } from 'vite';

// Second build pass for the standalone 3D world (world.html + Three.js). It is
// NOT single-file: Three.js is large, so normal chunked assets load faster than
// one inlined blob. `emptyOutDir: false` appends to the dist/ produced by the
// main chess build instead of wiping it, so both pages ship together. The Node
// server serves dist/ statically, so /world.html and its /assets resolve.
export default defineConfig({
  base: './',
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: { world: 'world.html', mc: 'mc.html' },
    },
  },
});
