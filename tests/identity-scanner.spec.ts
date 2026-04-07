import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const QPDF_BIN = process.env.QPDF_BIN ?? 'qpdf'
const OVERSIZED_PDF_BYTES = 10 * 1024 * 1024 + 1
const OVERLONG_PAGE_COUNT = 11

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

const buildMultiPagePdf = (pages: string[][]): Buffer => {
  const fontObjectNumber = 3 + pages.length
  const pageObjectNumbers = pages.map((_, index) => 3 + index)
  const contentObjectNumbers = pages.map((_, index) => fontObjectNumber + 1 + index)
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    ...pageObjectNumbers.map(
      (pageObjectNumber, index) =>
        `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumbers[index]} 0 R >>\nendobj\n`,
    ),
    `${fontObjectNumber} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    ...pages.map((lines, index) => {
      const content = [
        'BT',
        '/F1 12 Tf',
        '14 TL',
        '72 760 Td',
        ...lines.flatMap((line, lineIndex) =>
          lineIndex === 0 ? [`(${escapePdfText(line)}) Tj`] : ['T*', `(${escapePdfText(line)}) Tj`],
        ),
        'ET',
      ].join('\n')

      return `${contentObjectNumbers[index]} 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`
    }),
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

const alternateResumePdf = () =>
  buildPdf([
    'JANE PLATFORM',
    'jane@example.com',
    '555.0100',
    'Seattle, WA',
    'PROFESSIONAL EXPERIENCE',
    'Staff Platform Engineer | Example Corp | Jan 2020 - Present',
    '- Replaced the scanner payload cleanly.',
    'Projects',
    'Orbit: Internal developer portal.',
  ])

const multiRoleResumePdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    '- Built the first platform.',
    'Platform Engineer | ThreatX | Jan 2022 - Feb 2025',
    '- Scaled the second platform.',
  ])

const multiBulletResumePdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    '- Built the first platform.',
    '- Automated the second workflow.',
    '- Stabilized the third service.',
  ])

const multiPageResumePdf = () =>
  buildMultiPagePdf([
    [
      'NICK FERGUSON',
      'nick@atlascrew.dev',
      'PROFESSIONAL EXPERIENCE',
      'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
      '- Built the first platform.',
    ],
    [
      'Projects',
      'Facet: Vector-based job search platform.',
      'Education',
      'St. Petersburg College, Clearwater, FL. AAS, Computer Information Systems',
    ],
  ])

const encryptedResumePdf = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'facet-scanner-encrypted-'))
  const inputPath = join(tempDir, 'resume.pdf')
  const outputPath = join(tempDir, 'resume.locked.pdf')

  try {
    writeFileSync(
      inputPath,
      buildPdf([
        'NICK FERGUSON',
        'nick@atlascrew.dev',
        'PROFESSIONAL EXPERIENCE',
        'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
        '- Built the first platform.',
      ]),
    )
    execFileSync(QPDF_BIN, ['--encrypt', 'userpass', 'ownerpass', '256', '--', inputPath, outputPath])
    return readFileSync(outputPath)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const textlessPdf = () => buildPdf([])

const maliciousLinksPdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    'javascript:alert(1) | data:text/html,<script>alert(2)</script> | github.com/NickCrew',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    '- Built the first platform.',
  ])

const contactOnlyPdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    '727.266.8813',
    'Tampa, FL',
  ])

const oversizedPdf = () =>
  Buffer.concat([
    Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8'),
    Buffer.alloc(OVERSIZED_PDF_BYTES - Buffer.byteLength('%PDF-1.4\n%%EOF\n', 'utf8'), 0x20),
  ])

const tooManyPagesPdf = () =>
  buildMultiPagePdf(
    Array.from({ length: OVERLONG_PAGE_COUNT }, (_, index) =>
      index === 0
        ? [
            'NICK FERGUSON',
            'nick@atlascrew.dev',
            'PROFESSIONAL EXPERIENCE',
            'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
          ]
        : [`Page ${index + 1}`],
    ),
  )

const unstructuredPdf = () =>
  buildPdf([
    'Meeting notes from Tuesday',
    'Follow up with the vendor about pricing',
    'Risk review next week',
  ])

const circularPageTreePdf = () =>
  Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [2 0 R] /Count 1 >>
endobj
xref
0 3
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
trailer
<< /Size 3 /Root 1 0 R >>
startxref
115
%%EOF
`,
    'utf8',
  )

const zeroBulletRolePdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    'Projects',
    'Facet: Vector-based job search platform.',
  ])

const contactXssPdf = () =>
  buildPdf([
    '<img src=x onerror=alert(1)>',
    '"><script>alert(2)</script>',
    '<svg onload=alert(3)>',
    'Remote',
    'PROFESSIONAL EXPERIENCE',
    'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
    '- Preserved contact payloads safely.',
  ])

const roleXssPdf = () =>
  buildPdf([
    'NICK FERGUSON',
    'nick@atlascrew.dev',
    'PROFESSIONAL EXPERIENCE',
    '<img src=x onerror=alert(1)> | A10 Networks | Feb 2025 - Mar 2026',
    '- <script>alert(2)</script>',
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

test('recovers with a valid pdf after a rejected upload', async ({ page }) => {
  await page.goto('/identity')

  const contactSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Contact' }) })
  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  const uploadInput = page.locator('input[type="file"][accept="application/pdf,.pdf"]')

  await uploadInput.setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n', 'utf8'),
  })

  await expect(page.getByRole('alert')).toContainText(/resume scan failed|invalid pdf|invalid root reference|malformed/i)
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)

  await uploadInput.setInputFiles({
    name: 'scanner-acceptance.pdf',
    mimeType: 'application/pdf',
    buffer: sampleResumePdf(),
  })

  await expect(page.locator('.identity-alert')).toHaveText('')
  await expect(page.locator('.identity-notice')).toContainText(
    /scanned scanner-acceptance.pdf into a structured identity shell/i,
  )
  await expect(contactSection.locator('input[value="NICK FERGUSON"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="A10 Networks"]')).toBeVisible()
})

test('shows an error for zero-byte pdf uploads without rendering scanned sections', async ({ page }) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'empty.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(0),
  })

  await expect(page.getByRole('alert')).toContainText(/resume scan failed|invalid pdf|unexpected server response|missing pdf|empty/i)
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for circular-reference pdf uploads without rendering scanned sections', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'circular-page-tree.pdf',
    mimeType: 'application/pdf',
    buffer: circularPageTreePdf(),
  })

  await expect(page.getByRole('alert')).toContainText(
    /resume scan failed|circular reference|pages tree contains circular reference|invalid pdf/i,
  )
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for oversized pdf uploads before rendering scanned sections', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: oversizedPdf(),
  })

  await expect(page.getByRole('alert')).toContainText(/10 mb|smaller pdf|paste the resume text/i)
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for password-protected pdf uploads without rendering scanned sections', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'locked.pdf',
    mimeType: 'application/pdf',
    buffer: encryptedResumePdf(),
  })

  await expect(page.getByRole('alert')).toContainText(
    /resume scan failed|password|encrypted|no password given|incorrect password/i,
  )
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for pdfs that exceed the page-count limit without rendering scanned sections', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'too-many-pages.pdf',
    mimeType: 'application/pdf',
    buffer: tooManyPagesPdf(),
  })

  await expect(page.getByRole('alert')).toContainText(/10 pages|shorter pdf|split the resume/i)
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('shows an error for textless pdf uploads without rendering scanned sections', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'textless.pdf',
    mimeType: 'application/pdf',
    buffer: textlessPdf(),
  })

  await expect(page.getByRole('alert')).toContainText(
    /image-only|unreadable|paste text instead|resume scan failed/i,
  )
  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
})

test('drops malicious link schemes while preserving valid extracted links', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', async (dialog) => {
    dialogSeen = true
    await dialog.dismiss()
  })

  await page.goto('/identity')

  const contactSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Contact' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'malicious-links.pdf',
    mimeType: 'application/pdf',
    buffer: maliciousLinksPdf(),
  })

  await expect(contactSection.getByLabel('Links')).toHaveValue(/https:\/\/github\.com\/NickCrew/)
  await expect(contactSection.getByLabel('Links')).not.toHaveValue(/javascript:|data:text\/html/i)
  expect(dialogSeen).toBe(false)
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

