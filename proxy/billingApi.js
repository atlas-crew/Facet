import Stripe from 'stripe'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeAccount(actor, state) {
  return {
    deploymentMode: 'hosted',
    account: {
      tenantId: actor.tenantId,
      accountId: actor.accountId,
      deploymentMode: 'hosted',
      defaultWorkspaceId:
        actor.workspaceMemberships.find((membership) => membership.isDefault)?.workspaceId ??
        actor.workspaceMemberships[0]?.workspaceId ??
        null,
    },
    actor: {
      userId: actor.userId,
      tenantId: actor.tenantId,
      email: actor.email,
    },
    memberships: actor.workspaceMemberships,
    billingCustomer: state?.billingCustomer ?? null,
    billingSubscription: state?.billingSubscription ?? null,
    entitlement: state?.entitlement ?? null,
  }
}

function actorCanManageBilling(actor) {
  return Array.isArray(actor.workspaceMemberships) && actor.workspaceMemberships.some(
    (membership) => membership.role === 'owner',
  )
}

async function readJsonBody(readBody, req) {
  const body = await readBody(req)
  return isRecord(body) ? body : {}
}

export function createStripeBillingClient(options) {
  if (!options.secretKey) {
    throw new Error('Hosted billing requires STRIPE_SECRET_KEY.')
  }

  return new Stripe(options.secretKey, {
    apiVersion: '2025-02-24.acacia',
  })
}

const AI_PRO_ACCESS_DAYS = 90
const AI_PRO_FEATURES = [
  'build.jd-analysis',
  'build.bullet-reframe',
  'match.jd-analysis',
  'research.profile-inference',
  'research.search',
  'prep.generate',
  'letters.generate',
  'linkedin.generate',
  'debrief.generate',
]

function computeEffectiveThrough(fromDate, days) {
  const date = new Date(fromDate)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function createBillingWebhookHandler({
  stripeClient,
  webhookSecret,
  billingStore,
  onEvent,
}) {
  const webhookRoute = '/api/billing/webhooks/stripe'

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return req.method === 'POST' && url.pathname === webhookRoute
    },

    async handle(req, res, rawBody, sendJson) {
      if (!stripeClient || !webhookSecret) {
        sendJson(res, 500, { error: 'Webhook handler not configured.' })
        return
      }

      const signature = req.headers['stripe-signature']
      if (!signature) {
        sendJson(res, 400, { error: 'Missing Stripe signature.' })
        return
      }

      let event
      try {
        event = stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret)
      } catch (err) {
        onEvent?.('billing.webhook', 'denied', { code: 'invalid_signature' })
        sendJson(res, 400, { error: 'Invalid webhook signature.' })
        return
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const tenantId = session.metadata?.tenantId
        const accountId = session.metadata?.accountId
        const accessDays = parseInt(session.metadata?.accessDays ?? String(AI_PRO_ACCESS_DAYS), 10)

        if (!tenantId || !accountId) {
          onEvent?.('billing.webhook', 'error', { code: 'missing_metadata', eventType: event.type })
          sendJson(res, 200, { received: true })
          return
        }

        const now = new Date()
        const currentState = await billingStore.getAccountState(tenantId, accountId)

        // If user has existing unexpired access, extend from current expiry
        const extendFrom =
          currentState?.entitlement?.effectiveThrough &&
          new Date(currentState.entitlement.effectiveThrough) > now
            ? new Date(currentState.entitlement.effectiveThrough)
            : now

        await billingStore.upsertAccountState({
          tenantId,
          accountId,
          billingCustomer: currentState?.billingCustomer ?? {
            provider: 'stripe',
            customerId: session.customer,
          },
          billingSubscription: null,
          entitlement: {
            planId: 'ai-pro',
            status: 'active',
            source: 'stripe',
            features: AI_PRO_FEATURES,
            effectiveThrough: computeEffectiveThrough(extendFrom, accessDays),
          },
        })

        onEvent?.('billing.webhook', 'success', { eventType: event.type, tenantId, accountId })
      }

      sendJson(res, 200, { received: true })
    },
  }
}

