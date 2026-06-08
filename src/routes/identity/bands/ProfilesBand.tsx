import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AiWorkingStatus } from '../../../components/AiWorkingStatus'
import { useIdentityStore } from '../../../store/identityStore'
import { profilesFillStrength } from '../../../utils/identityFillStrength'
import { generateIdentityProfilesFromIdentity } from '../../../utils/identityParametersGeneration'
import { IdentityBand } from '../IdentityBand'
import {
  ensureIdentityInferenceEndpoint,
  IdentityInferenceConfigError,
} from '../identityInferenceRuntime'
import { useInferenceRequest } from '../useInferenceRequest'

type ProfileGenerationMessage = {
  id: number
  tone: 'info' | 'error'
  text: string
  autoDismiss: boolean
  visible: boolean
}

const PROFILE_MESSAGE_DISMISS_MS = 8000

const ensureProfilesEndpoint = () => {
  return ensureIdentityInferenceEndpoint('Connect the AI proxy before generating profile lenses.')
}

function ProfileGenerationStatus({
  message,
  tone,
}: {
  message: ProfileGenerationMessage | null
  tone: 'info' | 'error'
}) {
  const matchesTone = message?.tone === tone
  const hasMessage = Boolean(matchesTone && message?.visible)

  return (
    <div
      className={`strategy-generation-message ${tone} ${hasMessage ? '' : 'empty'}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {hasMessage && message ? message.text : ''}
    </div>
  )
}

export function ProfilesBand({
  profileRequestId = 0,
  onRequestSettled,
}: {
  profileRequestId?: number
  onRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateProfiles = useIdentityStore((s) => s.updateCurrentProfiles)
  const recordAiGenerationUndo = useIdentityStore((s) => s.recordAiGenerationUndo)
  const fill = profilesFillStrength(identity)
  const profiles = identity?.profiles ?? []
  const generationRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const messageIdRef = useRef(0)
  const mountedRef = useRef(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<ProfileGenerationMessage | null>(null)

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
      setMessage((current) =>
        current?.id === messageId ? { ...current, visible: false } : current,
      )
    }, PROFILE_MESSAGE_DISMISS_MS)

    return () => window.clearTimeout(timeoutId)
  }, [message])

  const showMessage = useCallback((next: Omit<ProfileGenerationMessage, 'id' | 'visible'>) => {
    messageIdRef.current += 1
    setMessage({ ...next, id: messageIdRef.current, visible: true })
  }, [])

  const handleGenerateProfiles = useCallback(async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || generationRef.current) return false

    generationRef.current = true
    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController
    const generationRevision = currentIdentity.model_revision ?? 0
    setGenerating(true)
    showMessage({
      tone: 'info',
      text: 'Generating profile lenses...',
      autoDismiss: false,
    })

    try {
      const endpoint = ensureProfilesEndpoint()
      const generated = await generateIdentityProfilesFromIdentity(currentIdentity, endpoint, {
        signal: abortController.signal,
      })
      if (abortController.signal.aborted || !mountedRef.current) return

      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity || (latestIdentity.model_revision ?? 0) !== generationRevision) {
        showMessage({
          tone: 'info',
          text: 'Identity changed during generation; discarded the profile draft.',
          autoDismiss: true,
        })
        return false
      }

      if (generated.length === 0) {
        showMessage({
          tone: 'info',
          text: 'The generated draft did not return profile lenses.',
          autoDismiss: true,
        })
        return false
      }

      updateProfiles(generated)
      recordAiGenerationUndo('generated profile lenses', latestIdentity)
      showMessage({
        tone: 'info',
        text: `Generated ${generated.length} profile lens${generated.length === 1 ? '' : 'es'}.`,
        autoDismiss: true,
      })
      return true
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
            : 'Unable to generate profile lenses.',
        autoDismiss: false,
      })
      return false
    } finally {
      if (mountedRef.current) {
        abortRef.current = null
        generationRef.current = false
        setGenerating(false)
      }
    }
  }, [recordAiGenerationUndo, showMessage, updateProfiles])

  useInferenceRequest({
    requestId: profileRequestId,
    handler: handleGenerateProfiles,
    onSettled: onRequestSettled,
    skipWhen: () => generationRef.current,
    onSkipped: () => {
      showMessage({
        tone: 'info',
        text: 'Profile generation is already running.',
        autoDismiss: true,
      })
    },
  })

  return (
    <IdentityBand
      layer="profiles"
      name="Profiles"
      subtitle="positioning lenses for reusable identity variants"
      fill={fill}
    >
      <div className="profile-generation-controls">
        <div>
          <div className="arc-label label-tracked">Inference</div>
          <p className="chapter-copy">
            Generate reusable profile lenses from the current thesis, self-model, roles, skills,
            and projects.
          </p>
        </div>
        <button
          type="button"
          className="inspector-btn primary profile-generate"
          onClick={handleGenerateProfiles}
          aria-disabled={!identity || generating}
          aria-busy={generating}
        >
          <Sparkles size={14} aria-hidden="true" />
          {generating
            ? 'Generating...'
            : profiles.length > 0
              ? 'Regenerate profiles'
              : 'Generate profiles'}
        </button>
        <div className="strategy-generation-stack profile-generation-status">
          <AiWorkingStatus
            active={generating}
            label="Generating profile lenses"
            caption="AI is comparing your thesis, self-model, roles, skills, and projects."
            expectedDurationMs={60000}
          />
          <ProfileGenerationStatus message={message} tone="info" />
          <ProfileGenerationStatus message={message} tone="error" />
        </div>
      </div>
      {profiles.length === 0 ? (
        <p className="chapter-copy band-empty">
          No profiles yet. Add positioning lenses that capture distinct ways to frame the
          durable identity.
        </p>
      ) : (
        <div className="profiles-grid">
          {profiles.map((p) => {
            const isSelected = selection?.type === 'profile' && selection.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`profile-card${isSelected ? ' selected' : ''}`}
                onClick={() => setSelection({ type: 'profile', id: p.id })}
                aria-current={isSelected ? 'true' : undefined}
              >
                <div className="profile-id label-tracked">{p.id}</div>
                <div className="profile-tags">
                  {p.tags.map((tag) => (
                    <span key={tag} className="profile-tag label-tracked">{tag}</span>
                  ))}
                </div>
                <p className="profile-text">{p.text}</p>
                <span className="profile-action label-tracked">Edit in inspector</span>
              </button>
            )
          })}
        </div>
      )}
    </IdentityBand>
  )
}
