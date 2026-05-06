import { describe, expect, it } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import type { MatchReport } from '../types/match'
import { untagged, untaggedNote } from '../types/audience'
import { applyMatchReportToResumeData, buildMatchVectorId } from '../utils/matchAssembler'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const reportFixture: MatchReport = {
  generatedAt: '2026-04-02T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit with cloud infrastructure depth.',
  jobDescription: 'Need Kubernetes, AWS, and platform engineering leadership.',
  matchScore: 0.81,
  requirements: [],
  topBullets: [
    untagged({
      kind: 'bullet',
      id: 'acme-b2',
      label: 'Latency optimization',
      sourceLabel: 'Acme Corp',
      text: 'Reduced P99 API latency from 800ms to 120ms through query planning and cache strategy.',
      tags: ['performance'],
      matchedTags: ['aws'],
      matchedKeywords: ['latency'],
      matchedRequirementIds: ['req-1'],
      score: 0.92,
    }),
    untagged({
      kind: 'bullet',
      id: 'acme-b1',
      label: 'Order pipeline',
      sourceLabel: 'Acme Corp',
      text: 'Designed and built a high-throughput order processing pipeline serving 25M+ events/day.',
      tags: ['platform'],
      matchedTags: ['platform'],
      matchedKeywords: ['pipeline'],
      matchedRequirementIds: ['req-1'],
      score: 0.88,
    }),
  ],
  topSkills: [
    untagged({
      kind: 'skill',
      id: 'skill-aws',
      label: 'AWS',
      sourceLabel: 'Infrastructure',
      text: 'AWS',
      tags: ['aws'],
      matchedTags: ['aws'],
      matchedKeywords: ['AWS'],
      matchedRequirementIds: ['req-1'],
      score: 0.95,
    }),
    untagged({
      kind: 'skill',
      id: 'skill-go',
      label: 'Go',
      sourceLabel: 'Languages',
      text: 'Go',
      tags: ['go'],
      matchedTags: ['go'],
      matchedKeywords: ['Go'],
      matchedRequirementIds: ['req-2'],
      score: 0.82,
    }),
  ],
  topProjects: [
    untagged({
      kind: 'project',
      id: 'project-1',
      label: 'OpenThing',
      sourceLabel: 'Projects',
      text: 'Distributed task queue library with adaptive retry and dead-letter routing.',
      tags: ['platform'],
      matchedTags: ['platform'],
      matchedKeywords: ['distributed'],
      matchedRequirementIds: ['req-1'],
      score: 0.79,
    }),
  ],
  topProfiles: [
    untagged({
      kind: 'profile',
      id: 'profile-backend',
      label: 'Backend profile',
      sourceLabel: 'Profiles',
      text: 'Backend engineer building reliable distributed systems.',
      tags: ['backend'],
      matchedTags: ['backend'],
      matchedKeywords: ['systems'],
      matchedRequirementIds: ['req-1'],
      score: 0.77,
    }),
  ],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: [untaggedNote('Lead with platform migration and reliability stories.')],
  gapFocus: [],
  warnings: [],
}

