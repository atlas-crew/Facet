import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type {
  ProfessionalIdentityV3,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { facetClientEnv } from '../../../utils/facetEnv'
import { searchStrategyFillStrength } from '../../../utils/identityFillStrength'
import {
  generateAwarenessFromIdentity,
  generateSearchVectorsFromIdentity,
  generateStrategicPositioningFromIdentity,
} from '../../../utils/identityParametersGeneration'
import { createId } from '../../../utils/idUtils'
import { sanitizeEndpointUrl } from '../../../utils/urlUtils'
import { IdentityBand } from '../IdentityBand'

type StrategyGenerationKind = 'strategy' | 'vectors' | 'questions'
type StrategyGenerationMessage = {
  id: number
  kind: StrategyGenerationKind
  tone: 'info' | 'error'
  text: string
  autoDismiss: boolean
}
type StrategySelectionType = 'search-vector' | 'awareness-question'

class StrategyGenerationConfigError extends Error {}

const getIdentityGenerationKey = (identity: ProfessionalIdentityV3) =>
  // identityStore.syncIdentityDocument advances model_revision for durable identity edits,
  // while these collection signatures catch any future direct strategy-list writes.
  [
    identity.model_revision ?? 0,
    normalizeGenerationSignature(identity.self_model?.competitive_moat),
    ...(identity.self_model?.unfair_advantages ?? []).map((advantage) =>
      normalizeGenerationSignature(advantage),
    ),
    ...(identity.search_vectors ?? []).map((vector) =>
      normalizeGenerationSignature(`${vector.id} ${vector.title}`),
    ),
    ...(identity.awareness?.open_questions ?? []).map((question) =>
      normalizeGenerationSignature(`${question.id} ${question.topic}`),
    ),
  ].join('\u0000')

const normalizeGenerationSignature = (value: string | null | undefined) =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const uniquifyGeneratedItems = <Item extends { id: string }>({
  existing,
  generated,
  idPrefix,
  getSignature,
}: {
  existing: Item[]
  generated: Item[]
  idPrefix: string
  getSignature: (item: Item) => string
}) => {
  const signatures = new Set(
    existing.map((item) => normalizeGenerationSignature(getSignature(item))).filter(Boolean),
  )

  return generated.flatMap((item) => {
    const signature = normalizeGenerationSignature(getSignature(item))
    // Drop empty signatures from generated items; an untitled AI result is not reviewable.
    if (!signature) return []
    if (signatures.has(signature)) return []
    signatures.add(signature)
    return [{ ...item, id: createId(idPrefix) }]
  })
}

const getUniqueGeneratedAdvantages = (existing: string[], generated: string[]) => {
  const signatures = new Set(existing.map(normalizeGenerationSignature).filter(Boolean))

  return generated.flatMap((advantage) => {
    const trimmed = advantage.trim()
    const signature = normalizeGenerationSignature(trimmed)
    if (!signature) return []
    if (signatures.has(signature)) return []
    signatures.add(signature)
    return [trimmed]
  })
}

const formatGeneratedStrategyMessage = ({
  addedMoat,
  advantageCount,
  vectorCount,
  questionCount,
}: {
  addedMoat: boolean
  advantageCount: number
  vectorCount: number
  questionCount: number
}) => {
  const parts = [
    addedMoat ? 'moat' : '',
    advantageCount > 0
      ? `${advantageCount} ${advantageCount === 1 ? 'advantage' : 'advantages'}`
      : '',
    vectorCount > 0 ? `${vectorCount} ${vectorCount === 1 ? 'vector' : 'vectors'}` : '',
    questionCount > 0
      ? `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`
      : '',
  ].filter(Boolean)

  return parts.length > 0
    ? `Generated strategy: ${parts.join(', ')}.`
    : 'Generated strategy matched existing identity; nothing new was added.'
}

const priorityTone = (priority: 'high' | 'medium' | 'low'): string => {
  switch (priority) {
    case 'high':
      return 'tone-strong'
    case 'medium':
      return 'tone-muted'
    case 'low':
      return 'tone-muted'
  }
}

const awarenessTone = (severity: 'high' | 'medium' | 'low' | undefined): string => {
  switch (severity) {
    case 'high':
      return 'tone-warn'
    case 'medium':
      return 'tone-muted'
    case 'low':
      return 'tone-muted'
    default:
      return 'tone-muted'
  }
}

function StrategyGenerationStatus({
  message,
  tone,
}: {
  message: StrategyGenerationMessage | null
  tone: StrategyGenerationMessage['tone']
}) {
  const hasMessage = message?.tone === tone
  const ariaLive = tone === 'info' ? 'polite' : 'assertive'
  const role = tone === 'info' ? 'status' : 'alert'

  return (
    <div
      className={`strategy-generation-message ${tone} ${hasMessage ? '' : 'empty'}`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {hasMessage ? message.text : ''}
    </div>
  )
}

export function SearchStrategyBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateCompetitiveMoat = useIdentityStore((s) => s.updateCurrentCompetitiveMoat)
  const updateUnfairAdvantages = useIdentityStore((s) => s.updateCurrentUnfairAdvantages)
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const fill = searchStrategyFillStrength(identity)
  // The ref closes the pre-render double-click window; state drives the UI.
  const generatingRef = useRef<StrategyGenerationKind | null>(null)
  const generationMessageIdRef = useRef(0)
  const [generating, setGenerating] = useState<StrategyGenerationKind | null>(null)
  const [generationMessage, setGenerationMessage] = useState<StrategyGenerationMessage | null>(null)

  const vectors = identity?.search_vectors ?? []
  const questions = identity?.awareness?.open_questions ?? []
  const strategyMessage = generationMessage?.kind === 'strategy' ? generationMessage : null
  const vectorMessage = generationMessage?.kind === 'vectors' ? generationMessage : null
  const questionMessage = generationMessage?.kind === 'questions' ? generationMessage : null

  useEffect(() => {
    if (!generationMessage?.autoDismiss) return undefined

    // Guard stale timers so a previous success message cannot clear a newer status/error.
    const messageId = generationMessage.id
    const timeoutId = window.setTimeout(() => {
      setGenerationMessage((current) => (current?.id === messageId ? null : current))
    }, 8000)

    return () => window.clearTimeout(timeoutId)
  }, [generationMessage])

  const showGenerationMessage = (message: Omit<StrategyGenerationMessage, 'id'>) => {
    generationMessageIdRef.current += 1
    setGenerationMessage({ ...message, id: generationMessageIdRef.current })
  }

  const ensureEndpoint = () => {
    const aiEndpoint = sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl)
    if (!aiEndpoint) {
      throw new StrategyGenerationConfigError(
        'Connect the AI proxy before generating search strategy.',
      )
    }
    return aiEndpoint
  }

  const runStrategyGeneration = async <Item extends { id: string }>({
    kind,
    loadingText,
    changedText,
    emptyText,
    duplicateText,
    singularText,
    pluralText,
    unableText,
    generate,
    getExisting,
    updateItems,
    selectionType,
    idPrefix,
    getSignature,
  }: {
    kind: StrategyGenerationKind
    loadingText: string
    changedText: string
    emptyText: string
    duplicateText: string
    singularText: string
    pluralText: string
    unableText: string
    generate: (identity: ProfessionalIdentityV3, endpoint: string) => Promise<Item[]>
    getExisting: (identity: ProfessionalIdentityV3) => Item[]
    updateItems: (items: Item[]) => void
    selectionType: StrategySelectionType
    idPrefix: string
    getSignature: (item: Item) => string
  }) => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || generatingRef.current) return

    try {
      generatingRef.current = kind
      const endpoint = ensureEndpoint()
      const generationKey = getIdentityGenerationKey(currentIdentity)
      setGenerating(kind)
      showGenerationMessage({
        kind,
        tone: 'info',
        text: loadingText,
        autoDismiss: false,
      })
      const generated = await generate(currentIdentity, endpoint)
      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity || getIdentityGenerationKey(latestIdentity) !== generationKey) {
        showGenerationMessage({
          kind,
          tone: 'info',
          text: changedText,
          autoDismiss: true,
        })
        return
      }
      if (generated.length === 0) {
        showGenerationMessage({
          kind,
          tone: 'info',
          text: emptyText,
          autoDismiss: true,
        })
        return
      }

      const existing = getExisting(latestIdentity)
      const nextGenerated = uniquifyGeneratedItems<Item>({
        existing,
        generated,
        idPrefix,
        getSignature,
      })
      const [firstGenerated] = nextGenerated
      if (!firstGenerated) {
        showGenerationMessage({
          kind,
          tone: 'info',
          text: duplicateText,
          autoDismiss: true,
        })
        return
      }

      updateItems([...existing, ...nextGenerated])
      setSelection({ type: selectionType, id: firstGenerated.id })
      showGenerationMessage({
        kind,
        tone: 'info',
        text:
          nextGenerated.length === 1
            ? singularText
            : pluralText.replace('{count}', String(nextGenerated.length)),
        autoDismiss: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const isConfigError = error instanceof StrategyGenerationConfigError
      if (!isConfigError) {
        console.error(error)
      }
      showGenerationMessage({
        kind,
        tone: 'error',
        text: isConfigError ? message : unableText,
        autoDismiss: false,
      })
    } finally {
      generatingRef.current = null
      setGenerating(null)
    }
  }

  const handleGenerateStrategy = async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || generatingRef.current) return

    try {
      generatingRef.current = 'strategy'
      const endpoint = ensureEndpoint()
      const generationKey = getIdentityGenerationKey(currentIdentity)
      setGenerating('strategy')
      showGenerationMessage({
        kind: 'strategy',
        tone: 'info',
        text: 'Generating strategy…',
        autoDismiss: false,
      })

      const generated = await generateStrategicPositioningFromIdentity(currentIdentity, endpoint)
      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity || getIdentityGenerationKey(latestIdentity) !== generationKey) {
        showGenerationMessage({
          kind: 'strategy',
          tone: 'info',
          text: 'Identity changed during generation; discarded the generated strategy.',
          autoDismiss: true,
        })
        return
      }

      const existingMoat = latestIdentity.self_model?.competitive_moat?.trim() ?? ''
      const addedMoat = !existingMoat && Boolean(generated.competitive_moat)
      const existingAdvantages = latestIdentity.self_model?.unfair_advantages ?? []
      const nextAdvantages = getUniqueGeneratedAdvantages(
        existingAdvantages,
        generated.unfair_advantages,
      )
      const existingVectors = latestIdentity.search_vectors ?? []
      const nextVectors = uniquifyGeneratedItems<ProfessionalSearchVector>({
        existing: existingVectors,
        generated: generated.search_vectors,
        idPrefix: 'search-vector',
        getSignature: (vector) => vector.title,
      })
      const existingQuestions = latestIdentity.awareness?.open_questions ?? []
      const nextQuestions = uniquifyGeneratedItems<ProfessionalOpenQuestion>({
        existing: existingQuestions,
        generated: generated.open_questions,
        idPrefix: 'open-question',
        getSignature: (question) => question.topic,
      })

      if (addedMoat && generated.competitive_moat) {
        updateCompetitiveMoat(generated.competitive_moat)
      }
      if (nextAdvantages.length > 0) {
        updateUnfairAdvantages([...existingAdvantages, ...nextAdvantages])
      }
      if (nextVectors.length > 0) {
        updateVectors([...existingVectors, ...nextVectors])
      }
      if (nextQuestions.length > 0) {
        updateQuestions([...existingQuestions, ...nextQuestions])
      }

      const [firstVector] = nextVectors
      const [firstQuestion] = nextQuestions
      if (firstVector) {
        setSelection({ type: 'search-vector', id: firstVector.id })
      } else if (firstQuestion) {
        setSelection({ type: 'awareness-question', id: firstQuestion.id })
      }

      showGenerationMessage({
        kind: 'strategy',
        tone: 'info',
        text: formatGeneratedStrategyMessage({
          addedMoat,
          advantageCount: nextAdvantages.length,
          vectorCount: nextVectors.length,
          questionCount: nextQuestions.length,
        }),
        autoDismiss: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const isConfigError = error instanceof StrategyGenerationConfigError
      if (!isConfigError) {
        console.error(error)
      }
      showGenerationMessage({
        kind: 'strategy',
        tone: 'error',
        text: isConfigError ? message : 'Unable to generate strategy.',
        autoDismiss: false,
      })
    } finally {
      generatingRef.current = null
      setGenerating(null)
    }
  }

  const handleGenerateVectors = () =>
    runStrategyGeneration<ProfessionalSearchVector>({
      kind: 'vectors',
      loadingText: 'Generating search vectors…',
      changedText: 'Identity changed during generation; discarded the generated vectors.',
      emptyText: 'No new search vectors came back from the current identity.',
      duplicateText: 'Generated search vectors matched existing strategy; nothing new was added.',
      singularText: 'Generated 1 search vector.',
      pluralText: 'Generated {count} search vectors.',
      unableText: 'Unable to generate search vectors.',
      generate: generateSearchVectorsFromIdentity,
      getExisting: (currentIdentity) => currentIdentity.search_vectors ?? [],
      updateItems: updateVectors,
      selectionType: 'search-vector',
      idPrefix: 'search-vector',
      getSignature: (vector) => vector.title,
    })

  const handleGenerateQuestions = () =>
    runStrategyGeneration<ProfessionalOpenQuestion>({
      kind: 'questions',
      loadingText: 'Generating open questions…',
      changedText: 'Identity changed during generation; discarded the generated questions.',
      emptyText: 'No new open questions came back from the current identity.',
      duplicateText: 'Generated open questions matched existing strategy; nothing new was added.',
      singularText: 'Generated 1 open question.',
      pluralText: 'Generated {count} open questions.',
      unableText: 'Unable to generate open questions.',
      generate: generateAwarenessFromIdentity,
      getExisting: (currentIdentity) => currentIdentity.awareness?.open_questions ?? [],
      updateItems: updateQuestions,
      selectionType: 'awareness-question',
      idPrefix: 'open-question',
      getSignature: (question) => question.topic,
    })

  const handleAddVector = () => {
    const id = createId('search-vector')
    updateVectors([
      ...vectors,
      {
        id,
        title: '',
        priority: 'medium',
        thesis: '',
        target_roles: [],
        keywords: { primary: [], secondary: [] },
      },
    ])
    setSelection({ type: 'search-vector', id, justAdded: true })
  }

  const handleAddQuestion = () => {
    const id = createId('open-question')
    updateQuestions([
      ...questions,
      {
        id,
        topic: '',
        description: '',
        action: '',
      },
    ])
    setSelection({ type: 'awareness-question', id, justAdded: true })
  }

  return (
    <IdentityBand
      layer="search"
      name="Search Strategy"
      subtitle="positioning angles · open questions"
      fill={fill}
    >
      <div className="strategy-global-actions">
        <button
          type="button"
          className="inspector-btn primary"
          onClick={() => {
            if (generating !== null) return
            void handleGenerateStrategy()
          }}
          disabled={!identity}
          aria-disabled={generating !== null}
          aria-busy={generating === 'strategy'}
        >
          <Sparkles size={14} aria-hidden="true" />
          {generating === 'strategy' ? 'Generating strategy…' : 'Generate strategy'}
        </button>
      </div>
      <div className="strategy-generation-stack">
        <StrategyGenerationStatus message={strategyMessage} tone="info" />
        <StrategyGenerationStatus message={strategyMessage} tone="error" />
      </div>

      <div className="search-section">
        <div className="pref-list-label label-tracked">
          Search Vectors <span className="self-count">{vectors.length}</span>
        </div>
        {vectors.length === 0 ? (
          <p className="chapter-copy band-empty">No positioning angles yet.</p>
        ) : (
          <div className="pref-list">
            {vectors.map((vector) => {
              const isSelected = selection?.type === 'search-vector' && selection.id === vector.id
              const title = vector.title.trim() || 'Untitled vector'
              return (
                <button
                  key={vector.id}
                  type="button"
                  className={`pref-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'search-vector', id: vector.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{title}</span>
                  <span className={`pref-item-weight ${priorityTone(vector.priority)}`}>
                    {vector.priority}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="pref-list-actions">
          <button
            type="button"
            className="inspector-btn"
            onClick={handleAddVector}
            disabled={!identity || generating !== null}
          >
            + Add search vector
          </button>
          <button
            type="button"
            className="inspector-btn"
            onClick={() => {
              if (generating !== null) return
              void handleGenerateVectors()
            }}
            disabled={!identity}
            aria-disabled={generating !== null}
            aria-busy={generating === 'vectors'}
          >
            <Sparkles size={14} aria-hidden="true" />
            {generating === 'vectors' ? 'Generating vectors…' : 'Generate vectors'}
          </button>
        </div>
        <div className="strategy-generation-stack">
          <StrategyGenerationStatus message={vectorMessage} tone="info" />
          <StrategyGenerationStatus message={vectorMessage} tone="error" />
        </div>
      </div>

      <div className="search-section">
        <div className="pref-list-label label-tracked">
          Open Questions <span className="self-count">{questions.length}</span>
        </div>
        {questions.length === 0 ? (
          <p className="chapter-copy band-empty">No open questions yet.</p>
        ) : (
          <div className="pref-list">
            {questions.map((question) => {
              const isSelected =
                selection?.type === 'awareness-question' && selection.id === question.id
              const topic = question.topic.trim() || 'Untitled question'
              return (
                <button
                  key={question.id}
                  type="button"
                  className={`pref-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'awareness-question', id: question.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{topic}</span>
                  <span className={`pref-item-weight ${awarenessTone(question.severity)}`}>
                    {question.severity ?? 'open'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="pref-list-actions">
          <button
            type="button"
            className="inspector-btn"
            onClick={handleAddQuestion}
            disabled={!identity || generating !== null}
          >
            + Add open question
          </button>
          <button
            type="button"
            className="inspector-btn"
            onClick={() => {
              if (generating !== null) return
              void handleGenerateQuestions()
            }}
            disabled={!identity}
            aria-disabled={generating !== null}
            aria-busy={generating === 'questions'}
          >
            <Sparkles size={14} aria-hidden="true" />
            {generating === 'questions' ? 'Generating questions…' : 'Generate questions'}
          </button>
        </div>
        <div className="strategy-generation-stack">
          <StrategyGenerationStatus message={questionMessage} tone="info" />
          <StrategyGenerationStatus message={questionMessage} tone="error" />
        </div>
      </div>
    </IdentityBand>
  )
}
