import { describe, expect, it } from 'vitest'
import {
  getThemeFontFiles,
  getThemePreset,
  normalizeThemeState,
  resolveTheme,
  resolveThemeFontFamily,
  sanitizeThemeOverrides,
} from '../themes/theme'

describe('theme helpers', () => {
  it('defaults to ferguson v1.2 when theme is missing', () => {
    const normalized = normalizeThemeState(undefined)
    expect(normalized).toEqual({ preset: 'ferguson-v12' })
  })

  it('upgrades legacy preset IDs and override keys', () => {
    const normalized = normalizeThemeState({
      preset: 'editorial-dense' as never,
      overrides: {
        sectionGap: 9 as never,
      } as never,
    })

    expect(normalized).toEqual({
      preset: 'ferguson-v12',
      overrides: {
        sectionGapBefore: 9,
      },
    })
  })

  it('sanitizes override colors and removes values equal to preset defaults', () => {
    const normalized = normalizeThemeState({
      preset: 'clean-modern',
      overrides: {
        colorSection: '#0A0A0A',
        sizeBody: 10,
      },
    })

    expect(normalized).toEqual({
      preset: 'clean-modern',
      overrides: {
        colorSection: '0a0a0a',
      },
    })
  })

  it('merges sparse overrides onto the selected preset', () => {
    const resolved = resolveTheme({
      preset: 'minimal',
      overrides: {
        marginLeft: 0.8,
        bulletChar: 'none',
      },
    })

    expect(resolved.id).toBe('minimal')
    expect(resolved.marginLeft).toBe(0.8)
    expect(resolved.bulletChar).toBe('none')
    expect(resolved.fontBody).toBe('IBM Plex Sans')
  })

  it('maps legacy font overrides to embedded font families', () => {
    const normalized = normalizeThemeState({
      preset: 'ferguson-v12',
      overrides: {
        fontBody: 'Calibri',
        fontHeading: 'Times New Roman',
      },
    })

    expect(normalized).toEqual({
      preset: 'ferguson-v12',
      overrides: {
        fontHeading: 'Source Serif 4',
      },
    })
  })

  it('rejects NaN number overrides', () => {
    const result = sanitizeThemeOverrides(
      { sizeBody: NaN },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects number overrides with no bounds entry', () => {
    const result = sanitizeThemeOverrides(
      { unknownNumericKey: 42 } as never,
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects invalid color strings', () => {
    const result = sanitizeThemeOverrides(
      { colorBody: 'not-a-color' },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects invalid sectionHeaderStyle values', () => {
    const result = sanitizeThemeOverrides(
      { sectionHeaderStyle: 'invalid' as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects invalid bulletChar values', () => {
    const result = sanitizeThemeOverrides(
      { bulletChar: 'x' as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects invalid nameAlignment values', () => {
    const result = sanitizeThemeOverrides(
      { nameAlignment: 'justify' as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('rejects invalid datesAlignment values', () => {
    const result = sanitizeThemeOverrides(
      { datesAlignment: 'stacked' as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('accepts valid contactAlignment override', () => {
    const result = sanitizeThemeOverrides(
      { contactAlignment: 'right' },
      'ferguson-v12',
    )
    expect(result).toEqual({ contactAlignment: 'right' })
  })

  it('rejects boolean values for non-boolean keys', () => {
    const result = sanitizeThemeOverrides(
      { sizeBody: true as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('clamps out-of-range number overrides', () => {
    const result = sanitizeThemeOverrides(
      { sizeBody: 100 },
      'ferguson-v12',
    )
    // sizeBody max is 14, preset default is 9
    expect(result).toEqual({ sizeBody: 14 })
  })

  it('strips undefined/null override values', () => {
    const result = sanitizeThemeOverrides(
      { colorBody: undefined as never, sizeBody: null as never },
      'ferguson-v12',
    )
    expect(result).toBeUndefined()
  })

  it('returns undefined for completely undefined overrides', () => {
    const result = sanitizeThemeOverrides(undefined, 'ferguson-v12')
    expect(result).toBeUndefined()
  })

  it('falls back to default preset for unknown preset string', () => {
    const normalized = normalizeThemeState({ preset: 'nonexistent' as never })
    expect(normalized.preset).toBe('ferguson-v12')
  })
})

describe('getThemePreset', () => {
  it('returns a copy of the preset', () => {
    const a = getThemePreset('minimal')
    const b = getThemePreset('minimal')
    expect(a).toEqual(b)
    expect(a).not.toBe(b) // different object references
  })

  it('exposes additional one-click style presets', () => {
    expect(getThemePreset('executive-serif').fontBody).toBe('PT Serif')
    expect(getThemePreset('modern-contrast').fontHeading).toBe('IBM Plex Serif')
    expect(getThemePreset('signal-clean').fontHeading).toBe('PT Serif')
  })
})

describe('resolveThemeFontFamily', () => {
  it('resolves known alias', () => {
    expect(resolveThemeFontFamily('calibri')).toBe('Inter')
    expect(resolveThemeFontFamily('Arial')).toBe('IBM Plex Sans')
    expect(resolveThemeFontFamily('Georgia')).toBe('PT Serif')
  })

  it('passes through unknown font families', () => {
    expect(resolveThemeFontFamily('Custom Font')).toBe('Custom Font')
  })
})

describe('getThemeFontFiles', () => {
  it('returns font files for known families', () => {
    const files = getThemeFontFiles({ fontBody: 'Inter', fontHeading: 'DM Sans' })
    expect(files).toContain('/fonts/inter/Inter-Regular.ttf')
    expect(files).toContain('/fonts/dm-sans/DMSans-Regular.ttf')
  })

  it('returns files for newly added serif families', () => {
    const files = getThemeFontFiles({ fontBody: 'PT Serif', fontHeading: 'IBM Plex Serif' })
    expect(files).toContain('/fonts/pt-serif/PTSerif-Regular.ttf')
    expect(files).toContain('/fonts/ibm-plex-serif/IBMPlexSerif-Regular.ttf')
  })

  it('deduplicates when body and heading use the same font', () => {
    const files = getThemeFontFiles({ fontBody: 'Inter', fontHeading: 'Inter' })
    const uniqueCheck = new Set(files)
    expect(files.length).toBe(uniqueCheck.size)
  })

  it('returns empty array for unknown font families', () => {
    const files = getThemeFontFiles({ fontBody: 'Unknown', fontHeading: 'Unknown' })
    expect(files).toEqual([])
  })
})
