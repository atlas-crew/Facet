import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  ProfessionalIdentityV3,
  ProfessionalRole,
  ProfessionalRoleBullet,
  ProfessionalSkillItem,
} from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import { skillNamesMatch } from '../../utils/identityEnrichment'
import type { MapSelection } from '../../types/identity'

interface InspectorHandlers {
  /** Navigate to the legacy workbench at /identity/workbench. */
  goToWorkbench: () => void
  /** Route to the dedicated skill enrichment page for a specific group + item. */
  goToSkillWizard: (groupId: string, skillName: string) => void
  /** Update mapSelection — used by 'View bullets' and similar cross-band navigation. */
  selectRoleByCompany: (company: string) => void
}

/**
 * Sticky right-aside on the Identity Map. Renders a different body per
 * `mapSelection` discriminant. Action buttons are wired to either:
 *   - selection-set (View bullets → select the role)
 *   - dedicated routes (Open Skill Wizard → /identity/enrich/$groupId/$skillName)
 *   - the workbench fallback (everything that needs an inline editor we haven't built yet)
 *
 * Inline editing inside the inspector itself is a future refactor — would
 * require extracting form components from the workbench cards.
 */
export function IdentityInspector() {
  const selection = useIdentityStore((s) => s.mapSelection)
  const identity = useIdentityStore((s) => s.currentIdentity)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const navigate = useNavigate()

  const handlers: InspectorHandlers = {
    goToWorkbench: () => {
      void navigate({ to: '/identity/workbench' })
    },
    goToSkillWizard: (groupId, skillName) => {
      void navigate({
        to: '/identity/enrich/$groupId/$skillName',
        params: { groupId, skillName },
      })
    },
    selectRoleByCompany: (company) => {
      const role = identity?.roles.find((r) => r.company === company)
      if (role) setSelection({ type: 'role', id: role.id })
    },
  }

  return (
    <aside className="identity-inspector" aria-label="Identity inspector">
      {!selection || !identity ? (
        <p className="identity-inspector-empty chapter-copy">
          Click any element on the map to inspect it. Gaps and assumptions surface here, with prompts to refine the model.
        </p>
      ) : (
        <InspectorBody selection={selection} identity={identity} handlers={handlers} />
      )}
    </aside>
  )
}

