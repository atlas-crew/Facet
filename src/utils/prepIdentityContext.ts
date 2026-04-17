import type { ProfessionalIdentityV3, ProfessionalRoleBullet, ProfessionalSkillItem } from '../identity/schema'
import type { PrepIdentityMetricCandidate } from '../types/prep'

const MAX_EVIDENCE_CHARS = 240
const MIN_EVIDENCE_BOUNDARY_CHARS = 120

export interface PrepIdentityContext {
  [key: string]: unknown
  identity: {
    name: string
    display_name?: string
    title?: string
    location: string
    remote?: boolean
    thesis: string
  }
  vector: Record<string, unknown>
  self_model: {
    interview_style: ProfessionalIdentityV3['self_model']['interview_style']
    prep_strategy?: string
  }
  candidate_metrics?: PrepIdentityMetricCandidate[]
  roles: Array<{
    id: string
    company: string
    title: string
    dates: string
    subtitle?: string
    bullets: Array<{
      id: string
      problem: string
      action: string
      outcome: string
      impact: string[]
      metrics: ProfessionalRoleBullet['metrics']
      technologies: string[]
      tags: string[]
    }>
  }>
  skills: Array<{
    id: string
    label: string
    positioning?: string
    items: Array<{
      name: string
      depth: ProfessionalSkillItem['depth']
      context?: string
      positioning?: string
      tags: string[]
    }>
  }>
}

const normalizeTerm = (value: string): string => value.trim().toLowerCase()

function humanizeMetricKey(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeBulletEvidence(bullet: ProfessionalRoleBullet): string {
  const summary = [bullet.problem, bullet.action, bullet.outcome, ...bullet.impact]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
  if (summary.length <= MAX_EVIDENCE_CHARS) return summary
  const truncated = summary.slice(0, MAX_EVIDENCE_CHARS)
  const boundary = truncated.lastIndexOf(' ')
  return (boundary >= MIN_EVIDENCE_BOUNDARY_CHARS ? truncated.slice(0, boundary) : truncated).trimEnd()
}

const expandTerms = (values: string[]): Set<string> =>
  new Set(
    values.flatMap((value) => {
      const normalized = normalizeTerm(value)
      if (!normalized) return []
      const tokens = normalized.split(/[^a-z0-9]+/).filter((token) => token.length >= 3)
      return [normalized, ...tokens]
    }),
  )

const matchesAnyTerm = (values: string[], terms: Set<string>): boolean => {
  if (terms.size === 0) return false
  return values.some((value) => {
    const normalized = normalizeTerm(value)
    if (!normalized) return false
    for (const term of terms) {
      if (normalized.includes(term)) return true
    }
    return false
  })
}

const bulletMatchesVector = (
  bullet: ProfessionalRoleBullet,
  bulletIds: Set<string>,
  skillNames: Set<string>,
  keywordTerms: Set<string>,
): boolean => {
  if (bulletIds.has(bullet.id)) return true

  const bulletText = [
    bullet.problem,
    bullet.action,
    bullet.outcome,
    ...bullet.impact,
    ...bullet.technologies,
    ...bullet.tags,
    ...Object.values(bullet.metrics).map((value) => String(value)),
  ]

  return matchesAnyTerm(bulletText, skillNames) || matchesAnyTerm(bulletText, keywordTerms)
}

const skillMatchesVector = (
  skill: ProfessionalSkillItem,
  skillNames: Set<string>,
  keywordTerms: Set<string>,
): boolean => {
  if (skillNames.has(normalizeTerm(skill.name))) return true

  return matchesAnyTerm(
    [skill.name, skill.context ?? '', skill.positioning ?? '', ...skill.tags],
    keywordTerms,
  )
}

export function buildPrepIdentityContext(
  identity: ProfessionalIdentityV3,
  vectorId: string,
  vectorLabel?: string,
): PrepIdentityContext {
  const selectedVector = identity.search_vectors?.find((entry) => entry.id === vectorId) ?? null
  const relevantBulletIds = new Set(selectedVector?.supporting_bullets ?? [])
  const relevantSkillNames = new Set((selectedVector?.supporting_skills ?? []).map(normalizeTerm))
  const fallbackTerms = vectorLabel ? [vectorId, vectorLabel] : []
  const keywordTerms = expandTerms(selectedVector
    ? [
        ...(selectedVector.keywords.primary ?? []),
        ...(selectedVector.keywords.secondary ?? []),
        ...(selectedVector.target_roles ?? []),
        ...(selectedVector.evidence ?? []),
        selectedVector.title,
        selectedVector.thesis,
      ]
    : fallbackTerms)
  const candidateMetrics: PrepIdentityMetricCandidate[] = []

  const roles = identity.roles.flatMap((role) => {
    const bullets = role.bullets
      .filter((bullet) => (
        selectedVector || keywordTerms.size > 0
          ? bulletMatchesVector(bullet, relevantBulletIds, relevantSkillNames, keywordTerms)
          : true
      ))
      .map((bullet) => {
        for (const [metricKey, metricValue] of Object.entries(bullet.metrics)) {
          if (!(typeof metricValue === 'number' || (typeof metricValue === 'string' && metricValue.trim()))) {
            continue
          }
          candidateMetrics.push({
            roleId: role.id,
            roleTitle: role.title,
            company: role.company,
            bulletId: bullet.id,
            metricKey,
            metricValue: typeof metricValue === 'number' ? String(metricValue) : metricValue,
            suggestedLabel: humanizeMetricKey(metricKey),
            evidence: summarizeBulletEvidence(bullet),
          })
        }

        return {
          id: bullet.id,
          problem: bullet.problem,
          action: bullet.action,
          outcome: bullet.outcome,
          impact: bullet.impact,
          metrics: bullet.metrics,
          technologies: bullet.technologies,
          tags: bullet.tags,
        }
      })

    if (bullets.length === 0) return []

    return [{
      id: role.id,
      company: role.company,
      title: role.title,
      dates: role.dates,
      subtitle: role.subtitle ?? undefined,
      bullets,
    }]
  })

  const skills = identity.skills.groups.flatMap((group) => {
    const items = group.items
      .filter((item) => (
        selectedVector || keywordTerms.size > 0
          ? skillMatchesVector(item, relevantSkillNames, keywordTerms)
          : true
      ))
      .map((item) => ({
        name: item.name,
        depth: item.depth,
        context: item.context,
        positioning: item.positioning,
        tags: item.tags,
      }))

    if (items.length === 0) return []

    return [{
      id: group.id,
      label: group.label,
      positioning: group.positioning,
      items,
    }]
  })

  return {
    identity: {
      name: identity.identity.name,
      display_name: identity.identity.display_name ?? undefined,
      title: identity.identity.title,
      location: identity.identity.location,
      remote: identity.identity.remote ?? undefined,
      thesis: identity.identity.thesis,
    },
    vector: selectedVector
      ? {
          id: selectedVector.id,
          title: selectedVector.title,
          thesis: selectedVector.thesis,
          target_roles: selectedVector.target_roles,
          keywords: selectedVector.keywords,
          evidence: selectedVector.evidence ?? [],
          supporting_bullets: selectedVector.supporting_bullets ?? [],
          supporting_skills: selectedVector.supporting_skills ?? [],
        }
      : { id: vectorId },
    self_model: {
      interview_style: identity.self_model.interview_style,
      prep_strategy: identity.self_model.interview_style.prep_strategy,
    },
    candidate_metrics: candidateMetrics.length > 0 ? candidateMetrics : undefined,
    roles,
    skills,
  }
}
