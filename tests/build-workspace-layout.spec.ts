import { expect, test, type Page } from '@playwright/test'

const openSampleBuildWorkspace = async (page: Page) => {
  await page.goto('/build')

  const loadSampleButton = page.getByRole('button', { name: 'Load Sample Data' })
  if (await loadSampleButton.isVisible().catch(() => false)) {
    await loadSampleButton.click()
  }

  await expect(page.locator('.workspace')).toBeVisible()

  await page.getByRole('tab', { name: 'Live' }).click()
  await expect(page.locator('.preview-paper')).toBeVisible()
}

test.describe('Build workspace responsive layout', () => {
  for (const viewport of [
    { name: 'tablet', width: 900, height: 800, minPanelHeight: 420, maxPanelHeight: 720 },
    { name: 'tablet short', width: 900, height: 500, minPanelHeight: 420, maxPanelHeight: 720 },
    { name: 'tablet tall', width: 900, height: 1400, minPanelHeight: 420, maxPanelHeight: 720 },
    { name: 'mobile', width: 390, height: 844, minPanelHeight: 360, maxPanelHeight: 640 },
    { name: 'mobile tall', width: 390, height: 1200, minPanelHeight: 360, maxPanelHeight: 640 },
  ]) {
    test('keeps stacked panels scrollable on ' + viewport.name, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openSampleBuildWorkspace(page)

      await expect(page.locator('.workspace')).toHaveCSS('flex-direction', 'column')
      await expect(page.locator('.splitter')).toHaveCSS('display', 'none')

      const layoutMetrics = await page.evaluate(() => {
        const readBox = (selector: string) => {
          const element = document.querySelector(selector)
          if (!(element instanceof HTMLElement)) {
            throw new Error('Missing ' + selector)
          }

          const rect = element.getBoundingClientRect()
          return {
            width: rect.width,
            height: rect.height,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          }
        }

        return {
          appMain: readBox('.app-main'),
          workspace: readBox('.workspace'),
          libraryColumn: readBox('.library-column'),
          leftPanelBody: readBox('.left-panel-body'),
          previewColumn: readBox('.preview-column'),
        }
      })

      expect(layoutMetrics.appMain.scrollHeight).toBeGreaterThan(layoutMetrics.appMain.clientHeight)
      expect(layoutMetrics.workspace.scrollHeight).toBeLessThanOrEqual(layoutMetrics.workspace.clientHeight + 1)
      expect(layoutMetrics.libraryColumn.height).toBeGreaterThanOrEqual(viewport.minPanelHeight)
      expect(layoutMetrics.libraryColumn.height).toBeLessThanOrEqual(viewport.maxPanelHeight)
      expect(layoutMetrics.previewColumn.height).toBeGreaterThanOrEqual(viewport.minPanelHeight)
      expect(layoutMetrics.previewColumn.height).toBeLessThanOrEqual(viewport.maxPanelHeight)
      expect(layoutMetrics.libraryColumn.width).toBeCloseTo(layoutMetrics.workspace.width, 0)
      expect(layoutMetrics.previewColumn.width).toBeCloseTo(layoutMetrics.workspace.width, 0)
      expect(layoutMetrics.leftPanelBody.scrollHeight).toBeGreaterThan(layoutMetrics.leftPanelBody.clientHeight)

      const leftPanelScrollTop = await page.locator('#left-panel-content').evaluate((element) => {
        element.scrollTop = 300
        return element.scrollTop
      })

      expect(leftPanelScrollTop).toBeGreaterThan(0)
    })
  }

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'desktop short', width: 1280, height: 600 },
  ]) {
    test('keeps ' + viewport.name + ' columns side-by-side with the splitter visible', async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openSampleBuildWorkspace(page)

      await expect(page.locator('.workspace')).toHaveCSS('flex-direction', 'row')
      await expect(page.locator('.splitter')).not.toHaveCSS('display', 'none')

      const layoutMetrics = await page.evaluate(() => {
        const readBox = (selector: string) => {
          const element = document.querySelector(selector)
          if (!(element instanceof HTMLElement)) {
            throw new Error('Missing ' + selector)
          }

          const rect = element.getBoundingClientRect()
          return {
            height: rect.height,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          }
        }

        return {
          appMain: readBox('.app-main'),
          workspace: readBox('.workspace'),
          leftPanelBody: readBox('#left-panel-content'),
        }
      })

      expect(layoutMetrics.appMain.scrollHeight).toBeGreaterThan(layoutMetrics.appMain.clientHeight)
      expect(layoutMetrics.workspace.height).toBeGreaterThanOrEqual(520)
      expect(layoutMetrics.leftPanelBody.scrollHeight).toBeGreaterThan(layoutMetrics.leftPanelBody.clientHeight)
    })
  }
})
