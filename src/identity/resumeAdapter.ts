import type {
  PriorityByVector,
  ResumeData,
  ResumeVector,
  SkillGroupVectorConfig,
  VectorId,
} from '../types'
import type { ProfessionalIdentityV3, ProfessionalSearchVector } from './schema'
import { normalizeResumeWorkspaceGeneration } from '../utils/resumeGeneration'

const FALLBACK_VECTOR_ID = 'identity-default'
const FALLBACK_VECTOR_LABEL = 'Identity Default'
const FALLBACK_VECTOR_COLOR = '#2563EB'
const VECTOR_FALLBACK_COLORS = ['#2563EB', '#0D9488', '#7C3AED', '#EA580C', '#4F46E5', '#0891B2']

const isMatchableAlias = (alias: string): boolean => {
  const normalized = normalizeTerm(alias)
  if (!normalized) {
    return false
  }

  return normalized.length >= (normalized.includes(' ') ? 4 : 6)
}

type VectorMatchContext = {
  vector: ProfessionalSearchVector
  aliases: string[]
  directIds: Set<string>
  aliasPattern: RegExp | null
}

const includePriorities = (vectorIds: string[]): PriorityByVector =>
  Object.fromEntries(vectorIds.map((vectorId) => [vectorId, 'include' as const]))

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeTerm = (value: string) => value.trim().toLowerCase()

const uniqueTerms = (values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.map((value) => normalizeTerm(value ?? '')).filter(Boolean)))

const escapeRegex = (value: string) => value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')

const buildAliasPattern = (
  aliases: string[],
  vectorId: string,
): { pattern: RegExp | null; warning: string | null } => {
  const pattern = aliases
    .filter((alias) => isMatchableAlias(alias))
    .map(escapeRegex)
    .join('|')

  if (!pattern) {
    return { pattern: null, warning: null }
  }

  try {
    return {
      pattern: new RegExp(`(^|[^\\p{L}\\p{N}_])(?:${pattern})(?=$|[^\\p{L}\\p{N}_])`, 'u'),
      warning: null,
    }
  } catch {
    return {
      pattern: null,
      warning: `Could not build alias matcher for identity search vector "${vectorId}". Falling back to explicit id matching only.`,
    }
  }
}

const containsAlias = (text: string | undefined | null, context: VectorMatchContext): boolean => {
  if (!text) {
    return false
  }

  return context.aliasPattern?.test(normalizeTerm(text)) ?? false
}

const includesAlias = (values: Array<string | null | undefined>, aliases: string[]): boolean =>
  values.some((value) => {
    const normalized = normalizeTerm(value ?? '')
    return normalized.length > 0 && aliases.includes(normalized)
  })

const buildEducationId = (
  entry: ProfessionalIdentityV3['education'][number],
  index: number,
  seen: Map<string, number>,
): string => {
  const base =
    [entry.school, entry.degree, entry.location, entry.year ?? '']
      .map(toSlug)
      .filter(Boolean)
      .join('-') || `entry-${index + 1}`
  const nextCount = (seen.get(base) ?? 0) + 1
  seen.set(base, nextCount)

  return nextCount === 1 ? `edu-${base}` : `edu-${base}--${nextCount}`
}

const joinBulletText = (problem: string, action: string, outcome: string): string =>
  [problem.trim(), action.trim(), outcome.trim()].filter(Boolean).join(' ')

const resolveBulletText = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): string => {
  const composed = joinBulletText(bullet.problem, bullet.action, bullet.outcome)
  if (composed) {
    return composed
  }

  return bullet.source_text?.trim() ?? ''
}

const toBulletLabel = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): string =>
  bullet.impact[0]?.trim() ||
  bullet.outcome.trim() ||
  bullet.action.trim() ||
  bullet.problem.trim() ||
  bullet.source_text?.trim() ||
  bullet.id

const dedupeSearchVectors = (
  searchVectors: ProfessionalSearchVector[],
  warnings: string[],
): ProfessionalSearchVector[] => {
  const seen = new Set<string>()

  return searchVectors.filter((vector) => {
    if (seen.has(vector.id)) {
      warnings.push(
        `Ignored duplicate identity search vector "${vector.id}" while generating the resume workspace.`,
      )
      return false
    }

    seen.add(vector.id)
    return true
  })
}

