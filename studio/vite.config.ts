/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The built app is served by the FastAPI server from src/visionstyle/studio/static.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../src/visionstyle/studio/static',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8420' },
  },
  test: { environment: 'node' },
});
