import { describe, expect, it } from 'vitest'
import { assembleCoverLetterData, renderLetterAsText } from '../engine/letterAssembler'
import type { CoverLetterTemplate } from '../types/coverLetter'
import type { ResumeMeta } from '../types'

const mockMeta: ResumeMeta = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  location: 'San Francisco, CA',
  links: []
}

const mockTemplate: CoverLetterTemplate = {
  id: 't1',
  name: 'Test Template',
  header: 'Header for {{name}}',
  greeting: 'Dear {{company}} Manager,',
  signOff: 'Best, {{name}}',
  paragraphs: [
    {
      id: 'p1',
      text: 'Must for Vector A',
      vectors: { v1: 'must' }
    },
    {
      id: 'p2',
      text: 'Strong for Vector B',
      vectors: { v2: 'strong' }
    },
    {
      id: 'p3',
      text: 'Untagged paragraph',
      vectors: {}
    }
  ]
}

describe('letterAssembler', () => {
  const fixedDate = new Date(2026, 2, 9) // March 9, 2026 local time

  it('assembles data with correct vector filtering', () => {
    const data = assembleCoverLetterData(mockTemplate, {
      vectorId: 'v1',
      meta: mockMeta,
      variables: { name: 'John', company: 'Acme' },
      date: fixedDate
    })

    expect(data.paragraphs).toEqual(['Must for Vector A'])
    expect(data.greeting).toBe('Dear Acme Manager,')
    expect(data.date).toBe('March 9, 2026')
  })

  it('falls back to untagged paragraphs if vector does not match', () => {
    const data = assembleCoverLetterData(mockTemplate, {
      vectorId: 'v3', // non-existent vector
      meta: mockMeta,
      date: fixedDate
    })

    expect(data.paragraphs).toEqual(['Untagged paragraph'])
  })

  it('falls back to all paragraphs if no matches and no untagged exist', () => {
    const templateNoUntagged: CoverLetterTemplate = {
      ...mockTemplate,
      paragraphs: [
        { id: 'p1', text: 'P1', vectors: { v1: 'must' } }
      ]
    }

    const data = assembleCoverLetterData(templateNoUntagged, {
      vectorId: 'v2',
      meta: mockMeta
    })

    expect(data.paragraphs).toEqual(['P1'])
  })

  it('resolves variables in all fields', () => {
    const data = assembleCoverLetterData(mockTemplate, {
      vectorId: 'v1',
      meta: mockMeta,
      variables: { name: 'John', company: 'Acme' },
      recipient: 'Hiring Lead at {{company}}'
    })

    expect(data.metadata.title).toBe('Test Template - John Doe')
    expect(data.recipient).toBe('Hiring Lead at Acme')
    expect(data.greeting).toBe('Dear Acme Manager,')
    expect(data.signOff).toBe('Best, John')
  })

  it('renders text version correctly', () => {
    const payload = assembleCoverLetterData(mockTemplate, {
      vectorId: 'v1',
      meta: mockMeta,
      variables: { name: 'John', company: 'Acme' },
      date: fixedDate,
      recipient: 'Acme Corp'
    })

    const text = renderLetterAsText(payload)
    
    expect(text).toContain('John Doe')
    expect(text).toContain('San Francisco, CA | john@example.com | 555-1234')
    expect(text).toContain('March 9, 2026')
    expect(text).toContain('Acme Corp')
    expect(text).toContain('Dear Acme Manager,')
    expect(text).toContain('Must for Vector A')
    expect(text).toContain('Best, John')
  })

  it('handles empty or whitespace contact fields correctly', () => {
    const sparseMeta = { ...mockMeta, location: '  ', phone: '' }
    const data = assembleCoverLetterData(mockTemplate, {
      vectorId: 'v1',
      meta: sparseMeta as ResumeMeta
    })

    expect(data.contactLine).toBe('john@example.com')
  })
})