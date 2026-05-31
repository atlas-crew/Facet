import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { findNextPendingIdentitySkill } from '../../utils/identityEnrichment'

export type IdentityEnrichmentNavTarget =
  | {
      to: '/identity/enrich/$groupId/$skillName'
      params: {
        groupId: string
        skillName: string
      }
    }
  | {
      to: '/identity/enrich'
    }

export const resolveIdentityEnrichmentNavTarget = (
  identity: ProfessionalIdentityV3 | null | undefined,
): IdentityEnrichmentNavTarget => {
  const nextSkill = identity ? findNextPendingIdentitySkill(identity) : null

  if (!nextSkill) {
    return { to: '/identity/enrich' }
  }

  return {
    to: '/identity/enrich/$groupId/$skillName',
    params: {
      groupId: nextSkill.groupId,
      skillName: nextSkill.skillName,
    },
  }
}
