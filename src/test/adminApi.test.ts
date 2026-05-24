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
  records: {
    webhooks?: Array<Record<string, unknown>>
    actors?: Array<Record<string, unknown>>
  } = {},
  options: {
    hostedRateLimits?: {
      adminReads?: { max: number; windowMs: number }
      adminProbes?: { max: number; windowMs: number }
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
    [
      'admin role without a verified hosted actor',
      { sub: 'user-1', app_metadata: { role: 'admin' } },
    ],
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

  it('rate-limits hosted admin actor probes before token verification', async () => {
    const { server, baseUrl } = await startHostedAdminServer(
      {},
      {
        hostedRateLimits: {
          adminProbes: { max: 1, windowMs: 60_000 },
        },
      },
    )
    servers.add(server)
    const headers = {
      Authorization: 'Bearer invalid-token',
      Origin: 'http://localhost:5173',
    }

    const first = await fetch(`${baseUrl}/admin/actors`, { headers })
    const second = await fetch(`${baseUrl}/admin/actors`, { headers })

    expect(first.status).toBe(401)
    expect(second.status).toBe(429)
    await expect(second.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'rate_limited',
      }),
    )
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
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      webhooks: [
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
      ],
    })
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
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer(
      {},
      {
        hostedRateLimits: {
          adminReads: { max: 1, windowMs: 60_000 },
        },
      },
    )
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
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM webhook_event_receipts'), [
      '2026-03-14T11:00:00.000Z',
      25,
    ])
  })

  it('requires admin claims for hosted admin actors', async () => {
    const { server, baseUrl, accessToken } = await startHostedAdminServer()
    servers.add(server)

    const denied = await fetch(`${baseUrl}/admin/actors`, {
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

  it('lists hosted admin actors with tenant and email filters', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      actors: [
        {
          user_id: 'user-older',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'older@example.com',
          created_at: '2026-03-13T12:00:00.000Z',
          workspace_count: 2,
        },
        {
          user_id: 'user-recent',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'Member@Example.com',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: 1,
        },
        {
          user_id: 'user-other-tenant',
          tenant_id: 'tenant-2',
          account_id: 'account-2',
          email: 'member@example.com',
          created_at: '2026-03-15T12:00:00.000Z',
          workspace_count: 3,
        },
      ],
      webhooks: [],
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(`${baseUrl}/admin/actors?tenant_id=tenant-1&q=member`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('vary')).toBe('Authorization')
    await expect(response.json()).resolves.toEqual({
      actors: [
        {
          user_id: 'user-recent',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'Member@Example.com',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: 1,
        },
      ],
    })
  })

  it('treats hosted admin actor search wildcard characters literally', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      actors: [
        {
          user_id: 'user-literal',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'foo_bar@example.com',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: 1,
        },
        {
          user_id: 'user-wildcard-looking',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'fooXbar@example.com',
          created_at: '2026-03-14T13:00:00.000Z',
          workspace_count: 1,
        },
      ],
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(`${baseUrl}/admin/actors?q=foo_bar`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      actors: [
        {
          user_id: 'user-literal',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'foo_bar@example.com',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: 1,
        },
      ],
    })
  })

  it('rejects oversized hosted admin actor search queries before listing actors', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer()
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(`${baseUrl}/admin/actors?q=${'a'.repeat(257)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Admin actors search query must be 256 characters or fewer.',
      code: 'invalid_query',
    })
  })

  it('clamps hosted admin actor limits to 500', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      actors: Array.from({ length: 501 }, (_, index) => ({
        user_id: `user-${index}`,
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        email: `member-${index}@example.com`,
        created_at: new Date(Date.UTC(2026, 2, 14, 12, 0, index)).toISOString(),
        workspace_count: index % 3,
      })),
      webhooks: [],
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(`${baseUrl}/admin/actors?limit=600`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actors).toHaveLength(500)
  })

  it('keeps actor rows with missing optional display fields', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          user_id: 'user-1',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: 0,
        },
      ],
    })

    await expect(store.listActors()).resolves.toEqual([
      {
        user_id: 'user-1',
        tenant_id: null,
        account_id: null,
        email: null,
        created_at: '2026-03-14T12:00:00.000Z',
        workspace_count: 0,
      },
    ])
  })

  it('drops invalid actor rows and normalizes workspace count boundaries', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          created_at: '2026-03-14T12:00:00.000Z',
          email: 'missing-id@example.com',
          workspace_count: 1,
        },
        {
          user_id: 'missing-created-at',
          email: 'missing-created-at@example.com',
          workspace_count: 1,
        },
        {
          user_id: 'negative-count',
          created_at: '2026-03-14T12:00:00.000Z',
          workspace_count: -3,
        },
        {
          user_id: 'float-count',
          created_at: '2026-03-14T13:00:00.000Z',
          workspace_count: 2.7,
        },
        {
          user_id: 'string-count',
          created_at: '2026-03-14T14:00:00.000Z',
          workspace_count: '4',
        },
      ],
    })

    await expect(store.listActors()).resolves.toEqual([
      expect.objectContaining({
        user_id: 'string-count',
        workspace_count: 4,
      }),
      expect.objectContaining({
        user_id: 'float-count',
        workspace_count: 2,
      }),
      expect.objectContaining({
        user_id: 'negative-count',
        workspace_count: 0,
      }),
    ])
  })

  it('queries Postgres actors with filters and workspace counts', async () => {
    const { createPostgresAdminStore } = await loadProxyModules()
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: 'user-1',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'member@example.com',
          created_at: new Date('2026-03-14T12:00:00.000Z'),
          workspace_count: '2',
        },
      ],
    })
    const store = createPostgresAdminStore({ query })

    await expect(
      store.listActors({
        limit: 25,
        tenantId: 'tenant-1',
        query: 'member',
      }),
    ).resolves.toEqual([
      {
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        email: 'member@example.com',
        created_at: '2026-03-14T12:00:00.000Z',
        workspace_count: 2,
      },
    ])
    expect(query).toHaveBeenCalledWith(expect.stringContaining('m.tenant_id = a.tenant_id'), [
      'tenant-1',
      'member',
      25,
    ])
    expect(query.mock.calls[0]?.[0]).toContain(
      "POSITION(lower($2::text) IN lower(COALESCE(a.email, ''))) > 0",
    )
  })
})
