import { describe, expect, it } from 'vitest'
import { normalizeRuntimeProfessionalIdentity } from '../identity/schema'
import { cloneIdentityFixture } from './fixtures/identityFixture'

/**
 * The retired strategyEditorAutofill module wrapped strengths/weaknesses with
 * template prefixes ("The process leaves room to demonstrate …", "The process
 * over-indexes on … instead of job-relevant work.") and saved the wrapped
 * strings to interview_process.strong_fit_signals / red_flags. The normalizer
 * strips those wrappings on load so persisted data converges with the
 * post-retire shape.
 */
describe('normalizeRuntimeProfessionalIdentity — interview_process autofill cleanup', () => {
  it('strips the "The process leaves room to demonstrate …" prefix from strong_fit_signals', () => {
    const id = cloneIdentityFixture()
    id.preferences.interview_process = {
      accepted_formats: [],
      strong_fit_signals: [
        'The process leaves room to demonstrate Deep technical problem-solving with business impact focus.',
        'The team wants detailed examples of ownership, execution, and measurable impact.',
      ],
      red_flags: [],
    }
    const result = normalizeRuntimeProfessionalIdentity(id)
    expect(result.preferences.interview_process?.strong_fit_signals).toEqual([
      'Deep technical problem-solving with business impact focus',
      'The team wants detailed examples of ownership, execution, and measurable impact.',
    ])
  })

  it('strips the "The process over-indexes on … instead of job-relevant work." wrapping from red_flags', () => {
    const id = cloneIdentityFixture()
    id.preferences.interview_process = {
      accepted_formats: [],
      strong_fit_signals: [],
      red_flags: [
        'The process over-indexes on Strong opinions on infrastructure patterns that might not fit all contexts instead of job-relevant work.',
        'Loop is unfocused — random algorithm trivia.',
      ],
    }
    const result = normalizeRuntimeProfessionalIdentity(id)
    expect(result.preferences.interview_process?.red_flags).toEqual([
      'Strong opinions on infrastructure patterns that might not fit all contexts',
      'Loop is unfocused — random algorithm trivia.',
    ])
  })

  it('leaves authentic interview_process values unchanged', () => {
    const id = cloneIdentityFixture()
    id.preferences.interview_process = {
      accepted_formats: ['system design discussion'],
      strong_fit_signals: ['Authentic strong-fit signal.'],
      red_flags: ['Authentic red flag.'],
    }
    const result = normalizeRuntimeProfessionalIdentity(id)
    expect(result.preferences.interview_process).toEqual({
      accepted_formats: ['system design discussion'],
      strong_fit_signals: ['Authentic strong-fit signal.'],
      red_flags: ['Authentic red flag.'],
    })
  })

  it('handles identities without interview_process preferences', () => {
    const id = cloneIdentityFixture()
    delete id.preferences.interview_process
    expect(() => normalizeRuntimeProfessionalIdentity(id)).not.toThrow()
  })
})
