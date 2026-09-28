import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the production build can be opened directly from disk (file://),
// which supports the offline / remote-deployment story of the prototype.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: true },
})
