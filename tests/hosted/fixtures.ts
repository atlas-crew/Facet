/**
 * Shared API mock fixtures for Wave 1 hosted validation tests.
 *
 * These mirror the real types in src/types/hosted.ts and the response shapes
 * from the proxy API. Tests compose them via spread to override specific fields.
 */

import type { Page, Route } from '@playwright/test'
import type { FacetWorkspaceSnapshot } from '../../src/persistence/contracts'
import { buildWorkspaceSnapshot } from '../../src/test/fixtures/workspaceSnapshot'

// ── Fixture data ──────────────────────────────────────────────

export const TENANT_ID = 'tenant-test-001'
export const ACCOUNT_ID = 'account-test-001'
export const USER_ID = 'user-test-001'
export const USER_EMAIL = 'beta-tester@facet.dev'
export const WORKSPACE_ID = 'ws-test-001'
export const WORKSPACE_ID_2 = 'ws-test-002'
export const STRIPE_CUSTOMER_ID = 'cus_test_001'
export const STRIPE_SUBSCRIPTION_ID = 'sub_test_001'

export function makeAccountContext(overrides?: Record<string, unknown>) {
  return {
    context: {
      deploymentMode: 'hosted',
      account: {
        tenantId: TENANT_ID,
        accountId: ACCOUNT_ID,
        deploymentMode: 'hosted',
        defaultWorkspaceId: WORKSPACE_ID,
      },
      actor: {
        userId: USER_ID,
        tenantId: TENANT_ID,
        email: USER_EMAIL,
      },
      memberships: [{ workspaceId: WORKSPACE_ID, role: 'owner', isDefault: true }],
      billingCustomer: {
        provider: 'stripe',
        customerId: STRIPE_CUSTOMER_ID,
      },
      billingSubscription: null,
      entitlement: {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
      ...overrides,
    },
  }
}

export function makeWorkspaceDirectory(workspaces?: unknown[]) {
  return {
    workspaces: workspaces ?? [
      {
        workspaceId: WORKSPACE_ID,
        name: 'Primary Workspace',
        revision: 1,
        updatedAt: '2026-04-08T00:00:00.000Z',
        role: 'owner',
        isDefault: true,
      },
    ],
    actor: {
      tenantId: TENANT_ID,
      userId: USER_ID,
      workspaceIds: [WORKSPACE_ID],
    },
  }
}

export function makeWorkspaceSnapshot(
  workspaceId = WORKSPACE_ID,
  workspaceName = 'Primary Workspace',
) {
  const now = '2026-04-08T00:00:00.000Z'
  const snapshot = buildWorkspaceSnapshot({
    tenantId: TENANT_ID,
    userId: USER_ID,
    workspace: {
      id: workspaceId,
      name: workspaceName,
      revision: 1,
      updatedAt: now,
    },
  })

  return {
    snapshot: {
      ...snapshot,
      artifacts: Object.fromEntries(
        Object.entries(snapshot.artifacts).map(([artifactType, artifact]) => [
          artifactType,
          {
            ...artifact,
            artifactId: `${workspaceId}:${artifact.artifactType}`,
            workspaceId,
            revision: 1,
            updatedAt: now,
          },
        ]),
      ) as typeof snapshot.artifacts,
      exportedAt: now,
    },
  }
}

type WorkspaceSnapshotProvider =
  | FacetWorkspaceSnapshot
  | ((workspaceId: string) => FacetWorkspaceSnapshot)

const makeWorkspaceSnapshotResponse = (
  provider: WorkspaceSnapshotProvider | undefined,
  workspaceId = WORKSPACE_ID,
  workspaceName = 'Primary Workspace',
) => {
  if (!provider) {
    return makeWorkspaceSnapshot(workspaceId, workspaceName)
  }

  const snapshot = typeof provider === 'function' ? provider(workspaceId) : provider
  return { snapshot: structuredClone(snapshot) }
}

export function makeCreatedWorkspace(name = 'New Workspace', id = WORKSPACE_ID_2) {
  return {
    workspace: {
      workspaceId: id,
      name,
      revision: 1,
      updatedAt: new Date().toISOString(),
      role: 'owner',
      isDefault: false,
    },
    actor: {
      tenantId: TENANT_ID,
      userId: USER_ID,
      workspaceIds: [WORKSPACE_ID, id],
    },
  }
}

export function makeRenamedWorkspace(id: string, name: string) {
  return {
    workspace: {
      workspaceId: id,
      name,
      revision: 2,
      updatedAt: new Date().toISOString(),
      role: 'owner',
      isDefault: id === WORKSPACE_ID,
    },
    actor: {
      tenantId: TENANT_ID,
      userId: USER_ID,
      workspaceIds: [WORKSPACE_ID, WORKSPACE_ID_2],
    },
  }
}

export function makeDeletedWorkspace(id: string) {
  return {
    deletedWorkspaceId: id,
    defaultWorkspaceId: WORKSPACE_ID,
    actor: {
      tenantId: TENANT_ID,
      userId: USER_ID,
      workspaceIds: [WORKSPACE_ID],
    },
  }
}

export function makeEntitlement(overrides?: Record<string, unknown>) {
  return {
    planId: 'ai-pro',
    status: 'active',
    source: 'stripe',
    features: [
      'build.jd-analysis',
      'build.bullet-reframe',
      'identity.extract',
      'identity.deepen',
      'match.jd-analysis',
      'research.profile-inference',
      'research.search',
      'prep.generate',
      'letters.generate',
      'linkedin.generate',
      'debrief.generate',
    ],
    effectiveThrough: '2026-07-08T00:00:00.000Z',
    ...overrides,
  }
}

export function makeAiDenialResponse(
  reason: 'upgrade_required' | 'billing_issue',
  feature = 'build.jd-analysis',
) {
  return {
    error: `AI access denied: ${reason}`,
    code: 'ai_access_denied',
    reason,
    feature,
  }
}

// ── Route helpers ──────────────────────────────────────────────

/** Fulfill a route with a JSON response. */
export function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

/**
 * Install the standard hosted API mock scaffold.
 * Returns handles for each endpoint so tests can override specific responses.
 */
export async function installHostedApiMocks(
  page: Page,
  options?: {
    accountContext?: Record<string, unknown>
    workspaces?: unknown[]
    entitlement?: Record<string, unknown> | null
    failPersistence?: boolean
    workspaceSnapshot?: WorkspaceSnapshotProvider
  },
) {
  const entitlement = options?.entitlement === undefined ? undefined : options?.entitlement
  const contextOverrides: Record<string, unknown> = {
    ...options?.accountContext,
  }
  if (entitlement !== undefined) {
    contextOverrides.entitlement = entitlement
  }

  // Account context
  await page.route('**/api/account/context', (route) =>
    jsonResponse(route, makeAccountContext(contextOverrides)),
  )

  // Workspace directory
  await page.route('**/api/persistence/workspaces', (route) => {
    if (route.request().method() === 'GET') {
      return jsonResponse(route, makeWorkspaceDirectory(options?.workspaces))
    }
    if (route.request().method() === 'POST') {
      return jsonResponse(route, makeCreatedWorkspace(), 201)
    }
    return route.continue()
  })

  // Individual workspace (load/save)
  await page.route(/\/api\/persistence\/workspaces\/[^/]+$/, (route) => {
    const method = route.request().method()
    if (options?.failPersistence) {
      return jsonResponse(
        route,
        { error: 'Persistence unavailable', code: 'workspace_save_error' },
        500,
      )
    }
    if (method === 'GET') {
      return jsonResponse(route, makeWorkspaceSnapshotResponse(options?.workspaceSnapshot))
    }
    if (method === 'PUT') {
      return jsonResponse(route, makeWorkspaceSnapshotResponse(options?.workspaceSnapshot))
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      return jsonResponse(route, makeRenamedWorkspace(WORKSPACE_ID, body?.name ?? 'Renamed'))
    }
    if (method === 'DELETE') {
      return jsonResponse(route, makeDeletedWorkspace(WORKSPACE_ID_2))
    }
    return route.continue()
  })
}

/**
 * Inject a fake Supabase session into localStorage so the app
 * sees the user as authenticated without going through OAuth.
 *
 * Instead of guessing the storage key from the Supabase URL (which may
 * differ between test env and built app), this intercepts
 * `Storage.prototype.getItem` to return a fake session for ANY
 * `sb-*-auth-token` key that the Supabase GoTrue client reads.
 *
 * Call this before navigating to any page.
 */
export async function injectSupabaseSession(page: Page) {
  const fakeSession = {
    access_token: 'test-access-token-wave1',
    refresh_token: 'test-refresh-token-wave1',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: USER_ID,
      email: USER_EMAIL,
      app_metadata: { provider: 'github' },
      user_metadata: { full_name: 'Beta Tester' },
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  }

  await page.addInitScript((session) => {
    const sessionJson = JSON.stringify(session)
    const nativeGetItem = Storage.prototype.getItem

    // Intercept reads: if the Supabase client asks for its auth key
    // and nothing is stored yet, return our fake session.
    Storage.prototype.getItem = function (key: string) {
      if (typeof key === 'string' && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const stored = nativeGetItem.call(this, key)
        if (!stored) {
          return sessionJson
        }
        return stored
      }
      return nativeGetItem.call(this, key)
    }
  }, fakeSession)

  // Also intercept Supabase GoTrue token refresh calls so
  // the client doesn't try to validate our fake token over HTTP.
  await page.route('**/auth/v1/token**', (route) => jsonResponse(route, fakeSession))
  await page.route('**/auth/v1/user', (route) => jsonResponse(route, fakeSession.user))
}