const buildResumeVectors = (searchVectors: ProfessionalSearchVector[]): ResumeVector[] => {
  if (searchVectors.length === 0) {
    return [
      {
        id: FALLBACK_VECTOR_ID,
        label: FALLBACK_VECTOR_LABEL,
        color: FALLBACK_VECTOR_COLOR,
      },
    ]
  }

  return searchVectors.map((vector, index) => ({
    id: vector.id,
    label: vector.title.trim() || vector.id,
    color: VECTOR_FALLBACK_COLORS[index % VECTOR_FALLBACK_COLORS.length],
  }))
}

const buildVectorContexts = (
  searchVectors: ProfessionalSearchVector[],
  warnings: string[],
): VectorMatchContext[] =>
  searchVectors.map((vector) => {
    const aliases = uniqueTerms([
      vector.id,
      vector.title,
      vector.subtitle,
      vector.thesis,
      ...vector.target_roles,
      ...vector.keywords.primary,
      ...vector.keywords.secondary,
      ...(vector.supporting_skills ?? []),
      ...(vector.evidence ?? []),
    ])
    const { pattern: aliasPattern, warning } = buildAliasPattern(aliases, vector.id)

    if (warning) {
      warnings.push(warning)
    }

    return {
      vector,
      aliases,
      directIds: new Set(
        uniqueTerms([
          ...(vector.supporting_skills ?? []),
          ...(vector.supporting_bullets ?? []),
          ...(vector.evidence ?? []),
        ]),
      ),
      aliasPattern,
    }
  })

const matchVectorIds = (
  contexts: VectorMatchContext[],
  allVectorIds: string[],
  candidate: {
    ids?: Array<string | null | undefined>
    tags?: Array<string | null | undefined>
    texts?: Array<string | null | undefined>
  },
): string[] => {
  if (contexts.length === 0) {
    return allVectorIds
  }

  const directIds = uniqueTerms(candidate.ids ?? [])
  const tags = uniqueTerms(candidate.tags ?? [])
  const text = (candidate.texts ?? []).filter(Boolean).join(' ')

  const exactMatches = contexts
    .filter((context) => {
      const { aliases, directIds: explicitIds } = context
      return directIds.some((id) => explicitIds.has(id)) || includesAlias(tags, aliases)
    })
    .map(({ vector }) => vector.id)

  if (exactMatches.length > 0) {
    return exactMatches
  }

  const textMatches = contexts
    .filter((context) => containsAlias(text, context))
    .map(({ vector }) => vector.id)

  if (textMatches.length > 0) {
    return textMatches
  }

  // Keep unmatched content on the primary vector instead of broadcasting it across every
  // generated lane. Follow-up tasks can refine this further once vector suggestion becomes
  // its own explicit AI stage.
  return allVectorIds[0] ? [allVectorIds[0]] : []
}

const buildSkillGroupVectors = (
  contexts: VectorMatchContext[],
  vectors: ResumeVector[],
  group: ProfessionalIdentityV3['skills']['groups'][number],
  groupOrder: number,
): Record<VectorId, SkillGroupVectorConfig> => {
  const vectorIds = vectors.map((vector) => vector.id)
  const matchedVectorIds = new Set(
    matchVectorIds(contexts, vectorIds, {
      ids: [group.id, ...group.items.map((item) => item.name)],
      texts: [
        group.label,
        group.positioning,
        ...group.items.flatMap((item) => [item.name, item.context, item.positioning]),
      ],
    }),
  )

  return Object.fromEntries(
    vectors.map((vector) => [
      vector.id,
      {
        priority: matchedVectorIds.has(vector.id) ? 'include' : 'exclude',
        order: groupOrder,
      },
    ]),
  )
}

