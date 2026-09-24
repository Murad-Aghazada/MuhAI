import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly rather than moving to 5174. The API trusts a fixed list of
    // dev origins (BACKEND_CORS_ORIGINS), so a silent port shift does not look
    // like a port shift — it looks like every request being blocked by CORS,
    // which sends you reading the backend's middleware for an hour. A stale
    // dev server left running on 5173 is all it takes.
    strictPort: true,
    open: true,
  },
})
