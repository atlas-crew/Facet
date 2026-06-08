import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AiWorkingStatus } from '../../../components/AiWorkingStatus'
import { useIdentityStore } from '../../../store/identityStore'
import {
  EMPTY_THESIS_FILL_DESCRIPTION,
  thesisFillStrength,
} from '../../../utils/identityFillStrength'
import {
  generateIdentityThesisFromIdentity,
} from '../../../utils/identityParametersGeneration'
import { IdentityBand } from '../IdentityBand'
import {
  ensureIdentityInferenceEndpoint,
  IdentityInferenceConfigError,
} from '../identityInferenceRuntime'
import { useInferenceRequest } from '../useInferenceRequest'

type ThesisGenerationMessage = {
  id: number
  tone: 'info' | 'error'
  text: string
  autoDismiss: boolean
}

const THESIS_MESSAGE_DISMISS_MS = 8000
const ensureThesisEndpoint = () => {
  return ensureIdentityInferenceEndpoint('Connect the AI proxy before regenerating the identity thesis.')
}

const getThesisGenerationRevision = () => useIdentityStore.getState().currentIdentity?.model_revision ?? 0

function ThesisGenerationStatus({
  message,
  tone,
}: {
  message: ThesisGenerationMessage | null
  tone: 'info' | 'error'
}) {
  const hasMessage = Boolean(message && message.tone === tone)
  const role = tone === 'error' ? 'alert' : 'status'

  return (
    <div
      className={`strategy-generation-message ${tone} ${hasMessage ? '' : 'empty'}`}
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {hasMessage ? message?.text : ''}
    </div>
  )
}

