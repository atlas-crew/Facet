import type { ResumeData, ResumeVector, SkillGroupVectorConfig } from '../types'
import type { MatchReport } from '../types/match'
import { slugify } from './idUtils'

const MATCH_VECTOR_COLORS = ['#0F766E', '#1D4ED8', '#B45309', '#7C3AED']
const MAX_MATCH_BULLETS = 8
const MAX_MATCH_PROJECTS = 2
const MAX_MATCH_PROFILES = 1
const MAX_SKILLS_PER_GROUP = 6

export interface MatchAssemblyResult {
  data: ResumeData
  vectorId: string
  summary: string
  warnings: string[]
}

const parseSkillGroupItems = (content: string): string[] =>
  content
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const buildVectorIdBase = (report: MatchReport): string => {
  const raw = [report.role, report.company].map((value) => value.trim()).filter(Boolean).join(' ')
  return slugify(raw) || 'target-role'
}

export const buildMatchVectorId = (report: MatchReport): string => 'match-' + buildVectorIdBase(report)

const buildMatchVectorLabel = (report: MatchReport): string => {
  if (report.role && report.company) {
    return report.role + ' · ' + report.company
  }
  return report.role || report.company || 'Matched Role'
}

const buildTargetLineText = (report: MatchReport): string =>
  report.role.trim() || report.positioningRecommendations[0]?.text.trim() || 'Target Role'

const upsertVector = (vectors: ResumeVector[], nextVector: ResumeVector): ResumeVector[] => {
  const existingIndex = vectors.findIndex((vector) => vector.id === nextVector.id)
  if (existingIndex === -1) {
    return [...vectors, nextVector]
  }

  return vectors.map((vector, index) => (index === existingIndex ? nextVector : vector))
}

const setPriority = (
  current: Record<string, 'include' | 'exclude'> | undefined,
  vectorId: string,
  include: boolean,
): Record<string, 'include' | 'exclude'> => ({
  ...(current ?? {}),
  [vectorId]: include ? 'include' : 'exclude',
})

const sortIdsByScore = <T extends { id: string }>(
  items: T[],
  scoreOrder: Map<string, number>,
): string[] => {
  const known = items
    .filter((item) => scoreOrder.has(item.id))
    .sort((left, right) => (scoreOrder.get(left.id) ?? 0) - (scoreOrder.get(right.id) ?? 0))
    .map((item) => item.id)
  const remainder = items.filter((item) => !scoreOrder.has(item.id)).map((item) => item.id)
  return [...known, ...remainder]
}

