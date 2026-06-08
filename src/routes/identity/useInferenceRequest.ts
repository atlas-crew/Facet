import { useEffect, useRef } from 'react'

interface InferenceRequestOptions {
  requestId: number
  handler: () => void | boolean | Promise<void | boolean>
  skipWhen?: () => boolean
  onSkipped?: () => void
  onSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
}

export function useInferenceRequest({
  requestId,
  handler,
  skipWhen,
  onSkipped,
  onSettled,
}: InferenceRequestOptions) {
  const lastRequestIdRef = useRef(requestId)
  const handlerRef = useRef(handler)
  const skipWhenRef = useRef(skipWhen)
  const onSkippedRef = useRef(onSkipped)
  const onSettledRef = useRef(onSettled)

  // Keep the trigger effect keyed only to requestId while still calling the
  // latest render's handler and guard functions.
  useEffect(() => {
    handlerRef.current = handler
    skipWhenRef.current = skipWhen
    onSkippedRef.current = onSkipped
    onSettledRef.current = onSettled
  })

  useEffect(() => {
    if (requestId === lastRequestIdRef.current) return
    lastRequestIdRef.current = requestId

    if (skipWhenRef.current?.()) {
      onSkippedRef.current?.()
      return
    }

    void Promise.resolve(handlerRef.current()).then(
      (result) => onSettledRef.current?.(requestId, result === false ? 'failed' : 'succeeded'),
      () => onSettledRef.current?.(requestId, 'failed'),
    )
  }, [requestId])
}
