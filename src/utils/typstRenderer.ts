import type { AssembledResume, ResumeTheme } from '../types'
import { getThemeFontFiles, resolveThemeFontFamily } from '../themes/theme'
import { toLinkDisplayText, toLinkHref } from './linkFormatting'
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from '../templates/registry'
import { getTypstSnippet, toPdfPageCount } from './typstRendererUtils'
import type { TypstWorkerRequest, TypstWorkerResponse } from './typstRenderer.types'

const PDF_MIME_TYPE = 'application/pdf'
const WORKER_TIMEOUT_MS = 30000

export interface TypstRenderResult {
  blob: Blob
  bytes: Uint8Array
  pageCount: number
  generatedAt: string
}

export interface TypstThemePayload {
  fontBody: string
  fontHeading: string
  sizeBody: number
  sizeName: number
  sizeSectionHeader: number
  sizeRoleTitle: number
  sizeCompanyName: number
  sizeSmall: number
  sizeContact: number
  lineHeight: number
  bulletGap: number
  sectionGapBefore: number
  sectionGapAfter: number
  roleGap: number
  roleLineGapAfter: number
  paragraphGap: number
  contactGapAfter: number
  competencyGap: number
  projectGap: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  colorBody: [number, number, number]
  colorHeading: [number, number, number]
  colorSection: [number, number, number]
  colorDim: [number, number, number]
  colorRule: [number, number, number]
  roleTitleColor: [number, number, number]
  datesColor: [number, number, number]
  subtitleColor: [number, number, number]
  competencyLabelColor: [number, number, number]
  projectUrlColor: [number, number, number]
  sectionHeaderStyle: ResumeTheme['sectionHeaderStyle']
  sectionHeaderLetterSpacing: number
  sectionRuleWeight: number
  nameLetterSpacing: number
  nameBold: boolean
  nameAlignment: ResumeTheme['nameAlignment']
  contactAlignment: ResumeTheme['contactAlignment']
  roleTitleItalic: boolean
  datesAlignment: ResumeTheme['datesAlignment']
  subtitleItalic: boolean
  companyBold: boolean
  bulletChar: ResumeTheme['bulletChar']
  bulletIndent: number
  bulletHanging: number
  competencyLabelBold: boolean
  projectNameBold: boolean
  projectUrlSize: number
  educationSchoolBold: boolean
}

export interface TypstDataPayload {
  metadata: {
    title: string
    author: string
  }
  name: string
  contactLine: string | null
  contactLinks: Array<{ text: string; href: string }>
  targetLine: string | null
  profile: string | null
  skillGroups: Array<{ label: string; content: string }>
  roles: Array<{
    company: string
    location: string | null
    subtitle: string | null
    title: string
    dates: string
    bullets: string[]
  }>
  projects: Array<{ name: string; urlText: string | null; urlHref: string | null; text: string }>
  education: Array<{ school: string; location: string; degree: string; year: string | null }>
}

