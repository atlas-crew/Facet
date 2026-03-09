import type { CoverLetterTemplate } from '../types/coverLetter'
import { getThemeFontFiles } from '../themes/theme'
import { getTypstSnippet, toPdfPageCount } from './typstRendererUtils'
import { TEMPLATES } from '../templates/registry'
import type { ResumeTheme, ResumeMeta, VectorId } from '../types'
import { toThemePayload } from './typstRenderer'
import { assembleCoverLetterData } from '../engine/letterAssembler'

const PDF_MIME_TYPE = 'application/pdf'

export const renderLetterAsPdf = async (
  template: CoverLetterTemplate,
  theme: ResumeTheme,
  meta: ResumeMeta,
  vectorId: VectorId,
  recipient: string = '',
  variables: Record<string, string> = {},
  date?: Date
) => {
  const fontFiles = getThemeFontFiles(theme)
  const snippet = await getTypstSnippet(fontFiles)
  
  // Use the shared assembler logic
  const dataPayload = assembleCoverLetterData(template, {
    vectorId,
    meta,
    variables,
    recipient,
    date
  })

  const themePayload = toThemePayload(theme)
  const typstTemplate = TEMPLATES.letter

  const pdfBytes = await snippet.pdf({
    mainContent: typstTemplate.content,
    inputs: {
      data: JSON.stringify(dataPayload),
      theme: JSON.stringify(themePayload),
    },
  })

  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('Typst renderer produced an empty PDF output.')
  }

  const bytes = new Uint8Array(pdfBytes)
  const blob = new Blob([bytes], { type: PDF_MIME_TYPE })

  return {
    blob,
    bytes,
    pageCount: toPdfPageCount(bytes),
    generatedAt: new Date().toISOString(),
  }
}
