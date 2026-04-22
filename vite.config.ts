import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When deploying to https://truskrillor.github.io/zlib-viz/, all static assets
// need to be served from /zlib-viz/. Dev server stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zlib-viz/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
}));
