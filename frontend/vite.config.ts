import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Task 23: unit/regression tests (npm test). jsdom stands in for the browser;
  // setup.ts wires up the DOM matchers and per-test cleanup.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
  // Task 100: the big libraries get their own long-lived files, so a release that only touches app code
  // leaves them cached in the visitor's browser. The heavy editor libraries (fabric, the model runtimes)
  // are only reached through lazy imports, so they never load on the landing page.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'vendor-motion'
          if (/node_modules\/fabric\//.test(id)) return 'vendor-fabric'
          return undefined
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
