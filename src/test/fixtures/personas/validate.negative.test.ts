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
    expect(errors.some((e) => e.path.includes('vectorId') && e.message.includes('v-does-not-exist'))).toBe(true)
  })

  it('catches an unknown vector reference on a role bullet', () => {
    const persona = buildMayaPatelPersona()
    persona.resume.roles[0].bullets[0].vectors = {
      ...persona.resume.roles[0].bullets[0].vectors,
      'v-not-real': 'include',
    }
    const errors = validatePersona(persona).filter((i) => i.level === 'error')
    expect(
      errors.some((e) => e.path.includes('bullets') && e.message.includes('v-not-real')),
    ).toBe(true)
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
    expect(errors.some((e) => e.path.includes('pipelineRoundId') && e.message.includes('rd-ghost'))).toBe(true)
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
