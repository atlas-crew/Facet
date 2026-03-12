interface FilePickerType {
  description?: string
  accept: Record<string, string[]>
}

interface SaveFilePickerOptionsLike {
  suggestedName?: string
  excludeAcceptAllOption?: boolean
  types?: FilePickerType[]
}

interface OpenFilePickerOptionsLike {
  excludeAcceptAllOption?: boolean
  multiple?: boolean
  types?: FilePickerType[]
}

interface FileSystemWritableFileStreamLike {
  write: (data: Blob | BufferSource | string) => Promise<void>
  close: () => Promise<void>
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>
  getFile: () => Promise<File>
}

interface FileSystemAccessWindow extends Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptionsLike,
  ) => Promise<FileSystemFileHandleLike>
  showOpenFilePicker?: (
    options?: OpenFilePickerOptionsLike,
  ) => Promise<FileSystemFileHandleLike[]>
}

const filePickerTypes: FilePickerType[] = [
  {
    description: 'Facet backup bundle',
    accept: {
      'application/json': ['.facet.json', '.json'],
      'text/plain': ['.facet.json', '.json'],
    },
  },
]

const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'AbortError'
  )
}

const getWindowWithFileSystemAccess = (): FileSystemAccessWindow | null => {
  if (typeof window === 'undefined') {
    return null
  }

  return window as FileSystemAccessWindow
}

export const supportsFileSystemSave = (): boolean => {
  const nextWindow = getWindowWithFileSystemAccess()
  return typeof nextWindow?.showSaveFilePicker === 'function'
}

export const supportsFileSystemOpen = (): boolean => {
  const nextWindow = getWindowWithFileSystemAccess()
  return typeof nextWindow?.showOpenFilePicker === 'function'
}

export const saveTextFileWithPicker = async (
  text: string,
  suggestedName: string,
): Promise<boolean> => {
  const nextWindow = getWindowWithFileSystemAccess()
  if (typeof nextWindow?.showSaveFilePicker !== 'function') {
    throw new Error('File save is not supported in this browser.')
  }

  try {
    const handle = await nextWindow.showSaveFilePicker({
      suggestedName,
      excludeAcceptAllOption: false,
      types: filePickerTypes,
    })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return true
  } catch (error) {
    if (isAbortError(error)) {
      return false
    }

    throw error
  }
}

export const openTextFileWithPicker = async (): Promise<string | null> => {
  const nextWindow = getWindowWithFileSystemAccess()
  if (typeof nextWindow?.showOpenFilePicker !== 'function') {
    throw new Error('File open is not supported in this browser.')
  }

  try {
    const [handle] = await nextWindow.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: filePickerTypes,
    })

    if (!handle) {
      return null
    }

    const file = await handle.getFile()
    return file.text()
  } catch (error) {
    if (isAbortError(error)) {
      return null
    }

    throw error
  }
}
