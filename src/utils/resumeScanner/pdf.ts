import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseResumeTextItems } from './parser'
import type { ResumeTextItem } from './types'

type PdfDocumentHandle = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>

// Safety limits for untrusted PDF input.
const MAX_PDF_FILE_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGE_COUNT = 10
const MAX_PDF_TEXT_ITEMS = 5000
const MAX_PDF_TEXT_CHARS = 200_000
const MAX_PDF_FILE_MEGABYTES = MAX_PDF_FILE_BYTES / (1024 * 1024)

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).toString()

const isPdfTextItem = (value: unknown): value is {
  str: string
  transform: number[]
  width: number
  height?: number
  fontName?: string
} =>
  typeof value === 'object' &&
  value !== null &&
  'str' in value &&
  'transform' in value &&
  Array.isArray((value as { transform: unknown }).transform)

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
}

const throwIfUnsupportedSize = (file: File) => {
  if (file.size <= MAX_PDF_FILE_BYTES) {
    return
  }

  throw new Error(
    `Resume Scanner v1 only supports PDFs up to ${MAX_PDF_FILE_MEGABYTES} MB. Export a smaller PDF or paste the resume text instead.`,
  )
}

export const extractPdfTextItems = async (
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<{ items: ResumeTextItem[]; pageCount: number }> => {
  throwIfAborted(options.signal)
  throwIfUnsupportedSize(file)
  const data = new Uint8Array(await file.arrayBuffer())
  throwIfAborted(options.signal)

  let pdfDocument: PdfDocumentHandle | null = null
  try {
    pdfDocument = await pdfjs.getDocument({ data }).promise
    throwIfAborted(options.signal)
    const pageCount = pdfDocument.numPages
    const items: ResumeTextItem[] = []
    let totalCharacters = 0

    if (pageCount > MAX_PDF_PAGE_COUNT) {
      throw new Error(
        `Resume Scanner v1 only supports PDFs up to ${MAX_PDF_PAGE_COUNT} pages. Split the resume or export a shorter PDF and try again.`,
      )
    }

    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      throwIfAborted(options.signal)
      const page = await pdfDocument.getPage(pageIndex)
      const textContent = await page.getTextContent()
      throwIfAborted(options.signal)

      for (const entry of textContent.items) {
        if (!isPdfTextItem(entry)) {
          continue
        }

        const text = entry.str.replaceAll('\u0000', '').trim()
        if (!text) {
          continue
        }

        if (items.length >= MAX_PDF_TEXT_ITEMS) {
          throw new Error(
            `This PDF contains too many text elements for Resume Scanner v1 (${MAX_PDF_TEXT_ITEMS} limit). Export a simpler PDF or paste the resume text instead.`,
          )
        }

        if (totalCharacters + text.length > MAX_PDF_TEXT_CHARS) {
          throw new Error(
            `This PDF contains too much text for Resume Scanner v1 (${MAX_PDF_TEXT_CHARS.toLocaleString()} characters max). Export a simpler PDF or paste the resume text instead.`,
          )
        }

        totalCharacters += text.length
        items.push({
          text,
          x: entry.transform[4] ?? 0,
          y: entry.transform[5] ?? 0,
          width: entry.width ?? 0,
          height: entry.height ?? (Math.abs(entry.transform[0] ?? 0) || 10),
          page: pageIndex,
          ...(entry.fontName ? { fontName: entry.fontName } : {}),
        })
      }
    }

    return {
      items,
      pageCount,
    }
  } finally {
    if (pdfDocument && typeof pdfDocument.destroy === 'function') {
      await pdfDocument.destroy().catch((error) => {
        console.warn('pdf.js document cleanup failed', error)
      })
    }
  }
}

export const scanResumePdf = async (
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<import('../../types/identity').ResumeScanResult> => {
  const extracted = await extractPdfTextItems(file, options)
  const parsed = parseResumeTextItems(extracted.items)

  return {
    fileName: file.name,
    pageCount: extracted.pageCount,
    scannedAt: new Date().toISOString(),
    rawText: parsed.rawText,
    identity: parsed.identity,
    warnings: parsed.warnings,
    counts: {
      roles: parsed.identity.roles.length,
      bullets: parsed.identity.roles.reduce((total, role) => total + role.bullets.length, 0),
      projects: parsed.identity.projects.length,
      skillGroups: parsed.identity.skills.groups.length,
      education: parsed.identity.education.length,
      extractedBullets: parsed.identity.roles.reduce(
        (total, role) =>
          total + role.bullets.filter((bullet) => bullet.source_text?.trim()).length,
        0,
      ),
      decomposedBullets: 0,
      scannedBullets: parsed.identity.roles.reduce(
        (total, role) =>
          total + role.bullets.filter((bullet) => bullet.source_text?.trim()).length,
        0,
      ),
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    },
    layout: parsed.layout,
    progress: {
      bullets: {},
      bulk: {
        status: 'idle',
        total: 0,
        completed: 0,
        currentBulletKey: null,
        lastUpdatedAt: null,
      },
    },
  }
}
