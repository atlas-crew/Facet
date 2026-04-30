import { useNavigate } from '@tanstack/react-router'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import type { MapSelection } from '../../types/identity'
import { ArcStopInspector } from './inspectorSlots/ArcStopInspector'
import { AwarenessQuestionInspector } from './inspectorSlots/AwarenessQuestionInspector'
import { BulletInspector } from './inspectorSlots/BulletInspector'
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
  goToWorkbench: () => void
  goToSkillWizard: (groupId: string, skillName: string) => void
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
      return (
        <ProfileInspector
          identity={identity}
          profileId={selection.id}
          onGoToWorkbench={handlers.goToWorkbench}
        />
      )
    case 'role':
      return (
        <RoleInspector
          identity={identity}
          roleId={selection.id}
          onGoToWorkbench={handlers.goToWorkbench}
        />
      )
    case 'bullet':
      return (
        <BulletInspector
          identity={identity}
          roleId={selection.roleId}
          bulletId={selection.bulletId}
          onGoToWorkbench={handlers.goToWorkbench}
        />
      )
    case 'project':
      return <ProjectInspector identity={identity} projectId={selection.id} />
    case 'skill-group':
      return <SkillGroupInspector identity={identity} groupId={selection.id} />
    case 'skill-item':
      return (
        <SkillItemInspector
          identity={identity}
          groupId={selection.groupId}
          itemName={selection.itemId}
          onGoToSkillWizard={() => handlers.goToSkillWizard(selection.groupId, selection.itemId)}
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
        />
      )
    case 'search-vector':
      return (
        <SearchVectorInspector
          key={`search-vector:${selection.id}`}
          identity={identity}
          vectorId={selection.id}
        />
      )
    case 'awareness-question':
      return (
        <AwarenessQuestionInspector
          key={`awareness-question:${selection.id}`}
          identity={identity}
          questionId={selection.id}
        />
      )
    default: {
      selection satisfies never
      return null
    }
  }
}
