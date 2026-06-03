import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import type { MapSelection } from '../../types/identity'
import { ArcStopInspector } from './inspectorSlots/ArcStopInspector'
import { AwarenessQuestionInspector } from './inspectorSlots/AwarenessQuestionInspector'
import { BulletInspector } from './inspectorSlots/BulletInspector'
import { CompetitiveMoatInspector } from './inspectorSlots/CompetitiveMoatInspector'
import { MatchRuleInspector } from './inspectorSlots/MatchRuleInspector'
import { PhilosophyInspector } from './inspectorSlots/PhilosophyInspector'
import { PrefFieldInspector } from './inspectorSlots/PrefFieldInspector'
import { ProfileInspector } from './inspectorSlots/ProfileInspector'
import { ProjectInspector } from './inspectorSlots/ProjectInspector'
import { RoleInspector } from './inspectorSlots/RoleInspector'
import { SearchVectorInspector } from './inspectorSlots/SearchVectorInspector'
import { SkillGroupInspector } from './inspectorSlots/SkillGroupInspector'
import { SkillItemInspector } from './inspectorSlots/SkillItemInspector'
import { ThesisInspector } from './inspectorSlots/ThesisInspector'

interface InspectorHandlers {
  selectRoleByCompany: (company: string) => void
}

/**
 * Sticky right-aside on the Identity Map. Reads `mapSelection` from the
 * identity store and dispatches to the matching slot component (one file
 * per discriminant in `./inspectorSlots/`). This file stays a thin
 * dispatcher so the slot bodies can grow independently.
 */
export function IdentityInspector() {
  const selection = useIdentityStore((s) => s.mapSelection)
  const identity = useIdentityStore((s) => s.currentIdentity)
  const setSelection = useIdentityStore((s) => s.setMapSelection)

  const handlers: InspectorHandlers = {
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
    case 'competitive-moat':
      return <CompetitiveMoatInspector identity={identity} />
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
      return <ProfileInspector identity={identity} profileId={selection.id} />
    case 'role':
      return <RoleInspector identity={identity} roleId={selection.id} />
    case 'bullet':
      return (
        <BulletInspector
          identity={identity}
          roleId={selection.roleId}
          bulletId={selection.bulletId}
        />
      )
    case 'project':
      return <ProjectInspector identity={identity} projectId={selection.id} />
    case 'skill-group':
      return <SkillGroupInspector identity={identity} groupId={selection.id} />
    case 'skill-item':
      return (
        <SkillItemInspector
          key={`skill-item:${selection.groupId}:${selection.itemId}`}
          identity={identity}
          groupId={selection.groupId}
          itemName={selection.itemId}
          autoDraft={Boolean(selection.draft)}
        />
      )
    case 'pref-field':
      return <PrefFieldInspector identity={identity} field={selection.field} />
    case 'match-rule':
      return (
        <MatchRuleInspector
          key={`match-rule:${selection.kind}:${selection.id}`}
          identity={identity}
          kind={selection.kind}
          ruleId={selection.id}
          justAdded={selection.justAdded}
        />
      )
    case 'search-vector':
      return (
        <SearchVectorInspector
          key={`search-vector:${selection.id}`}
          identity={identity}
          vectorId={selection.id}
          justAdded={selection.justAdded}
        />
      )
    case 'awareness-question':
      return (
        <AwarenessQuestionInspector
          key={`awareness-question:${selection.id}`}
          identity={identity}
          questionId={selection.id}
          justAdded={selection.justAdded}
        />
      )
    default: {
      selection satisfies never
      return null
    }
  }
}
