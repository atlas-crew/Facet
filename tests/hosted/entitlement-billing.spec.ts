/**
 * Wave 1 Staged Validation — Section 4: AI Entitlement & Billing-State
 *
 * Checklist coverage:
 * - [x] AI request succeeds with active AI Pro entitlement
 * - [x] upgrade_required surfaces when no entitlement
 * - [x] billing_issue surfaces when delinquent
 * - [x] AI denial does not block workspace access or persistence
 * - [x] Billing-state outage surfaces billing_state_error
 * - [x] Recovery path is non-destructive
 */

import { test, expect, type Page } from '@playwright/test'
import type { ProfessionalIdentityV3 } from '../../src/identity/schema'
import type { FacetWorkspaceSnapshot } from '../../src/persistence/contracts'
import { buildMayaPatelIdentityStorageEnvelope } from '../../src/test/fixtures/goldenWorkspace'
import { cloneIdentityFixture } from '../../src/test/fixtures/identityFixture'
import { buildWorkspaceSnapshot } from '../../src/test/fixtures/workspaceSnapshot'
import type { PipelineEntry } from '../../src/types/pipeline'
import {
  installHostedApiMocks,
  injectSupabaseSession,
  jsonResponse,
  makeAccountContext,
  makeEntitlement,
  makeAiDenialResponse,
  WORKSPACE_ID,
} from './fixtures'

const TEST_JOB_DESCRIPTION =
  'Acme Corp needs a staff engineer to own developer enablement, incident response, and reliability rituals across product teams.'

const createPipelineEntry = (overrides: Partial<PipelineEntry> = {}): PipelineEntry => ({
  id: 'pipe-entitlement-jd',
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  tier: '1',
  status: 'researching',
  comp: '$240k-$300k',
  url: 'https://example.com/acme/staff-platform',
  contact: '',
  vectorId: null,
  jobDescription: TEST_JOB_DESCRIPTION,
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: 'Lead with developer enablement and reliability operating model.',
  skillMatch: 'Reliability and cross-team platform ownership.',
  nextStep: 'Analyze the JD.',
  notes: '',
  appMethod: 'unknown',
  response: 'none',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  lastAction: '2026-04-08',
  createdAt: '2026-04-08',
  history: [{ date: '2026-04-08', note: 'Created' }],
  ...overrides,
})

const createIdentity = (): ProfessionalIdentityV3 => ({
  ...cloneIdentityFixture(),
  skills: {
    groups: [],
  },
  search_vectors: [],
})

const createPipelineWorkspaceSnapshot = (): FacetWorkspaceSnapshot => {
  const snapshot = buildWorkspaceSnapshot({
    workspace: {
      id: WORKSPACE_ID,
      name: 'Primary Workspace',
      revision: 1,
      updatedAt: '2026-04-08T00:00:00.000Z',
    },
  })

  return {
    ...snapshot,
    artifacts: {
      ...snapshot.artifacts,
      pipeline: {
        ...snapshot.artifacts.pipeline,
        payload: { entries: [createPipelineEntry()] },
      },
      jdAnalysis: {
        ...snapshot.artifacts.jdAnalysis,
        payload: { analyses: [] },
      },
    },
  }
}

const installIdentity = async (page: Page) => {
  const identity = createIdentity()
  await page.addInitScript(
    ({ envelope }) => {
      window.localStorage.setItem('facet-identity-workspace', JSON.stringify(envelope))
    },
    {
      envelope: buildMayaPatelIdentityStorageEnvelope(identity),
    },
  )
}

const installHostedPipelineMocks = async (
  page: Page,
  options?: Parameters<typeof installHostedApiMocks>[1],
) => {
  await installIdentity(page)
  await installHostedApiMocks(page, {
    ...options,
    workspaceSnapshot: createPipelineWorkspaceSnapshot(),
  })
}

const isAiProxyRequest = (body: unknown): body is { feature?: unknown } => {
  if (!body || typeof body !== 'object') return false
  const candidate = body as Record<string, unknown>
  return (
    typeof candidate.system === 'string' &&
    Array.isArray(candidate.messages) &&
    typeof candidate.feature === 'string'
  )
}

const routeAiProxy = async (page: Page, handler: Parameters<Page['route']>[1]) => {
  await page.route('**/*', (route) => {
    let body: unknown = null
    try {
      body = route.request().postDataJSON()
    } catch {
      body = null
    }

    if (isAiProxyRequest(body)) {
      return handler(route)
    }

    return route.fallback()
  })
}

