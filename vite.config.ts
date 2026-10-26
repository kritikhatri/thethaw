import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'client',
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared')
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
});
