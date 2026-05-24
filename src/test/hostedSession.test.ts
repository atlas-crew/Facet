import { afterEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}))

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

function configureHostedEnv() {
  vi.stubEnv('VITE_FACET_DEPLOYMENT_MODE', 'hosted')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.example')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
}

function configureSupabaseClient() {
  supabaseMocks.createClient.mockReturnValue({
    auth: {
      signOut: supabaseMocks.signOut,
    },
  })
}

async function importHostedSession() {
  vi.resetModules()
  configureHostedEnv()
  configureSupabaseClient()
  return import('../utils/hostedSession')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  supabaseMocks.createClient.mockReset()
  supabaseMocks.signOut.mockReset()
})

describe('hostedSession admin role hints', () => {
  it('reads admin role hints from unexpired JWT payloads', async () => {
    const { readUntrustedHostedAdminRoleHintFromToken } = await importHostedSession()
    const token = buildToken({
      exp: Math.floor(Date.now() / 1000) + 60,
      app_metadata: { role: 'admin' },
    })

    expect(readUntrustedHostedAdminRoleHintFromToken(token)).toBe('admin')
  })

  it('handles expired, malformed, and non-admin payloads', async () => {
    const { readUntrustedHostedAdminRoleHintFromToken } = await importHostedSession()
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

describe('hostedSession sign out', () => {
  it('signs out with the Supabase default server-revoking scope', async () => {
    supabaseMocks.signOut.mockResolvedValue({ error: null })
    const { signOutHostedSession } = await importHostedSession()

    await signOutHostedSession()

    expect(supabaseMocks.signOut).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.signOut).toHaveBeenCalledWith()
  })

  it('throws when the Supabase client is unconfigured', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_FACET_DEPLOYMENT_MODE', 'hosted')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    const { signOutHostedSession } = await import('../utils/hostedSession')

    await expect(signOutHostedSession()).rejects.toThrow('Supabase client is not configured.')
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
  })

  it('propagates Supabase sign-out errors', async () => {
    supabaseMocks.signOut.mockResolvedValue({ error: new Error('Supabase sign out failed') })
    const { signOutHostedSession } = await importHostedSession()

    await expect(signOutHostedSession()).rejects.toThrow('Supabase sign out failed')
  })
})
