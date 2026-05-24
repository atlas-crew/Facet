import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

async function loadProxyModules() {
  const [
    { createFacetServer },
    { createInMemoryHostedWorkspaceStore },
    { createAdminApi, requireAdmin, createInMemoryAdminStore, createPostgresAdminStore },
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
    createAdminApi,
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
    workspaces?: Array<Record<string, unknown>>
    workspaceMemberships?: Array<Record<string, unknown>>
    workspaceSnapshots?: Array<Record<string, unknown>>
    billing?: Array<Record<string, unknown>>
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

  it.each(['/admin/workspaces', '/admin/billing'])(
    'rate-limits hosted admin reads for %s',
    async (path) => {
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

      const first = await fetch(`${baseUrl}${path}`, { headers })
      const second = await fetch(`${baseUrl}${path}`, { headers })

      expect(first.status).toBe(200)
      expect(second.status).toBe(429)
      await expect(second.json()).resolves.toEqual(
        expect.objectContaining({
          code: 'rate_limited',
        }),
      )
    },
  )

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

  it('requires admin claims for hosted admin workspaces', async () => {
    const { server, baseUrl, accessToken } = await startHostedAdminServer()
    servers.add(server)

    const denied = await fetch(`${baseUrl}/admin/workspaces`, {
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

  it('lists hosted admin workspaces with membership filters and null snapshots', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      actors: [
        {
          user_id: 'user-owner',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'owner@example.com',
          created_at: '2026-03-14T09:00:00.000Z',
        },
        {
          user_id: 'user-member',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'member@example.com',
          created_at: '2026-03-14T10:00:00.000Z',
        },
      ],
      workspaces: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
          name: 'Current Workspace',
          revision: 4,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T12:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-without-snapshot',
          name: 'Unsnapshotted Workspace',
          revision: 7,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T13:00:00.000Z',
        },
        {
          tenant_id: 'tenant-2',
          workspace_id: 'ws-other-tenant',
          name: 'Other Tenant',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T14:00:00.000Z',
        },
      ],
      workspaceMemberships: [
        {
          user_id: 'user-owner',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
          is_default: true,
        },
        {
          user_id: 'user-member',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
        },
        {
          user_id: 'user-owner',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-without-snapshot',
          is_default: true,
        },
        {
          user_id: 'user-member',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-without-snapshot',
        },
        {
          user_id: 'user-member',
          tenant_id: 'tenant-2',
          workspace_id: 'ws-other-tenant',
        },
      ],
      workspaceSnapshots: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
          revision: 2,
          exported_at: '2026-03-14T11:30:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
          revision: 4,
          exported_at: '2026-03-14T12:30:00.000Z',
        },
      ],
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(
      `${baseUrl}/admin/workspaces?tenant_id=tenant-1&user_id=user-member`,
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
      workspaces: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-without-snapshot',
          name: 'Unsnapshotted Workspace',
          revision: 7,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T13:00:00.000Z',
          snapshot_revision: null,
          snapshot_exported_at: null,
          owner_user_id: 'user-owner',
          owner_email: 'owner@example.com',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-current',
          name: 'Current Workspace',
          revision: 4,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T12:00:00.000Z',
          snapshot_revision: 4,
          snapshot_exported_at: '2026-03-14T12:30:00.000Z',
          owner_user_id: 'user-owner',
          owner_email: 'owner@example.com',
        },
      ],
    })
  })

  it('queries Postgres workspaces with snapshot and member filters', async () => {
    const { createPostgresAdminStore } = await loadProxyModules()
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-1',
          name: 'Primary Workspace',
          revision: 3,
          created_at: new Date('2026-03-14T10:00:00.000Z'),
          updated_at: new Date('2026-03-14T12:00:00.000Z'),
          snapshot_revision: null,
          snapshot_exported_at: null,
          owner_user_id: 'user-1',
          owner_email: 'owner@example.com',
        },
        {
          tenant_id: 'tenant-1',
          name: 'Missing Workspace ID',
          revision: 4,
          created_at: new Date('2026-03-14T10:00:00.000Z'),
          updated_at: new Date('2026-03-14T13:00:00.000Z'),
        },
      ],
    })
    const store = createPostgresAdminStore({ query })

    await expect(
      store.listWorkspaces({
        limit: 25,
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        workspace_id: 'ws-1',
        name: 'Primary Workspace',
        revision: 3,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: '2026-03-14T12:00:00.000Z',
        snapshot_revision: null,
        snapshot_exported_at: null,
        owner_user_id: 'user-1',
        owner_email: 'owner@example.com',
      },
    ])
    expect(query).toHaveBeenCalledWith(expect.stringContaining('workspace_snapshots'), [
      'tenant-1',
      'user-1',
      25,
    ])
    expect(query.mock.calls[0]?.[0]).toContain('member_filter.user_id = $2::text')
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY w.updated_at DESC')
  })

  it('drops workspaces missing identifiers and preserves malformed display fields', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          user_id: 'owner-1',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'owner@example.com',
          created_at: '2026-03-14T10:00:00.000Z',
        },
      ],
      workspaces: [
        {
          workspace_id: 'missing-tenant',
          name: 'Missing Tenant',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T12:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'missing-updated-at',
          name: 'Missing Updated At',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-normalized',
          name: 'Normalized Workspace',
          revision: 3.8,
          created_at: new Date('2026-03-14T10:00:00.000Z'),
          updated_at: new Date('2026-03-14T12:00:00.000Z'),
        },
      ],
      workspaceMemberships: [
        {
          user_id: 'owner-1',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-normalized',
          is_default: true,
        },
      ],
      workspaceSnapshots: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-normalized',
          revision: '2',
          exported_at: '2026-03-14T11:30:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-normalized',
          revision: 4n,
          exported_at: '2026-03-14T12:30:00.000Z',
        },
      ],
    })

    await expect(store.listWorkspaces()).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        workspace_id: 'ws-normalized',
        name: 'Normalized Workspace',
        revision: 3,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: '2026-03-14T12:00:00.000Z',
        snapshot_revision: 4,
        snapshot_exported_at: '2026-03-14T12:30:00.000Z',
        owner_user_id: 'owner-1',
        owner_email: 'owner@example.com',
      },
      {
        tenant_id: 'tenant-1',
        workspace_id: 'missing-updated-at',
        name: 'Missing Updated At',
        revision: 1,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: null,
        snapshot_revision: null,
        snapshot_exported_at: null,
        owner_user_id: null,
        owner_email: null,
      },
    ])
  })

  it('normalizes camelCase workspace and billing fixtures with membership and snapshot aliases', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          userId: 'owner-camel',
          tenantId: 'tenant-camel',
          accountId: 'account-camel',
          email: 'owner-camel@example.com',
          createdAt: '2026-03-14T09:00:00.000Z',
        },
      ],
      workspaces: [
        {
          tenantId: 'tenant-camel',
          workspaceId: 'ws-explicit',
          name: '  Explicit Camel Workspace  ',
          revision: '8',
          createdAt: '2026-03-14T10:00:00.000Z',
          updatedAt: '2026-03-14T13:00:00.000Z',
          snapshotRevision: '6',
          snapshotExportedAt: '2026-03-14T12:30:00.000Z',
          ownerUserId: '  explicit-owner  ',
          ownerEmail: '  explicit-owner@example.com  ',
        },
        {
          tenantId: 'tenant-camel',
          workspaceId: 'ws-fallback',
          name: 'Fallback Camel Workspace',
          revision: 3,
          createdAt: '2026-03-14T10:00:00.000Z',
          updatedAt: '2026-03-14T12:00:00.000Z',
        },
      ],
      memberships: [
        {
          userId: 'owner-camel',
          tenantId: 'tenant-camel',
          workspaceId: 'ws-fallback',
          isDefault: true,
        },
      ],
      snapshots: [
        {
          tenantId: 'tenant-camel',
          workspaceId: 'ws-fallback',
          revision: '5',
          exportedAt: '2026-03-14T11:30:00.000Z',
        },
      ],
      billing: [
        {
          tenantId: 'tenant-camel',
          accountId: 'account-camel',
          ownerEmail: 'billing-owner@example.com',
          customer: { id: 'cus_camel' },
          subscription: { status: 'active' },
          entitlement: { planId: 'ai-pro' },
          updatedAt: '2026-03-14T14:00:00.000Z',
        },
      ],
    })

    await expect(store.listWorkspaces()).resolves.toEqual([
      {
        tenant_id: 'tenant-camel',
        workspace_id: 'ws-explicit',
        name: 'Explicit Camel Workspace',
        revision: 8,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: '2026-03-14T13:00:00.000Z',
        snapshot_revision: 6,
        snapshot_exported_at: '2026-03-14T12:30:00.000Z',
        owner_user_id: 'explicit-owner',
        owner_email: 'explicit-owner@example.com',
      },
      {
        tenant_id: 'tenant-camel',
        workspace_id: 'ws-fallback',
        name: 'Fallback Camel Workspace',
        revision: 3,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: '2026-03-14T12:00:00.000Z',
        snapshot_revision: 5,
        snapshot_exported_at: '2026-03-14T11:30:00.000Z',
        owner_user_id: 'owner-camel',
        owner_email: 'owner-camel@example.com',
      },
    ])
    await expect(store.listBilling()).resolves.toEqual([
      {
        tenant_id: 'tenant-camel',
        account_id: 'account-camel',
        owner_email: 'billing-owner@example.com',
        customer: { id: 'cus_camel' },
        subscription: { status: 'active' },
        entitlement: { planId: 'ai-pro' },
        updated_at: '2026-03-14T14:00:00.000Z',
      },
    ])
  })

  it('keeps workspace and billing ownership scoped to explicit matching signals', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          user_id: 'wrong-account-user',
          tenant_id: 'tenant-1',
          account_id: 'account-wrong',
          email: 'wrong-account@example.com',
          created_at: '2026-03-14T09:00:00.000Z',
        },
        {
          user_id: 'matching-account-user',
          tenant_id: 'tenant-1',
          account_id: 'account-match',
          email: 'matching-account@example.com',
          created_at: '2026-03-14T10:00:00.000Z',
        },
      ],
      workspaces: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-no-default',
          name: 'No Default Workspace',
          revision: 4,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T12:00:00.000Z',
        },
      ],
      workspaceMemberships: [
        {
          user_id: 'wrong-account-user',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-no-default',
          is_default: false,
        },
        {
          user_id: 'matching-account-user',
          tenant_id: 'tenant-1',
          workspace_id: 'ws-no-default',
        },
      ],
      workspaceSnapshots: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-no-default',
          revision: 'not-a-number',
          exported_at: '2026-03-14T11:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-no-default',
          revision: 3,
          exported_at: '2026-03-14T11:30:00.000Z',
        },
      ],
      billing: [
        {
          tenant_id: 'tenant-1',
          account_id: 'account-match',
          customer: { id: 'cus_match' },
          subscription: { status: 'active' },
          entitlement: { planId: 'ai-pro' },
          updated_at: '2026-03-14T13:00:00.000Z',
        },
      ],
    })

    await expect(store.listWorkspaces()).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        workspace_id: 'ws-no-default',
        name: 'No Default Workspace',
        revision: 4,
        created_at: '2026-03-14T10:00:00.000Z',
        updated_at: '2026-03-14T12:00:00.000Z',
        snapshot_revision: 3,
        snapshot_exported_at: '2026-03-14T11:30:00.000Z',
        owner_user_id: null,
        owner_email: null,
      },
    ])
    await expect(store.listBilling()).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        account_id: 'account-match',
        owner_email: 'matching-account@example.com',
        customer: { id: 'cus_match' },
        subscription: { status: 'active' },
        entitlement: { planId: 'ai-pro' },
        updated_at: '2026-03-14T13:00:00.000Z',
      },
    ])
  })

  it('sorts workspaces with invalid or missing updated_at values after dated rows', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      workspaces: [
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-invalid-date',
          name: 'Invalid Date Workspace',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: 'not-a-date',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-missing-date',
          name: 'Missing Date Workspace',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          workspace_id: 'ws-dated',
          name: 'Dated Workspace',
          revision: 1,
          created_at: '2026-03-14T10:00:00.000Z',
          updated_at: '2026-03-14T12:00:00.000Z',
        },
      ],
    })

    await expect(store.listWorkspaces()).resolves.toEqual([
      expect.objectContaining({
        workspace_id: 'ws-dated',
        updated_at: '2026-03-14T12:00:00.000Z',
      }),
      expect.objectContaining({
        workspace_id: 'ws-invalid-date',
        updated_at: 'not-a-date',
      }),
      expect.objectContaining({
        workspace_id: 'ws-missing-date',
        updated_at: null,
      }),
    ])
  })

  it('requires admin claims for hosted admin billing', async () => {
    const { server, baseUrl, accessToken } = await startHostedAdminServer()
    servers.add(server)

    const denied = await fetch(`${baseUrl}/admin/billing`, {
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

  it('lists hosted admin billing with filters and preserves JSON null fields', async () => {
    const { server, baseUrl, createAccessToken } = await startHostedAdminServer({
      actors: [
        {
          user_id: 'user-active',
          tenant_id: 'tenant-1',
          account_id: 'account-active',
          email: 'active@example.com',
          created_at: '2026-03-14T10:00:00.000Z',
        },
        {
          user_id: 'user-empty',
          tenant_id: 'tenant-1',
          account_id: 'account-empty',
          email: 'empty@example.com',
          created_at: '2026-03-14T11:00:00.000Z',
        },
      ],
      billing: [
        {
          tenant_id: 'tenant-1',
          account_id: 'account-active',
          customer: { id: 'cus_123' },
          subscription: { status: 'active' },
          entitlement: { passType: 'quarterly' },
          updated_at: '2026-03-14T12:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          account_id: 'account-empty',
          customer: null,
          subscription: null,
          entitlement: null,
          updated_at: '2026-03-14T13:00:00.000Z',
        },
      ],
    })
    servers.add(server)
    const adminToken = await createAccessToken({
      appMetadata: { role: 'admin' },
    })

    const response = await fetch(
      `${baseUrl}/admin/billing?tenant_id=tenant-1&account_id=account-empty`,
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
      billing: [
        {
          tenant_id: 'tenant-1',
          account_id: 'account-empty',
          owner_email: 'empty@example.com',
          customer: null,
          subscription: null,
          entitlement: null,
          updated_at: '2026-03-14T13:00:00.000Z',
        },
      ],
    })
  })

  it('queries Postgres billing with filters and aliases pass JSON as subscription', async () => {
    const { createPostgresAdminStore } = await loadProxyModules()
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          owner_email: 'owner@example.com',
          customer: { id: 'cus_123' },
          subscription: { status: 'active' },
          entitlement: null,
          updated_at: new Date('2026-03-14T12:00:00.000Z'),
        },
        {
          tenant_id: 'tenant-1',
          owner_email: 'broken@example.com',
          customer: { id: 'cus_broken' },
          subscription: { status: 'active' },
          entitlement: null,
          updated_at: new Date('2026-03-14T13:00:00.000Z'),
        },
      ],
    })
    const store = createPostgresAdminStore({ query })

    await expect(
      store.listBilling({
        limit: 25,
        tenantId: 'tenant-1',
        accountId: 'account-1',
      }),
    ).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        owner_email: 'owner@example.com',
        customer: { id: 'cus_123' },
        subscription: { status: 'active' },
        entitlement: null,
        updated_at: '2026-03-14T12:00:00.000Z',
      },
    ])
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM billing_accounts b'), [
      'tenant-1',
      'account-1',
      25,
    ])
    expect(query.mock.calls[0]?.[0]).toContain('b.pass AS subscription')
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY b.updated_at DESC')
  })

  it('drops invalid billing rows and preserves normalized JSON null fields', async () => {
    const { createInMemoryAdminStore } = await loadProxyModules()
    const store = createInMemoryAdminStore({
      actors: [
        {
          user_id: 'owner-1',
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          email: 'owner@example.com',
          created_at: '2026-03-14T10:00:00.000Z',
        },
      ],
      billing: [
        {
          tenant_id: 'tenant-1',
          customer: { id: 'missing-account' },
          updated_at: '2026-03-14T12:00:00.000Z',
        },
        {
          tenant_id: 'tenant-1',
          account_id: 'missing-updated-at',
          customer: { id: 'missing-updated-at' },
        },
        {
          tenant_id: 'tenant-1',
          account_id: 'account-1',
          customer: undefined,
          pass: { status: 'active' },
          entitlement: undefined,
          updated_at: new Date('2026-03-14T12:00:00.000Z'),
        },
      ],
    })

    await expect(store.listBilling()).resolves.toEqual([
      {
        tenant_id: 'tenant-1',
        account_id: 'account-1',
        owner_email: 'owner@example.com',
        customer: null,
        subscription: { status: 'active' },
        entitlement: null,
        updated_at: '2026-03-14T12:00:00.000Z',
      },
    ])
  })

  it.each([
    ['/admin/workspaces', {}, 'Admin workspaces store is unavailable.', 'admin_store_unavailable'],
    ['/admin/billing', {}, 'Admin billing store is unavailable.', 'admin_store_unavailable'],
  ])(
    'returns a 500 when %s store support is unavailable',
    async (path, adminStore, error, code) => {
      const { createAdminApi } = await loadProxyModules()
      const sendJson = vi.fn()
      const api = createAdminApi({
        actorResolver: async () => ({ userId: 'admin-1' }),
        adminStore,
        logger: { warn: vi.fn() },
      })

      await api.handle(
        {
          method: 'GET',
          url: path,
          _facetHostedClaims: { sub: 'admin-1', app_metadata: { role: 'admin' } },
          _facetHostedActor: { userId: 'admin-1', authMode: 'hosted' },
        },
        { setHeader: vi.fn() },
        sendJson,
      )

      expect(sendJson).toHaveBeenCalledWith(expect.anything(), 500, {
        error,
        code,
      })
    },
  )

  it.each([
    [
      '/admin/workspaces',
      'listWorkspaces',
      'admin.workspaces',
      'workspaceCount',
      [{ workspace_id: 'ws-1' }],
      { workspaces: [{ workspace_id: 'ws-1' }] },
      {},
    ],
    [
      '/admin/billing',
      'listBilling',
      'admin.billing',
      'billingCount',
      [{ account_id: 'account-1' }],
      { billing: [{ account_id: 'account-1' }] },
      { includesPayload: true },
    ],
  ])(
    'emits success telemetry when %s requests complete',
    async (path, method, scope, countKey, rows, body, expectedTelemetry) => {
      const { createAdminApi } = await loadProxyModules()
      const onEvent = vi.fn()
      const sendJson = vi.fn()
      const api = createAdminApi({
        actorResolver: async () => ({ userId: 'admin-1' }),
        adminStore: {
          [method]: vi.fn().mockResolvedValue(rows),
        },
        logger: { warn: vi.fn() },
        onEvent,
      })

      await api.handle(
        {
          method: 'GET',
          url: path,
          _facetHostedClaims: { sub: 'admin-1', app_metadata: { role: 'admin' } },
          _facetHostedActor: { userId: 'admin-1', authMode: 'hosted' },
        },
        { setHeader: vi.fn() },
        sendJson,
      )

      expect(onEvent).toHaveBeenCalledWith(
        scope,
        'success',
        expect.objectContaining({
          [countKey]: 1,
          ...expectedTelemetry,
          method: 'GET',
          path,
          userId: 'admin-1',
        }),
      )
      expect(sendJson).toHaveBeenCalledWith(expect.anything(), 200, body)
    },
  )

  it.each([
    ['/admin/workspaces', 'listWorkspaces', 'admin.workspaces', 'workspaces_unavailable'],
    ['/admin/billing', 'listBilling', 'admin.billing', 'billing_unavailable'],
  ])('emits admin telemetry when %s store calls fail', async (path, method, scope, code) => {
    const { createAdminApi } = await loadProxyModules()
    const failure = new Error('store down')
    const onEvent = vi.fn()
    const sendJson = vi.fn()
    const api = createAdminApi({
      actorResolver: async () => ({ userId: 'admin-1' }),
      adminStore: {
        [method]: vi.fn().mockRejectedValue(failure),
      },
      logger: { warn: vi.fn() },
      onEvent,
    })

    await expect(
      api.handle(
        {
          method: 'GET',
          url: path,
          _facetHostedClaims: { sub: 'admin-1', app_metadata: { role: 'admin' } },
          _facetHostedActor: { userId: 'admin-1', authMode: 'hosted' },
        },
        { setHeader: vi.fn() },
        sendJson,
      ),
    ).rejects.toThrow('store down')

    expect(onEvent).toHaveBeenCalledWith(
      scope,
      'error',
      expect.objectContaining({
        code,
        method: 'GET',
        path,
        userId: 'admin-1',
      }),
    )
    expect(sendJson).not.toHaveBeenCalledWith(expect.anything(), 200, expect.anything())
  })

  it('emits unknown admin telemetry when handle is called directly for an unmapped path', async () => {
    const { createAdminApi } = await loadProxyModules()
    const onEvent = vi.fn()
    const sendJson = vi.fn()
    const api = createAdminApi({
      actorResolver: async () => {
        throw Object.assign(new Error('missing auth'), { status: 401 })
      },
      adminStore: {},
      logger: { warn: vi.fn() },
      onEvent,
    })

    await api.handle(
      {
        method: 'GET',
        url: '/admin/unknown',
      },
      { setHeader: vi.fn() },
      sendJson,
    )

    expect(onEvent).toHaveBeenCalledWith(
      'admin.unknown',
      'denied',
      expect.objectContaining({
        code: 'auth_required',
        method: 'GET',
        path: '/admin/unknown',
      }),
    )
    expect(sendJson).toHaveBeenCalledWith(expect.anything(), 401, {
      error: 'Authorization required.',
      code: 'auth_required',
    })
  })

  it.each([
    ['/admin/workspaces', 'admin.workspaces'],
    ['/admin/billing', 'admin.billing'],
  ])('emits denied telemetry for non-admin %s requests', async (path, scope) => {
    const { createAdminApi } = await loadProxyModules()
    const onEvent = vi.fn()
    const sendJson = vi.fn()
    const api = createAdminApi({
      actorResolver: async () => ({ userId: 'member-1' }),
      adminStore: {},
      logger: { warn: vi.fn() },
      onEvent,
    })

    await api.handle(
      {
        method: 'GET',
        url: path,
        _facetHostedClaims: { sub: 'member-1', app_metadata: { role: 'member' } },
        _facetHostedActor: { userId: 'member-1', authMode: 'hosted' },
      },
      { setHeader: vi.fn() },
      sendJson,
    )

    expect(onEvent).toHaveBeenCalledWith(
      scope,
      'denied',
      expect.objectContaining({
        method: 'GET',
        path,
        userId: 'member-1',
      }),
    )
    expect(sendJson).toHaveBeenCalledWith(expect.anything(), 403, {
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
