import { describe, expect, it } from 'vitest'
import { exportResumeConfig, importResumeConfig } from '../engine/serializer'
import { defaultResumeData } from '../store/defaultData'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('serializer', () => {
  it('rejects empty input', () => {
    expect(() => importResumeConfig('   ')).toThrow(/empty/i)
  })

  it('rejects malformed json and yaml', () => {
    expect(() => importResumeConfig('{"version":')).toThrow(/Failed to parse JSON/)
    expect(() => importResumeConfig('version: 1\nmeta: [')).toThrow(/Failed to parse YAML/)
  })

  it('rejects oversized input payloads', () => {
    expect(() => importResumeConfig('a'.repeat(500_001))).toThrow(/too large/i)
  })

  it('rejects invalid priority and missing required fields', () => {
    const invalidPriority = clone(defaultResumeData)
    invalidPriority.target_lines[0].vectors.backend = 'critical' as never
    expect(() => importResumeConfig(JSON.stringify(invalidPriority))).toThrow(/must, strong, optional, exclude/)

    const missingName = clone(defaultResumeData) as unknown as Record<string, unknown>
    delete (missingName.meta as Record<string, unknown>).name
    expect(() => importResumeConfig(JSON.stringify(missingName))).toThrow(/meta.name/)
  })

  it('accepts contact links without labels', () => {
    const source = clone(defaultResumeData)
    source.meta.links = [{ url: 'github.com/janesmith' }]

    const parsed = importResumeConfig(JSON.stringify(source), 'json')
    expect(parsed.data.meta.links).toEqual([{ url: 'github.com/janesmith' }])
  })

  it('rejects unknown theme presets and malformed override keys', () => {
    const invalidThemePreset = clone(defaultResumeData)
    invalidThemePreset.theme = { preset: 'future-mode' as never }
    expect(() => importResumeConfig(JSON.stringify(invalidThemePreset))).toThrow(/theme.preset/)

    const invalidThemeOverride = clone(defaultResumeData)
    invalidThemeOverride.theme = {
      preset: 'ferguson-v12',
      overrides: { hackerMode: true } as never,
    }
    expect(() => importResumeConfig(JSON.stringify(invalidThemeOverride))).toThrow(
      /supported theme override/i,
    )
  })

  it('upgrades legacy theme preset aliases and override keys', () => {
    const legacyTheme = clone(defaultResumeData)
    legacyTheme.theme = {
      preset: 'editorial-dense' as never,
      overrides: {
        sectionGap: 11,
      } as never,
    }

    const parsed = importResumeConfig(JSON.stringify(legacyTheme), 'json')
    expect(parsed.data.theme).toEqual({
      preset: 'ferguson-v12',
      overrides: {
        sectionGapBefore: 11,
      },
    })
  })

  it('rejects duplicate ids by component type', () => {
    const duplicateRoleId = clone(defaultResumeData)
    duplicateRoleId.roles.push({
      ...duplicateRoleId.roles[0],
    })
    expect(() => importResumeConfig(JSON.stringify(duplicateRoleId))).toThrow(/duplicate id/i)
  })

  it('rejects missing required top-level arrays', () => {
    const missingRoles = clone(defaultResumeData) as unknown as Record<string, unknown>
    delete missingRoles.roles
    expect(() => importResumeConfig(JSON.stringify(missingRoles))).toThrow(/roles must be an array/)
  })

  it('rejects invalid version types and NaN', () => {
    const invalidVersion = clone(defaultResumeData) as unknown as Record<string, unknown>
    invalidVersion.version = '1'
    expect(() => importResumeConfig(JSON.stringify(invalidVersion))).toThrow(/version must be a number/)

    const nanVersion = `version: .nan
meta:
  name: Jane
  email: jane@example.com
  phone: '555'
  location: SF
  links: []
vectors: []
target_lines: []
profiles: []
skill_groups: []
roles: []
projects: []
education: []
`
    expect(() => importResumeConfig(nanVersion)).toThrow(/version must be a number/)
  })

  it('round-trips yaml and json exports', () => {
    const source = clone(defaultResumeData)

    const yaml = exportResumeConfig(source)
    const fromYaml = importResumeConfig(yaml)
    expect(fromYaml.format).toBe('yaml')
    expect(fromYaml.data).toEqual(source)
    expect(fromYaml.warnings).toEqual([])

    const json = exportResumeConfig(source, 'json')
    const fromJson = importResumeConfig(json)
    expect(fromJson.format).toBe('json')
    expect(fromJson.data).toEqual(source)
    expect(fromJson.warnings).toEqual([])
  })

  it('supports explicit import format hints', () => {
    const source = clone(defaultResumeData)
    const yaml = exportResumeConfig(source, 'yaml')

    const parsedYaml = importResumeConfig(yaml, 'yaml')
    expect(parsedYaml.format).toBe('yaml')
    expect(parsedYaml.data).toEqual(source)
    expect(() => importResumeConfig(yaml, 'json')).toThrow(/Failed to parse JSON/)
  })

  it('round-trips theme preset and sparse overrides', () => {
    const source = clone(defaultResumeData)
    source.theme = {
      preset: 'clean-modern',
      overrides: {
        fontBody: 'Helvetica',
        marginLeft: 0.9,
        colorSection: '#0a0a0a' as never,
      },
    }

    const parsed = importResumeConfig(exportResumeConfig(source, 'json'), 'json')
    expect(parsed.data.theme?.preset).toBe('clean-modern')
    expect(parsed.data.theme?.overrides).toEqual({
      fontBody: 'Helvetica',
      marginLeft: 0.9,
      colorSection: '0a0a0a',
    })
  })

  it('rejects forbidden object keys in imported data', () => {
    const source = exportResumeConfig(clone(defaultResumeData), 'json')
    const withProto = source.replace('{', '{"__proto__":{"polluted":true},')
    expect(() => importResumeConfig(withProto, 'json')).toThrow(/unsupported key/i)
  })

  it('rejects YAML tags outside the JSON schema', () => {
    const tagged = `version: 1
meta: !!js/function >
  function () { return "not-allowed"; }
vectors: []
target_lines: []
profiles: []
skill_groups: []
roles: []
projects: []
education: []
`

    expect(() => importResumeConfig(tagged)).toThrow(/Failed to parse YAML/)
  })

  it('auto-creates missing vectors from references and returns warnings', () => {
    const source = clone(defaultResumeData)
    source.vectors = source.vectors.filter((vector) => vector.id !== 'backend')

    const parsed = importResumeConfig(JSON.stringify(source), 'json')
    expect(parsed.data.vectors.some((vector) => vector.id === 'backend')).toBe(true)
    expect(parsed.warnings.some((warning) => warning.includes('Auto-created missing vector "backend"'))).toBe(
      true,
    )
  })

  it('warns on empty content and missing vector tags', () => {
    const source = clone(defaultResumeData)
    source.target_lines[0].text = ''
    source.target_lines[0].vectors = {}

    const parsed = importResumeConfig(JSON.stringify(source), 'json')
    expect(parsed.warnings.some((warning) => warning.includes('has empty text'))).toBe(true)
    expect(parsed.warnings.some((warning) => warning.includes('has no vector priorities'))).toBe(true)
  })

  it('upgrades legacy skill group order maps into vector settings', () => {
    const source = clone(defaultResumeData)
    source.skill_groups = [
      {
        id: 'legacy-skills',
        label: 'Legacy Skills',
        content: 'Go, Rust',
        order: { backend: 2, platform: 1, default: 3 },
      },
    ]

    const parsed = importResumeConfig(JSON.stringify(source), 'json')
    expect(parsed.data.skill_groups[0]?.vectors?.backend?.order).toBe(2)
    expect(parsed.data.skill_groups[0]?.vectors?.platform?.order).toBe(1)
    expect(parsed.data.skill_groups[0]?.vectors?.backend?.priority).toBe('strong')
  })

  it('supports presets in import/export schema', () => {
    const source = clone(defaultResumeData)
    source.presets = [
      {
        id: 'preset-1',
        name: 'Lumin-SRE',
        description: 'SRE-first framing',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        baseVector: 'backend',
        overrides: {
          manualOverrides: { 'role:acme:bullet:acme-b1': true },
          variantOverrides: {},
          bulletOrders: { acme: ['acme-b2', 'acme-b1'] },
          theme: {
            preset: 'minimal',
            overrides: { bulletChar: 'none' },
          },
          priorityOverrides: [
            { bulletId: 'acme-b1', vectorId: 'backend', priority: 'must' },
          ],
        },
      },
    ]

    const parsed = importResumeConfig(exportResumeConfig(source, 'json'), 'json')
    expect(parsed.data.presets?.[0]?.name).toBe('Lumin-SRE')
    expect(parsed.data.presets?.[0]?.overrides.bulletOrders.acme).toEqual([
      'acme-b2',
      'acme-b1',
    ])
    expect(parsed.data.presets?.[0]?.overrides.priorityOverrides?.[0]?.priority).toBe('must')
    expect(parsed.data.presets?.[0]?.overrides.theme).toEqual({
      preset: 'minimal',
      overrides: { bulletChar: 'none' },
    })
  })
})
