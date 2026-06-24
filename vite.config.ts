import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: {
    host: '127.0.0.1',
  },
  plugins: [react()],
  test: {
    // Global per-test reset (zustand store reset + storage/env/mock cleanup) so the suite is
    // order-independent — see src/test/setup.ts and __mocks__/zustand.ts.
    setupFiles: ['./src/test/setup.ts'],
    // '.worktrees/**' keeps Vitest from discovering duplicate test files in local git worktrees
    // (e.g. `.worktrees/<branch>/src/test/*`), which otherwise run twice and pollute shared stores.
    exclude: [...configDefaults.exclude, 'tests/**', '**/.worktrees/**'],
    // Full parallelism saturates CPU (worst on CI's lower core count), starving timing-sensitive
    // async UI tests so they blow the default 5s timeout — order-dependent flakiness that only
    // surfaces in the full suite. A generous timeout is free on the happy path (passing tests
    // finish fast) and buys headroom under contention without slowing the suite.
    testTimeout: 20000,
  },
  worker: {
    format: 'es',
  },
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

          if (id.includes('/@myriaddreamin/typst-ts-')) {
            return 'renderer'
          }
        },
      },
    },
  },
})
