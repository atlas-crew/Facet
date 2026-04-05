import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { TOUR_STEPS } from '../utils/tourSteps'
import { useFocusTrap } from '../utils/useFocusTrap'

interface TourProps {
  open: boolean
  onClose: () => void
}

const CUTOUT_PAD = 8
const TOOLTIP_GAP = 12

function computeTooltipPosition(
  targetRect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  tooltipWidth: number,
  tooltipHeight: number,
) {
  let top = 0
  let left = 0

  if (placement === 'top') {
    top = targetRect.top - tooltipHeight - TOOLTIP_GAP
    left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
  } else if (placement === 'bottom') {
    top = targetRect.bottom + TOOLTIP_GAP
    left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
  } else if (placement === 'left') {
    top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    left = targetRect.left - tooltipWidth - TOOLTIP_GAP
  } else {
    top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    left = targetRect.right + TOOLTIP_GAP
  }

  // Bound within viewport
  left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16))
  top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16))

  return { top, left }
}

export function Tour({ open, onClose }: TourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 })

  const step = TOUR_STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === TOUR_STEPS.length - 1

  useFocusTrap(open, cardRef, onClose)

  // Reset to first step when tour is re-opened
  useEffect(() => {
    if (open) {
      setCurrentStep(0) // eslint-disable-line react-hooks/set-state-in-effect -- reset on open
    }
  }, [open])

  const updatePosition = useCallback(() => {
    if (!open) return

    const target = document.querySelector(`[data-tour="${step.target}"]`)
    if (!target) {
      setTargetRect(null)
      // Center card if no target
      setCardPosition({
        top: window.innerHeight / 2 - (cardRef.current?.offsetHeight ?? 200) / 2,
        left: window.innerWidth / 2 - (cardRef.current?.offsetWidth ?? 320) / 2,
      })
      return
    }

    const rect = target.getBoundingClientRect()
    setTargetRect(rect)

    if (cardRef.current) {
      setCardPosition(
        computeTooltipPosition(
          rect,
          step.placement,
          cardRef.current.offsetWidth,
          cardRef.current.offsetHeight,
        ),
      )
    }
  }, [open, step])

  useLayoutEffect(() => {
    updatePosition() // eslint-disable-line react-hooks/set-state-in-effect -- layout measurement requires synchronous setState
  }, [updatePosition, currentStep])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, { capture: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, { capture: true })
    }
  }, [open, updatePosition])

  if (!open) return null

  return createPortal(
    <>
      <button 
        type="button"
        className="tour-overlay" 
        onClick={onClose}
        aria-label="Dismiss tour"
        tabIndex={-1}
      />
      {targetRect && (
        <svg className="tour-svg-overlay" aria-hidden="true">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - CUTOUT_PAD}
                y={targetRect.top - CUTOUT_PAD}
                width={targetRect.width + CUTOUT_PAD * 2}
                height={targetRect.height + CUTOUT_PAD * 2}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
        </svg>
      )}
      <div
        ref={cardRef}
        className="tour-card"
        style={{ top: cardPosition.top, left: cardPosition.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <div className="tour-card-header">
          <h3 id="tour-title">{step.title}</h3>
          <button
            className="btn-ghost btn-icon-only"
            type="button"
            onClick={onClose}
            aria-label="Close tour"
          >
            <X size={14} />
          </button>
        </div>
        <p className="tour-card-body">{step.body}</p>
        <div className="tour-card-footer">
          <span className="tour-step-counter">
            {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <div className="tour-card-nav">
            {!isFirst && (
              <button
                className="btn-secondary tour-nav-btn"
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            {isFirst && (
              <button
                className="btn-ghost tour-nav-btn"
                type="button"
                onClick={onClose}
              >
                Skip
              </button>
            )}
            {isLast ? (
              <button
                className="btn-primary tour-nav-btn"
                type="button"
                onClick={onClose}
              >
                Got it
              </button>
            ) : (
              <button
                className="btn-primary tour-nav-btn"
                type="button"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
