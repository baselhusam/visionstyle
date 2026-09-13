/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The built app is served by the FastAPI server from src/visionstyle/studio/static.
export default defineConfig({
  plugins: [react()],
  // The application and the brand book share the approved Chroma Press assets.
  publicDir: '../assets/brand/chroma-press',
  build: {
    outDir: '../src/visionstyle/studio/static',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8420' },
    // The Studio uses the same font files the Python annotator renders with; they live one level up.
    fs: { allow: ['..'] },
  },
  test: { environment: 'node' },
});
