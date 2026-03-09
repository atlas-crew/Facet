import { describe, expect, it } from 'vitest'
import { parseJobDescription } from '../utils/jdParser'

describe('parseJobDescription', () => {
  it('returns empty fields for empty text', () => {
    const result = parseJobDescription('   \n  ')
    expect(result).toEqual({
      company: '',
      role: '',
      comp: '',
      location: '',
      jobDescription: ''
    })
  })

  it('extracts role, company, location, and comp from a typical LinkedIn paste', () => {
    const text = `Software Engineer, Backend
Google
Mountain View, CA (Hybrid)
$150,000/yr - $200,000/yr

About the job
We are looking for a backend engineer...`

    const result = parseJobDescription(text)
    
    expect(result.role).toBe('Software Engineer, Backend')
    expect(result.company).toBe('Google')
    expect(result.location).toBe('Mountain View, CA (Hybrid)')
    expect(result.comp).toBe('$150,000/yr - $200,000/yr')
    expect(result.jobDescription).toBe(text.trim())
  })

  it('extracts comp from deeper in the text', () => {
    const text = `Frontend Developer
Startup Inc

We are hiring a frontend developer.
Salary Range: $120k - $140k
Benefits include...`

    const result = parseJobDescription(text)
    
    expect(result.role).toBe('Frontend Developer')
    expect(result.company).toBe('Startup Inc')
    expect(result.comp).toBe('Salary Range: $120k - $140k')
  })

  it('handles short text gracefully', () => {
    const text = `Just a title`
    const result = parseJobDescription(text)
    
    expect(result.role).toBe('Just a title')
    expect(result.company).toBe('')
    expect(result.comp).toBe('')
  })

  it('deduplicates role and company if they are identical', () => {
    const text = `Senior Engineer\nSenior Engineer\nSan Francisco`
    const result = parseJobDescription(text)
    expect(result.role).toBe('Senior Engineer')
    expect(result.company).toBe('')
    expect(result.location).toBe('San Francisco')
  })

  it('supports en-dash and "to" in compensation ranges', () => {
    const dashResult = parseJobDescription(`Role\nCompany\n$100k – $150k`)
    expect(dashResult.comp).toBe('$100k – $150k')

    const toResult = parseJobDescription(`Role\nCompany\n$100k to $150k`)
    expect(toResult.comp).toBe('$100k to $150k')
  })

  it('preserves company name when comp is on the same line', () => {
    const text = `Senior Engineer\nAcme Corp · $150k - $200k\nSan Francisco, CA`
    const result = parseJobDescription(text)
    expect(result.role).toBe('Senior Engineer')
    expect(result.company).toBe('Acme Corp')
    expect(result.comp).toBe('Acme Corp · $150k - $200k')
    expect(result.location).toBe('San Francisco, CA')
  })
})