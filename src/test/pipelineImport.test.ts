import { describe, expect, it } from 'vitest'
import { validatePipelineImportEntry } from '../utils/pipelineImport'

const baseImportEntry = {
  id: 'pipe-import-1',
  company: 'ImportCo',
  role: 'Staff Platform Engineer',
  tier: '2',
  status: 'researching',
  url: 'https://example.com/jobs/1',
}

describe('pipelineImport', () => {
  it('normalizes imported job description text and same-origin source URLs', () => {
    const entry = validatePipelineImportEntry({
      ...baseImportEntry,
      jobDescription: '  Own platform reliability.  ',
      jobDescriptionSourceUrl: 'https://example.com/jobs/1?source=facet',
    })

    expect(entry?.jobDescription).toBe('Own platform reliability.')
    expect(entry?.jobDescriptionSourceUrl).toBe('https://example.com/jobs/1?source=facet')
  })

  it('caps imported job descriptions and drops invalid source URLs without dropping manual text', () => {
    const entry = validatePipelineImportEntry({
      ...baseImportEntry,
      jobDescription: 'A'.repeat(60_000),
      jobDescriptionSourceUrl: 'https://other.example/jobs/1',
    })

    expect(entry?.jobDescription).toHaveLength(50_000)
    expect(entry?.jobDescriptionSourceUrl).toBeNull()
  })

  it('coerces non-string job descriptions and unsafe source URLs to empty defaults', () => {
    const entry = validatePipelineImportEntry({
      ...baseImportEntry,
      jobDescription: 42,
      jobDescriptionSourceUrl: 'javascript:alert(1)',
    })

    expect(entry?.jobDescription).toBe('')
    expect(entry?.jobDescriptionSourceUrl).toBeNull()
  })
})
