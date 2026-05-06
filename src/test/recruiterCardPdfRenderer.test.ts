import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecruiterCard } from '../types/recruiter'

interface MockSnippetInstance {
  lastPdfArgs: { mainContent?: string; inputs?: Record<string, string> } | null
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
      this.instance = { lastPdfArgs: null }
      snippetInstances.push(this.instance)
    }

    setCompilerInitOptions() {}
    setRendererInitOptions() {}
    use() {}

    async pdf(args: { mainContent?: string; inputs?: Record<string, string> }) {
      this.instance.lastPdfArgs = args
      return new TextEncoder().encode('%PDF-1.7\n/Type /Page\n')
    }
  }

  return { TypstSnippet: MockTypstSnippet }
})

const loadRenderer = () => import('../utils/recruiterCardPdfRenderer')

const createCard = (overrides: Partial<RecruiterCard> = {}): RecruiterCard => ({
  id: 'card-1',
  generatedAt: '2026-05-05T12:34:56.000Z',
  company: 'Acme Robotics',
  role: 'Staff Platform Engineer',
  candidateName: 'Jane Example',
  candidateTitle: 'Senior Platform Engineer',
  matchScore: 0.873,
  matchScoreMethodology: 'Match % methodology footnote.',
  summary: 'A grounded summary.',
  recruiterHook: 'A clean one-liner.',
  suggestedIntro: 'Hi team — meet Jane.',
  topReasons: ['Reason A', 'Reason B'],
  proofPoints: ['Proof 1'],
  skillHighlights: [],
  likelyConcerns: [],
  actionCta: 'Forward to hiring manager.',
  ...overrides,
})

describe('recruiterCardPdfRenderer', () => {
  beforeEach(() => {
    snippetInstances.length = 0
    vi.resetModules()
    // The renderer fetches DM Sans/DM Mono font files from /fonts/...; jsdom
    // cannot resolve those relative URLs, so stub fetch with an empty buffer.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ArrayBuffer(0), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rounds the match score to a percentage and ships card fields to Typst', async () => {
    const { renderRecruiterCardAsPdf } = await loadRenderer()

    const result = await renderRecruiterCardAsPdf(createCard())

    expect(result.blob.type).toBe('application/pdf')
    expect(result.bytes.byteLength).toBeGreaterThan(0)
    expect(result.pageCount).toBeGreaterThanOrEqual(1)

    const args = snippetInstances[0]?.lastPdfArgs
    expect(args?.mainContent).toContain('json.decode(sys.inputs.data)')

    const dataPayload = JSON.parse(args?.inputs?.data ?? '{}') as Record<string, unknown>
    expect(dataPayload.matchScorePct).toBe(87)
    expect(dataPayload.company).toBe('Acme Robotics')
    expect(dataPayload.role).toBe('Staff Platform Engineer')
    expect(dataPayload.candidateName).toBe('Jane Example')
    expect(dataPayload.topReasons).toEqual(['Reason A', 'Reason B'])
    expect(dataPayload.skillHighlights).toEqual([])
    expect(dataPayload.generatedAtShort).toBe('2026-05-05')
    expect(dataPayload.generatedAt).toContain('UTC')

    expect(args?.inputs?.brandLockup).toContain('<svg')
    expect(args?.inputs?.brandLockup).toContain('Gem mark')
  })

  it('clamps the match score percentage to the 0-100 range', async () => {
    const { renderRecruiterCardAsPdf } = await loadRenderer()

    await renderRecruiterCardAsPdf(createCard({ matchScore: 1.42 }))
    const high = JSON.parse(snippetInstances[0]?.lastPdfArgs?.inputs?.data ?? '{}') as { matchScorePct: number }
    expect(high.matchScorePct).toBe(100)

    snippetInstances.length = 0
    vi.resetModules()
    const { renderRecruiterCardAsPdf: render2 } = await loadRenderer()
    await render2(createCard({ matchScore: -0.2 }))
    const low = JSON.parse(snippetInstances[0]?.lastPdfArgs?.inputs?.data ?? '{}') as { matchScorePct: number }
    expect(low.matchScorePct).toBe(0)
  })

  it('renders legacy cards missing post-Phase-6 fields as blanks, not errors', async () => {
    // Cards hydrated from a workspace snapshot taken before Phase 6 will be
    // missing matchScoreMethodology and actionCta (and may still carry
    // dropped fields). The renderer must default missing strings to ''
    // and missing arrays to [] so the Typst template doesn't trip over
    // dict-key-not-found access. JSON.stringify drops undefined keys, so
    // without the defaults, dataPayload would lack those fields entirely.
    const { renderRecruiterCardAsPdf } = await loadRenderer()
    const legacyCard = {
      id: 'legacy-1',
      generatedAt: '2026-04-01T00:00:00.000Z',
      company: 'Acme',
      role: 'Staff Engineer',
      candidateName: 'Jane Example',
      candidateTitle: 'Senior Platform Engineer',
      matchScore: 0.7,
      summary: 'Legacy summary.',
      recruiterHook: 'Legacy hook.',
      suggestedIntro: 'Legacy intro.',
      topReasons: ['Reason'],
      proofPoints: ['Proof'],
      skillHighlights: ['Skill'],
      likelyConcerns: [],
    } as unknown as RecruiterCard

    await renderRecruiterCardAsPdf(legacyCard)

    const data = JSON.parse(snippetInstances[0]?.lastPdfArgs?.inputs?.data ?? '{}') as Record<string, unknown>
    expect(data.matchScoreMethodology).toBe('')
    expect(data.actionCta).toBe('')
    expect(data.topReasons).toEqual(['Reason'])
  })
})
