import type { StateStorage } from 'zustand/middleware'

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const resolveStorage = (): StateStorage => {
  const candidate = globalThis.localStorage as Partial<StateStorage> | undefined
  if (
    candidate &&
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  ) {
    return candidate as StateStorage
  }

  return memoryStorage
}
