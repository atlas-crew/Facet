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

export function createBillingApi({
  actorResolver,
  billingStore,
  stripeClient,
  stripePriceId,
  successUrl,
  cancelUrl,
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
        sendJson(res, 200, {
          context: normalizeAccount(actor, state),
        })
        return
      }

      if (!stripeClient) {
        sendJson(res, 500, { error: 'Hosted billing is not fully configured.' })
        return
      }

      if (req.method === 'POST' && url.pathname === customerRoute) {
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

        sendJson(res, 200, {
          billingCustomer: next.billingCustomer,
        })
        return
      }

      if (!stripePriceId) {
        sendJson(res, 500, { error: 'Hosted billing is not fully configured.' })
        return
      }

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
        mode: 'subscription',
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
        },
      })

      sendJson(res, 200, {
        sessionId: session.id,
        url: session.url,
        billingCustomer: updatedState.billingCustomer,
      })
    },
  }
}
