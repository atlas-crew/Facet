import { afterEach, describe, expect, it, vi } from 'vitest'
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
  options: {
    email?: string
    expiresIn?: string
    issuer?: string
    audience?: string
    subject?: string
  } = {},
) {
  return new SignJWT({ email: options.email ?? 'member@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject(options.subject ?? 'user-1')
    .setIssuer(options.issuer ?? 'https://supabase.example/auth/v1')
    .setAudience(options.audience ?? 'authenticated')
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(privateKey)
}

async function startBillingServer(options?: {
  memberships?: Array<{
    tenantId: string
    accountId: string
    userId: string
    email: string
    workspaces: Array<{
      workspaceId: string
      role: string
      isDefault: boolean
    }>
  }>
  entitlement?: {
    planId: string
    status: string
    source: 'stripe'
    features: string[]
    effectiveThrough: string | null
  }
  billingState?: {
    billingCustomer: {
      provider: 'stripe'
      customerId: string
    } | null
    billingSubscription: {
      provider: 'stripe'
      subscriptionId: string
      status: string
      currentPeriodEnd: string | null
    } | null
    entitlement: {
      planId: string
      status: string
      source: 'stripe'
      features: string[]
      effectiveThrough: string | null
    }
  }
  stripeClient?: {
    customers: {
      create: (...args: unknown[]) => Promise<{ id: string }>
      retrieve: (customerId: string) => Promise<{ id: string, deleted: boolean }>
    }
    checkout: {
      sessions: {
        create: (...args: unknown[]) => Promise<{ id: string, url: string }>
      }
    }
  } | null
  stripePriceId?: string | null
  tokenOptions?: {
    email?: string
    expiresIn?: string
    issuer?: string
    audience?: string
    subject?: string
  }
}) {
  const {
    createFacetServer,
    createInMemoryWorkspaceStore,
    createInMemoryHostedMembershipStore,
    createInMemoryHostedBillingStore,
  } = await loadProxyModules()

  const hosted = await buildHostedAuthFixture()
  const membershipStore = createInMemoryHostedMembershipStore(
    options?.memberships ?? [
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
  )
  const billingStore = createInMemoryHostedBillingStore([
    {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      billingCustomer: options?.billingState?.billingCustomer ?? null,
      billingSubscription: options?.billingState?.billingSubscription ?? null,
      entitlement:
        options?.billingState?.entitlement ??
        options?.entitlement ?? {
          planId: 'free',
          status: 'inactive',
          source: 'stripe',
          features: [],
          effectiveThrough: null,
        },
    },
  ])

  const defaultStripeClient = {
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
    stripeClient: options?.stripeClient === undefined ? defaultStripeClient : options.stripeClient,
    stripePriceId: options?.stripePriceId === undefined ? 'price_ai_monthly' : options.stripePriceId,
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
    accessToken: await createHostedSessionToken(hosted.privateKey, options?.tokenOptions),
    createAccessToken: (tokenOptions = {}) => createHostedSessionToken(hosted.privateKey, tokenOptions),
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
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
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

  it('reflects active entitlements and falls back to the first workspace when no default is set', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer({
      memberships: [
        {
          tenantId: 'tenant-1',
          accountId: 'account-1',
          userId: 'user-1',
          email: 'member@example.com',
          workspaces: [
            {
              workspaceId: 'ws-2',
              role: 'owner',
              isDefault: false,
            },
            {
              workspaceId: 'ws-3',
              role: 'owner',
              isDefault: false,
            },
          ],
        },
      ],
      entitlement: {
        planId: 'ai-pro',
        status: 'active',
        source: 'stripe',
        features: ['research.search'],
        effectiveThrough: '2026-05-01T00:00:00.000Z',
      },
    })
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      context: expect.objectContaining({
        account: expect.objectContaining({
          defaultWorkspaceId: 'ws-2',
        }),
        entitlement: expect.objectContaining({
          planId: 'ai-pro',
          status: 'active',
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

  it('rejects missing or expired hosted sessions for billing routes', async () => {
    const missingAuth = await startBillingServer()
    servers.add(missingAuth.server)

    const missingAuthResponse = await fetch(`${missingAuth.baseUrl}/api/account/context`, {
      headers: {
        Origin: 'http://localhost:5173',
        'X-Proxy-API-Key': 'proxy-key',
      },
    })
    expect(missingAuthResponse.status).toBe(401)

    const expired = await startBillingServer({
      tokenOptions: {
        expiresIn: '-1h',
      },
    })
    servers.add(expired.server)

    const expiredResponse = await fetch(`${expired.baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expired.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(expiredResponse.status).toBe(401)
  })

  it('rejects invalid hosted session signatures, issuer, audience, and malformed auth headers', async () => {
    // Fresh key pair so the token signature does not match the server fixture.
    const { privateKey } = await buildHostedAuthFixture()
    const serverState = await startBillingServer()
    servers.add(serverState.server)

    const badSignature = await createHostedSessionToken(privateKey)
    const wrongIssuer = await serverState.createAccessToken({
      issuer: 'https://malicious.example/auth/v1',
    })
    const wrongAudience = await serverState.createAccessToken({
      audience: 'not-facet',
    })

    const invalidSignatureResponse = await fetch(`${serverState.baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${badSignature}`,
        Origin: 'http://localhost:5173',
      },
    })
    expect(invalidSignatureResponse.status).toBe(401)

    const wrongIssuerResponse = await fetch(`${serverState.baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${wrongIssuer}`,
        Origin: 'http://localhost:5173',
      },
    })
    expect(wrongIssuerResponse.status).toBe(401)

    const wrongAudienceResponse = await fetch(`${serverState.baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${wrongAudience}`,
        Origin: 'http://localhost:5173',
      },
    })
    expect(wrongAudienceResponse.status).toBe(401)

    for (const header of ['Basic abc123', 'Bearer', serverState.accessToken]) {
      const malformedResponse = await fetch(`${serverState.baseUrl}/api/account/context`, {
        headers: {
          Authorization: header,
          Origin: 'http://localhost:5173',
        },
      })
      expect(malformedResponse.status).toBe(401)
    }
  })

  it('allows hosted billing routes with a valid bearer token and no proxy key', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/account/context`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
    })

    expect(response.status).toBe(200)
  })

  it('rejects billing routes from disallowed origins', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Origin not allowed',
    })
  })

  it('rejects hosted billing mutations for non-owner memberships', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer({
      memberships: [
        {
          tenantId: 'tenant-1',
          accountId: 'account-1',
          userId: 'user-1',
          email: 'member@example.com',
          workspaces: [
            {
              workspaceId: 'ws-1',
              role: 'member',
              isDefault: true,
            },
          ],
        },
      ],
    })
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Only workspace owners can manage hosted billing.',
      code: 'billing_owner_required',
    })

    const checkoutResponse = await fetch(`${baseUrl}/api/billing/checkout-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(checkoutResponse.status).toBe(403)
  })

  it('creates checkout sessions even when billing customer linkage has not been created yet', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

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

  it('returns provider errors when Stripe customer or checkout calls fail', async () => {
    const createFailure = await startBillingServer({
      stripeClient: {
        customers: {
          create: async () => {
            throw new Error('stripe create failed')
          },
          retrieve: async (customerId: string) => ({ id: customerId, deleted: false }),
        },
        checkout: {
          sessions: {
            create: async () => ({
              id: 'unused',
              url: 'https://unused.example',
            }),
          },
        },
      },
    })
    servers.add(createFailure.server)

    const createFailureResponse = await fetch(`${createFailure.baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${createFailure.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(createFailureResponse.status).toBe(502)
    await expect(createFailureResponse.json()).resolves.toEqual({
      error: 'Hosted billing provider request failed.',
      code: 'billing_provider_error',
    })

    const checkoutFailure = await startBillingServer({
      stripeClient: {
        customers: {
          create: async () => ({ id: 'cus_created' }),
          retrieve: async (customerId: string) => ({ id: customerId, deleted: false }),
        },
        checkout: {
          sessions: {
            create: async () => {
              throw new Error('stripe checkout failed')
            },
          },
        },
      },
    })
    servers.add(checkoutFailure.server)

    const checkoutFailureResponse = await fetch(`${checkoutFailure.baseUrl}/api/billing/checkout-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${checkoutFailure.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(checkoutFailureResponse.status).toBe(502)
    await expect(checkoutFailureResponse.json()).resolves.toEqual({
      error: 'Hosted billing provider request failed.',
      code: 'billing_provider_error',
    })
  })

  it('reuses an existing linked Stripe customer without creating a new one', async () => {
    const retrieve = vi.fn(async (customerId: string) => ({ id: customerId, deleted: false }))
    const create = vi.fn(async () => ({ id: 'cus_created_new' }))
    const { server, baseUrl, accessToken } = await startBillingServer({
      billingState: {
        billingCustomer: {
          provider: 'stripe',
          customerId: 'cus_existing',
        },
        billingSubscription: null,
        entitlement: {
          planId: 'free',
          status: 'inactive',
          source: 'stripe',
          features: [],
          effectiveThrough: null,
        },
      },
      stripeClient: {
        customers: {
          create,
          retrieve,
        },
        checkout: {
          sessions: {
            create: async () => ({
              id: 'cs_test_123',
              url: 'https://checkout.stripe.test/session/cs_test_123',
            }),
          },
        },
      },
    })
    servers.add(server)

    const response = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      billingCustomer: {
        provider: 'stripe',
        customerId: 'cus_existing',
      },
    })
    expect(retrieve).toHaveBeenCalledWith('cus_existing')
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects deleted Stripe customers', async () => {
    const deletedCustomer = await startBillingServer({
      billingState: {
        billingCustomer: {
          provider: 'stripe',
          customerId: 'cus_deleted',
        },
        billingSubscription: null,
        entitlement: {
          planId: 'free',
          status: 'inactive',
          source: 'stripe',
          features: [],
          effectiveThrough: null,
        },
      },
      stripeClient: {
        customers: {
          create: async () => ({ id: 'cus_created' }),
          retrieve: async (customerId: string) => ({ id: customerId, deleted: true }),
        },
        checkout: {
          sessions: {
            create: async () => ({
              id: 'cs_test_123',
              url: 'https://checkout.stripe.test/session/cs_test_123',
            }),
          },
        },
      },
    })
    servers.add(deletedCustomer.server)

    const deletedResponse = await fetch(`${deletedCustomer.baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deletedCustomer.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(deletedResponse.status).toBe(400)
    await expect(deletedResponse.json()).resolves.toEqual({
      error: 'Stored Stripe customer is deleted and cannot be reused.',
    })

  })

  it('returns provider errors when Stripe customer retrieval fails', async () => {
    const retrieveFailure = await startBillingServer({
      billingState: {
        billingCustomer: {
          provider: 'stripe',
          customerId: 'cus_existing',
        },
        billingSubscription: null,
        entitlement: {
          planId: 'free',
          status: 'inactive',
          source: 'stripe',
          features: [],
          effectiveThrough: null,
        },
      },
      stripeClient: {
        customers: {
          create: async () => ({ id: 'cus_created' }),
          retrieve: async () => {
            throw new Error('stripe retrieve failed')
          },
        },
        checkout: {
          sessions: {
            create: async () => ({
              id: 'cs_test_123',
              url: 'https://checkout.stripe.test/session/cs_test_123',
            }),
          },
        },
      },
    })
    servers.add(retrieveFailure.server)

    const retrieveFailureResponse = await fetch(`${retrieveFailure.baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${retrieveFailure.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(retrieveFailureResponse.status).toBe(502)
  })

  it('returns CORS preflight headers, rejects wrong methods, and fails malformed JSON with 400', async () => {
    const { server, baseUrl, accessToken } = await startBillingServer()
    servers.add(server)

    const preflight = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')

    const wrongMethod = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
      },
    })
    expect(wrongMethod.status).toBe(404)

    const malformed = await fetch(`${baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: '{ bad_json ',
    })
    expect(malformed.status).toBe(400)
  })

  it('fails cleanly when hosted billing is missing Stripe configuration', async () => {
    const missingStripe = await startBillingServer({
      stripeClient: null,
    })
    servers.add(missingStripe.server)

    const missingStripeResponse = await fetch(`${missingStripe.baseUrl}/api/billing/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${missingStripe.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(missingStripeResponse.status).toBe(500)
    await expect(missingStripeResponse.json()).resolves.toEqual({
      error: 'Hosted billing is not fully configured.',
    })

    const missingPrice = await startBillingServer({
      stripePriceId: null,
    })
    servers.add(missingPrice.server)

    const missingPriceResponse = await fetch(`${missingPrice.baseUrl}/api/billing/checkout-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${missingPrice.accessToken}`,
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': 'proxy-key',
      },
      body: JSON.stringify({}),
    })
    expect(missingPriceResponse.status).toBe(500)
    await expect(missingPriceResponse.json()).resolves.toEqual({
      error: 'Hosted billing is not fully configured.',
    })
  })
})
