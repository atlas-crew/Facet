import { useEffect, useRef, useState } from 'react'
import type { AssembledResume, ResumeTheme } from '../types'
import { renderResumeAsPdf } from '../utils/typstRenderer'

interface UsePdfPreviewArgs {
  resume: AssembledResume
  theme: ResumeTheme
  debounceMs?: number
}

export interface UsePdfPreviewState {
  previewBlobUrl: string | null
  cachedPdfBlob: Blob | null
  pageCount: number | null
  pending: boolean
  error: string | null
}

const DEFAULT_DEBOUNCE_MS = 400

export function usePdfPreview({ resume, theme, debounceMs = DEFAULT_DEBOUNCE_MS }: UsePdfPreviewArgs): UsePdfPreviewState {
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [cachedPdfBlob, setCachedPdfBlob] = useState<Blob | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewUrlRef = useRef<string | null>(null)
  const renderGenerationRef = useRef(0)

  useEffect(() => {
    const generation = renderGenerationRef.current + 1
    renderGenerationRef.current = generation

    setPending(true)
    setError(null)

    const timer = window.setTimeout(() => {
      ;(async () => {
        try {
          const rendered = await renderResumeAsPdf(resume, theme)
          if (renderGenerationRef.current !== generation) {
            return
          }

          const nextUrl = URL.createObjectURL(rendered.blob)
          const previousUrl = previewUrlRef.current
          previewUrlRef.current = nextUrl

          setPreviewBlobUrl(nextUrl)
          setCachedPdfBlob(rendered.blob)
          setPageCount(rendered.pageCount)

          if (previousUrl) {
            URL.revokeObjectURL(previousUrl)
          }
        } catch {
          if (renderGenerationRef.current !== generation) {
            return
          }

          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
          }
          setPreviewBlobUrl(null)
          setCachedPdfBlob(null)
          setPageCount(null)
          setError('Unable to render PDF preview. Adjust content or try again.')
        } finally {
          if (renderGenerationRef.current === generation) {
            setPending(false)
          }
        }
      })()
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      if (renderGenerationRef.current === generation) {
        renderGenerationRef.current = generation + 1
      }
    }
  }, [resume, theme, debounceMs])

  useEffect(
    () => () => {
      if (!previewUrlRef.current) {
        return
      }
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    },
    [],
  )

  return {
    previewBlobUrl,
    cachedPdfBlob,
    pageCount,
    pending,
    error,
  }
}
