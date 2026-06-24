// Vitest manual mock for zustand. It wraps `create`/`createStore` so every store registers a
// reset-to-initial-state function; the `afterEach` below returns all stores to their initial state
// between tests. This makes the suite order-independent — cross-file leakage of persisted store
// state was what made the suite pass locally (one order) but fail in CI (a different order).
//
// Activated by `vi.mock('zustand')` in src/test/setup.ts. Only `create` is imported across src/,
// but `createStore` is wrapped too for completeness.
import { afterEach, vi } from 'vitest'
import type { StateCreator, StoreApi } from 'zustand'

// Cache the real module on globalThis. `vi.resetModules()` (used by ~6 tests) re-evaluates this
// mock; a module-level `actual` would be re-resolved and come back without `create`. globalThis
// survives resetModules, so we resolve the real zustand exactly once.
type ZustandActual = typeof import('zustand')
const globalCache = globalThis as typeof globalThis & { __facetZustandActual?: ZustandActual }
if (!globalCache.__facetZustandActual) {
  globalCache.__facetZustandActual = await vi.importActual<ZustandActual>('zustand')
}
const actual = globalCache.__facetZustandActual

export const storeResetFns = new Set<() => void>()

const register = <T>(store: StoreApi<T>): StoreApi<T> => {
  const initialState = store.getInitialState()
  storeResetFns.add(() => {
    store.setState(initialState, true)
  })
  return store
}

export const create = (<T>(stateCreator?: StateCreator<T>) =>
  stateCreator === undefined
    ? (creator: StateCreator<T>) => register(actual.create(creator))
    : register(actual.create(stateCreator))) as typeof actual.create

export const createStore = (<T>(stateCreator?: StateCreator<T>) =>
  stateCreator === undefined
    ? (creator: StateCreator<T>) => register(actual.createStore(creator))
    : register(actual.createStore(stateCreator))) as typeof actual.createStore

afterEach(() => {
  storeResetFns.forEach((reset) => {
    reset()
  })
})
