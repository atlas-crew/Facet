import { describe, expect, it } from 'vitest'
import { assembleResume } from '../engine/assembler'
import { buildMayaPatelPersona } from './fixtures/personas'

const APPSEC = 'v-appsec'
const SECPLATFORM = 'v-secplatform'
const BACKEND = 'v-backend'

const collectBulletIds = (result: ReturnType<typeof assembleResume>): string[] =>
  result.resume.roles.flatMap((role) => role.bullets.map((bullet) => bullet.id))

describe('assembleResume — Maya Patel persona', () => {
  it('selects only AppSec-tagged bullets for the AppSec vector', () => {
    const { resume } = buildMayaPatelPersona()
    const result = assembleResume(resume, { selectedVector: APPSEC })

    const bulletIds = collectBulletIds(result)
    expect(bulletIds).toEqual(
      expect.arrayContaining([
        'cr-bug-bounty',
        'cr-sast-rollout',
        'cr-payment-tokenization',
        'cr-deps-policy',
        'nc-waf-rules',
        'vl-payment-xss',
      ]),
    )
    expect(bulletIds).not.toContain('nc-secret-rotation')
    expect(bulletIds).not.toContain('vl-design-system-a11y')

    expect(result.resume.targetLine?.id).toBe('tl-appsec')
  })

  it('drops the AppSec-only profile when assembling for the Backend vector', () => {
    const { resume } = buildMayaPatelPersona()
    const result = assembleResume(resume, { selectedVector: BACKEND })

    expect(result.resume.profile).toBeUndefined()
    expect(result.resume.targetLine?.id).toBe('tl-backend')

    const bulletIds = collectBulletIds(result)
    expect(bulletIds).toEqual(
      expect.arrayContaining([
        'cr-payment-tokenization',
        'nc-secret-rotation',
        'vl-design-system-a11y',
      ]),
    )
    expect(bulletIds).not.toContain('cr-bug-bounty')
    expect(bulletIds).not.toContain('vl-payment-xss')
  })

  it('resolves the secplatform variant text on the AppSec profile when that vector is selected', () => {
    const { resume } = buildMayaPatelPersona()
    const baseProfile = resume.profiles.find((p) => p.id === 'profile-appsec')
    const variantText = baseProfile?.variants?.[SECPLATFORM]
    expect(variantText).toBeDefined()

    const result = assembleResume(resume, { selectedVector: SECPLATFORM })

    expect(result.resume.profile?.id).toBe('profile-appsec')
    expect(result.resume.profile?.text).toBe(variantText)
    expect(result.resume.profile?.text).not.toBe(baseProfile?.text)
  })

  it('uses the base profile text on the AppSec vector (no variant defined for that vector)', () => {
    const { resume } = buildMayaPatelPersona()
    const baseProfile = resume.profiles.find((p) => p.id === 'profile-appsec')
    expect(baseProfile?.variants?.[APPSEC]).toBeUndefined()

    const result = assembleResume(resume, { selectedVector: APPSEC })

    expect(result.resume.profile?.id).toBe('profile-appsec')
    expect(result.resume.profile?.text).toBe(baseProfile?.text)
  })

  it("includes any role-bullet that's tagged include for at least one vector when selectedVector='all'", () => {
    const { resume } = buildMayaPatelPersona()
    const result = assembleResume(resume, { selectedVector: 'all' })

    const bulletIds = collectBulletIds(result)
    expect(bulletIds).toEqual(
      expect.arrayContaining([
        'cr-bug-bounty',
        'cr-sast-rollout',
        'cr-payment-tokenization',
        'cr-deps-policy',
        'nc-waf-rules',
        'nc-secret-rotation',
        'vl-payment-xss',
        'vl-design-system-a11y',
      ]),
    )
    expect(bulletIds).toHaveLength(8)
  })

  it('preserves the role order from the resume after assembly', () => {
    const { resume } = buildMayaPatelPersona()
    const result = assembleResume(resume, { selectedVector: APPSEC })

    const roleIds = result.resume.roles.map((role) => role.id)
    expect(roleIds).toEqual(['role-coralreef', 'role-northstar', 'role-velocity'])
  })

  it("trims bullets when target page budget is too tight for the AppSec vector's bullet count", () => {
    const { resume } = buildMayaPatelPersona()
    const result = assembleResume(resume, {
      selectedVector: APPSEC,
      targetPages: 1,
      trimToPageBudget: true,
    })

    expect(result.estimatedPages).toBeLessThanOrEqual(1.05)
    expect(result.trimmedBulletIds.length).toBeGreaterThanOrEqual(0)

    const remainingBulletIds = collectBulletIds(result)
    for (const trimmed of result.trimmedBulletIds) {
      expect(remainingBulletIds).not.toContain(trimmed)
    }
  })

  it('honors a manual override that includes a normally-excluded bullet on a vector', () => {
    const { resume } = buildMayaPatelPersona()
    // vl-design-system-a11y is backend-only — excluded from AppSec by default.
    const baseline = collectBulletIds(assembleResume(resume, { selectedVector: APPSEC }))
    expect(baseline).not.toContain('vl-design-system-a11y')

    const overridden = collectBulletIds(
      assembleResume(resume, {
        selectedVector: APPSEC,
        manualOverrides: { 'bullet:vl-design-system-a11y': true },
      }),
    )
    expect(overridden).toContain('vl-design-system-a11y')
  })

  it('assembles resume successfully for the vector referenced by a pipeline entry', () => {
    const { resume, pipelineEntries } = buildMayaPatelPersona()
    const pillar = pipelineEntries.find((e) => e.id === 'pipe-pillar')
    expect(pillar).toBeDefined()
    expect(pillar?.vectorId).toBe(APPSEC)

    const result = assembleResume(resume, { selectedVector: pillar!.vectorId! })

    expect(result.warnings).toEqual([])
    expect(result.resume.header.name).toBe('Maya Patel')
    expect(result.resume.targetLine?.id).toBe('tl-appsec')
    expect(result.resume.roles.length).toBeGreaterThan(0)
  })
})
