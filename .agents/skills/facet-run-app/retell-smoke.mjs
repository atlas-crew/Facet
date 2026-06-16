// Drives the Facet identity bullet re-tell loop in a real browser against the
// live proxy, screenshotting each step. See SKILL.md for the launch + seed steps.
//
//   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix /tmp/pw playwright
//   node retell-smoke.mjs            (reads /tmp/facet-seed.json)
//
// Env overrides: FACET_BASE_URL, FACET_ROLE_ID, FACET_BULLET_ID, FACET_SEED, FACET_SHOTS, FACET_PW_DIR
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

// playwright is installed outside this script's tree (default /tmp/pw), so ESM's
// walk-up resolution won't find it — resolve it explicitly from the install dir.
const require = createRequire(import.meta.url)
const pwDir = process.env.FACET_PW_DIR ?? '/tmp/pw/node_modules'
const { chromium } = require(require.resolve('playwright', { paths: [pwDir] }))

const BASE = process.env.FACET_BASE_URL ?? 'http://localhost:5173'
const ROLE = process.env.FACET_ROLE_ID ?? 'contoso'
const BULLET = process.env.FACET_BULLET_ID ?? 'platform-migration'
const SEED_PATH = process.env.FACET_SEED ?? '/tmp/facet-seed.json'
const SHOTS = process.env.FACET_SHOTS ?? '/tmp/facet-shots'

const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
mkdirSync(SHOTS, { recursive: true })

// channel: 'chrome' drives the installed Google Chrome — no Playwright browser download.
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } })
// Seed the persisted identity into localStorage before any app script runs.
await ctx.addInitScript((s) => {
  try {
    localStorage.setItem(s.key, s.value)
  } catch {}
}, seed)

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const step = async (n, label, fn) => {
  try {
    await fn()
    await page.screenshot({ path: `${SHOTS}/${n}-${label}.png` })
    console.log(`OK   ${n} ${label}`)
  } catch (err) {
    await page.screenshot({ path: `${SHOTS}/${n}-${label}-FAIL.png` }).catch(() => {})
    console.log(`FAIL ${n} ${label}: ${err.message.split('\n')[0]}`)
    throw err
  }
}

try {
  await step('1', 'inspector', async () => {
    await page.goto(`${BASE}/identity?sel=bullet:${ROLE}:${BULLET}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.getByRole('button', { name: 'Re-tell' }).waitFor({ timeout: 20000 })
  })

  await step('2', 'preview', async () => {
    await page.getByRole('button', { name: 'Re-tell' }).click()
    // Real LLM round-trip through the proxy — allow generous time.
    await page.getByText(/This reads as/i).waitFor({ timeout: 60000 })
  })

  await step('3', 'confirmed', async () => {
    await page.getByRole('button', { name: 'Confirm level' }).click()
    await page.getByText('Level', { exact: true }).waitFor({ timeout: 10000 })
  })

  const levelName = await page.locator('.inspector-level-name').first().textContent()
  console.log(`LEVEL_READOUT=${(levelName || '').trim()}`)
} finally {
  console.log('CONSOLE_ERRORS=' + JSON.stringify(errors))
  await browser.close()
}
