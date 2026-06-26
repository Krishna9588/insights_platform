import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // All fetch('/projects'), fetch('/pipeline') etc. go to FastAPI
      '/projects': { target: 'http://localhost:8000', changeOrigin: true },
      '/pipeline': { target: 'http://localhost:8000', changeOrigin: true },
      '/copilot': { target: 'http://localhost:8000', changeOrigin: true },
      '/jobs': { target: 'http://localhost:8000', changeOrigin: true },
      '/news': { target: 'http://localhost:8000', changeOrigin: true },
      '/rag': { target: 'http://localhost:8000', changeOrigin: true },
      '/sessions': { target: 'http://localhost:8000', changeOrigin: true },
      '/summaries': { target: 'http://localhost:8000', changeOrigin: true },
      '/ingest': { target: 'http://localhost:8000', changeOrigin: true },
      '/config': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
