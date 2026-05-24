import Stripe from 'stripe'
import { AI_PRO_FEATURES } from './aiFeatures.js'

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
    billingPass: state?.billingPass ?? null,
    entitlement: state?.entitlement ?? null,
  }
}

function actorCanManageBilling(actor) {
  return (
    Array.isArray(actor.workspaceMemberships) &&
    actor.workspaceMemberships.some((membership) => membership.role === 'owner')
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

function isoFromStripeCreated(created) {
  return typeof created === 'number'
    ? new Date(created * 1000).toISOString()
    : new Date().toISOString()
}

function resolveStripeId(value) {
  if (typeof value === 'string') {
    return value
  }
  return typeof value?.id === 'string' ? value.id : null
}

function billingStoreSupportsPaymentIntentLookup(billingStore) {
  return typeof billingStore?.findAccountStateByPaymentIntentId === 'function'
}

function passHistoryEntry(pass) {
  if (!pass) return null
  const { history: _history, ...entry } = pass
  return entry
}

function parseIsoDate(value) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function latestActivePassExpiry(billingPass, now = new Date()) {
  const candidates = []
  const collect = (pass) => {
    if (pass?.status !== 'active') return
    const expiresAt = parseIsoDate(pass.expiresAt)
    if (expiresAt && expiresAt > now) {
      candidates.push(expiresAt)
    }
  }

  collect(billingPass)
  for (const pass of billingPass?.history ?? []) {
    collect(pass)
  }

  return candidates.reduce(
    (latest, candidate) => (latest && latest > candidate ? latest : candidate),
    null,
  )
}

function currentActiveEntitlementExpiry(entitlement, now = new Date()) {
  if (entitlement?.status !== 'active') return null
  const effectiveThrough = parseIsoDate(entitlement.effectiveThrough)
  return effectiveThrough && effectiveThrough > now ? effectiveThrough : null
}

function activeEntitlementIsCurrent(entitlement) {
  return currentActiveEntitlementExpiry(entitlement) !== null
}

async function resolvePassState(billingStore, tenantId, accountId, paymentIntentId) {
  if (tenantId && accountId) {
    const currentState = await billingStore.getAccountState(tenantId, accountId)
    if (currentState) {
      return currentState
    }
  }

  if (typeof billingStore.findAccountStateByPaymentIntentId === 'function' && paymentIntentId) {
    return billingStore.findAccountStateByPaymentIntentId(paymentIntentId)
  }

  return null
}

async function recordPaidPass({
  billingStore,
  tenantId,
  accountId,
  customerId,
  paymentIntentId,
  purchasedAt,
}) {
  const existingStateByPaymentIntent =
    await billingStore.findAccountStateByPaymentIntentId(paymentIntentId)
  if (existingStateByPaymentIntent?.billingPass) {
    return existingStateByPaymentIntent
  }

  const currentState = await billingStore.getAccountState(tenantId, accountId)
  if (currentState?.billingPass?.paymentIntentId === paymentIntentId) {
    return currentState
  }
  if (
    currentState?.billingCustomer?.customerId &&
    currentState.billingCustomer.customerId !== customerId
  ) {
    throw new Error('Stripe customer mismatch for hosted billing pass.')
  }

  const currentPass = passHistoryEntry(currentState?.billingPass)
  const history = currentPass
    ? [currentPass, ...(currentState.billingPass?.history ?? [])]
    : (currentState?.billingPass?.history ?? [])
  const currentEntitlement = activeEntitlementIsCurrent(currentState?.entitlement)
    ? currentState.entitlement
    : null

  return billingStore.upsertAccountState({
    tenantId,
    accountId,
    billingCustomer: currentState?.billingCustomer ?? {
      provider: 'stripe',
      customerId,
    },
    billingPass: {
      provider: 'stripe',
      paymentIntentId,
      planId: 'ai-pro',
      status: 'paid',
      purchasedAt,
      activatedAt: null,
      expiresAt: null,
      ...(history.length > 0 ? { history } : {}),
    },
    entitlement: currentEntitlement ?? {
      planId: 'ai-pro',
      status: 'paid',
      source: 'stripe',
      features: AI_PRO_FEATURES,
      effectiveThrough: null,
    },
  })
}

async function refundPass({ billingStore, paymentIntentId }) {
  const currentState = await resolvePassState(billingStore, null, null, paymentIntentId)
  if (!currentState?.billingPass) {
    return null
  }
  const isCurrentPass = currentState.billingPass.paymentIntentId === paymentIntentId
  const history = (currentState.billingPass.history ?? []).map((pass) =>
    pass.paymentIntentId === paymentIntentId ? { ...pass, status: 'refunded' } : pass,
  )
  const billingPass = isCurrentPass
    ? {
        ...currentState.billingPass,
        status: 'refunded',
        history,
      }
    : {
        ...currentState.billingPass,
        history,
      }
  const activeExpiry = latestActivePassExpiry(billingPass)
  const refundedCurrentPassExpiry =
    isCurrentPass && currentState.billingPass.status === 'active'
      ? parseIsoDate(currentState.billingPass.expiresAt)
      : null
  const currentEntitlementExpiry = currentActiveEntitlementExpiry(currentState.entitlement)
  const entitlementExpiry =
    refundedCurrentPassExpiry &&
    currentEntitlementExpiry &&
    refundedCurrentPassExpiry.getTime() === currentEntitlementExpiry.getTime()
      ? null
      : currentEntitlementExpiry
  const effectiveActiveExpiry =
    activeExpiry && entitlementExpiry
      ? activeExpiry > entitlementExpiry
        ? activeExpiry
        : entitlementExpiry
      : (activeExpiry ?? entitlementExpiry)
  const hasPaidPass =
    billingPass.status === 'paid' || billingPass.history?.some((pass) => pass.status === 'paid')

  return billingStore.upsertAccountState({
    tenantId: currentState.tenantId,
    accountId: currentState.accountId,
    billingCustomer: currentState.billingCustomer ?? null,
    billingPass,
    entitlement: effectiveActiveExpiry
      ? {
          planId: 'ai-pro',
          status: 'active',
          source: 'stripe',
          features: AI_PRO_FEATURES,
          effectiveThrough: effectiveActiveExpiry.toISOString(),
        }
      : hasPaidPass
        ? {
            planId: 'ai-pro',
            status: 'paid',
            source: 'stripe',
            features: AI_PRO_FEATURES,
            effectiveThrough: null,
          }
        : {
            planId: 'ai-pro',
            status: 'refunded',
            source: 'stripe',
            features: AI_PRO_FEATURES,
            effectiveThrough: null,
          },
  })
}

async function markPaymentFailed({
  billingStore,
  tenantId,
  accountId,
  customerId,
  paymentIntentId,
}) {
  const currentState = await resolvePassState(billingStore, tenantId, accountId, paymentIntentId)
  if (!currentState?.billingPass) {
    return null
  }

  if (!currentState.billingCustomer && customerId) {
    return billingStore.upsertAccountState({
      ...currentState,
      billingCustomer: {
        provider: 'stripe',
        customerId,
      },
    })
  }

  return currentState
}

export function createBillingWebhookHandler({
  stripeClient,
  webhookSecret,
  billingStore,
  onEvent,
}) {
  const webhookRoute = '/api/billing/webhooks/stripe'
  if (billingStore && !billingStoreSupportsPaymentIntentLookup(billingStore)) {
    throw new Error('Hosted billing store must support payment intent lookup.')
  }

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
        const customerId = resolveStripeId(session.customer)
        const paymentIntentId = resolveStripeId(session.payment_intent)

        if (
          !tenantId ||
          !accountId ||
          !customerId ||
          !paymentIntentId ||
          session.metadata?.source !== 'facet-checkout'
        ) {
          onEvent?.('billing.webhook', 'error', { code: 'missing_metadata', eventType: event.type })
          sendJson(res, 200, { received: true })
          return
        }

        onEvent?.('billing.webhook', 'success', { eventType: event.type, tenantId, accountId })
      } else if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object
        const tenantId = paymentIntent.metadata?.tenantId
        const accountId = paymentIntent.metadata?.accountId
        const customerId = resolveStripeId(paymentIntent.customer)
        const paymentIntentId = paymentIntent.id

        if (
          !tenantId ||
          !accountId ||
          !customerId ||
          !paymentIntentId ||
          paymentIntent.metadata?.source !== 'facet-checkout'
        ) {
          onEvent?.('billing.webhook', 'error', { code: 'missing_metadata', eventType: event.type })
          sendJson(res, 200, { received: true })
          return
        }

        await recordPaidPass({
          billingStore,
          tenantId,
          accountId,
          customerId,
          paymentIntentId,
          purchasedAt: isoFromStripeCreated(paymentIntent.created),
        })

        onEvent?.('billing.webhook', 'success', { eventType: event.type, tenantId, accountId })
      } else if (event.type === 'charge.refunded') {
        const charge = event.data.object
        const paymentIntentId = resolveStripeId(charge.payment_intent)
        if (charge.refunded !== true) {
          // Partial refunds are handled by support out-of-band; they do not alter the one-time pass.
          onEvent?.('billing.webhook', 'success', {
            eventType: event.type,
            paymentIntentId,
            code: 'partial_refund_noop',
          })
          sendJson(res, 200, { received: true })
          return
        }

        const nextState = paymentIntentId
          ? await refundPass({ billingStore, paymentIntentId })
          : null

        if (!nextState) {
          onEvent?.('billing.webhook', 'error', {
            code: 'pass_not_found',
            eventType: event.type,
            paymentIntentId,
          })
          sendJson(res, 200, { received: true })
          return
        }

        onEvent?.('billing.webhook', 'success', {
          eventType: event.type,
          tenantId: nextState.tenantId,
          accountId: nextState.accountId,
        })
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object
        const tenantId = paymentIntent.metadata?.tenantId
        const accountId = paymentIntent.metadata?.accountId
        const customerId = resolveStripeId(paymentIntent.customer)
        const paymentIntentId = paymentIntent.id

        if (!tenantId || !accountId || !paymentIntentId) {
          onEvent?.('billing.webhook', 'error', { code: 'missing_metadata', eventType: event.type })
          sendJson(res, 200, { received: true })
          return
        }

        const nextState = await markPaymentFailed({
          billingStore,
          tenantId,
          accountId,
          customerId,
          paymentIntentId,
        })

        if (!nextState) {
          onEvent?.('billing.webhook', 'success', {
            code: 'pass_not_found_for_failure',
            eventType: event.type,
            paymentIntentId,
          })
          sendJson(res, 200, { received: true })
          return
        }

        onEvent?.('billing.webhook', 'success', {
          eventType: event.type,
          tenantId: nextState.tenantId,
          accountId: nextState.accountId,
        })
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
        (req.method === 'POST' &&
          (url.pathname === customerRoute || url.pathname === checkoutRoute))
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
              sendJson(res, 400, {
                error: 'Stored Stripe customer is deleted and cannot be reused.',
              })
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
            billingPass: state?.billingPass ?? null,
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
          billingPass: state?.billingPass ?? null,
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
            source: 'facet-checkout',
            accessDays: '90',
          },
          // Checkout Session metadata is not automatically copied to the PaymentIntent.
          payment_intent_data: {
            metadata: {
              tenantId: actor.tenantId,
              accountId: actor.accountId,
              userId: actor.userId,
              source: 'facet-checkout',
              accessDays: '90',
            },
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