test('replacing the uploaded pdf without clearing swaps the scanned structure', async ({ page }) => {
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
  const uploadInput = page.locator('input[type="file"][accept="application/pdf,.pdf"]')

  await uploadInput.setInputFiles({
    name: 'scanner-acceptance.pdf',
    mimeType: 'application/pdf',
    buffer: sampleResumePdf(),
  })

  await expect(contactSection.locator('input[value="NICK FERGUSON"]')).toBeVisible()
  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()

  await uploadInput.setInputFiles({
    name: 'alternate-resume.pdf',
    mimeType: 'application/pdf',
    buffer: alternateResumePdf(),
  })

  await expect(contactSection.locator('input[value="JANE PLATFORM"]')).toBeVisible()
  await expect(contactSection.locator('input[value="jane@example.com"]')).toBeVisible()
  await expect(contactSection.locator('input[value="Seattle, WA"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Example Corp"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Staff Platform Engineer"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Jan 2020 - Present"]')).toBeVisible()
  await expect(projectsSection.locator('input[value="Orbit"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue('Internal developer portal.')
  await expect(skillsSection).toContainText('No skill groups were parsed from this PDF.')
  await expect(educationSection).toContainText('No education entries were parsed from this PDF.')
  await expect(skillsSection.locator('input[value="Languages"]')).toHaveCount(0)
  await expect(educationSection.locator('input[value="St. Petersburg College"]')).toHaveCount(0)

  await expect(contactSection.locator('input[value="NICK FERGUSON"]')).toHaveCount(0)
  await expect(projectsSection.locator('input[value="Facet"]')).toHaveCount(0)
})

test('renders html-like pdf text as inert scanned content', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', async (dialog) => {
    dialogSeen = true
    await dialog.dismiss()
  })

  await page.goto('/identity')

  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'html-like-text.pdf',
    mimeType: 'application/pdf',
    buffer: buildPdf([
      'NICK FERGUSON',
      'nick@atlascrew.dev',
      'PROFESSIONAL EXPERIENCE',
      'Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026',
      '- Kept untrusted pdf text inert.',
      'Projects',
      'Facet: <script>alert(1)</script> <img src=x onerror=alert(1)>',
    ]),
  })

  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue(
    '<script>alert(1)</script> <img src=x onerror=alert(1)>',
  )
  expect(dialogSeen).toBe(false)
})

test('preserves encoded payloads as inert scanned values', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', async (dialog) => {
    dialogSeen = true
    await dialog.dismiss()
  })

  await page.goto('/identity')

  const contactSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Contact' }) })
  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'encoded-payload.pdf',
    mimeType: 'application/pdf',
    buffer: readFileSync(new URL('./fixtures/identity-scanner-unicode.pdf', import.meta.url)),
  })

  await expect(contactSection.locator('input[value="JOSÉ GARCÍA"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue(
    '＜script＞alert(1)＜/script＞ café 東京',
  )
  expect(dialogSeen).toBe(false)
})

test('parses multiple roles from a single resume pdf', async ({ page }) => {
  await page.goto('/identity')

  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'multi-role.pdf',
    mimeType: 'application/pdf',
    buffer: multiRoleResumePdf(),
  })

  await expect(page.getByLabel('Roles: 2')).toBeVisible()
  await expect(rolesSection.locator('input[value="A10 Networks"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Senior Platform Engineer"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Feb 2025 - Mar 2026"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="ThreatX"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Platform Engineer"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Jan 2022 - Feb 2025"]')).toBeVisible()
})

test('parses multiple bullets for a single role in source order', async ({ page }) => {
  await page.goto('/identity')

  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  const bulletSources = rolesSection.getByLabel(/Bullet \d+ Source/)

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'multi-bullet.pdf',
    mimeType: 'application/pdf',
    buffer: multiBulletResumePdf(),
  })

  await expect(page.getByLabel('Bullets: 3')).toBeVisible()
  await expect(bulletSources).toHaveCount(3)
  await expect(bulletSources.nth(0)).toHaveValue('Built the first platform.')
  await expect(bulletSources.nth(1)).toHaveValue('Automated the second workflow.')
  await expect(bulletSources.nth(2)).toHaveValue('Stabilized the third service.')
})

