import { useEffect, useRef } from 'react'

interface InferenceRequestOptions {
  requestId: number
  handler: () => void | Promise<void>
  skipWhen?: () => boolean
  onSkipped?: () => void
}

export function useInferenceRequest({
  requestId,
  handler,
  skipWhen,
  onSkipped,
}: InferenceRequestOptions) {
  const lastRequestIdRef = useRef(requestId)
  const handlerRef = useRef(handler)
  const skipWhenRef = useRef(skipWhen)
  const onSkippedRef = useRef(onSkipped)

  // Keep the trigger effect keyed only to requestId while still calling the
  // latest render's handler and guard functions.
  useEffect(() => {
    handlerRef.current = handler
    skipWhenRef.current = skipWhen
    onSkippedRef.current = onSkipped
  })

  useEffect(() => {
    if (requestId === lastRequestIdRef.current) return
    lastRequestIdRef.current = requestId

    if (skipWhenRef.current?.()) {
      onSkippedRef.current?.()
      return
    }

    void handlerRef.current()
  }, [requestId])
}

