import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('/@dnd-kit/')) {
            return 'dnd'
          }

          if (id.includes('/lucide-react/')) {
            return 'icons'
          }

          if (id.includes('/docx/') || id.includes('/jszip/')) {
            return 'docx'
          }
        },
      },
    },
  },
})