const toRgbTuple = (value: string): [number, number, number] => {
  const normalized = value.replace(/^#/, '').trim()
  const safe = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '000000'
  return [
    Number.parseInt(safe.slice(0, 2), 16),
    Number.parseInt(safe.slice(2, 4), 16),
    Number.parseInt(safe.slice(4, 6), 16),
  ]
}

export const toThemePayload = (theme: ResumeTheme): TypstThemePayload => ({
  ...theme,
  fontBody: resolveThemeFontFamily(theme.fontBody),
  fontHeading: resolveThemeFontFamily(theme.fontHeading),
  colorBody: toRgbTuple(theme.colorBody),
  colorHeading: toRgbTuple(theme.colorHeading),
  colorSection: toRgbTuple(theme.colorSection),
  colorDim: toRgbTuple(theme.colorDim),
  colorRule: toRgbTuple(theme.colorRule),
  roleTitleColor: toRgbTuple(theme.roleTitleColor),
  datesColor: toRgbTuple(theme.datesColor),
  subtitleColor: toRgbTuple(theme.subtitleColor),
  competencyLabelColor: toRgbTuple(theme.competencyLabelColor),
  projectUrlColor: toRgbTuple(theme.projectUrlColor),
})

export const toDataPayload = (resume: AssembledResume): TypstDataPayload => {
  const contactCore = [resume.header.location, resume.header.email, resume.header.phone]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(' | ')
  const contactLinks = resume.header.links
    .map((link) => {
      const href = toLinkHref(link.url)
      const text = toLinkDisplayText(link)
      return { href, text }
    })
    .filter((link) => link.href.length > 0 && link.text.length > 0)

  return {
    metadata: {
      title: `${resume.header.name} Resume`,
      author: resume.header.name,
    },
    name: resume.header.name,
    contactLine: contactCore || null,
    contactLinks,
    targetLine: resume.targetLine?.text ?? null,
    profile: resume.profile?.text ?? null,
    skillGroups: resume.skillGroups.map((group) => ({
      label: group.label,
      content: group.content,
    })),
    roles: resume.roles.map((role) => ({
      company: role.company,
      location: role.location ?? null,
      subtitle: role.subtitle ?? null,
      title: role.title,
      dates: role.dates,
      bullets: role.bullets.map((bullet) => bullet.text),
    })),
    projects: resume.projects.map((project) => ({
      name: project.name,
      urlText: project.url?.trim() || null,
      urlHref: project.url ? toLinkHref(project.url) : null,
      text: project.text,
    })),
    education: resume.education.map((entry) => ({
      school: entry.school,
      location: entry.location,
      degree: entry.degree,
      year: entry.year ?? null,
    })),
  }
}

/**
 * Direct WASM rendering on the current thread.
 * Use this only if workers are unavailable or for extremely simple one-off tasks.
 */
export const renderResumeAsPdfDirect = async (
  resume: AssembledResume,
  theme: ResumeTheme,
): Promise<TypstRenderResult> => {
  const fontFiles = getThemeFontFiles(theme)
  const snippet = await getTypstSnippet(fontFiles)
  const dataPayload = toDataPayload(resume)
  const themePayload = toThemePayload(theme)
  const template = TEMPLATES[theme.templateId] || TEMPLATES[DEFAULT_TEMPLATE_ID]

  const pdfBytes = await snippet.pdf({
    mainContent: template.content,
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

/**
 * Renders the resume in a background Web Worker.
 * PREFERRED for all UI-blocking operations like density optimization.
 */
export const renderResumeAsPdf = (
  resume: AssembledResume,
  theme: ResumeTheme,
): Promise<TypstRenderResult> => {
  // Return early fallback if Worker is not available
  if (typeof Worker === 'undefined') {
    console.warn('Web Workers not available, falling back to direct render.')
    return renderResumeAsPdfDirect(resume, theme)
  }

  let worker: Worker
  try {
    worker = new Worker(new URL('../engine/typst.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch (e) {
    console.error('Failed to spawn worker for render, falling back to direct render.', e)
    return renderResumeAsPdfDirect(resume, theme)
  }

  return new Promise((resolve, reject) => {
    let settled = false

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true
        worker.terminate()
        reject(new Error(`Typst render timed out after ${WORKER_TIMEOUT_MS}ms`))
      }
    }, WORKER_TIMEOUT_MS)

    worker.onmessage = (event: MessageEvent<TypstWorkerResponse>) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)

      const response = event.data
      if (response.type === 'success') {
        const { bytes, pageCount } = response
        const blob = new Blob([bytes.slice()], { type: PDF_MIME_TYPE })
        resolve({
          blob,
          bytes,
          pageCount,
          generatedAt: new Date().toISOString(),
        })
      } else {
        reject(new Error(response.error || 'Worker render failed'))
      }
      worker.terminate()
    }

    worker.onerror = (event) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      reject(new Error(event.message || 'Worker encountered a system error'))
      worker.terminate()
    }

    const request: TypstWorkerRequest = {
      id: Date.now(),
      dataPayload: toDataPayload(resume),
      themePayload: toThemePayload(theme),
      fontFiles: getThemeFontFiles(theme),
      templateContent: (TEMPLATES[theme.templateId] || TEMPLATES[DEFAULT_TEMPLATE_ID]).content,
    }

    worker.postMessage(request)
  })
}