test('parses project and education content from the second page of a pdf', async ({ page }) => {
  await page.goto('/identity')

  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  const educationSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Education' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'multi-page.pdf',
    mimeType: 'application/pdf',
    buffer: multiPageResumePdf(),
  })

  await expect(page.getByLabel('Projects: 1')).toBeVisible()
  await expect(page.getByLabel('Education: 1')).toBeVisible()
  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
  await expect(projectsSection.locator('textarea')).toHaveValue('Vector-based job search platform.')
  await expect(educationSection.locator('input[value="St. Petersburg College"]')).toBeVisible()
  await expect(educationSection.locator('input[value="Clearwater, FL"]')).toBeVisible()
})

test('falls back to paste mode for contact-only pdfs without role structure', async ({ page }) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'contact-only.pdf',
    mimeType: 'application/pdf',
    buffer: contactOnlyPdf(),
  })

  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
  await expect(page.getByText(/role parsing did not|structural role parsing failed/i)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Source Material' })).toHaveValue(
    /NICK FERGUSON[\s\S]*nick@atlascrew.dev[\s\S]*727.266.8813[\s\S]*Tampa, FL/,
  )
})

test('falls back to paste mode for a valid pdf with no recognizable resume structure', async ({
  page,
}) => {
  await page.goto('/identity')

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'meeting-notes.pdf',
    mimeType: 'application/pdf',
    buffer: unstructuredPdf(),
  })

  await expect(page.locator('section.identity-scan-section')).toHaveCount(0)
  await expect(page.getByText(/role parsing did not|structural role parsing failed/i)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Source Material' })).toHaveValue(
    /Meeting notes from Tuesday[\s\S]*Follow up with the vendor about pricing[\s\S]*Risk review next week/,
  )
})

test('renders a role header even when no bullets follow it', async ({ page }) => {
  await page.goto('/identity')

  const scanStatus = page.locator('.identity-scan-status')
  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  const projectsSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'zero-bullet-role.pdf',
    mimeType: 'application/pdf',
    buffer: zeroBulletRolePdf(),
  })

  await expect(page.getByLabel('Roles: 1')).toBeVisible()
  await expect(scanStatus.getByRole('group', { name: 'Bullets: 0', exact: true })).toBeVisible()
  await expect(rolesSection.locator('input[value="A10 Networks"]')).toBeVisible()
  await expect(rolesSection.locator('input[value="Senior Platform Engineer"]')).toBeVisible()
  await expect(rolesSection.getByLabel(/Bullet \d+ Source/)).toHaveCount(0)
  await expect(projectsSection.locator('input[value="Facet"]')).toBeVisible()
})

test('renders html-like contact payloads as inert field values', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', async (dialog) => {
    dialogSeen = true
    await dialog.dismiss()
  })

  await page.goto('/identity')

  const contactSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Contact' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'contact-xss.pdf',
    mimeType: 'application/pdf',
    buffer: contactXssPdf(),
  })

  await expect(contactSection.getByLabel('Name')).toHaveValue('<img src=x onerror=alert(1)>')
  await expect(contactSection.getByLabel('Email')).toHaveValue('')
  await expect(contactSection.getByLabel('Phone')).toHaveValue('')
  expect(dialogSeen).toBe(false)
})

test('renders html-like role and bullet payloads as inert field values', async ({ page }) => {
  let dialogSeen = false
  page.on('dialog', async (dialog) => {
    dialogSeen = true
    await dialog.dismiss()
  })

  await page.goto('/identity')

  const rolesSection = page
    .locator('section.identity-scan-section')
    .filter({ has: page.getByRole('heading', { name: 'Roles' }) })

  await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: 'role-xss.pdf',
    mimeType: 'application/pdf',
    buffer: roleXssPdf(),
  })

  await expect(rolesSection.locator('input[value="<img src=x onerror=alert(1)>"]')).toBeVisible()
  await expect(rolesSection.getByLabel('Bullet 1 Source')).toHaveValue('<script>alert(2)</script>')
  expect(dialogSeen).toBe(false)
})