function InspectorBody({
  selection,
  identity,
  handlers,
}: {
  selection: MapSelection
  identity: ProfessionalIdentityV3
  handlers: InspectorHandlers
}) {
  switch (selection.type) {
    case 'thesis':
      return <ThesisInspector identity={identity} />

    case 'philosophy':
      return <PhilosophyInspector identity={identity} positionId={selection.id} />



    case 'arc-stop':
      return (
        <ArcStopInspector
          identity={identity}
          selectionId={selection.id}
          onSelectRole={handlers.selectRoleByCompany}
        />
      )



    case 'profile':
      return <ProfileInspector identity={identity} profileId={selection.id} onGoToWorkbench={handlers.goToWorkbench} />



    case 'role': {
      const role = identity.roles.find((r) => r.id === selection.id)
      if (!role) return <NotFound label="role" />
      return (
        <SlotShell eyebrow={`Role · ${role.dates}`} title={`${role.company} — ${role.title}`}>
          <MetaRows
            rows={[
              ['Bullets', String(role.bullets.length)],
              ['Subtitle', role.subtitle ?? '—'],
              ['Source-text intact', allBulletsHaveSource(role) ? 'Yes' : 'Partial'],
            ]}
          />
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handlers.goToWorkbench}>
              Open scan editor
            </button>
            <button type="button" className="inspector-btn" onClick={handlers.goToWorkbench}>
              Generate variant
            </button>
          </Actions>
        </SlotShell>
      )
    }

    case 'bullet': {
      const role = identity.roles.find((r) => r.id === selection.roleId)
      const bullet = role?.bullets.find((b) => b.id === selection.bulletId)
      if (!role || !bullet) return <NotFound label="bullet" />
      return (
        <SlotShell eyebrow={`Bullet · ${role.company}`} title={bullet.problem || bullet.action || '(no summary)'}>
          <BulletPair label="Problem" value={bullet.problem} />
          <BulletPair label="Action" value={bullet.action} />
          <BulletPair label="Outcome" value={bullet.outcome} />
          {bullet.impact?.length ? <MetaRows rows={[['Impact', bullet.impact.join(' · ')]]} /> : null}
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handlers.goToWorkbench}>
              Edit bullet
            </button>
            <button type="button" className="inspector-btn" onClick={handlers.goToWorkbench}>
              Open in scan editor
            </button>
          </Actions>
        </SlotShell>
      )
    }

    case 'project': {
      const project = identity.projects.find((p) => p.id === selection.id)
      if (!project) return <NotFound label="project" />
      return (
        <SlotShell eyebrow="Project · Cross-cutting" title={project.name}>
          <p className="inspector-body-text">{project.description}</p>
          <MetaRows rows={[['Tags', project.tags.join(' · ') || '—'], ['URL', project.url ?? '—']]} />
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handlers.goToWorkbench}>
              Edit project
            </button>
          </Actions>
        </SlotShell>
      )
    }

    case 'skill-group': {
      const group = identity.skills.groups.find((g) => g.id === selection.id)
      if (!group) return <NotFound label="skill group" />
      return (
        <SlotShell eyebrow="Skill Group" title={group.label}>
          <MetaRows
            rows={[
              ['Items', String(group.items.length)],
              ['Positioning', group.positioning ?? '—'],
              ['Calibration', group.calibration ?? '—'],
              ['Differentiator', group.is_differentiator ? 'Yes' : 'No'],
            ]}
          />
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handlers.goToWorkbench}>
              Rename group
            </button>
            <button type="button" className="inspector-btn" onClick={handlers.goToWorkbench}>
              Mark differentiator
            </button>
          </Actions>
        </SlotShell>
      )
    }

    case 'skill-item': {
      const group = identity.skills.groups.find((g) => g.id === selection.groupId)
      const item: ProfessionalSkillItem | undefined = group?.items.find((i) => skillNamesMatch(i.name, selection.itemId))
      if (!group || !item) return <NotFound label="skill" />
      return (
        <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
          <MetaRows
            rows={[
              ['Depth', item.depth ?? '—'],
              ['Context', item.context?.trim() || '—'],
              ['Positioning', item.positioning?.trim() || '—'],
              ['Tags', item.tags?.join(' · ') || '—'],
            ]}
          />
          {!item.depth ? <Prompt label="Cleanup" text="Open the skill wizard to capture depth, context, and positioning." /> : null}
          <Actions>
            <button
              type="button"
              className="inspector-btn primary"
              onClick={() => handlers.goToSkillWizard(group.id, item.name)}
            >
              Open Skill Wizard
            </button>
            <button type="button" className="inspector-btn" onClick={handlers.goToWorkbench}>
              Mark broken
            </button>
          </Actions>
        </SlotShell>
      )
    }

    case 'pref-field':
      return (
        <SlotShell eyebrow="Preferences · Field" title={selection.field}>
          <p className="inspector-body-text chapter-copy">
            Field-level editor lives in the workbench until inline editing lands here.
          </p>
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handlers.goToWorkbench}>
              Edit field
            </button>
          </Actions>
        </SlotShell>
      )

    case 'match-rule':
      return <MatchRuleInspector identity={identity} kind={selection.kind} ruleId={selection.id} />



    case 'search-vector':
      return <SearchVectorInspector identity={identity} vectorId={selection.id} onGoToWorkbench={handlers.goToWorkbench} />



    case 'awareness-question':
      return <AwarenessQuestionInspector identity={identity} questionId={selection.id} onGoToWorkbench={handlers.goToWorkbench} />



    default: {
      selection satisfies never
      return null
    }
  }
}

