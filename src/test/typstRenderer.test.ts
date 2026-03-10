import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssembledResume, ResumeTheme } from '../types'

interface MockSnippetInstance {
  compilerInitOptions: { getModule: () => unknown } | null
  rendererInitOptions: { getModule: () => unknown } | null
  lastPdfArgs: { inputs?: Record<string, string> } | null
}

const snippetInstances: MockSnippetInstance[] = []

vi.mock('@myriaddreamin/typst-ts-web-compiler/wasm?url', () => ({
  default: '/assets/typst-ts-web-compiler.wasm',
}))

vi.mock('@myriaddreamin/typst-ts-renderer/wasm?url', () => ({
  default: '/assets/typst-ts-renderer.wasm',
}))

vi.mock('@myriaddreamin/typst.ts/contrib/snippet', () => {
  class MockTypstSnippet {
    private instance: MockSnippetInstance

    static disableDefaultFontAssets() {
      return { key: 'disable-default-font-assets' }
    }

    static preloadFonts() {
      return { key: 'preload-fonts' }
    }

    constructor() {
      this.instance = {
        compilerInitOptions: null,
        rendererInitOptions: null,
        lastPdfArgs: null,
      }
      snippetInstances.push(this.instance)
    }

    setCompilerInitOptions(options: { getModule: () => unknown }) {
      this.instance.compilerInitOptions = options
    }

    setRendererInitOptions(options: { getModule: () => unknown }) {
      this.instance.rendererInitOptions = options
    }

    use() {
      // no-op for this unit test
    }

    async pdf(args: { inputs?: Record<string, string> }) {
      this.instance.lastPdfArgs = args
      return new TextEncoder().encode('%PDF-1.7\n/Type /Page\n/Type /Page\n')
    }
  }

  return { TypstSnippet: MockTypstSnippet }
})

const loadRenderer = () => import('../utils/typstRenderer')

const createTheme = (): ResumeTheme => ({
  id: 'ferguson-v12',
  name: 'Ferguson v1.2',
  templateId: 'classic',
  fontBody: 'Unknown Font',
  fontHeading: 'Unknown Font',
  sizeBody: 9,
  sizeName: 14,
  sizeSectionHeader: 10.5,
  sizeRoleTitle: 9,
  sizeCompanyName: 10,
  sizeSmall: 8.5,
  sizeContact: 8.5,
  lineHeight: 1.15,
  bulletGap: 2.5,
  sectionGapBefore: 10,
  sectionGapAfter: 3,
  sectionRuleGap: 1,
  roleGap: 7,
  roleHeaderGap: 1,
  roleLineGapAfter: 3,
  paragraphGap: 2,
  contactGapAfter: 6,
  competencyGap: 1,
  projectGap: 3,
  marginTop: 0.45,
  marginBottom: 0.45,
  marginLeft: 0.75,
  marginRight: 0.75,
  colorBody: '333333',
  colorHeading: '1a1a1a',
  colorSection: '2b5797',
  colorDim: '666666',
  colorRule: '2b5797',
  roleTitleColor: '1a1a1a',
  datesColor: '666666',
  subtitleColor: '666666',
  competencyLabelColor: '1a1a1a',
  projectUrlColor: '2b5797',
  sectionHeaderStyle: 'caps-rule',
  sectionHeaderLetterSpacing: 3,
  sectionRuleWeight: 0.5,
  nameLetterSpacing: 4,
  nameBold: true,
  nameAlignment: 'center',
  contactAlignment: 'center',
  roleTitleItalic: true,
  datesAlignment: 'right-tab',
  subtitleItalic: true,
  companyBold: true,
  bulletChar: '•',
  bulletIndent: 18,
  bulletHanging: 10,
  competencyLabelBold: true,
  projectNameBold: true,
  projectUrlSize: 8.5,
  educationSchoolBold: true,
})

const createResume = (): AssembledResume => ({
  selectedVector: 'all',
  header: {
    name: 'Jane Example',
    email: 'jane@example.com',
    phone: '555-000-1111',
    location: 'Austin, TX',
    links: [],
  },
  skillGroups: [{ id: 'skills', label: 'Languages', content: 'TypeScript' }],
  roles: [
    {
      id: 'role-1',
      company: 'Acme',
      title: 'Engineer',
      dates: '2022 - Present',
      bullets: [{ id: 'bullet-1', text: 'Built systems' }],
    },
  ],
  projects: [
    {
      id: 'project-1',
      name: 'Facet',
      text: 'Resume tooling',
    },
  ],
  education: [{ id: 'edu-1', school: 'State U', location: 'TX', degree: 'BS', year: '2020' }],
  certifications: [],
})

