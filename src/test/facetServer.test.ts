import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { buildForgedWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

async function loadProxyModules() {
  const [
    { createFacetServer, createEnvFacetServer },
    { createInMemoryWorkspaceStore },
    { createInMemoryHostedWorkspaceStore },
    { createInMemoryHostedBillingStore },
  ] = await Promise.all([
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/facetServer.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/persistenceApi.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/hostedWorkspaceStore.js'),
    // @ts-expect-error runtime-tested local proxy module
    import('../../proxy/billingState.js'),
  ])

  return {
    createFacetServer,
    createEnvFacetServer,
    createInMemoryWorkspaceStore,
    createInMemoryHostedWorkspaceStore,
    createInMemoryHostedBillingStore,
  }
}

async function startServer(options?: {
  maxBodyBytes?: number
  staticDir?: string
  opusAvailable?: boolean
}) {
  const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
  const store = createInMemoryWorkspaceStore()
  const { server } = createFacetServer({
    allowedOrigins: ['http://localhost:5173'],
    maxBodyBytes: options?.maxBodyBytes,
    proxyApiKey: 'proxy-key',
    opusAvailable: options?.opusAvailable,
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
    staticDir: options?.staticDir,
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
  options: {
    email?: string
    jti?: string
  } = {},
) {
  let builder = new SignJWT({ email: options.email ?? 'member@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject('user-1')
    .setIssuer('https://supabase.example/auth/v1')
    .setAudience('authenticated')
    .setExpirationTime('1h')

  if (options.jti) {
    builder = builder.setJti(options.jti)
  }

  return builder.sign(privateKey)
}

async function startHostedServer(options?: {
  entitlement?: {
    planId: 'free' | 'ai-pro'
    status: 'inactive' | 'trial' | 'active' | 'grace' | 'delinquent'
    source: 'stripe'
    features: string[]
    effectiveThrough: string | null
  } | null
  includeDefaultWorkspace?: boolean
  hostedRateLimits?: {
    ai?: { max: number; windowMs: number }
    aiFeatures?: Record<string, { max: number; windowMs: number }>
    billingMutations?: { max: number; windowMs: number }
    persistenceMutations?: { max: number; windowMs: number }
  }
  usageStore?: {
    recordCall: (record: Record<string, unknown>) => Promise<void>
    reserveDailyFeatureCall?: (request: Record<string, unknown>) => Promise<{
      allowed: boolean
      count: number
    }>
    refundDailyFeatureCall?: (request: Record<string, unknown>) => Promise<void>
    getSpendCentsSince?: (request: { since: string }) => Promise<number>
  }
  hostedAiUsagePolicy?: {
    dailyFeatureCaps?: Record<string, number>
    globalSpendCircuitBreaker?: {
      maxCents?: number
      windowMs?: number
    }
  }
  usagePolicyNow?: () => number
  anthropicUsage?: { input_tokens: number; output_tokens: number }
  anthropicCreate?: () => Promise<unknown>
}) {
  const {
    createFacetServer,
    createInMemoryHostedWorkspaceStore,
    createInMemoryHostedBillingStore,
  } = await loadProxyModules()
  const hosted = await buildHostedAuthFixture()
  const includeDefaultWorkspace = options?.includeDefaultWorkspace ?? true
  const workspaceStore = createInMemoryHostedWorkspaceStore({
    actors: [
      {
        tenantId: 'tenant-1',
        accountId: 'account-1',
        userId: 'user-1',
        email: 'member@example.com',
        workspaces: includeDefaultWorkspace
          ? [
              {
                workspaceId: 'ws-1',
                role: 'owner',
                isDefault: true,
              },
            ]
          : [],
      },
    ],
  })
  const billingStore = createInMemoryHostedBillingStore([
    {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      billingCustomer: null,
      billingPass: null,
      entitlement: options?.entitlement ?? {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
    },
  ])
  const { server, operationsMonitor } = createFacetServer({
    authMode: 'hosted',
    allowedOrigins: ['http://localhost:5173'],
    proxyApiKey: 'proxy-key',
    hostedAuth: {
      issuer: 'https://supabase.example/auth/v1',
      audience: 'authenticated',
      jwks: hosted.jwks,
    },
    hostedWorkspaceStore: workspaceStore,
    billingStore,
    anthropicClient: {
      messages: {
        create:
          options?.anthropicCreate ??
          (async () => ({
            content: [{ type: 'text', text: '{"ok":true}' }],
            usage: options?.anthropicUsage ?? { input_tokens: 0, output_tokens: 0 },
          })),
      },
    },
    usageStore: options?.usageStore,
    now: () => '2026-03-14T12:00:00.000Z',
    hostedRateLimits: options?.hostedRateLimits,
    hostedAiUsagePolicy: options?.hostedAiUsagePolicy,
    usagePolicyNow: options?.usagePolicyNow,
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind hosted auth test server.')
  }

  return {
    store: workspaceStore,
    server,
    operationsMonitor,
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: await createHostedSessionToken(hosted.privateKey),
    createAccessToken: (tokenOptions = {}) =>
      createHostedSessionToken(hosted.privateKey, tokenOptions),
  }
}

describe('facetServer persistence API', () => {
  const servers = new Set<import('node:http').Server>()
  const tempDirs = new Set<string>()

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
    await Promise.all([...tempDirs].map((dir) => rm(dir, { recursive: true, force: true })))
    tempDirs.clear()
  })

  it('serves static files with cache headers and blocks symlink escapes', async () => {
    const staticDir = await mkdtemp(join(tmpdir(), 'facet-static-'))
    tempDirs.add(staticDir)
    await writeFile(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body>Facet static shell</body></html>',
    )
    await mkdir(join(staticDir, 'assets'), { recursive: true })
    await writeFile(join(staticDir, 'assets', 'app.js'), 'console.log("facet-static")')
    await writeFile(join(staticDir, 'hello world.txt'), 'Facet encoded path')
    await symlink(join(process.cwd(), 'package.json'), join(staticDir, 'escape.json'))

    const { server, baseUrl } = await startServer({ staticDir })
    servers.add(server)

    const asset = await fetch(`${baseUrl}/assets/app.js`)
    expect(asset.status).toBe(200)
    expect(asset.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8')
    expect(asset.headers.get('Cache-Control')).toBe('public, immutable, max-age=31536000')
    await expect(asset.text()).resolves.toContain('facet-static')

    const shell = await fetch(`${baseUrl}/dashboard`)
    expect(shell.status).toBe(200)
    expect(shell.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(shell.headers.get('Cache-Control')).toBe('no-cache')
    await expect(shell.text()).resolves.toContain('Facet static shell')

    const encodedPath = await fetch(`${baseUrl}/hello%20world.txt`)
    expect(encodedPath.status).toBe(200)
    expect(encodedPath.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    await expect(encodedPath.text()).resolves.toBe('Facet encoded path')

    const escaped = await fetch(`${baseUrl}/escape.json`, {
      headers: {
        Authorization: 'Bearer member-token',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(escaped.status).not.toBe(200)
    await expect(escaped.text()).resolves.not.toContain('"name"')
  })

  it('handles OPTIONS preflight and rejects disallowed origins', async () => {
    const { server, baseUrl } = await startServer()
    servers.add(server)

    const preflight = await fetch(baseUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS')
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')

    const blocked = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer member-token',
        Origin: 'https://evil.example',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(blocked.status).toBe(403)
    await expect(blocked.json()).resolves.toEqual({
      error: 'Origin not allowed',
    })
  })

  it('exposes Opus capability status and blocks Opus requests when unavailable', async () => {
    const calls: unknown[] = []
    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      opusAvailable: false,
      anthropicClient: {
        messages: {
          create: async (params: unknown) => {
            calls.push(params)
            return {
              content: [{ type: 'text', text: '{"ok":true}' }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }
          },
        },
      },
    })
    servers.add(server)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind capability test server.')
    }
    const baseUrl = `http://127.0.0.1:${address.port}`

    const capabilityResponse = await fetch(baseUrl + '/capabilities', {
      headers: {
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(capabilityResponse.status).toBe(200)
    await expect(capabilityResponse.json()).resolves.toMatchObject({
      modelCapabilities: {
        opus: {
          available: false,
          model: 'claude-opus-4-7',
          phase1FallbackModel: 'claude-sonnet-4-6',
          phase2Required: true,
        },
      },
    })

    const blocked = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.thesis',
        model: 'opus',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Generate a thesis.' }],
      }),
    })
    expect(blocked.status).toBe(503)
    await expect(blocked.json()).resolves.toMatchObject({
      code: 'ai_capability_unavailable',
      reason: 'opus_unavailable',
      feature: 'research.thesis',
    })

    const fallback = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.thesis',
        model: 'sonnet',
        capability_fallback: 'opus_unavailable',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Generate a fallback thesis.' }],
      }),
    })
    expect(fallback.status).toBe(200)
    expect(fallback.headers.get('X-Facet-Resolved-Model')).toBe('claude-sonnet-4-6')
    expect(calls).toHaveLength(1)
  })

  it('returns client errors for malformed and oversized JSON bodies', async () => {
    const malformedServer = await startServer()
    servers.add(malformedServer.server)

    const malformed = await fetch(malformedServer.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer member-token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: '{ bad_json ',
    })
    expect(malformed.status).toBe(400)
    await expect(malformed.json()).resolves.toEqual({
      error: 'Invalid JSON body',
    })

    const limitedServer = await startServer({ maxBodyBytes: 64 })
    servers.add(limitedServer.server)
    const oversized = await fetch(limitedServer.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer member-token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'x'.repeat(200) }],
      }),
    })
    expect(oversized.status).toBe(413)
    await expect(oversized.json()).resolves.toEqual({
      error: 'Request body too large',
    })
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

  it('allows wildcard local-mode actors to access arbitrary workspaces', async () => {
    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
    const store = createInMemoryWorkspaceStore()
    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceAuthTokens: [
        {
          token: 'wildcard-token',
          tenantId: 'tenant-1',
          userId: 'user-1',
          workspaces: ['*'],
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
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind wildcard test server.')
    }

    const baseUrl = `http://127.0.0.1:${address.port}`
    const saveResponse = await fetch(`${baseUrl}/api/persistence/workspaces/any-workspace`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer wildcard-token',
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
    })

    expect(saveResponse.status).toBe(200)
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

  it('supports hosted workspace directory create, rename, delete, and account-context sync', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer({
      includeDefaultWorkspace: false,
    })
    servers.add(server)

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Proxy-API-Key': 'proxy-key',
    }

    const initialContext = await fetch(`${baseUrl}/api/account/context`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    await expect(initialContext.json()).resolves.toEqual({
      context: expect.objectContaining({
        account: expect.objectContaining({
          defaultWorkspaceId: null,
        }),
        memberships: [],
      }),
    })

    const created = await fetch(`${baseUrl}/api/persistence/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'First Hosted Workspace' }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.workspace).toEqual(
      expect.objectContaining({
        name: 'First Hosted Workspace',
        revision: 0,
        isDefault: true,
        role: 'owner',
      }),
    )
    expect(createdBody.snapshot.workspace.id).toBe(createdBody.workspace.workspaceId)

    const listed = await fetch(`${baseUrl}/api/persistence/workspaces`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    await expect(listed.json()).resolves.toEqual({
      workspaces: [createdBody.workspace],
      actor: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        workspaceIds: [createdBody.workspace.workspaceId],
      }),
    })

    const renamed = await fetch(
      `${baseUrl}/api/persistence/workspaces/${createdBody.workspace.workspaceId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Renamed Hosted Workspace' }),
      },
    )
    expect(renamed.status).toBe(200)
    const renamedBody = await renamed.json()
    expect(renamedBody.workspace).toEqual(
      expect.objectContaining({
        workspaceId: createdBody.workspace.workspaceId,
        name: 'Renamed Hosted Workspace',
        revision: 1,
        isDefault: true,
      }),
    )
    expect(renamedBody.snapshot.workspace.name).toBe('Renamed Hosted Workspace')

    const saved = await fetch(
      `${baseUrl}/api/persistence/workspaces/${createdBody.workspace.workspaceId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
      },
    )
    expect(saved.status).toBe(200)
    const savedBody = await saved.json()
    expect(savedBody.snapshot.workspace.revision).toBe(2)
    expect(savedBody.snapshot.workspace.name).toBe('Incoming Workspace')

    const syncedContext = await fetch(`${baseUrl}/api/account/context`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    await expect(syncedContext.json()).resolves.toEqual({
      context: expect.objectContaining({
        account: expect.objectContaining({
          defaultWorkspaceId: createdBody.workspace.workspaceId,
        }),
        memberships: [
          {
            workspaceId: createdBody.workspace.workspaceId,
            role: 'owner',
            isDefault: true,
          },
        ],
      }),
    })

    const deleted = await fetch(
      `${baseUrl}/api/persistence/workspaces/${createdBody.workspace.workspaceId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Origin: 'http://localhost:5173',
          'X-Proxy-API-Key': 'proxy-key',
        },
      },
    )
    expect(deleted.status).toBe(200)
    await expect(deleted.json()).resolves.toEqual({
      deletedWorkspaceId: createdBody.workspace.workspaceId,
      defaultWorkspaceId: null,
      actor: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        workspaceIds: [],
      },
    })
  })

  it('allows hosted account and persistence routes without a proxy key and records operation counters', async () => {
    const { server, baseUrl, accessToken, operationsMonitor } = await startHostedServer()
    servers.add(server)

    const context = await fetch(`${baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
    })
    expect(context.status).toBe(200)

    const save = await fetch(`${baseUrl}/api/persistence/workspaces/ws-1`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ snapshot: buildForgedWorkspaceSnapshot() }),
    })
    expect(save.status).toBe(200)

    expect(operationsMonitor.snapshot().counters).toMatchObject({
      'billing.context.success': 1,
      'persistence.save.success': 1,
    })
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
        effectiveThrough: '2026-05-14T00:00:00.000Z',
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

  it('records ai_call_usage with tokens and cost after a successful hosted AI call', async () => {
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: { recordCall },
      // 10k input + 5k output at Opus = 15 + ceil(37.5) = 53 cents (see pricing.test.ts)
      anthropicUsage: { input_tokens: 10_000, output_tokens: 5_000 },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'prep.generate',
        model: 'opus',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Build me a deck.' }],
      }),
    })

    expect(response.status).toBe(200)
    // recordCall is fire-and-forget — await microtasks before asserting.
    await new Promise((r) => setTimeout(r, 0))
    expect(recordCall).toHaveBeenCalledTimes(1)
    expect(recordCall.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      // Resolved model id, not the 'opus' alias.
      model: expect.stringMatching(/^claude-opus-4/),
      inputTokens: 10_000,
      outputTokens: 5_000,
      estCostCents: 53,
      status: 'ok',
    })
  })

  it('AI response succeeds even when the usage store throws', async () => {
    const recordCall = vi.fn().mockRejectedValue(new Error('db down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: { recordCall },
      anthropicUsage: { input_tokens: 100, output_tokens: 200 },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'prep.generate',
        model: 'opus',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Build me a deck.' }],
      }),
    })

    // The response MUST succeed — observability failures cannot cascade.
    expect(response.status).toBe(200)
    errorSpy.mockRestore()
  })

  it('clamps thinking budget below max tokens for search requests', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      defaultMaxTokens: 4096,
      maxRequestTokens: 4096,
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind thinking-budget test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'sonnet',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
        thinking_budget: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 15 }],
      }),
    })

    expect(response.status).toBe(200)
    // On Sonnet 4.6, the proxy translates manual thinking → adaptive and derives an
    // effort level from the (clamped) budget. budget=8000 clamps to 4095 (max_tokens-1)
    // and 4095 maps to 'medium' per deriveEffortFromBudget.
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        output_config: expect.objectContaining({ effort: 'medium' }),
      }),
    )
  })

  it('passes task-budget params, beta headers, and updated web-search tool versions through for deep research features', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      defaultMaxTokens: 4096,
      maxRequestTokens: 4096,
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind task-budget passthrough test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.deep-search',
        model: 'sonnet',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Run deep research.' }],
        max_tokens: 200000,
        output_config: {
          task_budget: { type: 'tokens', total: 80000 },
          effort: 'xhigh',
        },
        betas: [' task-budgets-2026-03-13 ', ' other-beta '],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }],
      }),
    })

    expect(response.status).toBe(200)
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-7',
        max_tokens: 128000,
        output_config: {
          task_budget: { type: 'tokens', total: 80000 },
          effort: 'xhigh',
        },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 15 }],
      }),
      {
        headers: {
          'anthropic-beta': 'task-budgets-2026-03-13,other-beta',
        },
      },
    )
  })

  it('forwards beta headers through the unauthenticated Anthropic-compatible client', async () => {
    const upstreamRequests: Array<{
      beta: string | null
      body: Record<string, unknown>
    }> = []
    const upstream = createHttpServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      req.on('end', () => {
        upstreamRequests.push({
          beta: req.headers['anthropic-beta']?.toString() ?? null,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
        })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            content: [{ type: 'text', text: '{"ok":true}' }],
            usage: { input_tokens: 0, output_tokens: 0 },
          }),
        )
      })
    })
    servers.add(upstream)

    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve())
    })

    const upstreamAddress = upstream.address()
    if (!upstreamAddress || typeof upstreamAddress === 'string') {
      throw new Error('Failed to bind Anthropic-compatible upstream test server.')
    }

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()
    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      anthropicBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
      defaultMaxTokens: 4096,
      maxRequestTokens: 4096,
      persistenceStore: createInMemoryWorkspaceStore(),
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind compat passthrough test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.thesis',
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Draft a thesis.' }],
        betas: ['task-budgets-2026-03-13'],
      }),
    })

    expect(response.status).toBe(200)
    expect(upstreamRequests).toEqual([
      expect.objectContaining({
        beta: 'task-budgets-2026-03-13',
        body: expect.objectContaining({
          model: 'claude-opus-4-7',
        }),
      }),
    ])
  })

  it('rejects invalid task-budget passthrough option shapes before calling Anthropic', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind invalid task-budget option test server.')
    }

    const post = (body: Record<string, unknown>) =>
      fetch(`http://127.0.0.1:${address.port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          'X-Proxy-API-Key': 'proxy-key',
        },
        body: JSON.stringify({
          feature: 'research.deep-search',
          model: 'sonnet',
          messages: [{ role: 'user', content: 'Run deep research.' }],
          ...body,
        }),
      })

    const invalidOutputConfig = await post({ output_config: ['not-an-object'] })
    expect(invalidOutputConfig.status).toBe(400)
    await expect(invalidOutputConfig.json()).resolves.toEqual({
      error: 'Requested output_config must be an object',
    })

    const primitiveOutputConfig = await post({ output_config: 'not-an-object' })
    expect(primitiveOutputConfig.status).toBe(400)
    await expect(primitiveOutputConfig.json()).resolves.toEqual({
      error: 'Requested output_config must be an object',
    })

    const invalidBetas = await post({ betas: ['task-budgets-2026-03-13', 123] })
    expect(invalidBetas.status).toBe(400)
    await expect(invalidBetas.json()).resolves.toEqual({
      error: 'Requested betas must be an array of strings',
    })

    const nonArrayBetas = await post({ betas: 'task-budgets-2026-03-13' })
    expect(nonArrayBetas.status).toBe(400)
    await expect(nonArrayBetas.json()).resolves.toEqual({
      error: 'Requested betas must be an array of strings',
    })

    const blankBeta = await post({ betas: ['task-budgets-2026-03-13', '  '] })
    expect(blankBeta.status).toBe(400)
    await expect(blankBeta.json()).resolves.toEqual({
      error: 'Requested betas must be an array of strings',
    })

    expect(messagesCreate).not.toHaveBeenCalled()
  })

  it('keeps the default max token cap for non-task-budget features', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      defaultMaxTokens: 4096,
      maxRequestTokens: 4096,
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind max-token cap test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'sonnet',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Run regular search.' }],
        max_tokens: 128000,
        output_config: null,
        betas: [],
      }),
    })

    expect(response.status).toBe(200)
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 4096,
      }),
    )
    const [params] = messagesCreate.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(params).not.toHaveProperty('output_config')
    expect(messagesCreate.mock.calls[0]).toHaveLength(1)
  })

  it('allows letter generation to request enough tokens for high-effort adaptive thinking', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      defaultMaxTokens: 4096,
      maxRequestTokens: 4096,
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind letters thinking-budget test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'letters.generate',
        model: 'claude-opus-4-7',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Draft a letter.' }],
        max_tokens: 16000,
        thinking_budget: 12000,
        output_config: { effort: 'high' },
      }),
    })

    expect(response.status).toBe(200)
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-7',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
      }),
    )
  })

  it('routes opus-class drafting and suggestion features to opus 4.7 when callers send generic aliases', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind feature-model test server.')
    }

    for (const feature of ['prep.generate', 'research.profile-inference']) {
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          'X-Proxy-API-Key': 'proxy-key',
        },
        body: JSON.stringify({
          feature,
          model: 'sonnet',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Generate output.' }],
        }),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-facet-resolved-model')).toBe('claude-opus-4-7')
    }

    expect(messagesCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'claude-opus-4-7',
      }),
    )
    expect(messagesCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'claude-opus-4-7',
      }),
    )
    const [routedCall1, routedCall2] = messagesCreate.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >
    expect(routedCall1).not.toHaveProperty('temperature')
    expect(routedCall2).not.toHaveProperty('temperature')
  })

  it('routes cover-letter generation to sonnet when callers send generic aliases', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind letters feature-model test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'letters.generate',
        model: 'opus',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Draft a letter.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-facet-resolved-model')).toBe('claude-sonnet-4-6')
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
      }),
    )
    const [routedCall] = messagesCreate.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(routedCall).not.toHaveProperty('temperature')
  })

  it('preserves explicit raw model overrides for mapped features', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind raw-model override test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'letters.generate',
        model: 'claude-haiku-4-5-20251001',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Draft a letter.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-facet-resolved-model')).toBe('claude-haiku-4-5-20251001')
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        temperature: 0.3,
      }),
    )
  })

  it('omits temperature for explicit raw overrides that already target opus 4.7', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind current-model override test server.')
    }

    const response = await fetch('http://127.0.0.1:' + address.port, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'letters.generate',
        model: 'claude-opus-4-7',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Draft a letter.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-facet-resolved-model')).toBe('claude-opus-4-7')
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-7',
      }),
    )
    const [overrideCall] = messagesCreate.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(overrideCall).not.toHaveProperty('temperature')
  })

  it('warns when callers explicitly send temperature to a model that rejects it', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind explicit-temperature warning test server.')
    }

    const response = await fetch('http://127.0.0.1:' + address.port, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        feature: 'letters.generate',
        model: 'claude-opus-4-7',
        temperature: 0.2,
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Draft a letter.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledWith(
      '[proxy] omitting temperature because it is not accepted by model',
      'claude-opus-4-7',
    )
    warnSpy.mockRestore()
  })

  it('omits temperature for explicit raw overrides that already target sonnet 4.6', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind current-sonnet-model override test server.')
    }

    const response = await fetch('http://127.0.0.1:' + address.port, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Summarize this.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-facet-resolved-model')).toBe('claude-sonnet-4-6')
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
      }),
    )
    const [overrideCall] = messagesCreate.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(overrideCall).not.toHaveProperty('temperature')
  })

  it('resolves the sonnet alias to current Sonnet 4.6 when no feature is provided', async () => {
    const messagesCreate = vi.fn(async () => ({
      content: [{ type: 'text', text: '{"ok":true}' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }))

    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: messagesCreate,
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind alias-resolution test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        model: 'sonnet',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Use the base alias.' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-facet-resolved-model')).toBe('claude-sonnet-4-6')
    expect(messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
      }),
    )
    // Sonnet 4.6 is in MODELS_OMIT_TEMPERATURE, so the proxy must not forward temperature.
    const [aliasCall] = messagesCreate.mock.calls as unknown as Array<[Record<string, unknown>]>
    expect(aliasCall).not.toHaveProperty('temperature')
  })

  it('preserves upstream overload messages for 529 provider failures', async () => {
    const { createFacetServer, createInMemoryWorkspaceStore } = await loadProxyModules()

    const { server } = createFacetServer({
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceStore: createInMemoryWorkspaceStore(),
      anthropicClient: {
        messages: {
          create: async () => {
            const error = new Error('Overloaded. Please try again in a few minutes.')
            Object.assign(error, { status: 529 })
            throw error
          },
        },
      },
    })
    servers.add(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind overload test server.')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({
        model: 'sonnet',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Investigate this job.' }],
      }),
    })

    expect(response.status).toBe(529)
    await expect(response.json()).resolves.toEqual({
      error: 'Overloaded. Please try again in a few minutes.',
    })
  })

  it('allows hosted identity bullet deepening requests when the entitlement includes identity.deepen', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['identity.deepen'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
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
        feature: 'identity.deepen',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Deepen this bullet.' }],
      }),
    })

    expect(allowed.status).toBe(200)
    await expect(allowed.json()).resolves.toEqual(
      expect.objectContaining({
        content: [{ type: 'text', text: '{"ok":true}' }],
      }),
    )
  })

  it('rate limits hosted AI requests and returns retry metadata', async () => {
    const { server, baseUrl, accessToken, operationsMonitor } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      hostedRateLimits: {
        ai: { max: 1, windowMs: 60_000 },
        aiFeatures: {
          'research.search': { max: 1, windowMs: 60_000 },
        },
      },
    })
    servers.add(server)

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    }

    const first = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })
    expect(first.status).toBe(200)

    const second = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })
    expect(second.status).toBe(429)
    expect(second.headers.get('Retry-After')).toBeTruthy()
    await expect(second.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'rate_limited',
      }),
    )

    expect(operationsMonitor.snapshot().counters).toMatchObject({
      'ai.success': 1,
      'ai.rate_limited': 1,
    })
  })

  it('applies hosted rate limits across refreshed tokens after actor verification', async () => {
    const { server, baseUrl, accessToken, createAccessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      hostedRateLimits: {
        ai: { max: 1, windowMs: 60_000 },
        aiFeatures: {
          'research.search': { max: 1, windowMs: 60_000 },
        },
      },
    })
    servers.add(server)

    const first = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })
    expect(first.status).toBe(200)

    const refreshedToken = await createAccessToken({
      jti: 'refresh-1',
    })
    const second = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })
    expect(second.status).toBe(429)
  })

  it('applies hosted AI burst limits per feature bucket', async () => {
    const { server, baseUrl, accessToken, operationsMonitor } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate', 'research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      hostedRateLimits: {
        ai: { max: 99, windowMs: 60_000 },
        aiFeatures: {
          'prep.generate': { max: 1, windowMs: 60_000 },
          'research.search': { max: 2, windowMs: 60_000 },
        },
      },
    })
    servers.add(server)

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
    }

    const postAi = (feature: string) =>
      fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          feature,
          model: 'haiku',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Generate.' }],
        }),
      })

    expect((await postAi('prep.generate')).status).toBe(200)

    const cappedPrep = await postAi('prep.generate')
    expect(cappedPrep.status).toBe(429)
    await expect(cappedPrep.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'rate_limited',
        error: 'Rate limit exceeded for hosted ai:prep.generate.',
      }),
    )

    expect((await postAi('research.search')).status).toBe(200)
    expect(operationsMonitor.snapshot().counters).toMatchObject({
      'ai.success': 2,
      'ai.rate_limited': 1,
    })
  })

  it('enforces configured daily feature caps through the usage store', async () => {
    const reserveDailyFeatureCall = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true, count: 1 })
      .mockResolvedValueOnce({ allowed: false, count: 1 })
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        reserveDailyFeatureCall,
      },
      hostedAiUsagePolicy: {
        dailyFeatureCaps: {
          'prep.generate': 1,
        },
      },
      usagePolicyNow: () => Date.UTC(2026, 2, 14, 12, 0, 0),
    })
    servers.add(server)

    const request = () =>
      fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          feature: 'prep.generate',
          model: 'haiku',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Prepare me.' }],
        }),
      })

    expect((await request()).status).toBe(200)
    const capped = await request()

    expect(capped.status).toBe(429)
    expect(capped.headers.get('Retry-After')).toBeTruthy()
    await expect(capped.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'daily_feature_cap_exceeded',
        feature: 'prep.generate',
        limit: 1,
      }),
    )
    expect(reserveDailyFeatureCall).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-03-14',
      cap: 1,
    })
    expect(recordCall).toHaveBeenCalledTimes(1)
  })

  it('refunds a daily feature reservation when the upstream AI call fails', async () => {
    const reserveDailyFeatureCall = vi.fn().mockResolvedValue({ allowed: true, count: 1 })
    const refundDailyFeatureCall = vi.fn().mockResolvedValue(undefined)
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const upstreamError = Object.assign(new Error('upstream unavailable'), { status: 529 })
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        reserveDailyFeatureCall,
        refundDailyFeatureCall,
      },
      hostedAiUsagePolicy: {
        dailyFeatureCaps: {
          'prep.generate': 1,
        },
      },
      usagePolicyNow: () => Date.UTC(2026, 2, 14, 12, 0, 0),
      anthropicCreate: async () => {
        throw upstreamError
      },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'prep.generate',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Prepare me.' }],
      }),
    })

    expect(response.status).toBe(529)
    expect(refundDailyFeatureCall).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-03-14',
    })
    expect(recordCall).not.toHaveBeenCalled()
  })

  it('opens the global AI spend circuit breaker when configured spend is exhausted', async () => {
    const getSpendCentsSince = vi.fn().mockResolvedValue(500)
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        getSpendCentsSince,
      },
      hostedAiUsagePolicy: {
        globalSpendCircuitBreaker: {
          maxCents: 500,
          windowMs: 60_000,
        },
      },
      usagePolicyNow: () => Date.UTC(2026, 2, 14, 12, 0, 0),
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted AI is temporarily paused because the global spend circuit breaker is open.',
      code: 'ai_spend_circuit_open',
    })
    expect(getSpendCentsSince).toHaveBeenCalledWith({
      since: '2026-03-14T11:59:00.000Z',
    })
    expect(recordCall).not.toHaveBeenCalled()
  })

  it('returns a stable usage-policy error when global spend storage fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const getSpendCentsSince = vi.fn().mockRejectedValue(new Error('database unavailable'))
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        getSpendCentsSince,
      },
      hostedAiUsagePolicy: {
        globalSpendCircuitBreaker: {
          maxCents: 500,
          windowMs: 60_000,
        },
      },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'research.search',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Find jobs.' }],
      }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted AI usage limits are enabled but usage storage is unavailable.',
      code: 'ai_usage_policy_unavailable',
    })
    expect(recordCall).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('returns a stable usage-policy error when daily reservation storage fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reserveDailyFeatureCall = vi.fn().mockRejectedValue(new Error('database unavailable'))
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        reserveDailyFeatureCall,
      },
      hostedAiUsagePolicy: {
        dailyFeatureCaps: {
          'prep.generate': 1,
        },
      },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'prep.generate',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Prepare me.' }],
      }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted AI usage limits are enabled but usage storage is unavailable.',
      code: 'ai_usage_policy_unavailable',
    })
    expect(recordCall).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('fails closed when usage policy is enabled without a usage store', async () => {
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['prep.generate'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      hostedAiUsagePolicy: {
        dailyFeatureCaps: {
          'prep.generate': 1,
        },
      },
    })
    servers.add(server)

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        feature: 'prep.generate',
        model: 'haiku',
        system: 'Return JSON only.',
        messages: [{ role: 'user', content: 'Prepare me.' }],
      }),
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Hosted AI usage limits are enabled but usage storage is unavailable.',
      code: 'ai_usage_policy_unavailable',
    })
  })

  it('caches global spend checks briefly instead of summing on every AI request', async () => {
    const getSpendCentsSince = vi.fn().mockResolvedValue(100)
    const recordCall = vi.fn().mockResolvedValue(undefined)
    let now = Date.UTC(2026, 2, 14, 12, 0, 0)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        getSpendCentsSince,
      },
      hostedAiUsagePolicy: {
        globalSpendCircuitBreaker: {
          maxCents: 500,
          windowMs: 60_000,
        },
      },
      usagePolicyNow: () => now,
    })
    servers.add(server)

    const request = () =>
      fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          feature: 'research.search',
          model: 'haiku',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Find jobs.' }],
        }),
      })

    expect((await request()).status).toBe(200)
    now += 1_000
    expect((await request()).status).toBe(200)

    expect(getSpendCentsSince).toHaveBeenCalledTimes(1)
    expect(recordCall).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent global spend refreshes into one store query', async () => {
    let resolveSpend: (value: number) => void = () => {}
    const spendPromise = new Promise<number>((resolve) => {
      resolveSpend = resolve
    })
    const getSpendCentsSince = vi.fn().mockReturnValue(spendPromise)
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        getSpendCentsSince,
      },
      hostedAiUsagePolicy: {
        globalSpendCircuitBreaker: {
          maxCents: 500,
          windowMs: 60_000,
        },
      },
      usagePolicyNow: () => Date.UTC(2026, 2, 14, 12, 0, 0),
    })
    servers.add(server)

    const request = () =>
      fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          feature: 'research.search',
          model: 'haiku',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Find jobs.' }],
        }),
      })

    const responses = Promise.all([request(), request(), request()])
    await vi.waitFor(() => {
      expect(getSpendCentsSince).toHaveBeenCalledTimes(1)
    })
    resolveSpend(100)

    await expect(responses).resolves.toEqual([
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
      expect.objectContaining({ status: 200 }),
    ])
    expect(getSpendCentsSince).toHaveBeenCalledTimes(1)
  })

  it('adds successful in-process usage to the cached global spend breaker', async () => {
    const getSpendCentsSince = vi.fn().mockResolvedValue(499)
    const recordCall = vi.fn().mockResolvedValue(undefined)
    const { server, baseUrl, accessToken } = await startHostedServer({
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-14T00:00:00.000Z',
      },
      usageStore: {
        recordCall,
        getSpendCentsSince,
      },
      hostedAiUsagePolicy: {
        globalSpendCircuitBreaker: {
          maxCents: 500,
          windowMs: 60_000,
        },
      },
      usagePolicyNow: () => Date.UTC(2026, 2, 14, 12, 0, 0),
      anthropicUsage: { input_tokens: 100, output_tokens: 100 },
    })
    servers.add(server)

    const request = () =>
      fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
        },
        body: JSON.stringify({
          feature: 'research.search',
          model: 'haiku',
          system: 'Return JSON only.',
          messages: [{ role: 'user', content: 'Find jobs.' }],
        }),
      })

    expect((await request()).status).toBe(200)
    const denied = await request()

    expect(denied.status).toBe(503)
    await expect(denied.json()).resolves.toEqual({
      error: 'Hosted AI is temporarily paused because the global spend circuit breaker is open.',
      code: 'ai_spend_circuit_open',
    })
    expect(getSpendCentsSince).toHaveBeenCalledTimes(1)
    expect(recordCall).toHaveBeenCalledTimes(1)
  })

  it('fails closed with a billing_state_error when hosted billing state cannot be loaded', async () => {
    const { createFacetServer, createInMemoryHostedWorkspaceStore } = await loadProxyModules()
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
      billingStore: {
        getAccountState: async () => {
          throw new Error('disk read failed')
        },
        upsertAccountState: async () => {
          throw new Error('not implemented')
        },
      },
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

  it('rejects hosted staging defaults that still depend on local proxy auth or file stores', async () => {
    const { createEnvFacetServer } = await loadProxyModules()

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'production',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_JWKS_URL: 'https://supabase.example/auth/v1/keys',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
      }),
    ).toThrow(/default PROXY_API_KEY/i)
  })

  it('requires an explicit hosted environment label for createEnvFacetServer', async () => {
    const { createEnvFacetServer } = await loadProxyModules()

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_JWKS_URL: 'https://supabase.example/auth/v1/keys',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
      }),
    ).toThrow(/FACET_ENVIRONMENT=local\|staging\|production/i)
  })

  it('parses hosted AI feature rate and usage policy env overrides', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { createEnvFacetServer } = await loadProxyModules()

    const { operationsMonitor } = createEnvFacetServer({
      FACET_AUTH_MODE: 'hosted',
      FACET_ENVIRONMENT: 'local',
      ALLOWED_ORIGINS: 'http://localhost:5173',
      HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
      HOSTED_BILLING_FILE: './hosted-billing.example.json',
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_JWKS_URL: 'https://supabase.example/auth/v1/keys',
      HOSTED_AI_RATE_LIMIT_MAX: '99',
      HOSTED_AI_FEATURE_RATE_LIMITS_JSON: JSON.stringify({
        'prep.generate': { max: 7, windowMs: 12_000 },
      }),
      HOSTED_AI_RATE_LIMIT_PREP_GENERATE_MAX: '3',
      HOSTED_AI_DAILY_FEATURE_CAPS_JSON: JSON.stringify({
        'prep.generate': 11,
      }),
      HOSTED_AI_DAILY_CAP_PIPELINE_T3_INTERVIEWER: '2',
      HOSTED_AI_GLOBAL_SPEND_LIMIT_CENTS: '500',
      HOSTED_AI_GLOBAL_SPEND_WINDOW_MS: '60000',
    })
    const snapshot = operationsMonitor.snapshot()
    expect(snapshot.rateLimits.ai).toEqual({ max: 99, windowMs: 60_000 })
    expect(snapshot.rateLimits.aiFeatures['prep.generate']).toEqual({
      max: 3,
      windowMs: 12_000,
    })
    warnSpy.mockRestore()
  })

  it('rejects invalid hosted AI feature rate-limit env configuration', async () => {
    const { createEnvFacetServer } = await loadProxyModules()

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'local',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
        HOSTED_AI_FEATURE_RATE_LIMITS_JSON: '{not-json',
      }),
    ).toThrow(/HOSTED_AI_FEATURE_RATE_LIMITS_JSON must be valid JSON object syntax/)

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'local',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
        HOSTED_AI_DAILY_FEATURE_CAPS_JSON: '{not-json',
      }),
    ).toThrow(/HOSTED_AI_DAILY_FEATURE_CAPS_JSON must be valid JSON object syntax/)

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'local',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
        HOSTED_AI_FEATURE_RATE_LIMITS_JSON: JSON.stringify({
          'typo.feature': { max: 1, windowMs: 60_000 },
        }),
      }),
    ).toThrow(/unknown AI feature "typo.feature"/)
  })

  it('rejects hosted staging persistence token maps and transitional file stores without an explicit override', async () => {
    const { createEnvFacetServer } = await loadProxyModules()

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'staging',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_JWKS_URL: 'https://supabase.example/auth/v1/keys',
        PROXY_API_KEY: 'non-default-proxy-key',
        PERSISTENCE_AUTH_TOKENS: '[{"token":"bad"}]',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
      }),
    ).toThrow(/must not use PERSISTENCE_AUTH_TOKENS/i)

    expect(() =>
      createEnvFacetServer({
        FACET_AUTH_MODE: 'hosted',
        FACET_ENVIRONMENT: 'staging',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_JWKS_URL: 'https://supabase.example/auth/v1/keys',
        PROXY_API_KEY: 'non-default-proxy-key',
        HOSTED_WORKSPACE_FILE: './hosted-workspaces.example.json',
        HOSTED_BILLING_FILE: './hosted-billing.example.json',
      }),
    ).toThrow(/non-file-backed workspace and billing store/i)
  })
})

describe('deriveEffortFromBudget', () => {
  it('maps budget magnitude to effort levels at the boundaries', async () => {
    // @ts-expect-error runtime-tested local proxy module
    const { deriveEffortFromBudget } = await import('../../proxy/facetServer.js')
    // Below the low/medium boundary
    expect(deriveEffortFromBudget(0)).toBe('low')
    expect(deriveEffortFromBudget(3999)).toBe('low')
    // Low/medium boundary at 4000
    expect(deriveEffortFromBudget(4000)).toBe('medium')
    expect(deriveEffortFromBudget(11999)).toBe('medium')
    // Medium/high boundary at 12000
    expect(deriveEffortFromBudget(12000)).toBe('high')
    expect(deriveEffortFromBudget(50000)).toBe('high')
  })
})
