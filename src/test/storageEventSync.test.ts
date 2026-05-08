import { describe, expect, it, vi } from 'vitest'
import { installStorageEventSync } from '../persistence/storageEventSync'

const createStorageEventSource = () => {
  let listener: ((event: StorageEvent) => void) | null = null
  const localStorage = {} as Storage
  const otherStorage = {} as Storage

  return {
    localStorage,
    otherStorage,
    source: {
      localStorage,
      addEventListener: vi.fn((_type: 'storage', nextListener: (event: StorageEvent) => void) => {
        listener = nextListener
      }),
      removeEventListener: vi.fn((_type: 'storage', nextListener: (event: StorageEvent) => void) => {
        if (listener === nextListener) {
          listener = null
        }
      }),
    },
    dispatch: (event: Partial<StorageEvent>) => {
      listener?.(event as StorageEvent)
    },
  }
}

describe('installStorageEventSync', () => {
  it('rehydrates only matching localStorage events and unsubscribes cleanly', () => {
    const eventSource = createStorageEventSource()
    const rehydrateIdentity = vi.fn()
    const rehydrateWorkspace = vi.fn()

    const dispose = installStorageEventSync(
      [
        { key: 'facet-identity-workspace', rehydrate: rehydrateIdentity },
        { key: 'facet-workspace-snapshot:ws-1', rehydrate: rehydrateWorkspace },
      ],
      eventSource.source,
    )

    eventSource.dispatch({
      key: 'facet-identity-workspace',
      storageArea: eventSource.otherStorage,
    })
    eventSource.dispatch({
      key: 'unrelated',
      storageArea: eventSource.localStorage,
    })
    eventSource.dispatch({
      key: null,
      storageArea: eventSource.localStorage,
    })

    expect(rehydrateIdentity).not.toHaveBeenCalled()
    expect(rehydrateWorkspace).not.toHaveBeenCalled()

    eventSource.dispatch({
      key: 'facet-identity-workspace',
      storageArea: eventSource.localStorage,
    })
    eventSource.dispatch({
      key: 'facet-workspace-snapshot:ws-1',
      storageArea: eventSource.localStorage,
    })

    expect(rehydrateIdentity).toHaveBeenCalledTimes(1)
    expect(rehydrateWorkspace).toHaveBeenCalledTimes(1)

    dispose()
    eventSource.dispatch({
      key: 'facet-identity-workspace',
      storageArea: eventSource.localStorage,
    })

    expect(rehydrateIdentity).toHaveBeenCalledTimes(1)
  })

  it('does not install when storage events are unavailable', () => {
    const rehydrate = vi.fn()
    const dispose = installStorageEventSync(
      [{ key: 'facet-identity-workspace', rehydrate }],
      { localStorage: {} as Storage },
    )

    dispose()

    expect(rehydrate).not.toHaveBeenCalled()
  })
})
