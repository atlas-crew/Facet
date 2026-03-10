import {
  DEFAULT_TARGET_PAGES,
  type AssembledResume,
  type EngineWarning,
} from '../types'

const DEFAULT_LINES_PER_PAGE = 58
const DEFAULT_CHARS_PER_LINE = 92
const CONTACT_CHARS_PER_LINE = 72

export interface PageBudgetOptions {
  targetPages?: number
  trim?: boolean
  linesPerPage?: number
}

export interface PageBudgetResult {
  resume: AssembledResume
  targetPages: number
  estimatedPages: number
  estimatedPageUsage: number
  trimmedBulletIds: string[]
  warnings: EngineWarning[]
}

const estimateWrappedLines = (text: string, charsPerLine = DEFAULT_CHARS_PER_LINE): number => {
  const compact = text.trim().replace(/\s+/g, ' ')
  if (compact.length === 0) {
    return 0
  }

  return Math.max(1, Math.ceil(compact.length / charsPerLine))
}

const estimateRoleLines = (resume: AssembledResume): number => {
  if (resume.roles.length === 0) {
    return 0
  }

  let lines = 1
  for (const role of resume.roles) {
    lines += 1
    if (role.subtitle) {
      lines += estimateWrappedLines(role.subtitle)
    }

    for (const bullet of role.bullets) {
      lines += Math.max(1, estimateWrappedLines(bullet.text, DEFAULT_CHARS_PER_LINE - 10))
    }
  }

  return lines
}

const cloneAssembledResume = (resume: AssembledResume): AssembledResume => ({
  selectedVector: resume.selectedVector,
  header: {
    ...resume.header,
    links: resume.header.links.map((link) => ({ ...link })),
  },
  targetLine: resume.targetLine ? { ...resume.targetLine } : undefined,
  profile: resume.profile ? { ...resume.profile } : undefined,
  skillGroups: resume.skillGroups.map((group) => ({ ...group })),
  roles: resume.roles.map((role) => ({
    ...role,
    bullets: role.bullets.map((bullet) => ({ ...bullet })),
  })),
  projects: resume.projects.map((project) => ({ ...project })),
  education: resume.education.map((entry) => ({ ...entry })),
  certifications: resume.certifications.map((cert) => ({ ...cert })),
})

const removeLastBullet = (resume: AssembledResume): string | null => {
  for (let roleIndex = resume.roles.length - 1; roleIndex >= 0; roleIndex -= 1) {
    const role = resume.roles[roleIndex]

    for (let bulletIndex = role.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = role.bullets[bulletIndex]
      role.bullets.splice(bulletIndex, 1)
      if (role.bullets.length === 0) {
        resume.roles.splice(roleIndex, 1)
      }

      return bullet.id
    }
  }

  return null
}

export const estimateResumeLines = (resume: AssembledResume): number => {
  const contactBits = [resume.header.location, resume.header.email, resume.header.phone, ...resume.header.links.map((link) => link.url)]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  let lines = 2
  lines += estimateWrappedLines(contactBits.join(' | '), CONTACT_CHARS_PER_LINE)

  if (resume.targetLine) {
    lines += estimateWrappedLines(resume.targetLine.text)
  }

  if (resume.profile) {
    lines += 1 + estimateWrappedLines(resume.profile.text)
  }

  if (resume.skillGroups.length > 0) {
    lines += 1
    for (const group of resume.skillGroups) {
      lines += Math.max(1, estimateWrappedLines(`${group.label}: ${group.content}`))
    }
  }

  lines += estimateRoleLines(resume)

  if (resume.projects.length > 0) {
    lines += 1
    for (const project of resume.projects) {
      const headline = project.url ? `${project.name} (${project.url})` : project.name
      lines += 1 + estimateWrappedLines(`${headline}: ${project.text}`)
    }
  }

  if (resume.education.length > 0) {
    lines += 1
    lines += resume.education.length
  }

  if (resume.certifications.length > 0) {
    lines += 1
    lines += resume.certifications.length
  }

  return Math.max(1, lines)
}

export const estimateResumePageUsage = (
  resume: AssembledResume,
  linesPerPage = DEFAULT_LINES_PER_PAGE,
): number => {
  const safeLinesPerPage = Math.max(1, linesPerPage)
  const pages = estimateResumeLines(resume) / safeLinesPerPage
  return Math.max(1, Number(pages.toFixed(2)))
}

export const estimateResumePages = (
  resume: AssembledResume,
  linesPerPage = DEFAULT_LINES_PER_PAGE,
): number => Math.ceil(estimateResumePageUsage(resume, linesPerPage))

export const applyPageBudget = (
  resume: AssembledResume,
  options: PageBudgetOptions = {},
): PageBudgetResult => {
  const targetPages = options.targetPages ?? DEFAULT_TARGET_PAGES
  const shouldTrim = options.trim ?? true
  const linesPerPage = options.linesPerPage ?? DEFAULT_LINES_PER_PAGE
  const warnings: EngineWarning[] = []

  const workingResume = cloneAssembledResume(resume)
  const trimmedBulletIds: string[] = []

  let estimatedPageUsage = estimateResumePageUsage(workingResume, linesPerPage)
  let estimatedPages = Math.ceil(estimatedPageUsage)

  if (shouldTrim && estimatedPageUsage > targetPages) {
    while (estimatedPageUsage > targetPages) {
      const removedId = removeLastBullet(workingResume)
      if (!removedId) {
        break
      }

      trimmedBulletIds.push(removedId)
      estimatedPageUsage = estimateResumePageUsage(workingResume, linesPerPage)
      estimatedPages = Math.ceil(estimatedPageUsage)
    }
  }

  if (estimatedPageUsage > targetPages) {
    warnings.push({
      code: 'over_budget_after_trim',
      message: `Resume is still estimated at ${estimatedPageUsage.toFixed(2)} pages after trimming (target: ${targetPages}).`,
    })
  }

  return {
    resume: workingResume,
    targetPages,
    estimatedPages,
    estimatedPageUsage,
    trimmedBulletIds,
    warnings,
  }
}
