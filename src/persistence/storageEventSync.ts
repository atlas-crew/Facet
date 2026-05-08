type StorageEventSyncTarget = {
  key: string
  rehydrate: () => void | Promise<void>
}

type StorageEventSource = {
  addEventListener?: (type: 'storage', listener: (event: StorageEvent) => void) => void
  removeEventListener?: (type: 'storage', listener: (event: StorageEvent) => void) => void
  localStorage?: Storage
}

const hasStorageEventApi = (
  source: StorageEventSource,
): source is Required<Pick<StorageEventSource, 'addEventListener' | 'removeEventListener'>> &
  StorageEventSource =>
  typeof source.addEventListener === 'function' && typeof source.removeEventListener === 'function'

export const installStorageEventSync = (
  targets: StorageEventSyncTarget[],
  source: StorageEventSource = globalThis,
) => {
  if (!hasStorageEventApi(source) || targets.length === 0) {
    return () => undefined
  }

  const targetsByKey = new Map(targets.map((target) => [target.key, target.rehydrate]))

  const listener = (event: StorageEvent) => {
    if (!event.key) return
    if (source.localStorage && event.storageArea && event.storageArea !== source.localStorage) {
      return
    }

    const rehydrate = targetsByKey.get(event.key)
    if (!rehydrate) return

    void rehydrate()
  }

  source.addEventListener('storage', listener)

  return () => {
    source.removeEventListener('storage', listener)
  }
}