export const applyMatchReportToResumeData = (
  data: ResumeData,
  report: MatchReport,
): MatchAssemblyResult => {
  const vectorId = buildMatchVectorId(report)
  const vectorLabel = buildMatchVectorLabel(report)
  const existingVectorIndex = data.vectors.findIndex((vector) => vector.id === vectorId)
  const nextVector: ResumeVector = {
    id: vectorId,
    label: vectorLabel,
    color:
      data.vectors[existingVectorIndex]?.color ??
      MATCH_VECTOR_COLORS[data.vectors.length % MATCH_VECTOR_COLORS.length] ??
      '#0F766E',
  }

  const bulletOrder = new Map(
    report.topBullets.slice(0, MAX_MATCH_BULLETS).map((asset, index) => [asset.id, index] as const),
  )
  const selectedBulletIds = new Set(bulletOrder.keys())

  const profileOrder = new Map(
    report.topProfiles.slice(0, MAX_MATCH_PROFILES).map((asset, index) => [asset.id, index] as const),
  )
  const selectedProfileIds = new Set(profileOrder.keys())

  const projectOrder = new Map(
    report.topProjects.slice(0, MAX_MATCH_PROJECTS).map((asset, index) => [asset.id, index] as const),
  )
  const selectedProjectIds = new Set(projectOrder.keys())

  const skillOrder = new Map(report.topSkills.map((asset, index) => [asset.label.toLowerCase(), index] as const))
  const selectedSkillNames = new Set(report.topSkills.map((asset) => asset.label.toLowerCase()))

  const warnings: string[] = []
  if (selectedBulletIds.size === 0) warnings.push('Match report did not select any bullets for assembly.')
  if (selectedProfileIds.size === 0) warnings.push('Match report did not select a profile for the assembled vector.')

  const nextTargetLineId = 'match-target-' + vectorId
  const hasExistingTargetLine = data.target_lines.some((line) => line.id === nextTargetLineId)
  const targetLineText = buildTargetLineText(report)

  const nextTargetLines = hasExistingTargetLine
    ? data.target_lines.map((line) =>
        line.id === nextTargetLineId
          ? { ...line, text: targetLineText, vectors: setPriority(line.vectors, vectorId, true) }
          : { ...line, vectors: setPriority(line.vectors, vectorId, false) },
      )
    : [
        {
          id: nextTargetLineId,
          text: targetLineText,
          vectors: { [vectorId]: 'include' as const },
        },
        ...data.target_lines.map((line) => ({
          ...line,
          vectors: setPriority(line.vectors, vectorId, false),
        })),
      ]

  const nextProfiles = data.profiles.map((profile) => ({
    ...profile,
    vectors: setPriority(profile.vectors, vectorId, selectedProfileIds.has(profile.id)),
  }))

  const nextProjects = data.projects.map((project) => ({
    ...project,
    vectors: setPriority(project.vectors, vectorId, selectedProjectIds.has(project.id)),
  }))

  const nextRoles = data.roles.map((role) => {
    const nextBullets = role.bullets.map((bullet) => ({
      ...bullet,
      vectors: setPriority(bullet.vectors, vectorId, selectedBulletIds.has(bullet.id)),
    }))
    const includeRole = nextBullets.some((bullet) => selectedBulletIds.has(bullet.id))

    return {
      ...role,
      vectors: setPriority(role.vectors, vectorId, includeRole),
      bullets: nextBullets,
    }
  })

  const nextBulletOrders = {
    ...(data.bulletOrders ?? {}),
    [vectorId]: Object.fromEntries(nextRoles.map((role) => [role.id, sortIdsByScore(role.bullets, bulletOrder)])),
  }

  const matchedSkillGroupEntries = data.skill_groups
    .map((group) => {
      const matchedSkills = parseSkillGroupItems(group.content)
        .filter((item) => selectedSkillNames.has(item.toLowerCase()))
        .sort((left, right) => (skillOrder.get(left.toLowerCase()) ?? 0) - (skillOrder.get(right.toLowerCase()) ?? 0))
        .slice(0, MAX_SKILLS_PER_GROUP)

      return {
        group,
        matchedSkills,
        minOrder:
          matchedSkills.length > 0
            ? Math.min(...matchedSkills.map((item) => skillOrder.get(item.toLowerCase()) ?? Number.MAX_SAFE_INTEGER))
            : Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((left, right) => left.minOrder - right.minOrder)

  let skillGroupOrder = 1
  const skillVectorsByGroup = new Map<string, Record<string, SkillGroupVectorConfig>>()
  for (const entry of matchedSkillGroupEntries) {
    if (entry.matchedSkills.length > 0) {
      skillVectorsByGroup.set(entry.group.id, {
        ...(entry.group.vectors ?? {}),
        [vectorId]: {
          priority: 'include',
          order: skillGroupOrder,
          content: entry.matchedSkills.join(', '),
        },
      })
    } else {
      skillVectorsByGroup.set(entry.group.id, {
        ...(entry.group.vectors ?? {}),
        [vectorId]: {
          priority: 'exclude',
          order: skillGroupOrder,
        },
      })
    }

    skillGroupOrder += 1
  }

  const nextSkillGroups = data.skill_groups.map((group) => ({
    ...group,
    vectors:
      skillVectorsByGroup.get(group.id) ??
      ({
        ...(group.vectors ?? {}),
        [vectorId]: {
          priority: 'exclude',
          order: skillGroupOrder,
        },
      } satisfies Record<string, SkillGroupVectorConfig>),
  }))

  const missingBulletIds = [...selectedBulletIds].filter(
    (bulletId) => !data.roles.some((role) => role.bullets.some((bullet) => bullet.id === bulletId)),
  )
  const missingProfileIds = [...selectedProfileIds].filter(
    (profileId) => !data.profiles.some((profile) => profile.id === profileId),
  )
  const missingProjectIds = [...selectedProjectIds].filter(
    (projectId) => !data.projects.some((project) => project.id === projectId),
  )

  if (missingBulletIds.length > 0) {
    warnings.push('Build workspace is missing ' + missingBulletIds.length + ' matched bullets from the report.')
  }
  if (missingProfileIds.length > 0) {
    warnings.push('Build workspace is missing ' + missingProfileIds.length + ' matched profiles from the report.')
  }
  if (missingProjectIds.length > 0) {
    warnings.push('Build workspace is missing ' + missingProjectIds.length + ' matched projects from the report.')
  }

  return {
    vectorId,
    summary: 'Created match vector "' + vectorLabel + '" from the current Phase 1 report.',
    warnings,
    data: {
      ...data,
      vectors: upsertVector(data.vectors, nextVector),
      target_lines: nextTargetLines,
      profiles: nextProfiles,
      projects: nextProjects,
      roles: nextRoles,
      skill_groups: nextSkillGroups,
      bulletOrders: nextBulletOrders,
    },
  }
}