export function createBillingApi({
  actorResolver,
  billingStore,
  stripeClient,
  stripePriceId,
  successUrl,
  cancelUrl,
  onEvent,
}) {
  const contextRoute = '/api/account/context'
  const customerRoute = '/api/billing/customer'
  const checkoutRoute = '/api/billing/checkout-session'

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return (
        (req.method === 'GET' && url.pathname === contextRoute) ||
        (req.method === 'POST' && (url.pathname === customerRoute || url.pathname === checkoutRoute))
      )
    },

    async handle(req, res, readBody, sendJson) {
      const actor = await actorResolver(req)
      const state = await billingStore.getAccountState(actor.tenantId, actor.accountId)
      const url = new URL(req.url ?? '/', 'http://localhost')

      if (req.method === 'GET' && url.pathname === contextRoute) {
        onEvent?.('billing.context', 'success', {
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 200, {
          context: normalizeAccount(actor, state),
        })
        return
      }

      if (!actorCanManageBilling(actor)) {
        onEvent?.(
          url.pathname === customerRoute ? 'billing.customer' : 'billing.checkout',
          'denied',
          {
            code: 'billing_owner_required',
            method: req.method,
            path: url.pathname,
          },
        )
        sendJson(res, 403, {
          error: 'Only workspace owners can manage hosted billing.',
          code: 'billing_owner_required',
        })
        return
      }

      if (!stripeClient) {
        onEvent?.('billing.config', 'error', {
          code: 'stripe_not_configured',
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 500, { error: 'Hosted billing is not fully configured.' })
        return
      }

      if (req.method === 'POST' && url.pathname === customerRoute) {
        try {
          const body = await readJsonBody(readBody, req)
          let customer

          if (typeof body.customerId === 'string' && body.customerId.trim()) {
            customer = await stripeClient.customers.retrieve(body.customerId.trim())
            if (customer.deleted) {
              sendJson(res, 400, { error: 'Stripe customer is deleted and cannot be linked.' })
              return
            }
          } else if (state?.billingCustomer?.customerId) {
            customer = await stripeClient.customers.retrieve(state.billingCustomer.customerId)
            if (customer.deleted) {
              sendJson(res, 400, { error: 'Stored Stripe customer is deleted and cannot be reused.' })
              return
            }
          } else {
            customer = await stripeClient.customers.create({
              email: actor.email,
              metadata: {
                tenantId: actor.tenantId,
                accountId: actor.accountId,
                userId: actor.userId,
              },
            })
          }

          const next = await billingStore.upsertAccountState({
            tenantId: actor.tenantId,
            accountId: actor.accountId,
            billingCustomer: {
              provider: 'stripe',
              customerId: customer.id,
            },
            billingSubscription: state?.billingSubscription ?? null,
            entitlement: state?.entitlement ?? null,
          })

          onEvent?.('billing.customer', 'success', {
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 200, {
            billingCustomer: next.billingCustomer,
          })
          return
        } catch (error) {
          if (error?.status === 400 || error?.status === 413) {
            sendJson(res, error.status, {
              error:
                error.status === 413
                  ? 'Request payload too large.'
                  : 'Invalid billing request body.',
            })
            return
          }

          onEvent?.('billing.customer', 'error', {
            code: 'billing_provider_error',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 502, {
            error: 'Hosted billing provider request failed.',
            code: 'billing_provider_error',
          })
          return
        }
      }

      if (!stripePriceId) {
        onEvent?.('billing.config', 'error', {
          code: 'stripe_price_missing',
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 500, { error: 'Hosted billing is not fully configured.' })
        return
      }

      try {
        let customerId = state?.billingCustomer?.customerId ?? null
        if (!customerId) {
          const customer = await stripeClient.customers.create({
            email: actor.email,
            metadata: {
              tenantId: actor.tenantId,
              accountId: actor.accountId,
              userId: actor.userId,
            },
          })
          customerId = customer.id
        }

        const updatedState = await billingStore.upsertAccountState({
          tenantId: actor.tenantId,
          accountId: actor.accountId,
          billingCustomer: {
            provider: 'stripe',
            customerId,
          },
          billingSubscription: state?.billingSubscription ?? null,
          entitlement: state?.entitlement ?? null,
        })

        const session = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          customer: customerId,
          line_items: [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            tenantId: actor.tenantId,
            accountId: actor.accountId,
            userId: actor.userId,
            accessDays: '90',
          },
        })

        onEvent?.('billing.checkout', 'success', {
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 200, {
          sessionId: session.id,
          url: session.url,
          billingCustomer: updatedState.billingCustomer,
        })
      } catch (error) {
        onEvent?.('billing.checkout', 'error', {
          code: 'billing_provider_error',
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 502, {
          error: 'Hosted billing provider request failed.',
          code: 'billing_provider_error',
        })
      }
    },
  }
}
