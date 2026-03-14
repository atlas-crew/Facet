import { afterEach, describe, expect, it } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { buildForgedWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

async function loadProxyModules() {
  const [
    { createFacetServer },
    { createInMemoryWorkspaceStore },
    { createInMemoryHostedMembershipStore },
    { createInMemoryHostedBillingStore },
  ] = await Promise.all([
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/facetServer.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/persistenceApi.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/hostedAuth.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/billingState.js'),
  ])

  return {
    createFacetServer,
    createInMemoryWorkspaceStore,
    createInMemoryHostedMembershipStore,
    createInMemoryHostedBillingStore,
  }
}

async function startServer() {
  const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
  const store = createInMemoryWorkspaceStore()
  const { server } = createFacetServer({
    allowedOrigins: ['http://localhost:5173'],
    proxyApiKey: 'proxy-key',
    persistenceAuthTokens: [
      {
        token: 'member-token',
        tenantId: 'tenant-1',
        userId: 'user-1',
        workspaces: ['ws-1'],
      },
    ],
    persistenceStore: store,
    anthropicClient: {
      messages: {
        create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
      },
    },
    now: () => '2026-03-11T12:00:00.000Z',
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server.')
  }

  return {
    store,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
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
) {
  return new SignJWT({ email: 'member@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject('user-1')
    .setIssuer('https://supabase.example/auth/v1')
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(privateKey)
}

async function startHostedServer(options?: {
  entitlement?: {
    planId: 'free' | 'ai-pro'
    status: 'inactive' | 'trial' | 'active' | 'grace' | 'delinquent'
    source: 'stripe'
    features: string[]
    effectiveThrough: string | null
  } | null
}) {
  const {
    createFacetServer,
    createInMemoryWorkspaceStore,
    createInMemoryHostedMembershipStore,
    createInMemoryHostedBillingStore,
  } = await loadProxyModules()
  const store = createInMemoryWorkspaceStore()
  const hosted = await buildHostedAuthFixture()
  const membershipStore = createInMemoryHostedMembershipStore([
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
  ])
  const billingStore = createInMemoryHostedBillingStore([
    {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      billingCustomer: null,
      billingSubscription: null,
      entitlement: options?.entitlement ?? {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
    },
  ])
  const { server } = createFacetServer({
    authMode: 'hosted',
    allowedOrigins: ['http://localhost:5173'],
    proxyApiKey: 'proxy-key',
    hostedAuth: {
      issuer: 'https://supabase.example/auth/v1',
      audience: 'authenticated',
      jwks: hosted.jwks,
      membershipStore,
    },
    persistenceStore: store,
    billingStore,
    anthropicClient: {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: '{"ok":true}' }],
          usage: { input_tokens: 0, output_tokens: 0 },
        }),
      },
    },
    now: () => '2026-03-14T12:00:00.000Z',
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind hosted auth test server.')
  }

  return {
    store,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: await createHostedSessionToken(hosted.privateKey),
  }
}

describe('facetServer persistence API', () => {
  const servers = new Set<import('node:http').Server>()

  afterEach(async () => {
    await Promise.all(
      [...servers].map((server) => new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })),
    )
    servers.clear()
  })

  it('requires bearer auth and workspace membership for persistence routes', async () => {
    const { server, baseUrl } = await startServer()
    servers.add(server)

    const missingAuth = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'GET',
      headers: {
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(missingAuth.status).toBe(401)

    const unauthorizedWorkspace = await fetch(`${baseUrl}/api/persistence/workspaces/ws-2`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer member-token',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(unauthorizedWorkspace.status).toBe(403)
  })

  it('saves and loads tenant-scoped workspaces with server-owned metadata', async () => {
    const { server, baseUrl } = await startServer()
    servers.add(server)

    const saveResponse = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer member-token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
    })

    expect(saveResponse.status).toBe(200)
    const savedBody = await saveResponse.json()
    expect(savedBody.snapshot.tenantId).toBe('tenant-1')
    expect(savedBody.snapshot.userId).toBe('user-1')
    expect(savedBody.snapshot.workspace.id).toBe('ws-1')
    expect(savedBody.snapshot.workspace.name).toBe('Incoming Workspace')
    expect(savedBody.snapshot.workspace.revision).toBe(1)
    expect(savedBody.snapshot.workspace.updatedAt).toBe('2026-03-11T12:00:00.000Z')
    expect(savedBody.snapshot.artifacts.resume.artifactId).toBe('ws-1:resume')
    expect(savedBody.snapshot.artifacts.resume.artifactType).toBe('resume')
    expect(savedBody.snapshot.artifacts.resume.workspaceId).toBe('ws-1')
    expect(savedBody.snapshot.artifacts.resume.revision).toBe(1)

    const loadResponse = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer member-token',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })

    expect(loadResponse.status).toBe(200)
    const loadedBody = await loadResponse.json()
    expect(loadedBody.snapshot.workspace.revision).toBe(1)
    expect(loadedBody.snapshot.tenantId).toBe('tenant-1')
  })

  it('increments authoritative revisions on subsequent saves and validates payload shape', async () => {
    const { server, baseUrl } = await startServer()
    servers.add(server)

    const headers = {
      Authorization: 'Bearer member-token',
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Proxy-API-Key': 'proxy-key',
    }

    await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
    })

    const forgedSnapshot = buildForgedWorkspaceSnapshot()
    const secondSave = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        snapshot: {
          ...forgedSnapshot,
          workspace: {
            ...forgedSnapshot.workspace,
            name: 'Renamed Workspace',
          },
        },
      }),
    })
    const secondBody = await secondSave.json()
    expect(secondBody.snapshot.workspace.revision).toBe(2)
    expect(secondBody.snapshot.artifacts.resume.revision).toBe(2)

    const invalidSave = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        snapshot: {
          ...forgedSnapshot,
          artifacts: {
            ...forgedSnapshot.artifacts,
            pipeline: {
              ...forgedSnapshot.artifacts.pipeline,
              payload: { entries: null },
            },
          },
        },
      }),
    })

    expect(invalidSave.status).toBe(400)
    expect(await invalidSave.json()).toEqual(
      expect.objectContaining({
        error: expect.stringMatching(/invalid artifacts\.pipeline\.payload\.entries/i),
      }),
    )
  })

  it('validates hosted session tokens and disables the default local token fallback in hosted mode', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer()
    servers.add(server)

    const localDevToken = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer facet-local-user',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(localDevToken.status).toBe(401)

    const authorized = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
    })
    expect(authorized.status).toBe(200)

    const unauthorizedWorkspace = await fetch(`${baseUrl}/api/persistence/workspaces/ws-2`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(unauthorizedWorkspace.status).toBe(403)
  })

  it('rejects hosted AI requests when the entitlement is missing or inactive', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer()
    servers.add(server)

    const denied = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(denied.status).toBe(402)
    await expect(denied.json()).resolves.toEqual({
      code: 'ai_access_denied',
      reason: 'upgrade_required',
      feature: 'research.search',
      error: 'Upgrade to AI Pro to use this hosted AI feature.',
    })
  })

  it('allows hosted AI requests when the entitlement includes the requested feature', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search', 'research.profile-inference'],
        effectiveThrough: '2026-04-14T00:00:00.000Z',
      },
    })
    servers.add(server)

    const allowed = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(allowed.status).toBe(200)
    await expect(allowed.json()).resolves.toEqual(
      expect.objectContaining({
        content: [{ type: 'text', text: '{"ok":true}' }],
      }),
    )
  })

  it('fails closed with a billing_state_error when hosted billing state cannot be loaded', async () => {
    const { createFacetServer, createInMemoryWorkspaceStore, createInMemoryHostedMembershipStore } =
      await loadProxyModules()
    const hosted = await buildHostedAuthFixture()
    const membershipStore = createInMemoryHostedMembershipStore([
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
    ])
    const { server } = createFacetServer({
      authMode: 'hosted',
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      hostedAuth: {
        issuer: 'https://supabase.example/auth/v1',
        audience: 'authenticated',
        jwks: hosted.jwks,
        membershipStore,
      },
      billingStore: {
        getAccountState: async () => {
          throw new Error('disk read failed')
        },
        upsertAccountState: async () => {
          throw new Error('not implemented')
        },
      },
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind billing-state test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await createHostedSessionToken(hosted.privateKey)}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted billing state could not be loaded for this AI request.',
      code: 'billing_state_error',
    })
  })

  it('returns auth_internal_error when hosted actor resolution fails unexpectedly', async () => {
    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
    const { server } = createFacetServer({
      authMode: 'hosted',
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceActorResolver: async () => {
        const error = new Error('jwks fetch timeout')
        Object.assign(error, { status: 500 })
        throw error
      },
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind actor-resolve test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to verify identity for AI access.',
      code: 'auth_internal_error',
    })
  })

  it('returns incomplete_actor when hosted actor resolution succeeds without account identifiers', async () => {
    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
    const { server } = createFacetServer({
      authMode: 'hosted',
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceActorResolver: async () => ({
        userId: 'user-1',
        email: 'member@example.com',
        workspaceMemberships: [],
      }),
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind incomplete-actor test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted AI access requires a tenant-scoped account context.',
      code: 'incomplete_actor',
    })
  })
})
