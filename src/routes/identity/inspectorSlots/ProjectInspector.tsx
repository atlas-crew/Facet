import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  Actions,
  MetaRows,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

export function ProjectInspector({
  identity,
  projectId,
}: {
  identity: ProfessionalIdentityV3
  projectId: string
}) {
  const updateProjects = useIdentityStore((s) => s.updateCurrentProjects)
  const project = identity.projects.find((p) => p.id === projectId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '', url: '', tags: '' })

  if (!project) return <NotFound label="project" />

  const startEditing = () => {
    setDraft({
      name: project.name,
      description: project.description,
      url: project.url ?? '',
      tags: tagsToInput(project.tags),
    })
    setEditing(true)
  }

  const handleSave = () => {
    const trimmedUrl = draft.url.trim()
    const next = identity.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            name: draft.name.trim(),
            description: draft.description.trim(),
            url: trimmedUrl ? trimmedUrl : undefined,
            tags: inputToTags(draft.tags),
          }
        : p,
    )
    updateProjects(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Project · ${project.id}`} title="Refine the project">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Name</span>
          <input className="inspector-input" type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Description</span>
          <textarea className="inspector-textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">URL</span>
          <input className="inspector-input" type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
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
    <SlotShell eyebrow="Project · Cross-cutting" title={project.name}>
      <p className="inspector-body-text">{project.description}</p>
      <MetaRows rows={[['Tags', project.tags.join(' · ') || '—'], ['URL', project.url ?? '—']]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit project</button>
      </Actions>
    </SlotShell>
  )
}
