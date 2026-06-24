import { afterEach, beforeEach, vi } from 'vitest'
import { ensureLocalStorage } from '../store/storage'

// Activate the zustand manual mock (__mocks__/zustand.ts): it resets every store to its initial
// state after each test, so persisted store state can't leak across test files.
vi.mock('zustand')

const clearPersistedStorage = () => {
  ensureLocalStorage().clear?.()
}

// The rest of the shared state that leaks across files: persisted storage, env/global stubs
// (e.g. a left-over `VITE_FACET_DEPLOYMENT_MODE=hosted` stub flipping AppShell into the hosted
// runtime path), and mock call/return state. Reset around every test so execution order can't
// change pass/fail — the suite must be order-independent (local order ≠ CI order).
beforeEach(() => {
  clearPersistedStorage()
})

afterEach(() => {
  clearPersistedStorage()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
