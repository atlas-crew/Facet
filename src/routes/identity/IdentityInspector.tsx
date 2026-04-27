import type {
  ProfessionalIdentityV3,
  ProfessionalRole,
  ProfessionalRoleBullet,
  ProfessionalSkillItem,
} from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import { skillNamesMatch } from '../../utils/identityEnrichment'
import type { MapSelection } from '../../types/identity'

/**
 * Sticky right-aside on the Identity Map. Renders a different body per
 * `mapSelection` discriminant. Read-mostly per the redesign plan: action
 * buttons here are stubs for now and wire to existing editors / nested
 * routes in Phase D.
 */
export function IdentityInspector() {
  const selection = useIdentityStore((s) => s.mapSelection)
  const identity = useIdentityStore((s) => s.currentIdentity)

  return (
    <aside className="identity-inspector" aria-label="Identity inspector">
      {!selection || !identity ? (
        <p className="identity-inspector-empty chapter-copy">
          Click any element on the map to inspect it. Gaps and assumptions surface here, with prompts to refine the model.
        </p>
      ) : (
        <InspectorBody selection={selection} identity={identity} />
      )}
    </aside>
  )
}

function InspectorBody({ selection, identity }: { selection: MapSelection; identity: ProfessionalIdentityV3 }) {
  switch (selection.type) {
    case 'thesis':
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
            <button type="button" className="inspector-btn primary">Edit thesis</button>
          </Actions>
        </SlotShell>
      )

    case 'philosophy': {
      const position = identity.self_model.philosophy.find((p) => p.id === selection.id)
      if (!position) return <NotFound label="philosophy" />
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
            <button type="button" className="inspector-btn primary">Edit position</button>
          </Actions>
        </SlotShell>
      )
    }

    case 'arc-stop': {
      const arcEntry = lookupArcStop(identity, selection.id)
      if (!arcEntry) return <NotFound label="arc entry" />
      const role = identity.roles.find((r) => r.company === arcEntry.company)
      return (
        <SlotShell eyebrow="Career Arc · Chapter" title={`${arcEntry.company} — ${arcEntry.chapter}`}>
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
            <button type="button" className="inspector-btn">View bullets</button>
            <button type="button" className="inspector-btn">Edit chapter title</button>
          </Actions>
        </SlotShell>
      )
    }

    case 'profile': {
      const profile = identity.profiles.find((p) => p.id === selection.id)
      if (!profile) return <NotFound label="profile" />
      return (
        <SlotShell eyebrow="Profile · Variant" title={profile.id}>
          <p className="inspector-body-text">{profile.text}</p>
          <MetaRows rows={[['Tags', profile.tags.join(' · ') || '—']]} />
          <Actions>
            <button type="button" className="inspector-btn primary">Edit profile</button>
            <button type="button" className="inspector-btn">Generate variant</button>
          </Actions>
        </SlotShell>
      )
    }

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
            <button type="button" className="inspector-btn primary">Open scan editor</button>
            <button type="button" className="inspector-btn">Generate variant</button>
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
            <button type="button" className="inspector-btn primary">Edit bullet</button>
            <button type="button" className="inspector-btn">Open in scan editor</button>
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
            <button type="button" className="inspector-btn primary">Edit project</button>
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
            <button type="button" className="inspector-btn primary">Rename group</button>
            <button type="button" className="inspector-btn">Mark differentiator</button>
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
            <button type="button" className="inspector-btn primary">Open Skill Wizard</button>
            <button type="button" className="inspector-btn">Mark broken</button>
          </Actions>
        </SlotShell>
      )
    }

    case 'pref-field':
      return (
        <SlotShell eyebrow="Preferences · Field" title={selection.field}>
          <p className="inspector-body-text chapter-copy">
            Field-level editor lands with the topbar Generator settings drawer in Phase D.
          </p>
          <Actions>
            <button type="button" className="inspector-btn primary">Edit field</button>
          </Actions>
        </SlotShell>
      )

    case 'match-rule': {
      const rules = selection.kind === 'prioritize'
        ? identity.preferences.matching.prioritize
        : identity.preferences.matching.avoid
      const rule = rules.find((r) => r.id === selection.id)
      if (!rule) return <NotFound label="matching rule" />
      const weightOrSeverity = 'weight' in rule ? rule.weight : rule.severity
      return (
        <SlotShell eyebrow={`Matching · ${selection.kind}`} title={rule.label}>
          <p className="inspector-body-text">{rule.description}</p>
          <MetaRows rows={[[selection.kind === 'prioritize' ? 'Weight' : 'Severity', weightOrSeverity]]} />
          <Actions>
            <button type="button" className="inspector-btn primary">Edit rule</button>
          </Actions>
        </SlotShell>
      )
    }

    case 'search-vector': {
      const vector = identity.search_vectors?.find((v) => v.id === selection.id)
      if (!vector) return <NotFound label="search vector" />
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
            <button type="button" className="inspector-btn primary">Mark reviewed</button>
            <button type="button" className="inspector-btn">Regenerate</button>
          </Actions>
        </SlotShell>
      )
    }

    case 'awareness-question': {
      const question = identity.awareness?.open_questions.find((q) => q.id === selection.id)
      if (!question) return <NotFound label="open question" />
      return (
        <SlotShell eyebrow={`Awareness · ${question.severity ?? 'open'}`} title={question.topic}>
          <p className="inspector-body-text">{question.description}</p>
          <MetaRows rows={[['Action', question.action], ['Needs review', question.needs_review ? 'Yes' : 'No']]} />
          <Actions>
            <button type="button" className="inspector-btn primary">Mark reviewed</button>
            <button type="button" className="inspector-btn">Add evidence</button>
          </Actions>
        </SlotShell>
      )
    }

    default: {
      selection satisfies never
      return null
    }
  }
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

function lookupArcStop(
  identity: ProfessionalIdentityV3,
  id: string,
): { company: string; chapter: string } | null {
  if (id.startsWith('derived:')) {
    const [, company] = id.split(':')
    const role = identity.roles.find((r) => r.company === company)
    if (!role) return null
    return { company, chapter: role.subtitle?.trim() || role.title }
  }
  const persisted = identity.self_model.arc.find((entry, index) => `${entry.company}:${index}` === id)
  return persisted ?? null
}

