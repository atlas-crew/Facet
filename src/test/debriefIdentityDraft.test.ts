import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { buildDebriefCorrectionNotes, buildDebriefIdentityDraft } from '../utils/debriefIdentityDraft'
import type { DebriefGenerationResult } from '../types/debrief'

const generationResult: DebriefGenerationResult = {
  summary: 'The migration story landed, but metrics need to be tighter.',
  overallTakeaway: 'Lead with the platform migration story.',
  questionsAsked: [
    {
      question: 'How did you prove the on-prem rollout was working?',
      takeaway: 'Need a crisper metric.',
    },
  ],
  whatWorked: ['Platform migration story'],
  whatDidnt: ['Metrics were soft'],
  anchorStories: [
    {
      id: 'platform-migration',
      label: 'Platform migration story',
      reason: 'Strong interviewer engagement.',
      roleId: 'contoso',
      bulletId: 'platform-migration',
    },
  ],
  recurringGaps: [
    {
      id: 'missing-metrics',
      label: 'Missing metrics',
      reason: 'Impact numbers are still weak.',
    },
  ],
  bestFitCompanyTypes: [
    {
      id: 'platform-heavy',
      label: 'Platform-heavy companies',
      reason: 'Platform depth resonated.',
    },
  ],
  identityPatch: {
    summary: 'Tighten metrics and preserve the migration story as an anchor.',
    correctionNotes: ['Add the production rollout metric.'],
    followUpQuestions: ['What was the rollout size?'],
    updatedInterviewStyle: {
      strengths: ['migration storytelling'],
      prep_strategy: 'Lead with the migration story, then quantify impact.',
    },
    bulletUpdates: [
      {
        roleId: 'contoso',
        bulletId: 'platform-migration',
        addTags: ['interview-tested'],
        impactAdditions: ['Validated by hiring-manager interview feedback'],
      },
    ],
    newBullets: [
      {
        roleId: 'contoso',
        bullet: {
          id: 'platform-migration-followup',
          problem: 'Customers needed confidence in the new install path.',
          action: 'Built rollout instrumentation and adoption tracking.',
          outcome: 'Made the on-prem launch measurable and supportable.',
          impact: ['Created a proof point for future interviews'],
          metrics: { pilot_customers: 3 },
          technologies: ['Kubernetes'],
          tags: ['platform', 'rollout'],
        },
      },
    ],
    rewrites: [],
  },
  warnings: ['Metric detail still needs confirmation.'],
}

describe('debriefIdentityDraft', () => {
  it('builds a reviewable identity draft from the debrief patch', () => {
    const draft = buildDebriefIdentityDraft(cloneIdentityFixture(), generationResult)
    const updatedRole = draft.identity.roles.find((role) => role.id === 'contoso')
    const updatedBullet = updatedRole?.bullets.find((bullet) => bullet.id === 'platform-migration')
    const newBullet = updatedRole?.bullets.find((bullet) => bullet.id === 'platform-migration-followup')

    expect(draft.summary).toBe('Tighten metrics and preserve the migration story as an anchor.')
    expect(draft.followUpQuestions).toEqual(['What was the rollout size?'])
    expect(updatedBullet?.tags).toContain('interview-tested')
    expect(updatedBullet?.impact).toContain('Validated by hiring-manager interview feedback')
    expect(newBullet?.metrics).toEqual({ pilot_customers: 3 })
    expect(
      draft.identity.self_model.interview_style.strengths.includes('migration storytelling'),
    ).toBe(true)
    expect(draft.bullets.some((bullet) => bullet.bulletId === 'platform-migration-followup')).toBe(
      true,
    )
  })

  it('formats debrief correction notes for the identity workspace', () => {
    const correctionNotes = buildDebriefCorrectionNotes(
      {
        summary: generationResult.identityPatch.summary,
        correctionNotes: generationResult.identityPatch.correctionNotes,
        followUpQuestions: generationResult.identityPatch.followUpQuestions,
        questionsAsked: generationResult.questionsAsked,
      },
      'Acme',
      'Staff Engineer',
    )

    expect(correctionNotes).toContain('Debrief: Acme')
    expect(correctionNotes).toContain('Corrections')
    expect(correctionNotes).toContain('Follow-up Questions')
    expect(correctionNotes).toContain('Questions Asked')
  })
})
