import { useCallback, useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

interface HelpHintProps {
  text: string
  ariaLabel?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const POPOVER_GAP = 8

export function HelpHint({ text, ariaLabel = 'Help', placement = 'top' }: HelpHintProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // Initialize off-screen to avoid flash before calculation
  const [position, setPosition] = useState({ top: -9999, left: -9999 })
  const hintId = useId()

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const popoverEl = popoverRef.current
    const pw = popoverEl.offsetWidth
    const ph = popoverEl.offsetHeight

    let top = 0
    let left = 0

    if (placement === 'top') {
      top = rect.top - ph - POPOVER_GAP
      left = rect.left + rect.width / 2 - pw / 2
      if (top < 8) {
        top = rect.bottom + POPOVER_GAP
      }
    } else if (placement === 'bottom') {
      top = rect.bottom + POPOVER_GAP
      left = rect.left + rect.width / 2 - pw / 2
      if (top + ph > window.innerHeight - 8) {
        top = rect.top - ph - POPOVER_GAP
      }
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2 - ph / 2
      left = rect.right + POPOVER_GAP
      if (left + pw > window.innerWidth - 8) {
        left = rect.left - pw - POPOVER_GAP
      }
    } else {
      top = rect.top + rect.height / 2 - ph / 2
      left = rect.left - pw - POPOVER_GAP
      if (left < 8) {
        left = rect.right + POPOVER_GAP
      }
    }

    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8))

    // Note: the portal element uses position: absolute on the body document coordinate system.
    setPosition({ top: top + window.scrollY, left: left + window.scrollX })
  }, [placement])

  // Sync position immediately on open or text change
  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, updatePosition, text])

  useEffect(() => {
    const onResize = () => {
      if (isOpen) updatePosition()
    }

    // Capture: true for scroll to catch events from any scrolling container
    window.addEventListener('scroll', onResize, { capture: true })
    window.addEventListener('resize', onResize)
    
    return () => {
      window.removeEventListener('scroll', onResize, { capture: true })
      window.removeEventListener('resize', onResize)
    }
  }, [isOpen, updatePosition])

  return (
    <>
      <button
        ref={triggerRef}
        className="help-hint-trigger"
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        aria-label={ariaLabel}
        aria-describedby={hintId}
      >
        <HelpCircle size={14} />
      </button>
      {createPortal(
        <div
          id={hintId}
          ref={popoverRef}
          className="help-hint-popover"
          role="tooltip"
          aria-hidden={!isOpen}
          style={{ 
            top: position.top, 
            left: position.left,
            visibility: isOpen ? 'visible' : 'hidden',
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: 'opacity 0.15s ease-out'
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}
