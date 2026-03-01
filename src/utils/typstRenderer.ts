import type { AssembledResume, ResumeTheme } from '../types'
import { getThemeFontFiles, resolveThemeFontFamily } from '../themes/theme'
import { TypstSnippet } from '@myriaddreamin/typst.ts/contrib/snippet'
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url'
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/wasm?url'
import { toLinkDisplayText, toLinkHref } from './linkFormatting'
import resumeTemplate from '../templates/resume.typ?raw'

const PDF_MIME_TYPE = 'application/pdf'
const PDF_PAGE_PATTERN = /\/Type\s*\/Page\b/g

interface TypstRenderResult {
  blob: Blob
  bytes: Uint8Array
  pageCount: number
  generatedAt: string
}

interface TypstThemePayload {
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

interface TypstDataPayload {
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
    subtitle: string | null
    title: string
    dates: string
    bullets: string[]
  }>
  projects: Array<{ name: string; urlText: string | null; urlHref: string | null; text: string }>
  education: Array<{ school: string; location: string; degree: string; year: string }>
}

const fontBufferCache = new Map<string, Uint8Array>()
const snippetByFontSignature = new Map<string, TypstSnippet>()

const toRgbTuple = (value: string): [number, number, number] => {
  const normalized = value.replace(/^#/, '').trim()
  const safe = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '000000'
  return [
    Number.parseInt(safe.slice(0, 2), 16),
    Number.parseInt(safe.slice(2, 4), 16),
    Number.parseInt(safe.slice(4, 6), 16),
  ]
}

const toPdfPageCount = (bytes: Uint8Array): number => {
  const raw = new TextDecoder().decode(bytes)
  const matches = raw.match(PDF_PAGE_PATTERN)
  return Math.max(1, matches?.length ?? 1)
}

const loadFontBytes = async (path: string): Promise<Uint8Array> => {
  const cached = fontBufferCache.get(path)
  if (cached) {
    return cached
  }

  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Unable to load font file: ${path}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  fontBufferCache.set(path, bytes)
  return bytes
}

const isVariableFont = (bytes: Uint8Array): boolean => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 12) {
    return false
  }

  const tableCount = view.getUint16(4, false)
  let offset = 12
  for (let index = 0; index < tableCount; index += 1) {
    if (offset + 16 > bytes.byteLength) {
      break
    }
    const tag = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    if (tag === 'fvar') {
      return true
    }
    offset += 16
  }

  return false
}

const getSnippetForTheme = async (theme: ResumeTheme): Promise<TypstSnippet> => {
  const fontFiles = getThemeFontFiles(theme)
  const signature = fontFiles.join('|') || '__no_theme_fonts__'
  const cached = snippetByFontSignature.get(signature)
  if (cached) {
    return cached
  }

  const snippet = new TypstSnippet()
  // Vite prebundling can strip wasm-pack's auto-importer. Provide explicit module URLs.
  snippet.setCompilerInitOptions({ getModule: () => compilerWasmUrl })
  snippet.setRendererInitOptions({ getModule: () => rendererWasmUrl })
  if (fontFiles.length > 0) {
    const buffers = await Promise.all(fontFiles.map((file) => loadFontBytes(file)))
    const staticFontBuffers = buffers.filter((bytes) => !isVariableFont(bytes))
    if (staticFontBuffers.length > 0) {
      snippet.use(TypstSnippet.preloadFonts(staticFontBuffers))
    }
  }

  snippetByFontSignature.set(signature, snippet)
  return snippet
}

const toThemePayload = (theme: ResumeTheme): TypstThemePayload => ({
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

const toDataPayload = (resume: AssembledResume): TypstDataPayload => {
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
      year: entry.year,
    })),
  }
}

export const renderResumeAsPdf = async (
  resume: AssembledResume,
  theme: ResumeTheme,
): Promise<TypstRenderResult> => {
  const snippet = await getSnippetForTheme(theme)
  const dataPayload = toDataPayload(resume)
  const themePayload = toThemePayload(theme)

  const pdfBytes = await snippet.pdf({
    mainContent: resumeTemplate,
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
