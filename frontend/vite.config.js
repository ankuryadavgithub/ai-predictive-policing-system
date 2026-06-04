import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('@deck.gl') || id.includes('maplibre-gl') || id.includes('react-map-gl') || id.includes('@loaders.gl')) {
            return 'maps'
          }
          if (id.includes('framer-motion')) {
            return 'motion'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