function ThesisInspector({ identity }: { identity: ProfessionalIdentityV3 }) {
  const updateCore = useIdentityStore((s) => s.updateCurrentIdentityCore)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    thesis: identity.identity.thesis ?? '',
    origin: identity.identity.origin ?? '',
    elaboration: identity.identity.elaboration ?? '',
    title: identity.identity.title ?? '',
  })

  const startEditing = () => {
    setDraft({
      thesis: identity.identity.thesis ?? '',
      origin: identity.identity.origin ?? '',
      elaboration: identity.identity.elaboration ?? '',
      title: identity.identity.title ?? '',
    })
    setEditing(true)
  }

  const handleSave = () => {
    const trimmedOrigin = draft.origin.trim()
    const trimmedElaboration = draft.elaboration.trim()
    const trimmedTitle = draft.title.trim()
    updateCore({
      thesis: draft.thesis.trim(),
      origin: trimmedOrigin ? trimmedOrigin : undefined,
      elaboration: trimmedElaboration ? trimmedElaboration : undefined,
      title: trimmedTitle ? trimmedTitle : undefined,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Thesis · Editing" title="Refine the load-bearing claim">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Thesis</span>
          <textarea
            className="inspector-textarea"
            value={draft.thesis}
            onChange={(e) => setDraft({ ...draft, thesis: e.target.value })}
            rows={4}
            placeholder="The single sentence that anchors your identity."
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Origin</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.origin}
            onChange={(e) => setDraft({ ...draft, origin: e.target.value })}
            placeholder="How you came to believe this"
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Elaboration</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.elaboration}
            onChange={(e) => setDraft({ ...draft, elaboration: e.target.value })}
            placeholder="The longer-form version"
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Title</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Optional naming for this thesis"
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
    <SlotShell eyebrow="Thesis · Identity" title={identity.identity.thesis || 'No thesis yet'}>
      {identity.identity.elaboration ? (
        <p className="inspector-body-text chapter-copy">{identity.identity.elaboration}</p>
      ) : null}
      <MetaRows
        rows={[
          ['Origin', identity.identity.origin],
          ['Title', identity.identity.title],
          ['Cited by', `${identity.profiles.length} profiles · ${countBullets(identity)} bullets`],
        ]}
      />
      {!identity.identity.origin || !identity.identity.elaboration ? (
        <Prompt
          label="Open question"
          text="Origin and elaboration help interview prep generate the 'how I came to believe this' story when asked."
        />
      ) : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit thesis
        </button>
      </Actions>
    </SlotShell>
  )
}

/** Tag list serialized as comma-separated for inline edit. Splits on commas,
 *  trims whitespace, drops empties. */
const tagsToInput = (tags: string[]): string => tags.join(', ')
const inputToTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

function ProfileInspector({
  identity,
  profileId,
  onGoToWorkbench,
}: {
  identity: ProfessionalIdentityV3
  profileId: string
  onGoToWorkbench: () => void
}) {
  const updateProfiles = useIdentityStore((s) => s.updateCurrentProfiles)
  const profile = identity.profiles.find((p) => p.id === profileId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ text: '', tags: '' })

  if (!profile) return <NotFound label="profile" />

  const startEditing = () => {
    setDraft({ text: profile.text, tags: tagsToInput(profile.tags) })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.profiles.map((p) =>
      p.id === profile.id
        ? { ...p, text: draft.text.trim(), tags: inputToTags(draft.tags) }
        : p,
    )
    updateProfiles(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Profile · ${profile.id}`} title="Refine the variant">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Text</span>
          <textarea
            className="inspector-textarea"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={5}
            placeholder="What this profile says about you, framed for a specific audience."
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.tags}
            onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            placeholder="platform, infrastructure, automation"
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
    <SlotShell eyebrow="Profile · Variant" title={profile.id}>
      <p className="inspector-body-text">{profile.text}</p>
      <MetaRows rows={[['Tags', profile.tags.join(' · ') || '—']]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit profile
        </button>
        <button type="button" className="inspector-btn" onClick={onGoToWorkbench}>
          Generate variant
        </button>
      </Actions>
    </SlotShell>
  )
}

function PhilosophyInspector({
  identity,
  positionId,
}: {
  identity: ProfessionalIdentityV3
  positionId: string
}) {
  const updatePhilosophy = useIdentityStore((s) => s.updateCurrentPhilosophy)
  const position = identity.self_model.philosophy.find((p) => p.id === positionId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ text: '', tags: '' })

  if (!position) return <NotFound label="philosophy" />

  const startEditing = () => {
    setDraft({ text: position.text, tags: tagsToInput(position.tags) })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.self_model.philosophy.map((p) =>
      p.id === position.id
        ? { ...p, text: draft.text.trim(), tags: inputToTags(draft.tags) }
        : p,
    )
    updatePhilosophy(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Philosophy · ${position.id}`} title="Refine the position">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Text</span>
          <textarea
            className="inspector-textarea"
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={4}
            placeholder="The position you hold, in your own voice."
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.tags}
            onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            placeholder="platform, sustainability, knowledge-transfer"
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
    <SlotShell eyebrow="Philosophy · Position" title={position.id}>
      <p className="inspector-body-text chapter-copy">{position.text}</p>
      <MetaRows
        rows={[
          ['Tags', position.tags.join(' · ') || '—'],
          ['Cited in profiles', citedInProfiles(identity, position.tags)],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit position
        </button>
      </Actions>
    </SlotShell>
  )
}

