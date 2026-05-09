import { describe, it, expect } from 'vitest'
import { buildMayaPatelPersona, validatePersona, assertValidPersona } from './index'

describe('validatePersona — negative cases', () => {
  it('baseline: an unmodified persona produces zero errors', () => {
    const persona = buildMayaPatelPersona()
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(errors).toEqual([])
  })

  it('catches an unknown vector reference on a pipeline entry', () => {
    const persona = buildMayaPatelPersona()
    persona.pipelineEntries[0].vectorId = 'v-does-not-exist'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('vectorId') && e.message.includes('v-does-not-exist')),
    ).toBe(true)
  })

  it('catches an unknown vector reference on a role bullet', () => {
    const persona = buildMayaPatelPersona()
    persona.resume.roles[0].bullets[0].vectors = {
      ...persona.resume.roles[0].bullets[0].vectors,
      'v-not-real': 'include',
    }
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(errors.some((e) => e.path.includes('bullets') && e.message.includes('v-not-real'))).toBe(
      true,
    )
  })

  it('catches a card referencing a missing interviewer', () => {
    const persona = buildMayaPatelPersona()
    persona.prepDecks[0].cards[0].interviewerIds = ['int-ghost']
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(errors.some((e) => e.message.includes('int-ghost'))).toBe(true)
  })

  it('catches studyProgress keys that do not match any card id', () => {
    const persona = buildMayaPatelPersona()
    persona.prepDecks[0].studyProgress = { 'card-orphan': { attempts: 1, needsWorkCount: 0 } }
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(errors.some((e) => e.path.includes('studyProgress[card-orphan]'))).toBe(true)
  })

  it('catches a deck pointing at a non-existent pipeline round', () => {
    const persona = buildMayaPatelPersona()
    persona.prepDecks[0].pipelineRoundId = 'rd-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('pipelineRoundId') && e.message.includes('rd-ghost')),
    ).toBe(true)
  })

  it('catches a pipeline entry pointing at a missing JD analysis', () => {
    const persona = buildMayaPatelPersona()
    persona.pipelineEntries[0].jdAnalysisId = 'jd-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('jdAnalysisId') && e.message.includes('jd-ghost')),
    ).toBe(true)
  })

  it('catches a JD analysis pointing at a missing pipeline entry', () => {
    const persona = buildMayaPatelPersona()
    persona.jdAnalyses[0].pipelineEntryId = 'pipe-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('jdAnalysis') && e.message.includes('pipe-ghost')),
    ).toBe(true)
  })

  it('catches JD analysis internal requirement references that do not resolve', () => {
    const persona = buildMayaPatelPersona()
    persona.jdAnalyses[0].advantages[0].requirementIds = ['req-ghost']
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('advantages') && e.message.includes('req-ghost')),
    ).toBe(true)
  })

  it('catches cover letter links that do not resolve', () => {
    const persona = buildMayaPatelPersona()
    persona.coverLetters.letters[0].pipelineEntryId = 'pipe-ghost'
    persona.coverLetters.snapshots[0].sourceLetterId = 'cover-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some(
        (e) => e.path.includes('coverLetters.letters') && e.message.includes('pipe-ghost'),
      ),
    ).toBe(true)
    expect(
      errors.some((e) => e.path.includes('sourceLetterId') && e.message.includes('cover-ghost')),
    ).toBe(true)
  })

  it('catches cover letter source resume links that do not resolve', () => {
    const persona = buildMayaPatelPersona()
    persona.coverLetters.letters[0].sourceResumeId = 'resume-ghost'
    persona.coverLetters.snapshots[0].sourceResumeSnapshotId = 'resume-snap-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('sourceResumeId') && e.message.includes('resume-ghost')),
    ).toBe(true)
    expect(
      errors.some(
        (e) => e.path.includes('sourceResumeSnapshotId') && e.message.includes('resume-snap-ghost'),
      ),
    ).toBe(true)
  })

  it('catches debrief story references outside identity', () => {
    const persona = buildMayaPatelPersona()
    persona.debriefSessions[0].storiesTold[0].bulletId = 'bullet-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('storiesTold') && e.message.includes('bullet-ghost')),
    ).toBe(true)
  })

  it('catches research request and thesis links that do not resolve', () => {
    const persona = buildMayaPatelPersona()
    persona.research.runs[0].requestId = 'sreq-ghost'
    persona.research.activeThesisId = 'thesis-ghost'
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('requestId') && e.message.includes('sreq-ghost')),
    ).toBe(true)
    expect(
      errors.some((e) => e.path.includes('activeThesisId') && e.message.includes('thesis-ghost')),
    ).toBe(true)
  })

  it('catches duplicate bullet ids across roles in identity', () => {
    const persona = buildMayaPatelPersona()
    persona.identity.roles[0].bullets[0].id = persona.identity.roles[1].bullets[0].id
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(errors.some((e) => e.message.includes('Duplicate bullet id'))).toBe(true)
  })

  it('warns on identity↔resume meta drift', () => {
    const persona = buildMayaPatelPersona()
    persona.resume.meta.email = 'different@example.com'
    const warnings = validatePersona(persona).filter((i) => i.level === 'warning')
    expect(warnings.some((w) => w.path === 'resume.meta.email')).toBe(true)
  })

  it('assertValidPersona throws with a helpful message on errors', () => {
    const persona = buildMayaPatelPersona()
    persona.pipelineEntries[0].vectorId = 'v-bogus'
    expect(() => assertValidPersona(persona, 'maya')).toThrow(/maya.*v-bogus/s)
  })

  it('assertValidPersona does not throw on a clean persona', () => {
    const persona = buildMayaPatelPersona()
    expect(() => assertValidPersona(persona)).not.toThrow()
  })
})
