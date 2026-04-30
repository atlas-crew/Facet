import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  Actions,
  BulletPair,
  MetaRows,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

export function BulletInspector({
  identity,
  roleId,
  bulletId,
}: {
  identity: ProfessionalIdentityV3
  roleId: string
  bulletId: string
}) {
  const updateRoles = useIdentityStore((s) => s.updateCurrentRoles)
  const role = identity.roles.find((r) => r.id === roleId)
  const bullet = role?.bullets.find((b) => b.id === bulletId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    problem: '',
    action: '',
    outcome: '',
    impact: '',
    technologies: '',
    tags: '',
  })

  if (!role || !bullet) return <NotFound label="bullet" />

  const startEditing = () => {
    setDraft({
      problem: bullet.problem,
      action: bullet.action,
      outcome: bullet.outcome,
      impact: tagsToInput(bullet.impact),
      technologies: tagsToInput(bullet.technologies),
      tags: tagsToInput(bullet.tags),
    })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.roles.map((r) =>
      r.id !== roleId
        ? r
        : {
            ...r,
            bullets: r.bullets.map((b) =>
              b.id !== bulletId
                ? b
                : {
                    ...b,
                    problem: draft.problem.trim(),
                    action: draft.action.trim(),
                    outcome: draft.outcome.trim(),
                    impact: inputToTags(draft.impact),
                    technologies: inputToTags(draft.technologies),
                    tags: inputToTags(draft.tags),
                  },
            ),
          },
    )
    updateRoles(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Bullet · ${role.company}`} title="Refine the bullet">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Problem</span>
          <textarea className="inspector-textarea" value={draft.problem} onChange={(e) => setDraft({ ...draft, problem: e.target.value })} rows={2} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Action</span>
          <textarea className="inspector-textarea" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} rows={2} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Outcome</span>
          <textarea className="inspector-textarea" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} rows={2} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Impact (comma-sep)</span>
          <input className="inspector-input" type="text" value={draft.impact} onChange={(e) => setDraft({ ...draft, impact: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Technologies (comma-sep)</span>
          <input className="inspector-input" type="text" value={draft.technologies} onChange={(e) => setDraft({ ...draft, technologies: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-sep)</span>
          <input className="inspector-input" type="text" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Bullet · ${role.company}`} title={bullet.problem || bullet.action || '(no summary)'}>
      <BulletPair label="Problem" value={bullet.problem} />
      <BulletPair label="Action" value={bullet.action} />
      <BulletPair label="Outcome" value={bullet.outcome} />
      {bullet.impact?.length ? <MetaRows rows={[['Impact', bullet.impact.join(' · ')]]} /> : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit bullet</button>
      </Actions>
    </SlotShell>
  )
}
