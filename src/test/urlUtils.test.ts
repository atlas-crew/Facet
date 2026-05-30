import { describe, expect, it } from 'vitest'
import { sanitizeEndpointUrl } from '../utils/urlUtils'

describe('sanitizeEndpointUrl', () => {
  it('rejects empty, malformed, credentialed, and unsafe URLs', () => {
    expect(sanitizeEndpointUrl(undefined)).toBe('')
    expect(sanitizeEndpointUrl('')).toBe('')
    expect(sanitizeEndpointUrl('not a url')).toBe('')
    expect(sanitizeEndpointUrl('https://user@ai.example/proxy')).toBe('')
    expect(sanitizeEndpointUrl('https://user:pass@ai.example/proxy')).toBe('')
    expect(sanitizeEndpointUrl('http://evil.example/proxy')).toBe('')
    expect(sanitizeEndpointUrl('ftp://example.com/proxy')).toBe('')
    expect(sanitizeEndpointUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeEndpointUrl('file:///etc/passwd')).toBe('')
  })

  it('accepts https endpoints and local http development endpoints', () => {
    expect(sanitizeEndpointUrl('https://ai.example/proxy')).toBe('https://ai.example/proxy')
    expect(sanitizeEndpointUrl('https://ai.example')).toBe('https://ai.example/')
    expect(sanitizeEndpointUrl('http://localhost:3000/proxy')).toBe('http://localhost:3000/proxy')
    expect(sanitizeEndpointUrl('http://127.0.0.1:3000/proxy')).toBe('http://127.0.0.1:3000/proxy')
    expect(sanitizeEndpointUrl('http://[::1]:3000/proxy')).toBe('http://[::1]:3000/proxy')
  })
})
