import type { ResumeData } from '../types'
import type { ProfessionalIdentityV3 } from './schema'

const SYNTHETIC_VECTOR_ID = 'identity-default'
const SYNTHETIC_VECTOR_LABEL = 'Identity Default'
const SYNTHETIC_VECTOR_COLOR = '#2563EB'

const includeDefaultVector = () => ({ [SYNTHETIC_VECTOR_ID]: 'include' as const })

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

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

export const professionalIdentityToResumeData = (
  identity: ProfessionalIdentityV3,
): { data: ResumeData; warnings: string[] } => {
  const warnings = [
    `Imported Professional Identity Schema v3.1 using synthesized vector "${SYNTHETIC_VECTOR_ID}". Dynamic tag scoring and JD matching are not wired yet.`,
  ]
  const educationIdCounts = new Map<string, number>()

  const targetLineText = identity.identity.title?.trim() || identity.identity.thesis.trim()

  return {
    data: {
      version: 1,
      _overridesMigrated: true,
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
      vectors: [
        {
          id: SYNTHETIC_VECTOR_ID,
          label: SYNTHETIC_VECTOR_LABEL,
          color: SYNTHETIC_VECTOR_COLOR,
        },
      ],
      target_lines: targetLineText
        ? [
            {
              id: 'identity-title',
              vectors: includeDefaultVector(),
              text: targetLineText,
            },
          ]
        : [],
      profiles: identity.profiles.map((profile) => ({
        id: profile.id,
        vectors: includeDefaultVector(),
        text: profile.text,
      })),
      skill_groups: identity.skills.groups.map((group, index) => ({
        id: group.id,
        label: group.label,
        content: group.items.map((item) => item.name).join(', '),
        vectors: {
          [SYNTHETIC_VECTOR_ID]: {
            priority: 'include',
            order: index + 1,
          },
        },
      })),
      roles: identity.roles.map((role) => ({
        id: role.id,
        company: role.company,
        title: role.title,
        dates: role.dates,
        subtitle: role.subtitle ?? null,
        vectors: includeDefaultVector(),
        bullets: role.bullets.map((bullet) => ({
          id: bullet.id,
          label: toBulletLabel(bullet),
          vectors: includeDefaultVector(),
          text: resolveBulletText(bullet),
        })),
      })),
      projects: identity.projects.map((project) => ({
        id: project.id,
        name: project.name,
        url: project.url,
        vectors: includeDefaultVector(),
        text: project.description,
      })),
      education: identity.education.map((entry, index) => ({
        id: buildEducationId(entry, index, educationIdCounts),
        school: entry.school,
        location: entry.location,
        degree: entry.degree,
        year: entry.year,
        vectors: includeDefaultVector(),
      })),
      certifications: [],
      presets: [],
    },
    warnings,
  }
}