describe('matchAssembler', () => {
  it('creates a build vector from a match report', () => {
    const result = applyMatchReportToResumeData(clone(defaultResumeData), reportFixture)
    const vectorId = buildMatchVectorId(reportFixture)
    const vector = result.data.vectors.find((entry) => entry.id === vectorId)
    const targetLine = result.data.target_lines.find((entry) => entry.id === 'match-target-' + vectorId)
    const backendProfile = result.data.profiles.find((entry) => entry.id === 'profile-backend')
    const leadershipProfile = result.data.profiles.find((entry) => entry.id === 'profile-leadership')
    const acmeRole = result.data.roles.find((entry) => entry.id === 'acme')
    const infrastructureGroup = result.data.skill_groups.find((entry) => entry.id === 'infrastructure')
    const languageGroup = result.data.skill_groups.find((entry) => entry.id === 'languages')

    expect(result.vectorId).toBe(vectorId)
    expect(result.summary).toContain('Created match vector')
    expect(result.warnings).toEqual([])
    expect(vector?.label).toBe('Staff Platform Engineer · Atlas')
    expect(targetLine?.text).toBe('Staff Platform Engineer')
    expect(targetLine?.vectors[vectorId]).toBe('include')
    expect(backendProfile?.vectors[vectorId]).toBe('include')
    expect(leadershipProfile?.vectors[vectorId]).toBe('exclude')
    expect(acmeRole?.vectors[vectorId]).toBe('include')
    expect(acmeRole?.bullets.find((entry) => entry.id === 'acme-b2')?.vectors[vectorId]).toBe('include')
    expect(acmeRole?.bullets.find((entry) => entry.id === 'acme-b1')?.vectors[vectorId]).toBe('include')
    expect(acmeRole?.bullets.find((entry) => entry.id === 'acme-b3')?.vectors[vectorId]).toBe('exclude')
    expect(result.data.bulletOrders?.[vectorId]?.acme).toEqual(['acme-b2', 'acme-b1', 'acme-b3'])
    expect(result.data.projects.find((entry) => entry.id === 'project-1')?.vectors[vectorId]).toBe('include')
    expect(infrastructureGroup?.vectors?.[vectorId]).toEqual({
      priority: 'include',
      order: 1,
      content: 'AWS',
    })
    expect(languageGroup?.vectors?.[vectorId]).toEqual({
      priority: 'include',
      order: 2,
      content: 'Go',
    })
  })

  it('is idempotent when the same report is applied twice', () => {
    const firstPass = applyMatchReportToResumeData(clone(defaultResumeData), reportFixture)
    const secondPass = applyMatchReportToResumeData(firstPass.data, reportFixture)
    const vectorId = buildMatchVectorId(reportFixture)

    expect(secondPass.data.vectors.filter((entry) => entry.id === vectorId)).toHaveLength(1)
    expect(secondPass.data.target_lines.filter((entry) => entry.id === 'match-target-' + vectorId)).toHaveLength(1)
    expect(secondPass.data.bulletOrders?.[vectorId]?.acme).toEqual(['acme-b2', 'acme-b1', 'acme-b3'])
  })

  it('falls back to a stable target-role vector id and excludes unmatched skill groups', () => {
    const sparseReport: MatchReport = {
      ...reportFixture,
      company: '',
      role: '',
      topSkills: [
        untagged({
          kind: 'skill',
          id: 'skill-ml',
          label: 'Machine Learning',
          sourceLabel: 'Missing',
          text: 'Machine Learning',
          tags: ['ml'],
          matchedTags: ['ml'],
          matchedKeywords: ['ML'],
          matchedRequirementIds: ['req-3'],
          score: 0.6,
        }),
      ],
    }

    const result = applyMatchReportToResumeData(clone(defaultResumeData), sparseReport)

    expect(result.vectorId).toBe('match-target-role')
    expect(result.data.skill_groups.find((entry) => entry.id === 'languages')?.vectors?.[result.vectorId]).toEqual({
      priority: 'exclude',
      order: 1,
    })
    expect(result.data.skill_groups.find((entry) => entry.id === 'infrastructure')?.vectors?.[result.vectorId]).toEqual({
      priority: 'exclude',
      order: 2,
    })
  })

  it('returns warnings when the current build workspace is missing matched assets', () => {
    const reportWithMissingAssets: MatchReport = {
      ...reportFixture,
      topBullets: [
        ...reportFixture.topBullets,
        untagged({
          kind: 'bullet',
          id: 'missing-bullet',
          label: 'Missing bullet',
          sourceLabel: 'Missing',
          text: 'Missing bullet text',
          tags: [],
          matchedTags: [],
          matchedKeywords: [],
          matchedRequirementIds: [],
          score: 0.4,
        }),
      ],
      topProfiles: [],
      topProjects: [
        ...reportFixture.topProjects,
        untagged({
          kind: 'project',
          id: 'missing-project',
          label: 'Missing project',
          sourceLabel: 'Missing',
          text: 'Missing project text',
          tags: [],
          matchedTags: [],
          matchedKeywords: [],
          matchedRequirementIds: [],
          score: 0.3,
        }),
      ],
    }

    const result = applyMatchReportToResumeData(clone(defaultResumeData), reportWithMissingAssets)
    expect(result.warnings).toContain('Match report did not select a profile for the assembled vector.')
    expect(result.warnings).toContain('Build workspace is missing 1 matched bullets from the report.')
    expect(result.warnings).toContain('Build workspace is missing 1 matched projects from the report.')
  })
})
