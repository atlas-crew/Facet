import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  getDocument: getDocumentMock,
}))

import { extractPdfTextItems, scanResumePdf } from '../utils/resumeScanner/pdf'

type MockPdfTextItem = {
  str: string
  transform: number[]
  width: number
  height?: number
  fontName?: string
}

const buildPdfTextItem = (
  str: string,
  y: number,
  x = 72,
  pageFont = 'Helvetica',
): MockPdfTextItem => ({
  str,
  transform: [12, 0, 0, 12, x, y],
  width: Math.max(str.length * 5.5, 20),
  height: 12,
  fontName: pageFont,
})

const buildPdfFile = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'resume.pdf', {
    type: 'application/pdf',
  })

describe('resumeScanner pdf', () => {
  beforeEach(() => {
    getDocumentMock.mockReset()
    vi.useRealTimers()
  })

  it('extracts normalized text items and page count from pdfjs', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi
          .fn()
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [
                buildPdfTextItem('Nick Ferguson', 760),
                buildPdfTextItem('\u0000Staff Engineer', 744),
                buildPdfTextItem('   ', 728),
                { nope: true },
              ],
            }),
          })
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [buildPdfTextItem('Experience', 700)],
            }),
          }),
      }),
    })

    const result = await extractPdfTextItems(buildPdfFile())

    expect(result.pageCount).toBe(2)
    expect(result.items).toEqual([
      expect.objectContaining({
        text: 'Nick Ferguson',
        x: 72,
        y: 760,
        page: 1,
        fontName: 'Helvetica',
      }),
      expect.objectContaining({
        text: 'Staff Engineer',
        page: 1,
      }),
      expect.objectContaining({
        text: 'Experience',
        page: 2,
      }),
    ])
    expect(getDocumentMock).toHaveBeenCalledWith({
      data: expect.any(Uint8Array),
    })
  })

  it('aborts during page iteration before scanning later pages', async () => {
    const abortController = new AbortController()
    const firstPage = {
      getTextContent: vi.fn().mockImplementation(async () => {
        abortController.abort()
        return {
          items: [buildPdfTextItem('Nick Ferguson', 760)],
        }
      }),
    }

    const getPage = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce({
        getTextContent: vi.fn(),
      })

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage,
      }),
    })

    await expect(
      extractPdfTextItems(buildPdfFile(), { signal: abortController.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: 'The operation was aborted.',
    })
    expect(getPage).toHaveBeenCalledTimes(1)
  })

  it('surfaces pdf load failures from pdfjs', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('Password Required')),
    })

    await expect(extractPdfTextItems(buildPdfFile())).rejects.toThrow('Password Required')
  })

  it('scans a parsed pdf into resume counts and identity content', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T16:45:00.000Z'))

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              buildPdfTextItem('Nick Ferguson', 760),
              buildPdfTextItem('Staff Engineer', 744),
              buildPdfTextItem('nick@example.com | (727) 555-0100 | Tampa, FL | https://github.com/nick', 728),
              buildPdfTextItem('Summary', 696),
              buildPdfTextItem('I build platform systems that make complex delivery work routine.', 680),
              buildPdfTextItem('Experience', 648),
              buildPdfTextItem('Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026', 632),
              buildPdfTextItem('• Ported the platform to Kubernetes-based installs.', 616),
              buildPdfTextItem('• Automated release workflows for on-prem deploys.', 600),
              buildPdfTextItem('Skills', 568),
              buildPdfTextItem('Languages: TypeScript, Python', 552),
              buildPdfTextItem('Infra: Kubernetes, Terraform', 536),
              buildPdfTextItem('Education', 504),
              buildPdfTextItem('St. Petersburg College | AAS, Computer Information Systems | Clearwater, FL | 2020', 488),
            ],
          }),
        }),
      }),
    })

    const result = await scanResumePdf(buildPdfFile())

    expect(result.fileName).toBe('resume.pdf')
    expect(result.pageCount).toBe(1)
    expect(result.scannedAt).toBe('2026-04-05T16:45:00.000Z')
    expect(result.layout).toBe('single-column')
    expect(result.counts).toEqual({
      roles: 1,
      bullets: 2,
      projects: 0,
      skillGroups: 2,
      education: 1,
      extractedBullets: 2,
      decomposedBullets: 0,
      scannedBullets: 2,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    })
    expect(result.identity.identity.name).toBe('Nick Ferguson')
    expect(result.identity.roles[0]?.bullets[0]?.source_text).toBe(
      'Ported the platform to Kubernetes-based installs.',
    )
    expect(result.warnings).toEqual([])
    expect(result.rawText).toContain('Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026')
  })

  it('rejects image-only or empty pdfs at the top-level scan entrypoint', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [],
          }),
        }),
      }),
    })

    await expect(scanResumePdf(buildPdfFile())).rejects.toThrow(/image-only or unreadable/i)
  })

  it('aggregates roles and bullets that continue across multiple pages', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T17:15:00.000Z'))

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi
          .fn()
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [
                buildPdfTextItem('Nick Ferguson', 760),
                buildPdfTextItem('Staff Engineer', 744),
                buildPdfTextItem('nick@example.com | Tampa, FL | https://github.com/nick', 728),
                buildPdfTextItem('Experience', 696),
                buildPdfTextItem('Staff Engineer | Acme Corp | 2022 - Present', 680),
                buildPdfTextItem('• Built the scanner ingestion path.', 664),
              ],
            }),
          })
          .mockResolvedValueOnce({
            getTextContent: vi.fn().mockResolvedValue({
              items: [
                buildPdfTextItem('• Hardened parser edge cases.', 760),
                buildPdfTextItem('Skills', 728),
                buildPdfTextItem('Tooling: React, TypeScript', 712),
              ],
            }),
          }),
      }),
    })

    const result = await scanResumePdf(buildPdfFile())

    expect(result.pageCount).toBe(2)
    expect(result.scannedAt).toBe('2026-04-05T17:15:00.000Z')
    expect(result.counts).toEqual({
      roles: 1,
      bullets: 2,
      projects: 0,
      skillGroups: 1,
      education: 0,
      extractedBullets: 2,
      decomposedBullets: 0,
      scannedBullets: 2,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    })
    expect(result.identity.roles).toEqual([
      expect.objectContaining({
        company: 'Acme Corp',
        title: 'Staff Engineer',
        dates: '2022 - Present',
        bullets: [
          expect.objectContaining({ source_text: 'Built the scanner ingestion path.' }),
          expect.objectContaining({ source_text: 'Hardened parser edge cases.' }),
        ],
      }),
    ])
  })
})
