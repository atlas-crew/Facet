import type { RecruiterCard } from '../types/recruiter'
import facetLockupSvg from '../../brand/icons/svg/facet-lockup-on-light.svg?raw'
import recruiterCardTemplate from '../templates/recruiterCard.typ?raw'
import { getFacetBrandFontFiles } from '../themes/theme'
import { getTypstSnippet, toPdfPageCount } from './typstRendererUtils'

const PDF_MIME_TYPE = 'application/pdf'

const formatGeneratedAt = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
}

const formatGeneratedAtShort = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 10)
}

export const renderRecruiterCardAsPdf = async (card: RecruiterCard) => {
  const snippet = await getTypstSnippet(getFacetBrandFontFiles())

  const matchScorePct = Math.max(0, Math.min(100, Math.round((card.matchScore ?? 0) * 100)))

  const dataPayload = {
    title: `${card.company} · ${card.role} — Recruiter Card`,
    company: card.company,
    role: card.role,
    candidateName: card.candidateName,
    candidateTitle: card.candidateTitle,
    matchScorePct,
    matchScoreMethodology: card.matchScoreMethodology,
    summary: card.summary,
    recruiterHook: card.recruiterHook,
    suggestedIntro: card.suggestedIntro,
    topReasons: card.topReasons,
    proofPoints: card.proofPoints,
    skillHighlights: card.skillHighlights,
    likelyConcerns: card.likelyConcerns,
    actionCta: card.actionCta,
    generatedAt: formatGeneratedAt(card.generatedAt),
    generatedAtShort: formatGeneratedAtShort(card.generatedAt),
  }

  const pdfBytes = await snippet.pdf({
    mainContent: recruiterCardTemplate,
    inputs: {
      data: JSON.stringify(dataPayload),
      brandLockup: facetLockupSvg,
    },
  })

  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('Typst renderer produced an empty recruiter-card PDF.')
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
