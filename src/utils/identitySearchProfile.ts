import type { ProfessionalIdentityV3 } from '../identity/schema'
import type {
  SearchProfile,
  SearchProfileConstraints,
  SearchSkillCategory,
  SearchSkillDepth,
  SearchWorkSummaryEntry,
  SkillCatalogEntry,
  VectorSearchConfig,
} from '../types/search'

const CATEGORY_HINTS: Array<{
  category: SearchSkillCategory
  keywords: string[]
}> = [
  { category: 'backend', keywords: ['backend', 'api', 'services', 'distributed', 'microservice'] },
  { category: 'frontend', keywords: ['frontend', 'ui', 'ux', 'react', 'web'] },
  { category: 'platform', keywords: ['platform', 'developer platform', 'internal platform', 'devex'] },
  { category: 'devops', keywords: ['devops', 'ci', 'cd', 'automation', 'release'] },
  { category: 'cloud', keywords: ['cloud', 'aws', 'gcp', 'azure', 'kubernetes'] },
  { category: 'data', keywords: ['data', 'analytics', 'etl', 'warehouse'] },
  { category: 'ai-ml', keywords: ['ai', 'ml', 'machine learning', 'llm'] },
  { category: 'security', keywords: ['security', 'iam', 'threat', 'waf', 'zero trust'] },
  { category: 'architecture', keywords: ['architecture', 'system design', 'distributed systems'] },
  { category: 'leadership', keywords: ['leadership', 'manager', 'staff', 'principal'] },
  { category: 'product', keywords: ['product', 'customer', 'roadmap', 'pm'] },
  { category: 'domain', keywords: ['fintech', 'healthcare', 'adtech', 'ecommerce', 'compliance'] },
]

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeTerm = (value: string) => value.trim().toLowerCase()

const GENERIC_SKILL_TERMS = new Set([
  'api',
  'architecture',
  'backend',
  'cloud',
  'data',
  'database',
  'databases',
  'devops',
  'frontend',
  'leadership',
  'platform',
  'product',
  'security',
  'services',
  'software',
  'systems',
  'web',
])

const ROLE_TECHNOLOGY_WEIGHT = 3
const STRUCTURED_TAG_WEIGHT = 2
const SUPPORTING_SKILL_WEIGHT = 2
const PROFILE_TAG_WEIGHT = 1
const FREE_TEXT_WEIGHT = 1
const STRONG_DEPTH_THRESHOLD = 4
const WORKING_DEPTH_THRESHOLD = 2

const uniqueTerms = (values: string[]): string[] =>
  Array.from(new Set(values.map(normalizeTerm).filter(Boolean)))

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const containsAlias = (
  text: string | undefined | null,
  aliases: string[],
): boolean => {
  if (!text) {
    return false
  }

  const normalizedText = normalizeTerm(text)
  const pattern = aliases
    .filter((alias) => alias.length >= 4)
    .map(escapeRegex)
    .join('|')

  if (!pattern) {
    return false
  }

  return new RegExp(`\\b(?:${pattern})\\b`).test(normalizedText)
}

const includesAlias = (
  values: string[] | undefined,
  aliases: string[],
): boolean =>
  Boolean(values?.some((value) => aliases.includes(normalizeTerm(value))))

const inferSkillDepth = (
  identity: ProfessionalIdentityV3,
  groupLabel: string,
  item: ProfessionalIdentityV3['skills']['groups'][number]['items'][number],
): SearchSkillDepth => {
  if (item.depth) {
    return item.depth
  }

  const groupAlias = normalizeTerm(groupLabel)
  const exactAliases = uniqueTerms([item.name, ...(item.tags ?? [])]).filter(
    (alias) => alias.length >= 2 && alias !== groupAlias && !GENERIC_SKILL_TERMS.has(alias),
  )
  const textAliases = exactAliases.filter((alias) => alias.length >= 4)

  let score = 0
  let directRoleTechnologyEvidence = false

  for (const role of identity.roles) {
    for (const bullet of role.bullets) {
      if (includesAlias(bullet.technologies, exactAliases)) {
        score += ROLE_TECHNOLOGY_WEIGHT
        directRoleTechnologyEvidence = true
      }

      if (includesAlias(bullet.tags, exactAliases)) {
        score += STRUCTURED_TAG_WEIGHT
      }

      if (
        containsAlias(
          [
            bullet.problem,
            bullet.action,
            bullet.outcome,
            bullet.source_text,
            bullet.portfolio_dive,
            ...(bullet.impact ?? []),
          ]
            .filter(Boolean)
            .join(' '),
          textAliases,
        )
      ) {
        score += FREE_TEXT_WEIGHT
      }
    }
  }

  for (const project of identity.projects) {
    if (includesAlias(project.tags, exactAliases)) {
      score += STRUCTURED_TAG_WEIGHT
    }

    if (
      containsAlias(
        [project.description, project.portfolio_dive].filter(Boolean).join(' '),
        textAliases,
      )
    ) {
      score += FREE_TEXT_WEIGHT
    }
  }

  for (const profile of identity.profiles) {
    if (includesAlias(profile.tags, exactAliases)) {
      score += PROFILE_TAG_WEIGHT
    }

    if (containsAlias(profile.text, textAliases)) {
      score += FREE_TEXT_WEIGHT
    }
  }

  for (const vector of identity.search_vectors ?? []) {
    if (includesAlias(vector.supporting_skills, exactAliases)) {
      score += SUPPORTING_SKILL_WEIGHT
    }

    if (
      containsAlias(
        [
          vector.title,
          vector.subtitle,
          vector.thesis,
          ...(vector.evidence ?? []),
          ...vector.keywords.primary,
          ...vector.keywords.secondary,
        ]
          .filter(Boolean)
          .join(' '),
        textAliases,
      )
    ) {
      score += FREE_TEXT_WEIGHT
    }
  }

  if (directRoleTechnologyEvidence || score >= STRONG_DEPTH_THRESHOLD) {
    return 'strong'
  }

  if (score >= WORKING_DEPTH_THRESHOLD) {
    return 'working'
  }

  return 'basic'
}

