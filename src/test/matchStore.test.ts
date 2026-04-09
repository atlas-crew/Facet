import { describe, expect, it } from 'vitest'
import { migrateMatchWorkspaceState } from '../store/matchStore'
import type { MatchReport } from '../types/match'

const legacyReport: MatchReport = {
  generatedAt: '2026-04-08T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Legacy report only.',
  jobDescription: 'Platform ownership and Linux debugging.',
  matchScore: 0.74,
  requirements: [],
  topBullets: [],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: [],
  gapFocus: [],
  warnings: ['legacy warning'],
}

describe('matchStore migration', () => {
  it('preserves legacy currentReport state and initializes currentAnalysis to null', () => {
    const migrated = migrateMatchWorkspaceState(
      {
        jobDescription: legacyReport.jobDescription,
        currentReport: legacyReport,
        warnings: ['legacy warning'],
        history: [],
      },
      1,
    )

    expect(migrated.jobDescription).toBe(legacyReport.jobDescription)
    expect(migrated.currentReport).toEqual(legacyReport)
    expect(migrated.currentAnalysis).toBeNull()
    expect(migrated.warnings).toEqual(['legacy warning'])
  })
})
