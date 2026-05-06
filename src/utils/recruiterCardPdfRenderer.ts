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

// Default to '' / [] when a legacy card hydrated from a workspace snapshot
// is missing a field. JSON.stringify drops `undefined` keys entirely, which
// would throw in Typst on `data.<missing>` access. Empty strings/arrays
// render as blank sections instead.
const str = (value: string | undefined): string => value ?? ''
const arr = <T>(value: T[] | undefined): T[] => value ?? []

export const renderRecruiterCardAsPdf = async (card: RecruiterCard) => {
  const snippet = await getTypstSnippet(getFacetBrandFontFiles())

  const matchScorePct = Math.max(0, Math.min(100, Math.round((card.matchScore ?? 0) * 100)))

  const dataPayload = {
    title: `${str(card.company)} · ${str(card.role)} — Recruiter Card`,
    company: str(card.company),
    role: str(card.role),
    candidateName: str(card.candidateName),
    candidateTitle: str(card.candidateTitle),
    matchScorePct,
    matchScoreMethodology: str(card.matchScoreMethodology),
    summary: str(card.summary),
    recruiterHook: str(card.recruiterHook),
    suggestedIntro: str(card.suggestedIntro),
    topReasons: arr(card.topReasons),
    proofPoints: arr(card.proofPoints),
    skillHighlights: arr(card.skillHighlights),
    likelyConcerns: arr(card.likelyConcerns),
    actionCta: str(card.actionCta),
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
