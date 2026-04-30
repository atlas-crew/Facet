import { useIdentityStore } from '../../../store/identityStore'
import { searchStrategyFillStrength } from '../../../utils/identityFillStrength'
import { createId } from '../../../utils/idUtils'
import { IdentityBand } from '../IdentityBand'

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

export function SearchStrategyBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const fill = searchStrategyFillStrength(identity)

  const vectors = identity?.search_vectors ?? []
  const questions = identity?.awareness?.open_questions ?? []

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
                  <span className={`pref-item-weight ${priorityTone(vector.priority)}`}>{vector.priority}</span>
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className="inspector-btn pref-list-add"
          onClick={handleAddVector}
          disabled={!identity}
        >
          + Add search vector
        </button>
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
        <button
          type="button"
          className="inspector-btn pref-list-add"
          onClick={handleAddQuestion}
          disabled={!identity}
        >
          + Add open question
        </button>
      </div>
    </IdentityBand>
  )
}
