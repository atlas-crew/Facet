import { describe, expect, it } from 'vitest'
import {
  samplePipelineData,
  samplePipelineJobDescriptions,
} from '../routes/pipeline/samplePipelineData'

describe('sample pipeline data', () => {
  it('includes job descriptions that can drive JD analysis demos', () => {
    const expectedDescriptionsByCompany = new Map([
      ['Acme Corp', samplePipelineJobDescriptions.acme],
      ['Initech', samplePipelineJobDescriptions.initech],
      ['Globex Corporation', samplePipelineJobDescriptions.globex],
    ])
    const requiredSignalsByCompany = new Map([
      ['Acme Corp', ['Platform Engineer', 'Kubernetes', 'Terraform', 'developer velocity']],
      ['Initech', ['Security Engineer', 'AWS', 'GitHub Actions', 'threat modeling']],
      ['Globex Corporation', ['Developer Productivity Engineer', 'CI pipelines', 'monorepo', 'Go experience']],
    ])

    expect(Object.values(samplePipelineJobDescriptions)).toHaveLength(samplePipelineData.length)

    for (const entry of samplePipelineData) {
      expect(entry.jobDescription).toBe(expectedDescriptionsByCompany.get(entry.company))
      for (const signal of requiredSignalsByCompany.get(entry.company) ?? []) {
        expect(entry.jobDescription).toContain(signal)
      }
      expect(entry.jobDescription.trim().split(/\s+/).length).toBeGreaterThanOrEqual(40)
      expect(entry.jobDescriptionSourceUrl).toBe(entry.url)
      expect(entry.jdAnalysisId ?? null).toBeNull()
    }
  })
})
