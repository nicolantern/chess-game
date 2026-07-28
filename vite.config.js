import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `base: './'` + the single-file plugin inline all JS/CSS into one index.html so
// the built game can be opened straight from the filesystem (file://) or dropped
// anywhere as a standalone page. `npm run dev` is unaffected (plugin runs on build).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // Only the chess app (index.html) is built here as a single inlined file. The
  // 3D world (world.html) pulls in Three.js and is built separately (normal
  // chunked output) via vite.world.config.js — see the "build" npm script — since
  // the single-file plugin can't emit multiple pages.
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Proxy API calls to the account backend so the client can use relative
    // '/api' paths in dev (no CORS juggling).
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket proxy so the client can use the page origin for /ws in dev too.
      '/ws': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
