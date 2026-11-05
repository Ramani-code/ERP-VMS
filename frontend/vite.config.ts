import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the browser talks to Vite (5173) and Vite forwards /api to the
// Spring Boot backend, so there are no CORS problems.
const backend = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: backend, changeOrigin: true } }
  },
  build: { outDir: 'dist', sourcemap: false }
})
