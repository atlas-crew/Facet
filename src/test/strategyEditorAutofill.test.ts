import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { deriveStrategyAutofill } from '../utils/strategyEditorAutofill'

describe('deriveStrategyAutofill', () => {
  it('fills empty strategy fields from identity-derived signals', () => {
    const identity = cloneIdentityFixture()
    identity.identity.title = 'Senior Platform Engineer'
    identity.skills.groups[0]!.label = 'Platform Engineering'
    identity.education = [
      {
        school: 'USF',
        location: 'Tampa, FL',
        degree: 'Bachelor of Science in Computer Science',
      },
    ]

    const result = deriveStrategyAutofill(identity)

    expect(result.compensation?.notes).toContain('Compensation priorities')
    expect(result.workModel?.flexibility).toContain('Remote-first')
    expect(result.constraints?.title_flexibility).toEqual([
      'Senior Platform Engineer',
      'Platform Engineer',
    ])
    expect(result.constraints?.education?.highest).toBe(
      'Bachelor of Science in Computer Science',
    )
    expect(result.matching?.prioritize.map((item) => item.label)).toContain(
      'Platform scope',
    )
    expect(result.matching?.avoid.map((item) => item.label)).toContain(
      'On-site heavy roles',
    )
    expect(result.interviewProcess?.accepted_formats).toContain(
      'system design discussion',
    )
    expect(result.interviewProcess?.red_flags).toContain(
      'The loop over-indexes on trivia or whiteboard performance instead of real work.',
    )
    expect(result.changedFields.length).toBeGreaterThan(0)
  })

  it('does not overwrite existing strategy values', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.compensation.notes = 'Keep current comp notes.'
    identity.preferences.work_model.flexibility = 'Keep current flexibility.'
    identity.preferences.constraints = {
      title_flexibility: ['Platform Engineer'],
      education: { highest: 'Bachelor of Science' },
    }
    identity.preferences.matching = {
      prioritize: [
        {
          id: 'existing-priority',
          label: 'Existing priority',
          description: 'Keep it.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'existing-avoid',
          label: 'Existing avoid',
          description: 'Keep it.',
          severity: 'soft',
        },
      ],
    }
    identity.preferences.interview_process = {
      accepted_formats: ['team panel'],
      strong_fit_signals: ['existing signal'],
      red_flags: ['existing red flag'],
      onsite_preferences: 'Keep current onsite preference.',
    }

    const result = deriveStrategyAutofill(identity)

    expect(result.compensation).toBeUndefined()
    expect(result.workModel).toBeUndefined()
    expect(result.constraints).toBeUndefined()
    expect(result.matching).toBeUndefined()
    expect(result.interviewProcess).toBeUndefined()
    expect(result.changedFields).toEqual([])
  })
})
