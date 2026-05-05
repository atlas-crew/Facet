import { describe, expect, it } from 'vitest'
import {
  normalizeJobDescriptionSourceUrl,
  normalizeJobDescriptionText,
} from '../utils/jobDescriptionText'

describe('jobDescriptionText', () => {
  it('normalizes source URLs with http protocols and optional same-origin gating', () => {
    expect(normalizeJobDescriptionSourceUrl(' https://example.com/jobs/1 ')).toBe(
      'https://example.com/jobs/1',
    )
    expect(normalizeJobDescriptionSourceUrl('https://source.example/jobs/1', '   ')).toBe(
      'https://source.example/jobs/1',
    )
    expect(
      normalizeJobDescriptionSourceUrl(
        'https://example.com/jobs/1?ref=facet',
        'https://example.com/careers',
      ),
    ).toBe('https://example.com/jobs/1?ref=facet')
    expect(
      normalizeJobDescriptionSourceUrl(
        'https://other.example/jobs/1',
        'https://example.com/careers',
      ),
    ).toBeUndefined()
    expect(
      normalizeJobDescriptionSourceUrl('https://example.com/jobs/1', 'not a valid url'),
    ).toBeUndefined()
  })

  it('rejects unsafe or malformed source URL inputs', () => {
    for (const value of [
      null,
      undefined,
      42,
      '',
      '   ',
      'not a url',
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      'file:///etc/passwd',
      'ftp://example.com/jobs/1',
    ]) {
      expect(normalizeJobDescriptionSourceUrl(value)).toBeUndefined()
    }
  })

  it('normalizes job description text and caps by byte budget', () => {
    expect(normalizeJobDescriptionText(42)).toBe('')
    expect(normalizeJobDescriptionText('   ')).toBe('')

    const capped = normalizeJobDescriptionText('  ' + 'A'.repeat(50_000) + '\uD83D' + '  ')
    expect(capped).toHaveLength(50_000)
    expect(capped).not.toMatch(/[\uD800-\uDBFF]$/)
  })
})
