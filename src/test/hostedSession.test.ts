import { describe, expect, it } from 'vitest'
import { readUntrustedHostedAdminRoleHintFromToken } from '../utils/hostedSession'

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function buildToken(payload: Record<string, unknown>): string {
  return [
    encodeBase64Url(JSON.stringify({ alg: 'none' })),
    encodeBase64Url(JSON.stringify(payload)),
    'signature',
  ].join('.')
}

describe('hostedSession admin role hints', () => {
  it('reads admin role hints from unexpired JWT payloads', () => {
    const token = buildToken({
      exp: Math.floor(Date.now() / 1000) + 60,
      app_metadata: { role: 'admin' },
    })

    expect(readUntrustedHostedAdminRoleHintFromToken(token)).toBe('admin')
  })

  it('handles expired, malformed, and non-admin payloads', () => {
    const expired = buildToken({
      exp: Math.floor(Date.now() / 1000) - 60,
      app_metadata: { role: 'admin' },
    })
    const member = buildToken({
      exp: Math.floor(Date.now() / 1000) + 60,
      app_metadata: { role: 'member' },
    })

    expect(readUntrustedHostedAdminRoleHintFromToken(expired)).toBeNull()
    expect(readUntrustedHostedAdminRoleHintFromToken('not-a-jwt')).toBeNull()
    expect(readUntrustedHostedAdminRoleHintFromToken(member)).toBe('member')
    expect(readUntrustedHostedAdminRoleHintFromToken(buildToken({}))).toBeNull()
  })
})
