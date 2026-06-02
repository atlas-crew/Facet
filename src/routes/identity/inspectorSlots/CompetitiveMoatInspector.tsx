import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, SlotShell } from './slotPrimitives'

export function CompetitiveMoatInspector({
  identity,
}: {
  identity: ProfessionalIdentityV3
}) {
  const updateCompetitiveMoat = useIdentityStore((s) => s.updateCurrentCompetitiveMoat)
  const moat = identity.self_model.competitive_moat?.trim() ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEditing = () => {
    setDraft(moat)
    setEditing(true)
  }

  const handleSave = () => {
    updateCompetitiveMoat(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Strategic Positioning" title="Edit competitive moat">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Competitive Moat</span>
          <textarea
            className="inspector-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            placeholder="What makes you structurally different? e.g. Production Kubernetes plus product-aware platform judgment."
          />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Strategic Positioning" title="Competitive Moat">
      <p className="inspector-body-text chapter-copy">
        {moat || 'No competitive moat captured yet.'}
      </p>
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          {moat ? 'Edit moat' : 'Add moat'}
        </button>
      </Actions>
    </SlotShell>
  )
}
