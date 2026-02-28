import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  onClose?: () => void,
) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open || !container.current) {
      return
    }

    const root = container.current
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
      )

    const focusable = getFocusable()
    const first = focusable[0] ?? root
    first.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const tabbable = getFocusable()
      if (tabbable.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }

      const firstEl = tabbable[0]
      const lastEl = tabbable[tabbable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === firstEl) {
        event.preventDefault()
        lastEl.focus()
        return
      }

      if (!event.shiftKey && active === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    root.addEventListener('keydown', handleKeyDown)

    return () => {
      root.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousActive && previousActive.isConnected) {
        previousActive.focus()
      }
    }
  }, [open, container])
}