describe('typstRenderer', () => {
  beforeEach(() => {
    snippetInstances.length = 0
    vi.resetModules()
  })

  it('passes explicit wasm module URLs to Typst init', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    const result = await renderResumeAsPdf(createResume(), createTheme())
    expect(result.bytes.length).toBeGreaterThan(0)

    const instance = snippetInstances[0]
    expect(instance).toBeDefined()
    expect(instance.compilerInitOptions?.getModule()).toBe('/assets/typst-ts-web-compiler.wasm')
    expect(instance.rendererInitOptions?.getModule()).toBe('/assets/typst-ts-renderer.wasm')
  })

  it('serializes optional fields as null for Typst dictionary safety', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    await renderResumeAsPdf(createResume(), createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    expect(args?.inputs).toBeDefined()

    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as {
      targetLine: string | null
      profile: string | null
      roles: Array<{ subtitle: string | null }>
      projects: Array<{ urlText: string | null; urlHref: string | null }>
    }

    expect(dataPayload.targetLine).toBeNull()
    expect(dataPayload.profile).toBeNull()
    expect(dataPayload.roles[0]?.subtitle).toBeNull()
    expect(dataPayload.projects[0]?.urlText).toBeNull()
    expect(dataPayload.projects[0]?.urlHref).toBeNull()
  })

  it('includes links in contact lines when present', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    const resume = createResume()
    resume.header.links = [{ label: 'GitHub', url: 'https://github.com/jane' }]
    await renderResumeAsPdf(resume, createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as {
      contactLine: string | null
      contactLinks: Array<{ text: string; href: string }>
    }

    expect(dataPayload.contactLine).toContain('Austin, TX')
    expect(dataPayload.contactLinks.length).toBe(1)
    expect(dataPayload.contactLinks[0].text).toContain('GitHub')
    expect(dataPayload.contactLinks[0].href).toBe('https://github.com/jane')
  })

  it('serializes subtitle and project URL when present', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    const resume = createResume()
    resume.roles[0].subtitle = 'Platform Team'
    resume.projects[0].url = 'https://example.com'
    await renderResumeAsPdf(resume, createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as {
      roles: Array<{ subtitle: string | null }>
      projects: Array<{ urlText: string | null; urlHref: string | null }>
    }

    expect(dataPayload.roles[0].subtitle).toBe('Platform Team')
    expect(dataPayload.projects[0].urlText).toBe('https://example.com')
    expect(dataPayload.projects[0].urlHref).toBe('https://example.com')
  })

  it('uses URL text when a contact link label is omitted', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    const resume = createResume()
    resume.header.links = [{ url: 'github.com/jane' }]
    await renderResumeAsPdf(resume, createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as {
      contactLinks: Array<{ text: string; href: string }>
    }

    expect(dataPayload.contactLinks[0]).toEqual({
      text: 'github.com/jane',
      href: 'https://github.com/jane',
    })
  })

  it('serializes target line and profile when present', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    const resume = createResume()
    resume.targetLine = { id: 'tl', text: 'Backend-focused engineer' }
    resume.profile = { id: 'pr', text: 'Experienced engineer' }
    await renderResumeAsPdf(resume, createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as {
      targetLine: string | null
      profile: string | null
    }

    expect(dataPayload.targetLine).toBe('Backend-focused engineer')
    expect(dataPayload.profile).toBe('Experienced engineer')
  })

  it('converts theme colors to RGB tuples in the theme payload', async () => {
    const { renderResumeAsPdf } = await loadRenderer()
    await renderResumeAsPdf(createResume(), createTheme())

    const args = snippetInstances[0]?.lastPdfArgs
    const themePayload = JSON.parse(args?.inputs?.theme ?? '{}') as {
      colorBody: [number, number, number]
    }

    // '333333' → [51, 51, 51]
    expect(themePayload.colorBody).toEqual([51, 51, 51])
  })
})
