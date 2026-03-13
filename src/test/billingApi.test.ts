import { afterEach, describe, expect, it } from 'vitest'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

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

async function startBillingServer() {
  const {
    createFacetServer,
    createInMemoryWorkspaceStore,
    createInMemoryHostedMembershipStore,
    createInMemoryHostedBillingStore,
  } = await loadProxyModules()

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
      entitlement: {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
    },
  ])

  const stripeClient = {
    customers: {
      create: async () => ({ id: 'cus_created' }),
      retrieve: async (customerId: string) => ({ id: customerId, deleted: false }),
    },
    checkout: {
      sessions: {
        create: async () => ({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.test/session/cs_test_123',
        }),
      },
    },
  }

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
    persistenceStore: createInMemoryWorkspaceStore(),
    billingStore,
    stripeClient,
    stripePriceId: 'price_ai_monthly',
    billingSuccessUrl: 'http://localhost:5173/settings/billing/success',
    billingCancelUrl: 'http://localhost:5173/settings/billing/cancel',
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
    throw new Error('Failed to bind billing test server.')
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: await createHostedSessionToken(hosted.privateKey),
  }
}

describe('facetServer billing API', () => {
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

  it('returns server-authored hosted account context for downstream gating', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      context: expect.objectContaining({
        deploymentMode: 'hosted',
        account: expect.objectContaining({
          tenantId: 'tenant-1',
          accountId: 'account-1',
          defaultWorkspaceId: 'ws-1',
        }),
        actor: expect.objectContaining({
          userId: 'user-1',
          tenantId: 'tenant-1',
          email: 'member@example.com',
        }),
        memberships: [
          {
            workspaceId: 'ws-1',
            role: 'owner',
            isDefault: true,
          },
        ],
        entitlement: expect.objectContaining({
          planId: 'free',
          status: 'inactive',
        }),
      }),
    })
  })

  it('creates or links a Stripe customer and reuses it for checkout sessions', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

    const customerLink = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })

    expect(customerLink.status).toBe(200)
    await expect(customerLink.json()).resolves.toEqual({
      billingCustomer: {
        provider: 'stripe',
        customerId: 'cus_created',
      },
    })

    const checkout = await fetch(`${baseUrl}/api/billing/checkout-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })

    expect(checkout.status).toBe(200)
    await expect(checkout.json()).resolves.toEqual({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.test/session/cs_test_123',
      billingCustomer: {
        provider: 'stripe',
        customerId: 'cus_created',
      },
    })
  })
})
