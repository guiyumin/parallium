import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Dev mode: serve from examples directory
  if (mode === 'development') {
    return {
      root: './examples',
      server: {
        port: 3000,
        open: true,
      },
    };
  }

  // Build mode: build library from src
  return {
    build: {
      target: 'esnext',
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'NgenGrid',
        fileName: 'ngengrid',
      },
      rollupOptions: {
        external: [],
      },
    },
  };
});
