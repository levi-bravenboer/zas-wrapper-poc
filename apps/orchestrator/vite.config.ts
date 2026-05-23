import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/@tanstack/react-router-devtools/') ||
            id.includes('/@tanstack/react-query-devtools/')
          ) {
            return 'devtools'
          }
          if (id.includes('/src/platform/embed/') || id.includes('/src/routes/embed')) {
            return 'embed'
          }
          return undefined
        },
      },
    },
  },
})
