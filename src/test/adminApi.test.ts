import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

async function loadProxyModules() {
  const [
    { createFacetServer },
    { createInMemoryHostedWorkspaceStore },
    { requireAdmin, createInMemoryAdminStore, createPostgresAdminStore },
  ] = await Promise.all([
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/facetServer.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/hostedWorkspaceStore.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/adminApi.js'),
  ])

  return {
    createFacetServer,
    createInMemoryHostedWorkspaceStore,
    requireAdmin,
    createInMemoryAdminStore,
    createPostgresAdminStore,
  }
}

async function buildHostedAuthFixture() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(publicKey)
  return {
    privateKey,
    jwks: {
      keys: [
        {
          ...publicJwk,
          alg: 'RS256',
          kid: 'facet-test-key',
          use: 'sig',
        },
      ],
    },
  }
}

async function createHostedSessionToken(
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'],
  options: {
    appMetadata?: Record<string, unknown>
  } = {},
) {
  return new SignJWT({
    email: 'member@example.com',
    ...(options.appMetadata ? { app_metadata: options.appMetadata } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject('user-1')
    .setIssuer('https://supabase.example/auth/v1')
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey)
}

async function createForgedAdminToken() {
  const { privateKey } = await generateKeyPair('RS256')
  return new SignJWT({
    email: 'member@example.com',
    app_metadata: { role: 'admin' },
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject('user-1')
    .setIssuer('https://supabase.example/auth/v1')
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey)
}

async function startHostedAdminServer(
  records: Array<Record<string, unknown>> = [],
  options: {
    hostedRateLimits?: {
      adminReads?: { max: number; windowMs: number }
    }
  } = {},
) {
  const { createFacetServer, createInMemoryHostedWorkspaceStore, createInMemoryAdminStore } =
    await loadProxyModules()
  const hosted = await buildHostedAuthFixture()
  const workspaceStore = createInMemoryHostedWorkspaceStore({
    actors: [
      {
        tenantId: 'tenant-1',
        accountId: 'account-1',
        userId: 'user-1',
        email: 'member@example.com',
        workspaces: [
          {
            workspaceId: 'ws-1',
            role: 'owner',
            isDefault: true,
          },
        ],
      },
    ],
  })
  const { server } = createFacetServer({
    authMode: 'hosted',
    allowedOrigins: ['http://localhost:5173'],
    proxyApiKey: 'proxy-key',
    hostedAuth: {
      issuer: 'https://supabase.example/auth/v1',
      audience: 'authenticated',
      jwks: hosted.jwks,
    },
    hostedWorkspaceStore: workspaceStore,
    adminStore: createInMemoryAdminStore(records),
    hostedRateLimits: options.hostedRateLimits,
    anthropicClient: {
      messages: {
        create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
      },
    },
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind hosted admin test server.')
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: await createHostedSessionToken(hosted.privateKey),
    createAccessToken: (tokenOptions = {}) =>
      createHostedSessionToken(hosted.privateKey, tokenOptions),
  }
}

describe('adminApi', () => {
  const servers = new Set<import('node:http').Server>()

  afterEach(async () => {
    await Promise.all(
      [...servers].map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error)
                return
              }
              resolve()
            })
          }),
      ),
    )
    servers.clear()
  })

  it.each([
    ['missing claims', undefined],
    ['missing app metadata', { sub: 'user-1' }],
    ['non-admin role', { sub: 'user-1', app_metadata: { role: 'member' } }],
    ['admin role without a verified hosted actor', { sub: 'user-1', app_metadata: { role: 'admin' } }],
  ])('requireAdmin rejects %s', async (_label, claims) => {
    const { requireAdmin } = await loadProxyModules()
    const sendJson = vi.fn()
    const logger = { warn: vi.fn() }
    const next = vi.fn()

    requireAdmin(
      {
        _facetHostedClaims: claims,
        _facetHostedActor: { userId: 'user-1' },
      },
      {},
      next,
      { sendJson, logger },
    )

    expect(next).not.toHaveBeenCalled()
    expect(sendJson).toHaveBeenCalledWith({}, 403, {
      error: 'Admin access required.',
      code: 'admin_required',
    })
    expect(logger.warn).toHaveBeenCalledWith('[proxy] admin_auth_denied', {
      user_id: 'user-1',
    })
  })

  it('requireAdmin calls next for admin claims', async () => {
    const { requireAdmin } = await loadProxyModules()
    const sendJson = vi.fn()
    const logger = { warn: vi.fn() }
    const next = vi.fn()

    requireAdmin(
      {
        _facetHostedClaims: { sub: 'user-1', app_metadata: { role: 'admin' } },
        _facetHostedActor: { userId: 'user-1', authMode: 'hosted' },
      },
      {},
      next,
      { sendJson, logger },
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(sendJson).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('requires admin claims for hosted admin webhook receipts', async () => {
    const { server, baseUrl, accessToken } = await startHostedAdminServer()
    servers.add(server)

    const denied = await fetch(`${baseUrl}/admin/webhooks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(denied.status).toBe(403)
    await expect(denied.json()).resolves.toEqual({
      error: 'Admin access required.',
      code: 'admin_required',
    })
  })

  it('returns 401 for invalid hosted admin bearer tokens', async () => {
    const { server, baseUrl } = await startHostedAdminServer()
    servers.add(server)

    const denied = await fetch(`${baseUrl}/admin/webhooks`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token',
        Origin: 'http://localhost:5173',
      },
    })

    expect(denied.status).toBe(401)
    await expect(denied.json()).resolves.toEqual({
      error: 'Authorization required.',
      code: 'auth_required',
    })
  })

  it('rejects forged admin JWT payloads that are not signed by the hosted JWKS', async () => {
    const { server, baseUrl } = await startHostedAdminServer()
    servers.add(server)
    const forgedAdminToken = await createForgedAdminToken()

    const denied = await fetch(`${baseUrl}/admin/webhooks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${forgedAdminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(denied.status).toBe(401)
    await expect(denied.json()).resolves.toEqual({
      error: 'Authorization required.',
      code: 'auth_required',
    })
  })

  it('lists hosted admin webhook receipts with limit and since filters', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer([
      {
        event_id: 'evt_old',
        event_type: 'checkout.session.completed',
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        processed_at: '2026-03-14T10:00:00.000Z',
        payload: { id: 'evt_old' },
      },
      {
        event_id: 'evt_recent',
        event_type: 'customer.subscription.updated',
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        processed_at: '2026-03-14T12:00:00.000Z',
        payload: { id: 'evt_recent', livemode: false },
      },
    ])
    servers.add(server)

    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })
    const response = await fetch(
      `${baseUrl}/admin/webhooks?limit=1&since=2026-03-14T11:00:00.000Z`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Origin: 'http://localhost:5173',
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('vary')).toBe('Authorization')
    await expect(response.json()).resolves.toEqual({
      webhooks: [
        {
          event_id: 'evt_recent',
          event_type: 'customer.subscription.updated',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          processed_at: '2026-03-14T12:00:00.000Z',
          payload: { id: 'evt_recent', livemode: false },
        },
      ],
    })
  })

  it('rejects non-ISO since filters before querying receipts', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer()
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(`${baseUrl}/admin/webhooks?since=2026`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Admin webhooks since must be a valid ISO timestamp.',
      code: 'invalid_since',
    })
  })

  it('rate-limits hosted admin webhook reads', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer([], {
      hostedRateLimits: {
        adminReads: { max: 1, windowMs: 60_000 },
      },
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })
    const headers = {
      Authorization: `Bearer ${adminToken}`,
      Origin: 'http://localhost:5173',
    }

    const first = await fetch(`${baseUrl}/admin/webhooks`, { headers })
    const second = await fetch(`${baseUrl}/admin/webhooks`, { headers })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    await expect(second.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'rate_limited',
      }),
    )
  })

  it('queries Postgres webhook receipts with timestamp bounds and limit', async () => {
    const { createPostgresAdminStore } = await loadProxyModules()
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          event_id: 'evt_recent',
          event_type: 'checkout.session.completed',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          processed_at: new Date('2026-03-14T12:00:00.000Z'),
          payload: { id: 'evt_recent' },
        },
      ],
    })
    const store = createPostgresAdminStore({ query })

    await expect(
      store.listWebhookReceipts({
        limit: 25,
        since: '2026-03-14T11:00:00.000Z',
      }),
    ).resolves.toEqual([
      {
        event_id: 'evt_recent',
        event_type: 'checkout.session.completed',
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        processed_at: '2026-03-14T12:00:00.000Z',
        payload: { id: 'evt_recent' },
      },
    ])
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM webhook_event_receipts'),
      ['2026-03-14T11:00:00.000Z', 25],
    )
  })
})