const inferSkillCategory = (
  groupLabel: string,
  tags: string[],
): SearchSkillCategory => {
  const haystack = [groupLabel, ...tags].join(' ').toLowerCase()
  const match = CATEGORY_HINTS.find(({ keywords }) => keywords.some((keyword) => haystack.includes(keyword)))
  return match?.category ?? 'other'
}

const formatCompensation = (
  identity: ProfessionalIdentityV3,
): string => {
  const { base_floor: baseFloor, base_target: baseTarget } = identity.preferences.compensation
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  if (typeof baseFloor === 'number' && typeof baseTarget === 'number') {
    return `${formatter.format(baseFloor)} floor / ${formatter.format(baseTarget)} target`
  }

  if (typeof baseTarget === 'number') {
    return formatter.format(baseTarget)
  }

  if (typeof baseFloor === 'number') {
    return `${formatter.format(baseFloor)} floor`
  }

  return identity.preferences.compensation.notes?.trim() ?? ''
}

const buildConstraints = (
  identity: ProfessionalIdentityV3,
): SearchProfileConstraints => ({
  compensation: formatCompensation(identity),
  locations: identity.identity.location ? [identity.identity.location] : [],
  clearance: identity.preferences.constraints?.clearance?.status ?? '',
  companySize: '',
})

const buildSkills = (
  identity: ProfessionalIdentityV3,
): SkillCatalogEntry[] =>
  identity.skills.groups.flatMap((group) =>
    group.items.map((item) => ({
      id: `identity-skill-${group.id}-${slugify(item.name) || 'untitled'}`,
      name: item.name,
      category: inferSkillCategory(group.label, item.tags),
      depth: inferSkillDepth(identity, group.label, item),
      context: item.context,
      positioning: item.positioning,
    })),
  )

const buildVectors = (
  identity: ProfessionalIdentityV3,
): VectorSearchConfig[] =>
  (identity.search_vectors ?? []).map((vector, index) => ({
    vectorId: vector.id,
    priority: index + 1,
    description: vector.subtitle?.trim() || vector.thesis.trim(),
    targetRoleTitles: vector.target_roles,
    searchKeywords: [
      ...vector.keywords.primary,
      ...vector.keywords.secondary,
    ],
  }))

const buildWorkSummary = (
  identity: ProfessionalIdentityV3,
): SearchWorkSummaryEntry[] => {
  const profileSummaries = identity.profiles.map((profile) => ({
    title: profile.tags[0] || 'Profile',
    summary: profile.text,
  }))

  const roleSummaries = identity.roles.slice(0, 4).map((role) => ({
    title: `${role.title} · ${role.company}`,
    summary:
      role.bullets
        .slice(0, 2)
        .map((bullet) => [bullet.problem, bullet.action, bullet.outcome].filter(Boolean).join(' '))
        .join(' ')
        .trim() || role.subtitle?.trim() || role.dates,
  }))

  return [...profileSummaries, ...roleSummaries].filter((entry) => entry.summary.trim())
}

const buildOpenQuestions = (
  identity: ProfessionalIdentityV3,
): string[] =>
  (identity.awareness?.open_questions ?? []).map((question) =>
    [question.topic, question.action || question.description].filter(Boolean).join(': '),
  )

export const adaptIdentityToSearchProfile = (
  identity: ProfessionalIdentityV3,
  options: {
    resumeVersion?: number
    workSummary?: SearchWorkSummaryEntry[]
    openQuestions?: string[]
  } = {},
): Omit<SearchProfile, 'id' | 'inferredAt'> => ({
  source: {
    kind: 'identity',
    label: identity.identity.display_name?.trim() || identity.identity.name,
  },
  skills: buildSkills(identity),
  vectors: buildVectors(identity),
  workSummary: options.workSummary ?? buildWorkSummary(identity),
  openQuestions: options.openQuestions ?? buildOpenQuestions(identity),
  constraints: buildConstraints(identity),
  filters: {
    prioritize: identity.preferences.matching.prioritize.map((item) => item.label),
    avoid: identity.preferences.matching.avoid.map((item) => item.label),
  },
  interviewPrefs: {
    strongFit:
      identity.preferences.interview_process?.strong_fit_signals ??
      identity.self_model.interview_style.strengths,
    redFlags:
      identity.preferences.interview_process?.red_flags ??
      identity.self_model.interview_style.weaknesses,
  },
  inferredFromResumeVersion: options.resumeVersion ?? 0,
})
