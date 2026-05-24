import { test } from '@playwright/test'
import { installHostedApiMocks, injectSupabaseSession } from './fixtures'

test('diagnose hosted bootstrap', async ({ page }) => {
  const errors: string[] = []
  const logs: string[] = []

  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`
    logs.push(text)
    if (msg.type() === 'error') errors.push(text)
  })

  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`)
  })

  await installHostedApiMocks(page)
  await injectSupabaseSession(page)
  await page.goto('/build', { waitUntil: 'networkidle' })

  // Wait a bit for async bootstrap
  await page.waitForTimeout(5000)

  // Dump what we see
  const bodyText = await page.locator('body').innerText()
  console.log('=== PAGE TEXT ===')
  console.log(bodyText)
  console.log('=== ERRORS ===')
  for (const e of errors) console.log(e)
  console.log('=== RELEVANT LOGS ===')
  for (const l of logs.filter(
    (l) =>
      l.includes('hosted') || l.includes('error') || l.includes('Error') || l.includes('persist'),
  )) {
    console.log(l)
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/hosted-diag.png', fullPage: true })

  if (errors.length > 0) {
    console.log(`Found ${errors.length} errors`)
  }
})