export const professionalIdentityToResumeData = (
  identity: ProfessionalIdentityV3,
): { data: ResumeData; warnings: string[] } => {
  const warnings: string[] = []
  const educationIdCounts = new Map<string, number>()
  const searchVectors = dedupeSearchVectors(identity.search_vectors ?? [], warnings)
  const vectors = buildResumeVectors(searchVectors)
  const vectorIds = vectors.map((vector) => vector.id)
  const vectorContexts = buildVectorContexts(searchVectors, warnings)
  const usingFallbackVector = searchVectors.length === 0

  if (usingFallbackVector) {
    warnings.push(
      `Imported Professional Identity Schema v3.1 without configured search vectors. Using fallback vector "${FALLBACK_VECTOR_ID}" until identity vectors are defined.`,
    )
  } else {
    warnings.push(
      `Imported Professional Identity Schema v3.1 using ${vectorContexts.length} identity-derived vector${vectorContexts.length === 1 ? '' : 's'}.`,
    )
  }

  const targetLineText = identity.identity.title?.trim() || identity.identity.thesis.trim()
  const targetLineVariantsEntries = vectorContexts
    .map(({ vector }) => [vector.id, vector.title.trim()] as const)
    .filter(([, title]) => title.length > 0 && title !== targetLineText)
  const targetLineVariants =
    targetLineVariantsEntries.length > 0 ? Object.fromEntries(targetLineVariantsEntries) : undefined

  return {
    data: {
      version: 1,
      _overridesMigrated: true,
      generation: normalizeResumeWorkspaceGeneration({
        mode: vectorIds.length > 1 ? 'multi-vector' : 'single',
        vectorMode: 'manual',
        source: 'identity',
        primaryVectorId: vectorIds[0] ?? null,
        vectorIds,
        suggestedVectorIds: [],
      }),
      meta: {
        name: identity.identity.display_name?.trim() || identity.identity.name,
        email: identity.identity.email,
        phone: identity.identity.phone,
        location: identity.identity.location,
        links: identity.identity.links.map((link) => ({
          label: link.id,
          url: link.url,
        })),
      },
      vectors,
      target_lines: targetLineText
        ? [
            {
              id: 'identity-title',
              vectors: includePriorities(vectorIds),
              text: targetLineText,
              variants: targetLineVariants,
            },
          ]
        : [],
      profiles: identity.profiles.map((profile) => ({
        id: profile.id,
        vectors: includePriorities(
          matchVectorIds(vectorContexts, vectorIds, {
            ids: [profile.id],
            tags: profile.tags,
            texts: [profile.text],
          }),
        ),
        text: profile.text,
      })),
      skill_groups: identity.skills.groups.map((group, index) => ({
        id: group.id,
        label: group.label,
        content: group.items.map((item) => item.name).join(', '),
        vectors: buildSkillGroupVectors(vectorContexts, vectors, group, index + 1),
      })),
      roles: identity.roles.map((role) => ({
        id: role.id,
        company: role.company,
        title: role.title,
        dates: role.dates,
        subtitle: role.subtitle ?? null,
        vectors: includePriorities(
          matchVectorIds(vectorContexts, vectorIds, {
            ids: [role.id, role.company, role.title],
            tags: role.bullets.flatMap((bullet) => bullet.tags ?? []),
            texts: [
              role.company,
              role.title,
              role.subtitle,
              ...role.bullets.flatMap((bullet) => [
                bullet.problem,
                bullet.action,
                bullet.outcome,
                bullet.source_text,
                bullet.portfolio_dive,
                ...bullet.impact,
                ...bullet.technologies,
              ]),
            ],
          }),
        ),
        bullets: role.bullets.map((bullet) => ({
          id: bullet.id,
          label: toBulletLabel(bullet),
          vectors: includePriorities(
            matchVectorIds(vectorContexts, vectorIds, {
              ids: [bullet.id, ...bullet.technologies],
              tags: bullet.tags,
              texts: [
                bullet.problem,
                bullet.action,
                bullet.outcome,
                bullet.source_text,
                bullet.portfolio_dive,
                ...bullet.impact,
              ],
            }),
          ),
          text: resolveBulletText(bullet),
        })),
      })),
      projects: identity.projects.map((project) => ({
        id: project.id,
        name: project.name,
        url: project.url,
        vectors: includePriorities(
          matchVectorIds(vectorContexts, vectorIds, {
            ids: [project.id, project.name],
            tags: project.tags,
            texts: [project.name, project.description, project.portfolio_dive],
          }),
        ),
        text: project.description,
      })),
      education: identity.education.map((entry, index) => ({
        id: buildEducationId(entry, index, educationIdCounts),
        school: entry.school,
        location: entry.location,
        degree: entry.degree,
        year: entry.year,
        vectors: includePriorities(vectorIds),
      })),
      certifications: [],
      presets: [],
    },
    warnings,
  }
}
