import { expect, test } from '@playwright/test'

const escapePdfText = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')

const buildPdf = (lines: string[]): Buffer => {
  const content = [
    'BT',
    '/F1 12 Tf',
    '14 TL',
    '72 760 Td',
    ...lines.flatMap((line, index) => (index === 0 ? [`(${escapePdfText(line)}) Tj`] : ['T*', `(${escapePdfText(line)}) Tj`])),
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += object
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'utf8')
}

const sampleResumePdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    '727.266.8813',
    'Tampa, FL',
    'github.com/NickCrew | linkedin.com/in/ncferguson | portfolio.atlascrew.dev',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    '- Took the product from SaaS-only to deployable on customer-managed hardware.',
    'SKILLS',
    'Languages: TypeScript, Rust',
    'Projects',
    'Facet: Vector-based job search platform.',
    'Education',
    'St. Petersburg College, Clearwater, FL. AAS, Computer Information Systems',
  ])

test('uploads, parses, clears, and rescans a resume PDF with projects and education', async ({
  page,
}) => {
  await page.goto('/identity')
  const contactSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Contact' }) })
  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  const skillsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Skills' }) })
  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  const educationSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Education' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'scanner-acceptance.pdf',
    mimeType: 'application/pdf',
    buffer: sampleResumePdf(),
  })

  await expect(contactSection.locator('input[value="NICK FERGUSON"]')).toBeVisible()
  await expect(contactSection.locator('input[value="nick@atlascrew.dev"]')).toBeVisible()
  await expect(contactSection.locator('input[value="727.266.8813"]')).toBeVisible()
  await expect(contactSection.locator('input[value="Tampa, FL"]')).toBeVisible()
  await expect(contactSection.locator('textarea').first()).toHaveValue(
    /https:\/\/github.com\/NickCrew[\s\S]*https:\/\/linkedin.com\/in\/ncferguson[\s\S]*https:\/\/portfolio.atlascrew.dev/,
  )
  await expect(rolesSection.locator('input[value="A10 Networks"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Senior Platform Engineer"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Feb 2025 - Mar 2026"]')).toBeVisible()
  await expect(
    rolesSection.locator('textarea').filter({ hasText: 'Took the product from SaaS-only to deployable on customer-managed hardware.' }),
  ).toBeVisible()
  await expect(skillsSection.locator('input[value="Languages"]')).toBeVisible()
  await expect(skillsSection.locator('input[value="TypeScript"]')).toBeVisible()
  await expect(skillsSection.locator('input[value="Rust"]')).toBeVisible()
  await expect(page.getByLabel('Projects: 1')).toBeVisible()
  await expect(page.getByLabel('Education: 1')).toBeVisible()
  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue('Vector-based job search platform.')
  await expect(educationSection.locator('input[value="St. Petersburg College"]')).toBeVisible()
  await expect(
    educationSection.locator('input[value="AAS, Computer Information Systems"]'),
  ).toBeVisible()
  await expect(educationSection.locator('input[value="Clearwater, FL"]')).toBeVisible()

  await page.getByRole('button', { name: 'Clear Scan' }).click()
  await expect(page.getByText('Cleared the scanned resume structure.')).toBeVisible()
  await expect(projectsSection.locator('input[value="Facet"]')).toHaveCount(0)

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'scanner-acceptance.pdf',
    mimeType: 'application/pdf',
    buffer: sampleResumePdf(),
  })

  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
  await expect(educationSection.locator('input[value="Clearwater, FL"]')).toBeVisible()
})

test('rejects non-pdf uploads before scanning', async ({ page }) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'not-a-resume.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('plain text only', 'utf8'),
  })

  await expect(page.getByRole('alert')).toContainText('Resume Scanner v1 only supports PDF uploads.')
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for malformed pdf uploads without rendering scanned sections', async ({ page }) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'utf8'),
  })

  await expect(page.getByRole('alert')).toContainText(/resume scan failed|invalid pdf|invalid root reference|malformed/i)
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('preserves escaped parentheses and backslashes from pdf text', async ({ page }) => {
  await page.goto('/identity')

  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'special-chars.pdf',
    mimeType: 'application/pdf',
    buffer: buildPdf([
      'NICK FERGUSON',
      'nick@atlascrew.dev',
      'PROFESSIONAL EXPERIENCE',
      'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
      '- Built the scanner acceptance harness.',
      'Projects',
      'Facet: Windows path C:\\tools\\facet (preview build)',
    ]),
  })

  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue(
    'Windows path C:\\tools\\facet (preview build)',
  )
})
