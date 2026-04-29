import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

export function SearchVectorInspector({
  identity,
  vectorId,
}: {
  identity: ProfessionalIdentityV3
  vectorId: string
}) {
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const vector = identity.search_vectors?.find((v) => v.id === vectorId)
  if (!vector) return <NotFound label="search vector" />

  const toggleReviewed = () => {
    const vectors = identity.search_vectors ?? []
    const next = vectors.map((v) => (v.id === vectorId ? { ...v, needs_review: !v.needs_review } : v))
    updateVectors(next)
  }

  return (
    <SlotShell eyebrow={`Vector · ${vector.priority}`} title={vector.title}>
      <p className="inspector-body-text chapter-copy">{vector.thesis}</p>
      <MetaRows
        rows={[
          ['Target roles', vector.target_roles.join(' · ') || '—'],
          ['Primary keywords', vector.keywords.primary.join(' · ') || '—'],
          ['Needs review', vector.needs_review ? 'Yes' : 'No'],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={toggleReviewed}>
          {vector.needs_review ? 'Mark reviewed' : 'Reopen for review'}
        </button>
      </Actions>
    </SlotShell>
  )
}
