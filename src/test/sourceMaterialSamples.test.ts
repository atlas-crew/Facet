import { describe, expect, it } from 'vitest'
import { SOURCE_MATERIAL_SAMPLES } from '../routes/identity/sampleSourceMaterial'

describe('identity source material samples', () => {
  it('keeps sample ids unique', () => {
    const ids = SOURCE_MATERIAL_SAMPLES.map((sample) => sample.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes senior-engineer samples for the dev dropdown', () => {
    expect(SOURCE_MATERIAL_SAMPLES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'senior-backend-resume',
          label: 'Senior backend resume',
        }),
        expect.objectContaining({
          id: 'staff-infrastructure-resume',
          label: 'Staff infrastructure resume',
        }),
      ]),
    )
  })

  it('keeps sample source material substantive', () => {
    for (const sample of SOURCE_MATERIAL_SAMPLES) {
      expect(sample.text.length).toBeGreaterThan(300)
    }
  })
})