function ArcStopInspector({
  identity,
  selectionId,
  onSelectRole,
}: {
  identity: ProfessionalIdentityV3
  selectionId: string
  onSelectRole: (company: string) => void
}) {
  const updateArc = useIdentityStore((s) => s.updateCurrentSelfModelArc)
  const arc = identity.self_model.arc
  const arcIndex = arc.findIndex((entry, i) => `${entry.company}:${i}` === selectionId)
  const arcEntry = arcIndex >= 0 ? arc[arcIndex] : null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!arcEntry) return <NotFound label="arc entry" />

  const role = identity.roles.find((r) => r.company === arcEntry.company)
  const arcCompany = arcEntry.company

  const startEditing = () => {
    setDraft(arcEntry.chapter)
    setEditing(true)
  }

  const handleSave = () => {
    const next = arc.map((entry, i) => (i === arcIndex ? { ...entry, chapter: draft.trim() } : entry))
    updateArc(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Career Arc · ${arcCompany}`} title="Refine the chapter">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Chapter</span>
          <textarea
            className="inspector-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="What this chapter of your career meant — the narrative interpretation, not the role title."
          />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Career Arc · Chapter" title={`${arcCompany} — ${arcEntry.chapter}`}>
      {role ? (
        <MetaRows
          rows={[
            ['Years', role.dates],
            ['Role', role.title],
            ['Bullets', String(role.bullets.length)],
            ['Headline metric', role.subtitle ?? '—'],
          ]}
        />
      ) : null}
      <Actions>
        <button
          type="button"
          className="inspector-btn primary"
          onClick={() => onSelectRole(arcCompany)}
          disabled={!role}
          title={role ? undefined : 'No matching role for this arc entry'}
        >
          View bullets
        </button>
        <button type="button" className="inspector-btn" onClick={startEditing}>
          Edit chapter
        </button>
      </Actions>
    </SlotShell>
  )
}

function MatchRuleInspector({
  identity,
  kind,
  ruleId,
}: {
  identity: ProfessionalIdentityV3
  kind: 'prioritize' | 'avoid'
  ruleId: string
}) {
  const updateMatching = useIdentityStore((s) => s.updateCurrentMatching)
  const rules = kind === 'prioritize' ? identity.preferences.matching.prioritize : identity.preferences.matching.avoid
  const rule = rules.find((r) => r.id === ruleId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ label: '', description: '', weightOrSeverity: 'high' as string })

  if (!rule) return <NotFound label="matching rule" />

  const weightOrSeverity = 'weight' in rule ? rule.weight : rule.severity

  const startEditing = () => {
    setDraft({ label: rule.label, description: rule.description, weightOrSeverity })
    setEditing(true)
  }

  const handleSave = () => {
    const matching = identity.preferences.matching
    if (kind === 'prioritize') {
      const next = matching.prioritize.map((r) =>
        r.id === ruleId
          ? { ...r, label: draft.label.trim(), description: draft.description.trim(), weight: draft.weightOrSeverity as 'high' | 'medium' | 'low' }
          : r,
      )
      updateMatching({ ...matching, prioritize: next })
    } else {
      const next = matching.avoid.map((r) =>
        r.id === ruleId
          ? { ...r, label: draft.label.trim(), description: draft.description.trim(), severity: draft.weightOrSeverity as 'hard' | 'soft' | 'conditional' }
          : r,
      )
      updateMatching({ ...matching, avoid: next })
    }
    setEditing(false)
  }

  if (editing) {
    const options = kind === 'prioritize' ? ['high', 'medium', 'low'] : ['hard', 'soft', 'conditional']
    return (
      <SlotShell eyebrow={`Matching · ${kind}`} title="Refine the rule">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Label</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Description</span>
          <textarea
            className="inspector-textarea"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">{kind === 'prioritize' ? 'Weight' : 'Severity'}</span>
          <select
            className="inspector-input"
            value={draft.weightOrSeverity}
            onChange={(e) => setDraft({ ...draft, weightOrSeverity: e.target.value })}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label}>
      <p className="inspector-body-text">{rule.description}</p>
      <MetaRows rows={[[kind === 'prioritize' ? 'Weight' : 'Severity', weightOrSeverity]]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit rule</button>
      </Actions>
    </SlotShell>
  )
}

function SearchVectorInspector({
  identity,
  vectorId,
  onGoToWorkbench,
}: {
  identity: ProfessionalIdentityV3
  vectorId: string
  onGoToWorkbench: () => void
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
        <button type="button" className="inspector-btn" onClick={onGoToWorkbench}>
          Edit / Regenerate
        </button>
      </Actions>
    </SlotShell>
  )
}

function AwarenessQuestionInspector({
  identity,
  questionId,
  onGoToWorkbench,
}: {
  identity: ProfessionalIdentityV3
  questionId: string
  onGoToWorkbench: () => void
}) {
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const question = identity.awareness?.open_questions.find((q) => q.id === questionId)
  if (!question) return <NotFound label="open question" />

  const toggleReviewed = () => {
    const questions = identity.awareness?.open_questions ?? []
    const next = questions.map((q) => (q.id === questionId ? { ...q, needs_review: !q.needs_review } : q))
    updateQuestions(next)
  }

  return (
    <SlotShell eyebrow={`Awareness · ${question.severity ?? 'open'}`} title={question.topic}>
      <p className="inspector-body-text">{question.description}</p>
      <MetaRows rows={[['Action', question.action], ['Needs review', question.needs_review ? 'Yes' : 'No']]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={toggleReviewed}>
          {question.needs_review ? 'Mark reviewed' : 'Reopen for review'}
        </button>
        <button type="button" className="inspector-btn" onClick={onGoToWorkbench}>
          Edit / Add evidence
        </button>
      </Actions>
    </SlotShell>
  )
}

function SlotShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="inspector-section">
      <p className="inspector-eyebrow label-tracked">{eyebrow}</p>
      <h3 className="inspector-title chapter-copy">{title}</h3>
      <div className="inspector-body">{children}</div>
    </div>
  )
}

function MetaRows({ rows }: { rows: Array<[string, string | undefined]> }) {
  return (
    <dl className="inspector-meta">
      {rows.map(([label, value]) => (
        <div key={label} className="inspector-meta-row">
          <dt className="inspector-meta-key label-tracked">{label}</dt>
          <dd className="inspector-meta-val">{value && value.trim() ? value : '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div className="inspector-prompt">
      <p className="inspector-prompt-label label-tracked">{label}</p>
      <p className="inspector-prompt-text">{text}</p>
    </div>
  )
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="inspector-action">{children}</div>
}

function NotFound({ label }: { label: string }) {
  return (
    <div className="inspector-section">
      <p className="inspector-eyebrow label-tracked">Selection stale</p>
      <p className="inspector-body chapter-copy">The {label} you selected is no longer in the model.</p>
    </div>
  )
}

function BulletPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspector-meta-row">
      <span className="inspector-meta-key label-tracked">{label}</span>
      <span className="inspector-meta-val">{value || '—'}</span>
    </div>
  )
}

const countBullets = (identity: ProfessionalIdentityV3): number =>
  identity.roles.reduce((acc, role) => acc + role.bullets.length, 0)

const allBulletsHaveSource = (role: ProfessionalRole): boolean =>
  role.bullets.every((b: ProfessionalRoleBullet) => Boolean(b.source_text?.trim()))

function citedInProfiles(identity: ProfessionalIdentityV3, tags: string[]): string {
  if (tags.length === 0) return '—'
  const matches = identity.profiles.filter((p) => p.tags.some((t) => tags.includes(t))).map((p) => p.id)
  return matches.length > 0 ? matches.join(' · ') : '—'
}

