import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { ResumeMeta } from '../types'

export const resolveCoverLetterCandidateMeta = (
  resumeMeta: ResumeMeta,
  identity: ProfessionalIdentityV3 | null | undefined,
): ResumeMeta => {
  if (!identity) return resumeMeta

  const identityCore = identity.identity
  if (!identityCore) return resumeMeta

  const identityName = identityCore.display_name?.trim() || identityCore.name?.trim()
  if (!identityName) return resumeMeta
  const hasIdentityLinks = 'links' in identityCore && Array.isArray(identityCore.links)
  const identityLinks = hasIdentityLinks ? identityCore.links : []
  const links =
    hasIdentityLinks
      ? identityLinks.map((link) => ({
          label: link.id?.trim(),
          url: link.url?.trim() || '',
        }))
      : resumeMeta.links

  return {
    name: identityName,
    email: identityCore.email?.trim() || resumeMeta.email,
    phone: identityCore.phone?.trim() || resumeMeta.phone,
    location: identityCore.location?.trim() || resumeMeta.location,
    links,
  }
}

export const applyCoverLetterCandidateMetaToAssembledResume = <TAssembled>(
  assembled: TAssembled,
  candidate: ResumeMeta,
): TAssembled => {
  if (!assembled || typeof assembled !== 'object' || Array.isArray(assembled)) return assembled

  const record = assembled as Record<string, unknown>
  const header = record.header && typeof record.header === 'object' && !Array.isArray(record.header) ? record.header : {}

  return {
    ...record,
    header: {
      ...header,
      ...candidate,
    },
  } as TAssembled
}
