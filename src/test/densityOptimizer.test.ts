import { describe, expect, it, vi } from 'vitest'
import { findOptimalDensity } from '../utils/densityOptimizer'
import { renderResumeAsPdf } from '../utils/typstRenderer'
import { getThemePreset } from '../themes/theme'
import { buildAssembledResume } from './fixtures/assembledResume'

vi.mock('../utils/typstRenderer', () => ({
  renderResumeAsPdf: vi.fn(),
}))

const theme = getThemePreset('ferguson-v12')
const resume = buildAssembledResume()

describe('densityOptimizer', () => {
  it('converges toward target page count', async () => {
    vi.mocked(renderResumeAsPdf).mockImplementation(async (_resume, theme) => {
      // Simulate: multiplier < 0.9 fits in 1 page, else 2
      const isTight = theme.sectionGapBefore < 13
      return {
        pageCount: isTight ? 1 : 2,
        bytes: new Uint8Array(),
        blob: new Blob(),
        generatedAt: '',
      }
    })

    const result = await findOptimalDensity(resume, theme, 1)
    
    expect(result.finalPageCount).toBe(1)
    expect(result.iterations).toBeGreaterThan(0)
    // ferguson-v12 sectionGapBefore is 14. 14 * 0.9 = 12.6 (< 13)
    expect(result.overrides.sectionGapBefore).toBeLessThan(13)
  })

  it('updates bestOverrides only when content fits', async () => {
    let callCount = 0
    vi.mocked(renderResumeAsPdf).mockImplementation(async () => {
      callCount++
      // First call (1.0) = 3 pages (too many)
      // Subsequent calls = 2 pages (fits)
      return {
        pageCount: callCount === 1 ? 3 : 2,
        bytes: new Uint8Array(),
        blob: new Blob(),
        generatedAt: '',
      }
    })

    const result = await findOptimalDensity(resume, theme, 2)
    expect(result.overrides).not.toEqual({})
    expect(result.finalPageCount).toBe(2)
  })

  it('returns empty overrides when resume never fits', async () => {
    vi.mocked(renderResumeAsPdf).mockResolvedValue({
      pageCount: 3,
      bytes: new Uint8Array(),
      blob: new Blob(),
      generatedAt: '',
    })

    const result = await findOptimalDensity(resume, theme, 2)
    expect(result.overrides).toEqual({})
    expect(result.finalPageCount).toBe(3)
  })

  it('rounds overrides to 3 decimal places', async () => {
    vi.mocked(renderResumeAsPdf).mockResolvedValue({
      pageCount: 1,
      bytes: new Uint8Array(),
      blob: new Blob(),
      generatedAt: '',
    })

    const result = await findOptimalDensity(resume, theme, 1, 1)
    const val = result.overrides.sectionGapBefore!
    const valStr = val.toString()
    if (valStr.includes('.')) {
      const decimals = valStr.split('.')[1]
      expect(decimals.length).toBeLessThanOrEqual(3)
    }
  })

  it('skips non-numeric density keys', async () => {
    vi.mocked(renderResumeAsPdf).mockResolvedValue({
      pageCount: 1,
      bytes: new Uint8Array(),
      blob: new Blob(),
      generatedAt: '',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately testing invalid input
    const weirdTheme = { ...theme, sectionGapBefore: 'not-a-number' as any }
    const result = await findOptimalDensity(resume, weirdTheme, 1, 1)
    expect(result.overrides.sectionGapBefore).toBeUndefined()
  })

  it('respects maxIterations cap', async () => {
    vi.mocked(renderResumeAsPdf).mockResolvedValue({
      pageCount: 2,
      bytes: new Uint8Array(),
      blob: new Blob(),
      generatedAt: '',
    })

    const result = await findOptimalDensity(resume, theme, 1, 3)
    expect(result.iterations).toBe(3)
  })
})
