import { test, expect } from '@playwright/test'
import { buildMayaPatelGoldenWorkspace } from '../../src/test/fixtures/goldenWorkspace'
import { installHostedApiMocks, injectSupabaseSession, WORKSPACE_ID } from './fixtures'

test.describe('Golden hosted workspace', () => {
  test('hydrates Maya/Pillar research data from hosted persistence mocks', async ({ page }) => {
    const golden = buildMayaPatelGoldenWorkspace({
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Primary Workspace',
    })

    await page.addInitScript(
      ({ key, envelope }) => {
        window.localStorage.setItem(key, JSON.stringify(envelope))
      },
      {
        key: golden.identityStorageKey,
        envelope: golden.identityStorageEnvelope,
      },
    )
    await injectSupabaseSession(page)
    await installHostedApiMocks(page, { workspaceSnapshot: golden.snapshot })

    await page.goto('/research')
    await expect(page.locator('.app-topbar-workspace')).toContainText('Primary Workspace', {
      timeout: 15_000,
    })

    await page.getByRole('tab', { name: 'Results Viewer' }).click()

    const pillarCard = page.locator('.research-result-card').filter({ hasText: 'Pillar Systems' })
    await expect(pillarCard).toContainText('Senior Security Engineer')
    await expect(pillarCard).toContainText('Maya can pair PCI tokenization proof')
  })
})