const openPipelineEntry = async (page: Page) => {
  await page.goto('/pipeline?entry=pipe-entitlement-jd')
  await expect(page.locator('.app-topbar-workspace')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Analyze JD/ })).toBeVisible()
}

const matchExtractionResponse = JSON.stringify({
  summary: 'Acme needs a platform leader for developer enablement and reliability.',
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  requirements: [
    {
      id: 'developer-enablement',
      label: 'Developer enablement',
      priority: 'core',
      evidence: 'own developer enablement',
      tags: ['developer-enablement'],
      keywords: ['developer enablement'],
    },
  ],
  advantage_hypotheses: [],
  positioning_recommendations: ['Lead with developer enablement and reliability rituals.'],
  gap_focus: [],
  warnings: [],
})

const filterAwarenessResponse = JSON.stringify({
  triggered_prioritize: [],
  triggered_avoid: [],
  relevant_awareness: [],
})

test.describe('AI Entitlement & Billing-State', () => {
  test.beforeEach(async ({ page }) => {
    await injectSupabaseSession(page)
  })

  test('AI request succeeds with active AI Pro entitlement', async ({ page }) => {
    await installHostedPipelineMocks(page, {
      entitlement: makeEntitlement(),
    })

    const requestBodies: unknown[] = []
    await routeAiProxy(page, (route) => {
      requestBodies.push(route.request().postDataJSON())
      const responseText =
        requestBodies.length === 1
          ? matchExtractionResponse
          : requestBodies.length === 2
            ? filterAwarenessResponse
            : 'Strong fit because the JD emphasizes developer enablement.'
      return jsonResponse(route, {
        content: [{ type: 'text', text: responseText }],
      })
    })

    await openPipelineEntry(page)

    // Account label should reflect Pro status
    await expect(page.getByRole('link', { name: 'Account' })).toContainText(/Pro/)

    await page.getByRole('button', { name: /Analyze JD/ }).click()

    await expect(page.getByRole('button', { name: /Refresh JD Analysis/ })).toBeVisible({
      timeout: 15_000,
    })
    expect(requestBodies.length).toBeGreaterThan(0)
    expect(requestBodies[0]).toMatchObject({
      feature: 'match.jd-analysis',
    })
  })

  test('upgrade_required surfaces when entitlement is inactive', async ({ page }) => {
    await installHostedPipelineMocks(page, {
      entitlement: {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
    })

    let aiRequestCount = 0
    // Mock AI endpoint to return upgrade_required
    await routeAiProxy(page, (route) => {
      aiRequestCount += 1
      return jsonResponse(route, makeAiDenialResponse('upgrade_required'), 403)
    })

    await openPipelineEntry(page)

    // Account should show Free
    await expect(page.getByRole('link', { name: 'Account' })).toContainText('Free')

    await page.getByRole('button', { name: /Analyze JD/ }).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'AI access denied: upgrade_required' }),
    ).toBeVisible({ timeout: 15_000 })
    expect(aiRequestCount).toBeGreaterThan(0)
  })

  test('billing_issue surfaces when entitlement is refunded', async ({ page }) => {
    await installHostedPipelineMocks(page, {
      entitlement: makeEntitlement({
        status: 'refunded',
        features: [],
        effectiveThrough: null,
      }),
    })

    let aiRequestCount = 0
    // Mock AI endpoint to return billing_issue
    await routeAiProxy(page, (route) => {
      aiRequestCount += 1
      return jsonResponse(route, makeAiDenialResponse('billing_issue'), 403)
    })

    await openPipelineEntry(page)

    // Account link should indicate billing issue
    await expect(page.getByRole('link', { name: 'Account' })).toContainText('Billing issue')

    await page.getByRole('button', { name: /Analyze JD/ }).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'AI access denied: billing_issue' }),
    ).toBeVisible({ timeout: 15_000 })
    expect(aiRequestCount).toBeGreaterThan(0)
  })

  test('AI denial does not block workspace access or persistence', async ({ page }) => {
    await installHostedApiMocks(page, {
      entitlement: {
        planId: 'free',
        status: 'inactive',
        source: 'stripe',
        features: [],
        effectiveThrough: null,
      },
    })

    // Block all AI requests
    await routeAiProxy(page, (route) =>
      jsonResponse(route, makeAiDenialResponse('upgrade_required'), 403),
    )

    await page.goto('/build')

    // Workspace should still load and be functional
    await expect(page.locator('.app-topbar-workspace')).toContainText('Primary Workspace', {
      timeout: 15_000,
    })

    // Sync should be healthy
    await expect(page.locator('.app-topbar-sync')).toContainText(/Ready|Saved/, {
      timeout: 10_000,
    })

    // Workspace dialog should still be accessible
    await page.getByLabel('Hosted workspaces').click()
    await expect(page.getByText('Hosted Workspaces')).toBeVisible()
  })

  test('billing-state outage surfaces billing_state_error', async ({ page }) => {
    // Override account context to return billing_state_error
    await page.route('**/api/account/context', (route) =>
      jsonResponse(route, { error: 'Billing state unavailable', code: 'billing_state_error' }, 502),
    )

    // Still install workspace mocks for any passthrough
    await page.route('**/api/persistence/workspaces', (route) =>
      jsonResponse(route, { workspaces: [] }),
    )

    await injectSupabaseSession(page)
    await page.goto('/build')

    // Should show the billing state error card
    await expect(
      page.getByRole('alert').filter({ hasText: 'Hosted billing state unavailable' }),
    ).toBeVisible({ timeout: 15_000 })

    // Retry and Refresh Billing State buttons should be present
    await expect(page.getByRole('button', { name: 'Retry Hosted Bootstrap' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh Billing State' })).toBeVisible()
  })

  test('recovery path is non-destructive — no delete or reset actions', async ({ page }) => {
    // Set up billing state error
    await page.route('**/api/account/context', (route) =>
      jsonResponse(route, { error: 'Billing state unavailable', code: 'billing_state_error' }, 502),
    )
    await page.route('**/api/persistence/workspaces', (route) =>
      jsonResponse(route, { workspaces: [] }),
    )

    await injectSupabaseSession(page)
    await page.goto('/build')

    await expect(
      page.getByRole('alert').filter({ hasText: 'Hosted billing state unavailable' }),
    ).toBeVisible({ timeout: 15_000 })

    // Grab all visible button text on the error card
    const errorCard = page.getByRole('alert')
    const buttons = errorCard.getByRole('button')
    const buttonTexts = await buttons.allInnerTexts()

    // No button should suggest destructive actions
    for (const text of buttonTexts) {
      const lower = text.toLowerCase()
      expect(lower).not.toContain('delete')
      expect(lower).not.toContain('reset')
      expect(lower).not.toContain('clear')
      expect(lower).not.toContain('remove')
    }

    // Recovery actions should be retry or refresh
    expect(buttonTexts.some((t) => /retry|refresh/i.test(t))).toBe(true)
  })

  test('billing recovery: retry after billing outage resolves', async ({ page }) => {
    let callCount = 0

    await installHostedApiMocks(page)
    await page.route('**/api/account/context', (route) => {
      callCount++
      if (callCount <= 1) {
        // First call: billing outage
        return jsonResponse(
          route,
          { error: 'Billing state unavailable', code: 'billing_state_error' },
          502,
        )
      }
      // Subsequent calls: healthy
      return jsonResponse(route, makeAccountContext())
    })

    await page.goto('/build')

    // Should start in error state
    await expect(
      page.getByRole('alert').filter({ hasText: 'Hosted billing state unavailable' }),
    ).toBeVisible({ timeout: 15_000 })

    // Click retry — second call returns healthy context
    await page.getByRole('button', { name: 'Retry Hosted Bootstrap' }).click()

    // Should recover — workspace becomes visible
    await expect(page.locator('.app-topbar-workspace')).toBeVisible({ timeout: 15_000 })
  })

  test('refresh billing state reloads and recovers after billing outage resolves', async ({
    page,
  }) => {
    let callCount = 0

    await installHostedApiMocks(page)
    await page.route('**/api/account/context', (route) => {
      callCount++
      if (callCount <= 1) {
        return jsonResponse(
          route,
          { error: 'Billing state unavailable', code: 'billing_state_error' },
          502,
        )
      }
      return jsonResponse(route, makeAccountContext())
    })

    await page.goto('/build')

    await expect(
      page.getByRole('alert').filter({ hasText: 'Hosted billing state unavailable' }),
    ).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Refresh Billing State' }).click()

    await expect(page.locator('.app-topbar-workspace')).toBeVisible({ timeout: 15_000 })
    expect(callCount).toBeGreaterThan(1)
  })
})
