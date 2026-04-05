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
  options: {
    email?: string
    expiresIn?: string
    subject?: string
  } = {},
) {
  return new SignJWT({ email: options.email ?? 'member@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'facet-test-key' })
    .setSubject(options.subject ?? 'user-1')
    .setIssuer('https://supabase.example/auth/v1')
    .setAudience('authenticated')
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
  stripeClient?: {
    customers: {
      create: () => Promise<{ id: string }>
      retrieve: (customerId: string) => Promise<{ id: string, deleted: boolean }>
    }
    checkout: {
      sessions: {
        create: () => Promise<{ id: string, url: string }>
      }
    }
  } | null
  stripePriceId?: string | null
  tokenOptions?: {
    email?: string
    expiresIn?: string
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
