import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url'
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/wasm?url'
import { TypstSnippet } from '@myriaddreamin/typst.ts/contrib/snippet'

export function isVariableFont(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 12) return false
  const tableCount = view.getUint16(4, false)
  let offset = 12
  for (let index = 0; index < tableCount; index += 1) {
    if (offset + 16 > bytes.byteLength) break
    const tag = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
    if (tag === 'fvar') return true
    offset += 16
  }
  return false
}

export function toPdfPageCount(bytes: Uint8Array): number {
  const raw = new TextDecoder().decode(bytes)
  // Use local regex to avoid stateful 'g' flag issues with module-level constants
  const matches = raw.match(/\/Type\s*\/Page\b/g)
  return Math.max(1, matches?.length ?? 1)
}

const fontBufferCache = new Map<string, Uint8Array>()
const snippetByFontSignature = new Map<string, TypstSnippet>()

async function loadFontBytes(path: string): Promise<Uint8Array> {
  const cached = fontBufferCache.get(path)
  if (cached) return cached

  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const url = path.startsWith('/') ? `${base}${path.slice(1)}` : path
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to load font file: ${path}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  fontBufferCache.set(path, bytes)
  return bytes
}

export async function getTypstSnippet(fontFiles: string[]): Promise<TypstSnippet> {
  const signature = fontFiles.join('|') || '__no_theme_fonts__'
  const cached = snippetByFontSignature.get(signature)
  if (cached) return cached

  const snippet = new TypstSnippet()
  snippet.setCompilerInitOptions({ getModule: () => compilerWasmUrl })
  snippet.setRendererInitOptions({ getModule: () => rendererWasmUrl })
  
  if (fontFiles.length > 0) {
    const buffers = await Promise.all(fontFiles.map(loadFontBytes))
    const staticFontBuffers = buffers.filter(b => !isVariableFont(b))
    if (staticFontBuffers.length > 0) {
      snippet.use(TypstSnippet.preloadFonts(staticFontBuffers))
    }
  }

  snippetByFontSignature.set(signature, snippet)
  return snippet
}