export function ThesisBand({
  thesisRequestId = 0,
  onRequestSettled,
}: {
  thesisRequestId?: number
  onRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateCore = useIdentityStore((s) => s.updateCurrentIdentityCore)
  const thesisDraft = useIdentityStore((s) => s.thesisDraft)
  const thesisDraftRevision = useIdentityStore((s) => s.thesisDraftRevision)
  const setThesisDraft = useIdentityStore((s) => s.setThesisDraft)
  const recordAiGenerationUndo = useIdentityStore((s) => s.recordAiGenerationUndo)
  const fill = thesisFillStrength(identity)
  const core = identity?.identity
  const generationRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const messageIdRef = useRef(0)
  const mountedRef = useRef(true)

  const isSelected = selection?.type === 'thesis'
  const text = core?.thesis?.trim() ?? ''
  const origin = core?.origin?.trim() ?? ''
  const elaboration = core?.elaboration?.trim() ?? ''
  const title = core?.title?.trim() ?? ''
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<ThesisGenerationMessage | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!message?.autoDismiss) return undefined

    const messageId = message.id
    const timeoutId = window.setTimeout(() => {
      setMessage((current) => (current?.id === messageId ? null : current))
    }, THESIS_MESSAGE_DISMISS_MS)

    return () => window.clearTimeout(timeoutId)
  }, [message])

  useEffect(() => {
    if (thesisDraftRevision === null) return
    if (identity?.model_revision === thesisDraftRevision) return
    setThesisDraft(null, null)
  }, [thesisDraftRevision, identity?.model_revision, setThesisDraft])

  const showMessage = useCallback((next: Omit<ThesisGenerationMessage, 'id'>) => {
    messageIdRef.current += 1
    setMessage({ ...next, id: messageIdRef.current })
  }, [])

  const handleGenerateThesis = useCallback(async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity) return

    generationRef.current = true
    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController
    const generationRevision = currentIdentity.model_revision ?? 0
    setGenerating(true)
    setThesisDraft(null, null)
    showMessage({
      tone: 'info',
      text: 'Generating an identity thesis draft...',
      autoDismiss: false,
    })

    try {
      const endpoint = ensureThesisEndpoint()
      const generated = await generateIdentityThesisFromIdentity(currentIdentity, endpoint, {
        signal: abortController.signal,
      })
      if (abortController.signal.aborted || !mountedRef.current) return
      if (getThesisGenerationRevision() !== generationRevision) {
        showMessage({
          tone: 'info',
          text: 'Identity changed during generation; discarded the thesis draft.',
          autoDismiss: true,
        })
        return
      }
      setThesisDraft(generated, generationRevision)
      showMessage({
        tone: 'info',
        text: 'Review the generated thesis before applying it.',
        autoDismiss: false,
      })
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (isAbortError) return
      const isConfigError = error instanceof IdentityInferenceConfigError
      if (!isConfigError) {
        console.error(error)
      }
      showMessage({
        tone: 'error',
        text:
          isConfigError && error instanceof Error
            ? error.message
            : 'Unable to regenerate identity thesis.',
        autoDismiss: false,
      })
    } finally {
      if (mountedRef.current) {
        abortRef.current = null
        generationRef.current = false
        setGenerating(false)
      }
    }
  }, [setThesisDraft, showMessage])

  useInferenceRequest({
    requestId: thesisRequestId,
    handler: handleGenerateThesis,
    onSettled: onRequestSettled,
    skipWhen: () => generationRef.current,
    onSkipped: () => {
      showMessage({
        tone: 'info',
        text: 'Thesis generation is already running.',
        autoDismiss: true,
      })
    },
  })

  const applyDraft = () => {
    if (!thesisDraft) return
    if (
      thesisDraftRevision !== null &&
      getThesisGenerationRevision() !== thesisDraftRevision
    ) {
      setThesisDraft(null, null)
      showMessage({
        tone: 'info',
        text: 'Identity changed since this draft was generated; discarded the thesis draft.',
        autoDismiss: true,
      })
      return
    }
    const beforeIdentity = useIdentityStore.getState().currentIdentity
    updateCore(thesisDraft)
    if (beforeIdentity) {
      recordAiGenerationUndo('generated identity thesis', beforeIdentity)
    }
    setThesisDraft(null, null)
    showMessage({
      tone: 'info',
      text: 'Applied generated identity thesis.',
      autoDismiss: true,
    })
  }

  // Only show meta rows for fields that have values. Empty optionals don't
  // render "— not set" — the strength meter already carries that signal at
  // band level, and the inspector slot's prompt carries it at action level.
  // Surfacing it a third time on the card itself is the guilt-meter anti-pattern.
  const filledMeta: Array<{ label: string; value: string }> = []
  if (origin) filledMeta.push({ label: 'Origin', value: origin })
  if (elaboration) filledMeta.push({ label: 'Elaboration', value: elaboration })
  if (title) filledMeta.push({ label: 'Title', value: title })

  return (
    <IdentityBand layer="thesis" name="Thesis" subtitle="what you claim about yourself" fill={fill}>
      <button
        type="button"
        className={`thesis-card${isSelected ? ' selected' : ''}`}
        onClick={() => setSelection({ type: 'thesis' })}
        aria-pressed={isSelected}
      >
        {text ? (
          <p className="thesis-text chapter-copy">{text}</p>
        ) : (
          <p className="thesis-text chapter-copy thesis-empty">
            {EMPTY_THESIS_FILL_DESCRIPTION}
          </p>
        )}
        {filledMeta.length > 0 ? (
          <div className="thesis-meta">
            {filledMeta.map((item) => (
              <span key={item.label} className="thesis-meta-item label-tracked">
                {item.label} <span className="thesis-meta-set">— {item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </button>
      <div className="strategy-global-actions thesis-generation-actions">
        <button
          type="button"
          className="inspector-btn primary"
          onClick={() => {
            if (generating) return
            void handleGenerateThesis()
          }}
          disabled={!identity}
          aria-disabled={generating}
          aria-busy={generating}
        >
          <Sparkles size={14} aria-hidden="true" />
          {generating ? 'Generating thesis...' : text ? 'Regenerate thesis' : 'Generate thesis'}
        </button>
      </div>
      <div className="strategy-generation-stack">
        <AiWorkingStatus
          active={generating}
          label="Generating identity thesis"
          caption="AI is reviewing the current identity model and drafting a thesis for you to inspect."
          expectedDurationMs={60000}
        />
        <ThesisGenerationStatus message={message} tone="info" />
        <ThesisGenerationStatus message={message} tone="error" />
      </div>
      {thesisDraft ? (
        <section className="self-strategy-draft thesis-generation-draft" aria-label="Generated thesis draft">
          <div className="self-strategy-draft-header">
            <div>
              <span className="label-tracked">Review Generated Thesis</span>
              <h4>{thesisDraft.title ?? 'Identity thesis draft'}</h4>
            </div>
          </div>
          <p className="chapter-copy">{thesisDraft.thesis}</p>
          {thesisDraft.elaboration ? (
            <p className="chapter-copy">{thesisDraft.elaboration}</p>
          ) : null}
          {thesisDraft.origin ? (
            <p className="chapter-copy thesis-generation-origin">Origin: {thesisDraft.origin}</p>
          ) : null}
          <div className="self-strategy-draft-actions">
            <button type="button" className="inspector-btn primary" onClick={applyDraft}>
              Apply thesis
            </button>
            <button
              type="button"
              className="inspector-btn"
              onClick={() => setThesisDraft(null, null)}
            >
              Discard
            </button>
          </div>
        </section>
      ) : null}
    </IdentityBand>
  )
}
