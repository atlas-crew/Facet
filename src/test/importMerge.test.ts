import { describe, expect, it } from 'vitest'
import { mergeResumeData } from '../engine/importMerge'
import { defaultResumeData } from '../store/defaultData'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('importMerge', () => {
  it('adds only new components and skips duplicates by id', () => {
    const current = clone(defaultResumeData)
    const incoming = clone(defaultResumeData)
    incoming.target_lines.push({
      id: 'tl-new',
      text: 'New target line',
      vectors: { backend: 'strong' },
    })
    incoming.profiles[0].text = 'changed text should be ignored for duplicate profile id'

    const merged = mergeResumeData(current, incoming)
    expect(merged.target_lines.some((line) => line.id === 'tl-new')).toBe(true)
    expect(merged.profiles[0].text).toBe(current.profiles[0].text)
  })

  it('merges bullets for existing roles while preserving existing bullets', () => {
    const current = clone(defaultResumeData)
    const incoming = clone(defaultResumeData)
    incoming.roles = [
      {
        ...incoming.roles[0],
        bullets: [
          ...incoming.roles[0].bullets,
          {
            id: 'acme-b4',
            text: 'New imported bullet',
            vectors: { backend: 'optional' },
          },
        ],
      },
    ]

    const merged = mergeResumeData(current, incoming)
    const role = merged.roles.find((item) => item.id === 'acme')
    expect(role?.bullets.some((bullet) => bullet.id === 'acme-b4')).toBe(true)
    expect(role?.bullets.some((bullet) => bullet.id === 'acme-b1')).toBe(true)
  })

  it('merges presets by id while preserving existing presets', () => {
    const current = clone(defaultResumeData)
    current.presets = [
      {
        id: 'preset-1',
        name: 'Existing',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        baseVector: 'backend',
        overrides: {
          manualOverrides: {},
          variantOverrides: {},
          bulletOrders: {},
        },
      },
    ]

    const incoming = clone(defaultResumeData)
    incoming.presets = [
      {
        id: 'preset-2',
        name: 'Incoming',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        baseVector: 'platform',
        overrides: {
          manualOverrides: {},
          variantOverrides: {},
          bulletOrders: {},
        },
      },
    ]

    const merged = mergeResumeData(current, incoming)
    expect(merged.presets?.map((preset) => preset.id)).toEqual(['preset-1', 'preset-2'])
  })
})
