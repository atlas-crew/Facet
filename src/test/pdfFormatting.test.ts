import { describe, expect, it } from 'vitest'
import { buildResumePdfFileName } from '../utils/pdfFormatting'

describe('pdfFormatting', () => {
  it('builds vector-aware pdf filenames from candidate and vector labels', () => {
    const fileName = buildResumePdfFileName('Alex Example', 'security-platform', [
      { id: 'security-platform', label: 'Security Platform', color: '#000000' },
    ])

    expect(fileName).toBe('AlexExample_Resume_SecurityPlatform.pdf')
  })

  it('uses AllVectors suffix when selection is all', () => {
    const fileName = buildResumePdfFileName('Alex Example', 'all', [])
    expect(fileName).toBe('AlexExample_Resume_AllVectors.pdf')
  })

  it.each([
    {
      name: 'Cher',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'Backend', color: '#000000' }],
      expected: 'Cher_Resume_Backend.pdf',
    },
    {
      name: 'Mary Jane Watson',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'Backend', color: '#000000' }],
      expected: 'MaryWatson_Resume_Backend.pdf',
    },
    {
      name: '   ',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'Backend', color: '#000000' }],
      expected: 'Resume_Resume_Backend.pdf',
    },
    {
      name: '',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'Backend', color: '#000000' }],
      expected: 'Resume_Resume_Backend.pdf',
    },
    {
      name: "Mary O'Brien",
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'C++ / Systems', color: '#000000' }],
      expected: 'MaryOBrien_Resume_CSystems.pdf',
    },
    {
      name: 'José García',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: 'Backend', color: '#000000' }],
      expected: 'JosGarca_Resume_Backend.pdf',
    },
    {
      name: 'Jane Doe',
      selectedVector: 'unknown-vector',
      vectors: [],
      expected: 'JaneDoe_Resume_unknownvector.pdf',
    },
    {
      name: 'Jane Doe',
      selectedVector: 'backend',
      vectors: [{ id: 'backend', label: '---', color: '#000000' }],
      expected: 'JaneDoe_Resume_Resume.pdf',
    },
  ])('handles edge-case filename shaping: $expected', ({ name, selectedVector, vectors, expected }) => {
    expect(buildResumePdfFileName(name, selectedVector, vectors)).toBe(expected)
  })
})
