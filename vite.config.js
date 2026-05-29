import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In dev: proxy /api calls to Express on 3001
  // In prod: Express serves everything on one port — no proxy needed
  server: {
    proxy: mode === 'development' ? {
      '/api': 'http://localhost:3001',
    } : {},
  },
}))
