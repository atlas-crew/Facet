// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { SkillsBand } from '../routes/identity/bands/SkillsBand'
import { SelfModelBand } from '../routes/identity/bands/SelfModelBand'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)
const identityParameterMocks = vi.hoisted(() => ({
  generateSearchVectorsFromIdentityMock: vi.fn(),
  generateAwarenessFromIdentityMock: vi.fn(),
  generateIdentityThesisFromIdentityMock: vi.fn(),
  generateIdentityProfilesFromIdentityMock: vi.fn(),
  generateSelfKnowledgeFromIdentityMock: vi.fn(),
  generateStrategicPositioningFromIdentityMock: vi.fn(),
}))
const skillEnrichmentMocks = vi.hoisted(() => ({
  generateSkillEnrichmentSuggestionMock: vi.fn(),
}))
const skillGroupNamingMocks = vi.hoisted(() => ({
  generateSkillGroupNameSuggestionsMock: vi.fn(),
}))
const facetEnvMock = vi.hoisted(() => ({
  facetClientEnv: {
    deploymentMode: 'self-hosted',
    facetApiBaseUrl: '',
    anthropicProxyUrl: 'https://ai.example/proxy',
    anthropicProxyApiKey: '',
    supabaseUrl: '',
    supabasePublishableKey: '',
  },
}))

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}))

vi.mock('../utils/facetEnv', () => ({
  facetClientEnv: facetEnvMock.facetClientEnv,
  getFacetClientEnv: () => facetEnvMock.facetClientEnv,
}))

vi.mock('../utils/identityParametersGeneration', () => ({
  generateSearchVectorsFromIdentity: identityParameterMocks.generateSearchVectorsFromIdentityMock,
  generateAwarenessFromIdentity: identityParameterMocks.generateAwarenessFromIdentityMock,
  generateIdentityThesisFromIdentity: identityParameterMocks.generateIdentityThesisFromIdentityMock,
  generateIdentityProfilesFromIdentity:
    identityParameterMocks.generateIdentityProfilesFromIdentityMock,
  generateSelfKnowledgeFromIdentity: identityParameterMocks.generateSelfKnowledgeFromIdentityMock,
  generateStrategicPositioningFromIdentity:
    identityParameterMocks.generateStrategicPositioningFromIdentityMock,
}))

vi.mock('../utils/skillEnrichment', async () => {
  const actual = await vi.importActual<typeof import('../utils/skillEnrichment')>(
    '../utils/skillEnrichment',
  )
  return {
    ...actual,
    generateSkillEnrichmentSuggestion: (
      ...args: Parameters<typeof actual.generateSkillEnrichmentSuggestion>
    ) => skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock(...args),
  }
})

vi.mock('../utils/skillGroupNaming', async () => {
  const actual = await vi.importActual<typeof import('../utils/skillGroupNaming')>(
    '../utils/skillGroupNaming',
  )
  return {
    ...actual,
    generateSkillGroupNameSuggestions: (
      ...args: Parameters<typeof actual.generateSkillGroupNameSuggestions>
    ) => skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock(...args),
  }
})

const seed = (modifier?: (id: ReturnType<typeof cloneIdentityFixture>) => void) => {
  const identity = cloneIdentityFixture()
  modifier?.(identity)
  resolveStorage().removeItem('facet-identity-workspace')
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: identity,
    draft: null,
    draftDocument: '',
    thesisDraft: null,
    thesisDraftRevision: null,
    intakeSources: [],
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
    // Reset the persisted inference-staleness set so a prior test's cascade can't bleed a stale
    // panel into the next render.
    staleInferenceSections: [],
  })
}

const getSelfKnowledgeControls = () => {
  const controls = document.querySelector('.self-knowledge-controls')
  if (!controls) throw new Error('Expected self-knowledge controls to render.')
  return controls as HTMLElement
}

const deferDownstreamPrompt = async () => {
  const prompt = await screen.findByRole('dialog', {
    name: 'Regenerate downstream sections?',
  })
  fireEvent.click(within(prompt).getByRole('button', { name: 'Defer downstream' }))
}

const seedNoAttentionIdentity = () => {
  seed((id) => {
    id.identity.thesis =
      'I build Kubernetes and Postgres platforms for regulated SaaS teams. I turn ambiguous delivery constraints into reliable operating systems. I make infrastructure choices legible to product and security leaders.'
    id.self_model = {
      arc: [
        {
          company: 'Contoso Networks',
          chapter: 'Built platform systems that made enterprise delivery predictable.',
        },
      ],
      philosophy: [
        { id: 'clarity', text: 'Make tradeoffs explicit.', tags: ['leadership'] },
        { id: 'systems', text: 'Prefer durable systems over heroic recovery.', tags: ['platform'] },
      ],
      interview_style: {
        strengths: ['system design', 'cross-functional strategy'],
        weaknesses: ['take-home exercises'],
        prep_strategy: 'Map every answer to an operating principle and a concrete artifact.',
      },
      competitive_moat: 'Combines platform depth with product-facing judgment.',
      unfair_advantages: [
        'Can translate infra work into business risk.',
        'Has shipped across constraints.',
      ],
    }
    id.profiles = [
      { id: 'platform', tags: ['platform'], text: 'Platform systems profile.' },
      { id: 'security', tags: ['security'], text: 'Security and reliability profile.' },
      { id: 'leadership', tags: ['leadership'], text: 'Engineering leadership profile.' },
    ]
    id.roles[0]!.bullets = [
      {
        id: 'delivery',
        problem: 'Enterprise delivery was blocked by cloud-only assumptions.',
        action: 'Designed a Kubernetes installation path.',
        outcome: 'Unlocked customer-hosted deployments.',
        impact: [],
        metrics: {},
        tags: ['platform'],
        technologies: ['Kubernetes'],
      },
      {
        id: 'reliability',
        problem: 'Operators lacked deployment confidence.',
        action: 'Added release guardrails and runbooks.',
        outcome: 'Reduced failed rollout risk.',
        impact: [],
        metrics: {},
        tags: ['reliability'],
        technologies: ['Postgres'],
      },
    ]
    id.projects = [
      {
        id: 'installer',
        name: 'Enterprise installer',
        description: 'Customer-hosted installation path.',
        tags: ['platform'],
      },
    ]
    id.skills.groups[0]!.label = 'Platform Engineering'
    id.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
        depthSource: 'corrected',
        context: 'Used across customer-hosted delivery.',
        positioning: 'Strong match for platform roles.',
      },
    ]
    id.preferences = {
      compensation: {
        base_floor: 175000,
        base_target: 210000,
        notes: 'Prioritizes strong teams and durable scope.',
        priorities: [{ item: 'base', weight: 'high' }],
      },
      work_model: {
        preference: 'remote',
        flexibility: 'Hybrid for the right team.',
        hard_no: 'No full-time office mandate.',
      },
      constraints: {
        clearance: { status: 'none' },
        education: { highest: 'BS' },
        title_flexibility: ['Staff', 'Principal'],
      },
      matching: {
        prioritize: [
          {
            id: 'platform',
            label: 'Platform ownership',
            description: 'Platform scope with durable ownership.',
            weight: 'high',
          },
        ],
        avoid: [
          {
            id: 'adtech',
            label: 'Adtech',
            description: 'Avoid adtech-heavy work.',
            severity: 'soft',
          },
        ],
      },
      interview_process: {
        accepted_formats: ['system design'],
        strong_fit_signals: ['collaborative team'],
        red_flags: ['opaque process'],
        max_rounds: 5,
        onsite_preferences: 'Remote-first preferred.',
      },
    }
    id.search_vectors = [
      {
        id: 'platform',
        title: 'Platform',
        priority: 'high',
        thesis: 'Platform leadership.',
        target_roles: ['Staff Platform Engineer'],
        keywords: { primary: ['platform'], secondary: [] },
      },
      {
        id: 'infra',
        title: 'Infrastructure',
        priority: 'medium',
        thesis: 'Infrastructure strategy.',
        target_roles: ['Infrastructure Engineer'],
        keywords: { primary: ['infrastructure'], secondary: [] },
      },
      {
        id: 'security',
        title: 'Security',
        priority: 'medium',
        thesis: 'Security platform work.',
        target_roles: ['Security Platform Engineer'],
        keywords: { primary: ['security'], secondary: [] },
      },
    ]
    id.awareness = { open_questions: [] }
  })
}

beforeEach(() => {
  skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReset()
  skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValue({
    depth: 'strong',
    depthConfidence: 'medium',
    context: 'Uses the skill in platform delivery with enough evidence for review.',
    positioning: 'Mention when relevant; do not lead by default.',
  })
  skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock.mockReset()
})

describe('Identity Map — match-rule add/remove', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReset()
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockReset()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

  it('renders a fill-strength legend help chip near the top of the map', () => {
    seed()
    render(<IdentityMapPage />)

    const trigger = screen.getByRole('button', { name: 'Fill strength legend' })
    expect(trigger).toBeTruthy()

    fireEvent.focus(trigger)
    expect(screen.getByText(/Strong \(ready\): Ready to reuse downstream/)).toBeTruthy()
    expect(screen.getByText(/Messy \(needs attention\): The material needs cleanup/)).toBeTruthy()
  })

  it('edits candidate contact basics from the Identity Map header', () => {
    seed((id) => {
      id.identity.display_name = 'Alex'
      id.identity.title = 'Staff Platform Engineer'
      id.identity.remote = true
      id.identity.links = [{ id: 'github', url: 'https://github.com/alex' }]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    expect(useIdentityStore.getState().mapSelection).toEqual({ type: 'contact-basics' })
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Alex' })).toBeTruthy()

    fireEvent.click(
      within(screen.getByLabelText('Identity inspector')).getByRole('button', {
        name: 'Edit details',
      }),
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  Alexandra Example  ' },
    })
    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: 'Alex Example' },
    })
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Principal Platform Engineer' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alexandra@example.dev' },
    })
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '555-0101' },
    })
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Seattle, WA' },
    })
    fireEvent.click(screen.getByLabelText('Available for remote roles'))
    fireEvent.change(screen.getByLabelText('Link 1 Label'), {
      target: { value: 'linkedin' },
    })
    fireEvent.change(screen.getByLabelText('Link 1 URL'), {
      target: { value: 'https://linkedin.com/in/alex-example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
    fireEvent.change(screen.getByLabelText('Link 2 URL'), {
      target: { value: 'https://alex.example.dev' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.identity).toMatchObject({
      name: 'Alexandra Example',
      display_name: 'Alex Example',
      title: 'Principal Platform Engineer',
      email: 'alexandra@example.dev',
      phone: '555-0101',
      location: 'Seattle, WA',
      remote: false,
      links: [
        { id: 'linkedin', url: 'https://linkedin.com/in/alex-example' },
        { id: 'link-1', url: 'https://alex.example.dev' },
      ],
    })
    expect(document.querySelector('.identity-map-name')?.textContent).toBe('Alex Example')
    expect(screen.getByText('Seattle, WA · On-site · alexandra@example.dev')).toBeTruthy()
  })

  it('cancels candidate contact basics edits without changing identity', () => {
    seed((id) => {
      id.identity.display_name = 'Alex'
      id.identity.links = [{ id: 'github', url: 'https://github.com/alex' }]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    fireEvent.click(
      within(screen.getByLabelText('Identity inspector')).getByRole('button', {
        name: 'Edit details',
      }),
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Discarded Name' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'discarded@example.dev' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity?.identity).toMatchObject({
      name: 'Alex Example',
      display_name: 'Alex',
      email: 'alex@example.com',
      links: [{ id: 'github', url: 'https://github.com/alex' }],
    })
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Alex' })).toBeTruthy()
    expect(screen.queryByText('discarded@example.dev')).toBeNull()

    fireEvent.click(
      within(screen.getByLabelText('Identity inspector')).getByRole('button', {
        name: 'Edit details',
      }),
    )
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Alex Example')
  })

  it('opens each attention item from the unified queue', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'visa',
            topic: 'Clarify visa status',
            severity: 'high',
            description: 'Work authorization is unclear.',
            action: 'Confirm sponsorship needs.',
          },
        ],
      }
      id.skills.groups[0]!.items = [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
        },
      ]
    })
    render(<IdentityMapPage />)

    // Both attention items render as rows in the one queue (no cycling button) — each opens
    // its own inspector selection via Review. (M11 H1 — one prioritized list, not a panel.)
    const queue = screen.getByRole('region', { name: 'Refine and refresh the model' })
    const visaRow = within(queue)
      .getByRole('heading', { name: 'Clarify visa status' })
      .closest('li') as HTMLElement
    fireEvent.click(within(visaRow).getByRole('button', { name: 'Review' }))
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'awareness-question',
      id: 'visa',
    })

    const skillRow = within(queue)
      .getByRole('heading', { name: 'Deepen skill evidence' })
      .closest('li') as HTMLElement
    fireEvent.click(within(skillRow).getByRole('button', { name: 'Review' }))
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'Kubernetes',
    })
  })

  it('shows no refinements panel when nothing needs attention', () => {
    seedNoAttentionIdentity()
    render(<IdentityMapPage />)

    // Nag-free terminal behavior: with zero attention items and zero stale sections the
    // queue does not render at all — no empty "needs attention" panel. (M11 H1 + C1.)
    expect(screen.queryByRole('region', { name: 'Refine and refresh the model' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Regenerate all stale' })).toBeNull()
  })

  it('summarizes contact basics in inspector read mode', () => {
    seed((id) => {
      id.identity.title = 'Staff Platform Engineer'
      id.identity.remote = true
      id.identity.links = [
        { id: 'github', url: 'https://github.com/alex' },
        { id: 'linkedin', url: 'https://linkedin.com/in/alex' },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')

    expect(within(inspector).getByText('Staff Platform Engineer')).toBeTruthy()
    expect(within(inspector).getByText('Remote')).toBeTruthy()
    expect(
      within(inspector).getByText(
        'github: https://github.com/alex · linkedin: https://linkedin.com/in/alex',
      ),
    ).toBeTruthy()
  })

  it('falls back through contact read-mode titles and on-site availability', () => {
    seed((id) => {
      id.identity.display_name = ''
      id.identity.remote = false
      id.identity.links = []
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')
    expect(within(inspector).getByRole('heading', { name: 'Alex Example' })).toBeTruthy()
    expect(within(inspector).getByText('On-site')).toBeTruthy()

    act(() => {
      useIdentityStore.getState().updateCurrentIdentityCore({ name: '' })
    })
    expect(within(inspector).getByRole('heading', { name: 'No identity yet' })).toBeTruthy()
  })

  it('blocks incomplete contact drafts before saving', () => {
    seed((id) => {
      id.identity.display_name = 'Alex'
      id.identity.links = [{ id: 'github', url: 'https://github.com/alex' }]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Edit details' }))
    const saveButton = within(inspector).getByRole('button', { name: 'Save' })

    fireEvent.change(within(inspector).getByLabelText('Name'), {
      target: { value: '   ' },
    })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(within(inspector).getByLabelText('Name'), {
      target: { value: 'Alex Example' },
    })
    const emailInput = within(inspector).getByLabelText('Email')
    fireEvent.change(emailInput, {
      target: { value: 'not-an-email' },
    })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    expect(within(inspector).getByText('Use a valid email address.')).toBeTruthy()

    fireEvent.change(emailInput, {
      target: { value: 'alex@example.com' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.change(within(inspector).getByLabelText('Link 2 Label'), {
      target: { value: 'portfolio' },
    })
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    expect(within(inspector).getByText('Add a URL or remove the labeled link.')).toBeTruthy()
  })

  it('clears optional contact fields and keeps generated link ids unique', () => {
    seed((id) => {
      id.identity.display_name = 'Alex'
      id.identity.title = 'Staff Platform Engineer'
      id.identity.links = [
        { id: 'link-1', url: 'https://alex.example.dev' },
        { id: 'github', url: 'https://github.com/alex' },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Edit details' }))
    fireEvent.change(within(inspector).getByLabelText('Display Name'), {
      target: { value: '   ' },
    })
    fireEvent.change(within(inspector).getByLabelText('Title'), {
      target: { value: '   ' },
    })
    fireEvent.change(within(inspector).getByLabelText('Email'), {
      target: { value: '   ' },
    })
    fireEvent.change(within(inspector).getByLabelText('Phone'), {
      target: { value: '   ' },
    })
    fireEvent.change(within(inspector).getByLabelText('Location'), {
      target: { value: '   ' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Remove link 2' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.change(within(inspector).getByLabelText('Link 2 URL'), {
      target: { value: 'https://portfolio.example.dev' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.identity.display_name).toBeUndefined()
    expect(useIdentityStore.getState().currentIdentity?.identity.title).toBeUndefined()
    expect(useIdentityStore.getState().currentIdentity?.identity.email).toBe('')
    expect(useIdentityStore.getState().currentIdentity?.identity.phone).toBe('')
    expect(useIdentityStore.getState().currentIdentity?.identity.location).toBe('')
    expect(useIdentityStore.getState().currentIdentity?.identity.links).toEqual([
      { id: 'link-1', url: 'https://alex.example.dev' },
      { id: 'link-2', url: 'https://portfolio.example.dev' },
    ])
    expect(document.querySelector('.identity-map-name')?.textContent).toBe('Alex Example')
  })

  it('reserves later manual link labels before assigning fallback labels', () => {
    seed((id) => {
      id.identity.links = []
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Edit details' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.change(within(inspector).getByLabelText('Link 1 URL'), {
      target: { value: 'https://first.example.dev' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 2 Label'), {
      target: { value: 'link-1' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 2 URL'), {
      target: { value: 'https://second.example.dev' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.identity.links).toEqual([
      { id: 'link-2', url: 'https://first.example.dev' },
      { id: 'link-1', url: 'https://second.example.dev' },
    ])
  })

  it('deduplicates repeated manual contact link labels', () => {
    seed((id) => {
      id.identity.links = []
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit contact basics' }))
    const inspector = screen.getByLabelText('Identity inspector')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Edit details' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.change(within(inspector).getByLabelText('Link 1 Label'), {
      target: { value: 'github' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 1 URL'), {
      target: { value: 'https://github.com/alex' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 2 Label'), {
      target: { value: 'github' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 2 URL'), {
      target: { value: 'https://github.com/alex-work' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add link' }))
    fireEvent.change(within(inspector).getByLabelText('Link 3 Label'), {
      target: { value: 'github' },
    })
    fireEvent.change(within(inspector).getByLabelText('Link 3 URL'), {
      target: { value: 'https://github.com/alex-side' },
    })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.identity.links).toEqual([
      { id: 'github', url: 'https://github.com/alex' },
      { id: 'github-2', url: 'https://github.com/alex-work' },
      { id: 'github-3', url: 'https://github.com/alex-side' },
    ])
  })

  it('uses source text as the map preview before role bullets are decomposed', () => {
    seed((id) => {
      const bullet = id.roles[0]?.bullets[0]
      if (!bullet) return
      bullet.problem = ''
      bullet.action = ''
      bullet.outcome = ''
      bullet.source_text =
        'The product was SaaS-only; key prospects required on-prem deployment support.'
    })
    render(<IdentityMapPage />)

    expect(
      screen.getByRole('button', {
        name: /the product was saas-only; key prospects required on-prem/i,
      }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /\(no summary\)/i })).toBeNull()
  })

  it('renders thesis metadata fields on the thesis card', () => {
    seed((id) => {
      id.identity.thesis =
        'I build security platforms that ship eBPF agents on AWS at scale. ' +
        'At A10 I owned WAF sensor lifecycle across 400+ deployments. ' +
        'Now I want platform leadership where the substrate is the product.'
      id.identity.title = 'Platform Systems Lead'
      id.identity.origin = 'Repeated migration work'
      id.identity.elaboration = 'Grounded in deployment architecture and product judgment.'
    })

    const { container } = render(<IdentityMapPage />)

    const thesisMeta = container.querySelector('.thesis-meta')
    expect(thesisMeta?.textContent).toContain('Platform Systems Lead')
    expect(thesisMeta?.textContent).toContain('Repeated migration work')
    expect(thesisMeta?.textContent).toContain(
      'Grounded in deployment architecture and product judgment.',
    )
    const thesisBand = container.querySelector('[data-layer="thesis"]') as HTMLElement
    expect(thesisBand.querySelector('.thesis-strength-note')).toBeNull()
    expect(
      within(thesisBand)
        .getByRole('button', { name: /I build security platforms/i })
        .getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('does not duplicate intermediate thesis strength copy below a filled thesis', () => {
    seed((id) => {
      id.identity.thesis =
        'I help teams do better work in complicated situations. ' +
        'I make complex tradeoffs easier for product teams.'
    })

    const { container } = render(<IdentityMapPage />)
    const thesisBand = container.querySelector('[data-layer="thesis"]')
    expect(thesisBand).toBeTruthy()
    expect(
      within(thesisBand as HTMLElement).queryByText(
        'Sparse: the thesis is present, but it needs more concrete evidence or named systems. Current signals: 2 sentences, 0 specific signals, and 0 generic or hedging signals.',
      ),
    ).toBeNull()
    expect(thesisBand?.querySelector('.thesis-strength-note')).toBeNull()
    expect(
      within(thesisBand as HTMLElement)
        .getByRole('button', { name: /I help teams do better work/i })
        .getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('explains an empty thesis status on the thesis band', () => {
    seed((id) => {
      id.identity.thesis = ''
    })

    const { container } = render(<IdentityMapPage />)
    const thesisBand = container.querySelector('[data-layer="thesis"]')
    expect(thesisBand).toBeTruthy()
    expect(
      within(thesisBand as HTMLElement).getByText(
        'Empty: generate a thesis or add one before this section can be evaluated.',
      ),
    ).toBeTruthy()
    expect(thesisBand?.querySelector('.thesis-strength-note')).toBeNull()
    expect(
      within(thesisBand as HTMLElement)
        .getByRole('button', { name: /Empty: generate a thesis or add one/i })
        .getAttribute('aria-describedby'),
    ).toBeNull()
  })
  it('renders competitive moat as a selectable card and keeps advantage input styled', () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Platform engineering plus deployment architecture.'
    })
    render(<IdentityMapPage />)

    expect(screen.queryByLabelText('Competitive moat')).toBeNull()
    expect(
      screen
        .getByRole('button', { name: /platform engineering plus deployment architecture/i })
        .classList.contains('self-moat-card'),
    ).toBe(true)
    expect(
      screen.getByLabelText('New unfair advantage').classList.contains('self-advantage-input'),
    ).toBe(true)
  })

  it('edits competitive moat from the inspector after selecting the moat card', () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /existing authored moat/i }))

    expect(screen.getByRole('heading', { name: 'Competitive Moat' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit moat' }))
    fireEvent.change(screen.getByLabelText('Competitive Moat'), {
      target: { value: 'Updated platform moat.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Updated platform moat.',
    )
    expect(screen.getByRole('button', { name: /updated platform moat/i })).toBeTruthy()
  })

  it('shows competitive moat empty state and adds the moat from the inspector', () => {
    seed((id) => {
      id.self_model.competitive_moat = ''
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /no competitive moat captured yet/i }))

    expect(screen.getByRole('heading', { name: 'Competitive Moat' })).toBeTruthy()
    expect(screen.getByText('No competitive moat captured yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add moat' }))
    fireEvent.change(screen.getByLabelText('Competitive Moat'), {
      target: { value: 'New moat from inspector.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'New moat from inspector.',
    )
    expect(screen.getByRole('button', { name: /new moat from inspector/i })).toBeTruthy()
  })

  it('cancels competitive moat inspector edits without changing the identity', () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Original moat.'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /original moat/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit moat' }))
    fireEvent.change(screen.getByLabelText('Competitive Moat'), {
      target: { value: 'Discarded moat draft.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Original moat.',
    )
    expect(screen.getByRole('button', { name: /original moat/i })).toBeTruthy()
    expect(screen.queryByText('Discarded moat draft.')).toBeNull()
  })

  it('clears competitive moat from the inspector when saving empty text', () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Stale moat to remove.'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /stale moat to remove/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit moat' }))
    fireEvent.change(screen.getByLabelText('Competitive Moat'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBeUndefined()
    expect(screen.getByRole('button', { name: /no competitive moat captured yet/i })).toBeTruthy()
  })

  it('renders profiles as positioning-lens cards instead of audience editing forms', () => {
    seed()
    render(<IdentityMapPage />)

    expect(screen.getByText('positioning lenses for reusable identity variants')).toBeTruthy()
    expect(screen.queryByText('positioning variants for different audiences')).toBeNull()
    expect(screen.queryByLabelText('Profile Text')).toBeNull()
    expect(
      screen
        .getByRole('button', { name: /i make infrastructure tradeoffs legible/i })
        .classList.contains('profile-card'),
    ).toBe(true)
    expect(screen.getByText('Edit in inspector').classList.contains('profile-action')).toBe(true)
  })

  it('edits profile text and tags from the inspector after selecting the profile card', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(
      screen.getByRole('button', { name: /i make infrastructure tradeoffs legible/i }),
    )

    expect(screen.getByRole('heading', { name: 'platform-profile' })).toBeTruthy()
    expect(screen.getByText('Profile · Positioning Lens')).toBeTruthy()
    expect(screen.queryByLabelText('Profile Text')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.change(screen.getByLabelText('Profile Text'), {
      target: { value: 'Updated profile lens.' },
    })
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'platform, product judgment' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity?.profiles[0]).toEqual({
      id: 'platform-profile',
      tags: ['platform', 'product judgment'],
      text: 'Updated profile lens.',
    })
    expect(screen.getByRole('button', { name: /updated profile lens/i })).toBeTruthy()
  })

  it('cancels profile inspector edits without changing the profile', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(
      screen.getByRole('button', { name: /i make infrastructure tradeoffs legible/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.change(screen.getByLabelText('Profile Text'), {
      target: { value: 'Discarded profile draft.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity?.profiles[0]).toEqual({
      id: 'platform-profile',
      tags: ['platform'],
      text: 'I make infrastructure tradeoffs legible for product teams.',
    })
    expect(
      screen.getByRole('button', { name: /i make infrastructure tradeoffs legible/i }),
    ).toBeTruthy()
    expect(screen.queryByText('Discarded profile draft.')).toBeNull()
  })

  it('does not allow saving a profile with empty text', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(
      screen.getByRole('button', { name: /i make infrastructure tradeoffs legible/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    fireEvent.change(screen.getByLabelText('Profile Text'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('disabled')).not.toBeNull()
  })

  it('generates profile lenses from the Profiles band button', async () => {
    seed()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'platform-strategy',
        tags: ['platform', 'product-judgment'],
        text: 'Generated platform strategy lens.',
      },
      {
        id: 'developer-experience',
        tags: ['developer-experience'],
        text: 'Generated developer experience lens.',
      },
    ])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))

    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledWith(
        expect.objectContaining({ identity: expect.objectContaining({ name: 'Alex Example' }) }),
        'https://ai.example/proxy',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(useIdentityStore.getState().currentIdentity?.profiles).toEqual([
      {
        id: 'platform-strategy',
        tags: ['platform', 'product-judgment'],
        text: 'Generated platform strategy lens.',
      },
      {
        id: 'developer-experience',
        tags: ['developer-experience'],
        text: 'Generated developer experience lens.',
      },
    ])
    expect(screen.getByText('Generated 2 profile lenses.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /generated platform strategy lens/i })).toBeTruthy()
  })

  it('generates profile lenses from the action list', async () => {
    seed()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'platform-strategy',
        tags: ['platform'],
        text: 'Action-list generated profile lens.',
      },
    ])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate profiles/i }))

    // Profiles is a downstream leaf in the inference DAG: it drives no other section, so
    // regenerating it runs directly with no downstream prompt and marks nothing stale.
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
    })
    expect(useIdentityStore.getState().currentIdentity?.profiles).toEqual([
      {
        id: 'platform-strategy',
        tags: ['platform'],
        text: 'Action-list generated profile lens.',
      },
    ])
    expect(
      screen.queryByRole('dialog', { name: 'Regenerate downstream sections?' }),
    ).toBeNull()
    // Regenerating a leaf marks nothing stale: no stale rows, no batch control.
    expect(screen.queryByRole('button', { name: 'Regenerate all stale' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Refresh profiles' })).toBeNull()
  })

  // The cascade-machinery tests below drive the downstream prompt from `selfKnowledge`. It is the
  // only inference section that is both async-mockable and a non-leaf, non-draft-review source:
  // `profiles` is now a downstream leaf, while `thesis`/`positioning` open a review draft that
  // short-circuits the cascade. Its downstream is `{positioning, search}`.
  const seedSelfKnowledgeSource = (id: ReturnType<typeof cloneIdentityFixture>) => {
    id.self_model.philosophy = []
    id.self_model.interview_style = { strengths: [], weaknesses: [], prep_strategy: '' }
  }
  const generatedSelfKnowledge = {
    philosophy: [
      {
        id: 'platform-judgment',
        text: 'Favor platform moves when they unlock product access.',
        tags: ['platform'],
      },
    ],
    interview_style: {
      strengths: ['Frames platform proof through customer access.'],
      weaknesses: [],
      prep_strategy: '',
    },
  }

  it('regenerates selected downstream sections through existing request triggers', async () => {
    seed(seedSelfKnowledgeSource)
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce(
      generatedSelfKnowledge,
    )
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: ['Turns platform constraints into market access.'],
      search_vectors: [],
      open_questions: [],
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Regenerate downstream sections?' })
    // Checkboxes start all-checked; uncheck Search to defer it, leaving Positioning to regenerate
    // through its existing request trigger once self-knowledge settles.
    fireEvent.click(within(dialog).getByLabelText(/Search parameters/i))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate selected' }))

    await waitFor(() => {
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog', { name: 'Regenerate downstream sections?' })).toBeNull()
    const stalePanel = screen.getByRole('region', { name: 'Refine and refresh the model' })
    expect(within(stalePanel).queryByRole('heading', { name: 'Refresh self-knowledge' })).toBeNull()
    expect(within(stalePanel).queryByRole('heading', { name: 'Refresh positioning' })).toBeNull()
    expect(
      within(stalePanel).getByRole('heading', { name: 'Refresh search parameters' }),
    ).toBeTruthy()
  })

  it('regenerates stale downstream sections from the queue', async () => {
    seed(seedSelfKnowledgeSource)
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce(
      generatedSelfKnowledge,
    )
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: ['Turns platform constraints into market access.'],
      search_vectors: [],
      open_questions: [],
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()

    const stalePanel = await screen.findByRole('region', { name: 'Refine and refresh the model' })
    fireEvent.click(within(stalePanel).getByRole('button', { name: 'Regenerate all stale' }))

    // Positioning sorts first in the stale queue and opens a review draft, regenerating it and
    // marking the remaining queued section (search) stale.
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })
    expect(within(stalePanel).queryByRole('heading', { name: 'Refresh positioning' })).toBeNull()
    expect(
      within(stalePanel).getByRole('heading', { name: 'Refresh search parameters' }),
    ).toBeTruthy()
  })

  it('clears stale downstream markers without regenerating', async () => {
    seed(seedSelfKnowledgeSource)
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce(
      generatedSelfKnowledge,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()

    const stalePanel = await screen.findByRole('region', { name: 'Refine and refresh the model' })
    fireEvent.click(within(stalePanel).getByRole('button', { name: 'Clear stale markers' }))

    // Clearing removes the stale rows and the batch control; any optional attention items may
    // remain in the queue, but no stale refresh is offered or run.
    expect(screen.queryByRole('button', { name: 'Regenerate all stale' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Refresh positioning' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Refresh search parameters' })).toBeNull()
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).not.toHaveBeenCalled()
  })

  it('marks queued downstream sections stale if a cascade request does not settle', async () => {
    vi.useFakeTimers()
    try {
      seed(seedSelfKnowledgeSource)
      const deferred =
        createDeferred<
          Awaited<
            ReturnType<typeof identityParameterMocks.generateSelfKnowledgeFromIdentityMock>
          >
        >()
      identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockReturnValueOnce(
        deferred.promise,
      )

      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
      fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
      await act(async () => {
        vi.runOnlyPendingTimers()
        await Promise.resolve()
      })
      const dialog = screen.getByRole('dialog', { name: 'Regenerate downstream sections?' })
      // Defer Search (marked stale immediately) and keep Positioning queued behind the stalled
      // self-knowledge request, so the queued section only goes stale once the deadline elapses.
      fireEvent.click(within(dialog).getByLabelText(/Search parameters/i))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate selected' }))

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)
      const stalePanel = screen.getByRole('region', { name: 'Refine and refresh the model' })
      expect(
        within(stalePanel).getByText(
          'Waiting for Self-knowledge before regenerating queued downstream sections.',
        ),
      ).toBeTruthy()
      expect(within(stalePanel).queryByRole('heading', { name: 'Refresh positioning' })).toBeNull()

      act(() => {
        vi.advanceTimersByTime(90_000)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(
        within(stalePanel).getByRole('heading', { name: 'Refresh positioning' }),
      ).toBeTruthy()
      expect(
        within(stalePanel).queryByText(
          'Waiting for Self-knowledge before regenerating queued downstream sections.',
        ),
      ).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks queued downstream sections stale when an upstream cascade request fails', async () => {
    seed(seedSelfKnowledgeSource)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Regenerate downstream sections?' })
    // Defer Search; keep Positioning queued behind the failing self-knowledge request.
    fireEvent.click(within(dialog).getByLabelText(/Search parameters/i))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerate selected' }))

    const stalePanel = await screen.findByRole('region', { name: 'Refine and refresh the model' })
    await waitFor(() => {
      expect(within(stalePanel).getByRole('heading', { name: 'Refresh positioning' })).toBeTruthy()
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('shows run-all inference progress and skips completed or unavailable steps', () => {
    seedNoAttentionIdentity()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))

    const panel = screen.getByRole('region', { name: 'Run all inference' })
    expect(within(panel).getByText('No runnable inference steps remain.')).toBeTruthy()
    expect(within(panel).getByText('Bullet evidence is already structured.')).toBeTruthy()
    expect(within(panel).getByText('Skill depth is already complete.')).toBeTruthy()
    expect(within(panel).getByText('Search parameters already exist.')).toBeTruthy()
    expect(
      within(panel).getByRole('button', { name: 'Retry unfinished' }).getAttribute('disabled'),
    ).not.toBeNull()
    expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).not.toHaveBeenCalled()
    expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).not.toHaveBeenCalled()
  })

  it('pauses run-all inference at generated drafts that require review', async () => {
    seedNoAttentionIdentity()
    useIdentityStore.setState((state) => ({
      currentIdentity: state.currentIdentity
        ? {
            ...state.currentIdentity,
            identity: { ...state.currentIdentity.identity, thesis: '' },
          }
        : state.currentIdentity,
    }))
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockResolvedValueOnce({
      thesis: 'Generated identity thesis.',
      title: 'Staff Platform Engineer',
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))

    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)
    })
    const panel = screen.getByRole('region', { name: 'Run all inference' })
    await waitFor(() => {
      expect(
        within(panel).getByText('Thesis needs review before run all can continue.'),
      ).toBeTruthy()
    })
    expect(
      within(panel).getByText('Review and apply the generated draft, then retry unfinished steps.'),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Generated thesis draft' })).toBeTruthy()
  })

  it('preserves completed run-all steps and retries unfinished work after a failure', async () => {
    seedNoAttentionIdentity()
    useIdentityStore.setState((state) => ({
      currentIdentity: state.currentIdentity
        ? {
            ...state.currentIdentity,
            profiles: [],
          }
        : state.currentIdentity,
    }))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateIdentityProfilesFromIdentityMock
      .mockRejectedValueOnce(new Error('profile generation failed'))
      .mockResolvedValueOnce([
        {
          id: 'platform-generated',
          tags: ['platform'],
          text: 'Generated profile lens after retry.',
        },
      ])

    try {
      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))

      const panel = await screen.findByRole('region', { name: 'Run all inference' })
      await waitFor(() => {
        expect(
          within(panel).getByText('Profiles did not finish. Retry unfinished steps when ready.'),
        ).toBeTruthy()
      })
      expect(within(panel).getByText('Thesis already exists.')).toBeTruthy()
      expect(
        within(panel).getByText('Failed. Successful earlier steps were preserved.'),
      ).toBeTruthy()

      fireEvent.click(within(panel).getByRole('button', { name: 'Retry unfinished' }))

      await waitFor(() => {
        expect(useIdentityStore.getState().currentIdentity?.profiles).toEqual([
          {
            id: 'platform-generated',
            tags: ['platform'],
            text: 'Generated profile lens after retry.',
          },
        ])
      })
      await waitFor(() => {
        expect(within(panel).getByText('Run all inference finished.')).toBeTruthy()
      })
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        2,
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('marks a run-all inference request as failed if it does not settle', async () => {
    vi.useFakeTimers()
    try {
      seedNoAttentionIdentity()
      useIdentityStore.setState((state) => ({
        currentIdentity: state.currentIdentity
          ? {
              ...state.currentIdentity,
              profiles: [],
            }
          : state.currentIdentity,
      }))
      const deferred =
        createDeferred<
          Awaited<
            ReturnType<typeof identityParameterMocks.generateIdentityProfilesFromIdentityMock>
          >
        >()
      identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReturnValueOnce(
        deferred.promise,
      )

      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))
      await act(async () => {
        vi.advanceTimersByTime(0)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
      const panel = screen.getByRole('region', { name: 'Run all inference' })
      expect(within(panel).getByText('Running Profiles.')).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(90_000)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(within(panel).getByText('Profiles did not report completion.')).toBeTruthy()
      expect(within(panel).getByText('Timed out waiting for this section to finish.')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('halts run-all inference when a queued section reports blocked', async () => {
    seedNoAttentionIdentity()
    useIdentityStore.setState((state) => ({
      currentIdentity: state.currentIdentity
        ? {
            ...state.currentIdentity,
            profiles: [],
            skills: {
              ...state.currentIdentity.skills,
              groups: state.currentIdentity.skills.groups.map((group, index) =>
                index === 0
                  ? {
                      ...group,
                      items: [
                        {
                          name: 'Kubernetes',
                          tags: ['platform', 'kubernetes'],
                        },
                      ],
                    }
                  : group,
              ),
            },
          }
        : state.currentIdentity,
    }))
    const firstGroup = useIdentityStore.getState().currentIdentity!.skills.groups[0]!
    skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock.mockResolvedValueOnce([
      {
        groupId: firstGroup.id,
        currentLabel: firstGroup.label,
        suggestedLabel: 'Platform Infrastructure',
      },
    ])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest group names' }))
    await screen.findByLabelText('Suggested skill group names')
    fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))

    const panel = await screen.findByRole('region', { name: 'Run all inference' })
    await waitFor(() => {
      expect(
        within(panel).getByText('Skill depth did not finish. Retry unfinished steps when ready.'),
      ).toBeTruthy()
    })
    expect(
      within(panel).getByText('Blocked. Resolve the section message, then retry unfinished steps.'),
    ).toBeTruthy()
    expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).not.toHaveBeenCalled()
  })

  it('continues run-all inference when a queued section reports skipped', async () => {
    seedNoAttentionIdentity()
    useIdentityStore.setState((state) => ({
      currentIdentity: state.currentIdentity
        ? {
            ...state.currentIdentity,
            profiles: [],
            skills: {
              ...state.currentIdentity.skills,
              groups: state.currentIdentity.skills.groups.map((group, index) =>
                index === 0
                  ? {
                      ...group,
                      items: [
                        {
                          name: 'Kubernetes',
                          tags: ['platform', 'kubernetes'],
                        },
                      ],
                    }
                  : group,
              ),
            },
          }
        : state.currentIdentity,
    }))
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'platform-generated',
        tags: ['platform'],
        text: 'Generated profile after skipped skills.',
      },
    ])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Run all inference' }))
    const currentIdentity = useIdentityStore.getState().currentIdentity!
    currentIdentity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
        context: 'Satisfied while the run-all queue was starting.',
        positioning: 'Platform roles.',
      },
    ]
    useIdentityStore.setState({ currentIdentity })

    const panel = await screen.findByRole('region', { name: 'Run all inference' })
    await waitFor(() => {
      expect(within(panel).getByText('Skipped by the section.')).toBeTruthy()
    })
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
    })
    await waitFor(() => {
      expect(within(panel).getByText('Run all inference finished.')).toBeTruthy()
    })
  })

  it('clears a stale marker when the matching band generation starts directly', async () => {
    // Self-knowledge clears its own marker the moment its band generation starts
    // (onSelfKnowledgeRequestStarted). Mark it stale directly, then regenerate it from its band.
    seed()
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce(
      generatedSelfKnowledge,
    )
    useIdentityStore.getState().markInferenceSectionsStale(['selfKnowledge'])

    render(<IdentityMapPage />)

    const stalePanel = screen.getByRole('region', { name: 'Refine and refresh the model' })
    expect(
      within(stalePanel).getByRole('heading', { name: 'Refresh self-knowledge' }),
    ).toBeTruthy()

    fireEvent.click(
      within(getSelfKnowledgeControls()).getByRole('button', {
        name: /^generate self-knowledge$/i,
      }),
    )

    // Self-knowledge was the only stale section; starting its band generation clears the marker,
    // removing the stale row and the batch control (optional attention items may remain).
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Regenerate all stale' })).toBeNull()
    })
    expect(screen.queryByRole('heading', { name: 'Refresh self-knowledge' })).toBeNull()
  })

  it('shows a configuration error when profile generation has no AI proxy', async () => {
    seed()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Connect the AI proxy before generating profile lenses.'),
      ).toBeTruthy()
    })
    expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('shows a generic error when profile generation fails', async () => {
    seed()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const generationError = new Error('proxy timeout')
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockRejectedValueOnce(
      generationError,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to generate profile lenses.')).toBeTruthy()
    })
    expect(
      screen.getByRole('button', { name: /^regenerate profiles$/i }).getAttribute('aria-busy'),
    ).toBe('false')
    expect(consoleErrorSpy).toHaveBeenCalledWith(generationError)
    consoleErrorSpy.mockRestore()
  })

  it('keeps existing profiles when generated profile lenses are empty', async () => {
    const existingProfiles = [
      {
        id: 'platform-profile',
        tags: ['platform'],
        text: 'I make infrastructure tradeoffs legible for product teams.',
      },
    ]
    seed()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockResolvedValueOnce([])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))

    await waitFor(() => {
      expect(screen.getByText('The generated draft did not return profile lenses.')).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.profiles).toEqual(existingProfiles)
  })

  it('auto-dismisses profile generation info messages', async () => {
    vi.useFakeTimers()
    seed()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'platform-strategy',
        tags: ['platform'],
        text: 'Generated platform strategy lens.',
      },
    ])

    try {
      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))

      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByText('Generated 1 profile lens.')).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(8000)
      })

      expect(screen.queryByText('Generated 1 profile lens.')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not start duplicate profile generation while a request is running', async () => {
    seed()
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityProfilesFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
    })
    expect(screen.getByText('Generating profile lenses...')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^generating\.\.\.$/i }).getAttribute('aria-busy'),
    ).toBe('true')
    // Profiles is a leaf, so the action regenerates it directly (no downstream prompt) and the
    // in-flight guard reports the duplicate.
    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate profiles/i }))

    await waitFor(() => {
      expect(screen.getByText('Profile generation is already running.')).toBeTruthy()
    })
    expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve([])
      await deferred.promise
    })
  })

  it('discards generated profile lenses if identity changes during generation', async () => {
    const originalProfiles = [
      {
        id: 'platform-profile',
        tags: ['platform'],
        text: 'I make infrastructure tradeoffs legible for product teams.',
      },
    ]
    seed()
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityProfilesFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
    })

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
      },
    })

    await act(async () => {
      deferred.resolve([
        {
          id: 'stale-profile',
          tags: ['stale'],
          text: 'Stale generated profile.',
        },
      ])
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the profile draft.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.profiles).toEqual(originalProfiles)
  })

  it('aborts profile generation on unmount without surfacing abort errors', async () => {
    seed()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityProfilesFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    const { unmount } = render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate profiles$/i }))
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityProfilesFromIdentityMock).toHaveBeenCalledTimes(
        1,
      )
    })
    const signal =
      identityParameterMocks.generateIdentityProfilesFromIdentityMock.mock.calls[0]?.[2]?.signal

    unmount()

    expect(signal?.aborted).toBe(true)

    await act(async () => {
      const abortError = new Error('aborted')
      abortError.name = 'AbortError'
      deferred.reject(abortError)
      await deferred.promise.catch(() => undefined)
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('refreshes strategic positioning into a reviewed draft before applying sections', async () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
      id.self_model.unfair_advantages = ['Existing advantage']
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      competitive_moat:
        'Sharper platform moat grounded in deployment architecture and product judgment.',
      unfair_advantages: ['Platform infrastructure depth plus product judgment'],
      search_vectors: [
        {
          id: 'generated-platform',
          title: 'Platform Strategy',
          priority: 'high',
          thesis: 'Lead platform roles where deployment architecture shapes market access.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform strategy'], secondary: ['deployment architecture'] },
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
      ],
      open_questions: [
        {
          id: 'generated-question',
          topic: 'Customer deployment proof',
          description: 'Clarify the strongest customer deployment proof.',
          action: 'Add one adoption example.',
          severity: 'medium',
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
      ],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^refresh positioning$/i }))

    await waitFor(() => {
      expect(screen.getByText('Review the generated positioning before applying it.')).toBeTruthy()
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
      expect.objectContaining({ mode: 'regenerate' }),
    )
    expect(screen.getByLabelText('Generated positioning draft')).toBeTruthy()
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Existing authored moat.',
    )
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /^replace moat$/i }))
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Sharper platform moat grounded in deployment architecture and product judgment.',
    )

    fireEvent.click(screen.getByRole('button', { name: /^add advantages$/i }))
    expect(useIdentityStore.getState().currentIdentity?.self_model.unfair_advantages).toEqual([
      'Existing advantage',
      'Platform infrastructure depth plus product judgment',
    ])

    fireEvent.click(screen.getByRole('button', { name: /^add vectors$/i }))
    const vectors = useIdentityStore.getState().currentIdentity?.search_vectors ?? []
    expect(vectors).toHaveLength(1)
    expect(vectors[0]).toMatchObject({
      title: 'Platform Strategy',
      needs_review: true,
    })
    expect(vectors[0]?.id).not.toBe('generated-platform')

    fireEvent.click(screen.getByRole('button', { name: /^add questions$/i }))
    const questions = useIdentityStore.getState().currentIdentity?.awareness?.open_questions ?? []
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({
      topic: 'Customer deployment proof',
      needs_review: true,
    })
    expect(questions[0]?.id).not.toBe('generated-question')
  })

  it('shows a configuration error when refreshing positioning has no AI proxy', async () => {
    seed()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^refresh positioning$/i }))

    await waitFor(() => {
      expect(screen.getByText('Connect the AI proxy before refreshing positioning.')).toBeTruthy()
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).not.toHaveBeenCalled()
  })

  it('shows an error and preserves identity when refreshing positioning fails', async () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
      id.self_model.unfair_advantages = ['Existing advantage']
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^refresh positioning$/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to refresh positioning.')).toBeTruthy()
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    const identity = useIdentityStore.getState().currentIdentity!
    expect(identity.self_model.competitive_moat).toBe('Existing authored moat.')
    expect(identity.self_model.unfair_advantages).toEqual(['Existing advantage'])
    expect(identity.search_vectors).toEqual([])
    expect(identity.awareness?.open_questions).toEqual([])
    expect(screen.queryByLabelText('Generated positioning draft')).toBeNull()
  })

  it('discards a positioning draft if identity changes during refresh', async () => {
    seed((id) => {
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const deferred =
      createDeferred<
        Awaited<
          ReturnType<typeof identityParameterMocks.generateStrategicPositioningFromIdentityMock>
        >
      >()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^refresh positioning$/i }))

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
      },
    })

    await act(async () => {
      deferred.resolve({
        competitive_moat: 'Generated moat.',
        unfair_advantages: ['Generated advantage'],
        search_vectors: [],
        open_questions: [],
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the positioning draft.'),
      ).toBeTruthy()
    })
    expect(screen.queryByLabelText('Generated positioning draft')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).not.toBe(
      'Generated moat.',
    )
  })

  it('refuses to apply a positioning draft after identity changes', async () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      competitive_moat: 'Generated replacement moat.',
      unfair_advantages: [],
      search_vectors: [],
      open_questions: [],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^refresh positioning$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Generated positioning draft')).toBeTruthy()
    })
    const currentIdentity = useIdentityStore.getState().currentIdentity!
    currentIdentity.model_revision += 1
    useIdentityStore.setState({ currentIdentity })
    fireEvent.click(screen.getByRole('button', { name: /^replace moat$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Identity changed since this draft was generated; discarded the positioning draft.',
        ),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Existing authored moat.',
    )
    expect(screen.queryByLabelText('Generated positioning draft')).toBeNull()
  })

  it('explains the map as the editing surface and deepens pending skills from Skills', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
          depth: 'strong',
          context: 'Used for customer-hosted deployments.',
          positioning: 'Platform modernization and Kubernetes operations.',
        },
        {
          name: 'Terraform',
          tags: ['platform', 'iac'],
          skipped_at: '2026-04-08T00:00:00.000Z',
        },
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })

    render(<IdentityMapPage />)

    expect(screen.getByText('Edit the durable identity here.')).toBeTruthy()
    expect(screen.getByText(/import turns source material into a draft/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Generate research thesis' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Regenerate research thesis' })).toBeNull()
    expect(screen.getByText(/deepen skills here so downstream work knows/i)).toBeTruthy()

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    expect(
      within(panel).getByText((_, element) => element?.textContent === '1 pending'),
    ).toBeTruthy()
    expect(
      within(panel).getByText((_, element) => element?.textContent === '1 complete'),
    ).toBeTruthy()
    expect(
      within(panel).getByText((_, element) => element?.textContent === '1 skipped'),
    ).toBeTruthy()

    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://ai.example/proxy',
          group: expect.objectContaining({ id: 'platform' }),
          skill: expect.objectContaining({ name: 'TypeScript' }),
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Deepened 1 skill(s).')).toBeTruthy()
    })
    expect(
      useIdentityStore
        .getState()
        .currentIdentity!.skills.groups[0]!.items.find((skill) => skill.name === 'TypeScript'),
    ).toMatchObject({
      depth: 'strong',
      enriched_by: 'llm-accepted',
    })
  })

  it('deepens all pending skills with evidence from the Skills band', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
        {
          name: 'Ansible',
          tags: [],
        },
        {
          name: 'Elixir',
          tags: ['language'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript', 'Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock
      .mockResolvedValueOnce({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Builds TypeScript services and UI surfaces.',
        positioning: 'Strong supporting signal. Mention early.',
      })
      .mockResolvedValueOnce({
        depth: 'expert',
        depthConfidence: 'medium',
        context: 'Authors Ansible automation and understands module conventions.',
        positioning: 'Lead with it when relevant.',
      })
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(
        screen.getByText('Deepened 2 skill(s); 1 skipped for missing or insufficient evidence.'),
      ).toBeTruthy()
    })

    const skills = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items
    expect(skills.find((skill) => skill.name === 'TypeScript')).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      enriched_by: 'llm-accepted',
    })
    expect(skills.find((skill) => skill.name === 'Ansible')).toMatchObject({
      depth: 'expert',
      depthConfidence: 'medium',
      enriched_by: 'llm-accepted',
    })
    const elixir = skills.find((skill) => skill.name === 'Elixir')
    expect(elixir?.depth).toBeUndefined()
    expect(elixir?.skipped_at).toEqual(expect.any(String))
    expect(screen.getByRole('button', { name: 'Ansible' }).className).toContain('complete')
    expect(screen.getByRole('button', { name: 'Ansible' }).className).not.toContain('untagged')
  })

  it('surfaces disabled AI proxy configuration for bulk skill deepening', () => {
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    expect(
      screen.getAllByText('AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.'),
    ).not.toHaveLength(0)
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('skips bulk skill suggestions that do not infer a depth', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: 'Context without depth.',
      positioning: 'Positioning without depth.',
    })
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(
        screen.getByText('No skills deepened; 1 skipped for missing or insufficient evidence.'),
      ).toBeTruthy()
    })
    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.depth).toBeUndefined()
    expect(skill.skipped_at).toEqual(expect.any(String))
  })

  it('continues bulk skill deepening after one suggestion fails', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
        {
          name: 'Ansible',
          tags: ['automation', 'ansible'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript', 'Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        depth: 'expert',
        depthConfidence: 'medium',
        context: 'Authors Ansible roles and modules.',
        positioning: 'Lead with it when relevant.',
      })
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(screen.getByText('Deepened 1 skill(s); 1 failed.')).toBeTruthy()
    })
    const skills = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items
    expect(skills.find((skill) => skill.name === 'TypeScript')?.depth).toBeUndefined()
    expect(skills.find((skill) => skill.name === 'Ansible')).toMatchObject({
      depth: 'expert',
      enriched_by: 'llm-accepted',
    })
  })

  it('prevents duplicate bulk skill deepening requests while one is running', async () => {
    const deferred = createDeferred<{
      depth: 'strong'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    const button = within(panel).getByRole('button', { name: 'Deepen all skills' })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    const busyButton = within(panel).getByRole('button', { name: 'Deepening...' })
    expect(busyButton.getAttribute('aria-busy')).toBe('true')
    expect(busyButton).toHaveProperty('disabled', true)

    await act(async () => {
      deferred.resolve({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Builds TypeScript services.',
        positioning: 'Mention for backend UI roles.',
      })
      await deferred.promise
    })
    await waitFor(() => {
      expect(screen.getByText('Deepened 1 skill(s).')).toBeTruthy()
    })
  })

  it('shows intermediate progress while bulk skill deepening continues', async () => {
    const firstDeferred = createDeferred<{
      depth: 'strong'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    const secondDeferred = createDeferred<{
      depth: 'expert'
      depthConfidence: 'medium'
      context: string
      positioning: string
    }>()
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
        {
          name: 'Ansible',
          tags: ['automation', 'ansible'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript', 'Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise)
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    await act(async () => {
      firstDeferred.resolve({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Builds TypeScript services.',
        positioning: 'Mention for backend UI roles.',
      })
      await firstDeferred.promise
    })

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(2)
      expect(within(panel).getByRole('status').textContent).toBe('Processed 1 of 2 skill(s)...')
    })

    await act(async () => {
      secondDeferred.resolve({
        depth: 'expert',
        depthConfidence: 'medium',
        context: 'Authors Ansible roles and modules.',
        positioning: 'Lead with it when relevant.',
      })
      await secondDeferred.promise
    })
    await waitFor(() => {
      expect(screen.getByText('Deepened 2 skill(s).')).toBeTruthy()
    })
  })

  it('aborts in-flight bulk skill deepening when the Skills band unmounts', async () => {
    const deferred = createDeferred<{
      depth: 'strong'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    const view = render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    const signal = skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mock.calls[0]?.[0]
      ?.signal as AbortSignal

    view.unmount()
    await act(async () => {
      deferred.resolve({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Stale TypeScript suggestion.',
        positioning: 'Stale positioning.',
      })
      await deferred.promise
    })

    expect(signal.aborted).toBe(true)
    expect(
      useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!.depth,
    ).toBeUndefined()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('preserves a manual skill edit when a stale bulk suggestion resolves later', async () => {
    const deferred = createDeferred<{
      depth: 'strong'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      const current = useIdentityStore.getState().currentIdentity!
      useIdentityStore.getState().updateCurrentSkillGroups(
        current.skills.groups.map((group) =>
          group.id === 'platform'
            ? {
                ...group,
                items: group.items.map((skill) =>
                  skill.name === 'TypeScript'
                    ? {
                        ...skill,
                        depth: 'expert',
                        context: 'Manual TypeScript context.',
                        enriched_by: 'user',
                      }
                    : skill,
                ),
              }
            : group,
        ),
      )
    })

    await act(async () => {
      deferred.resolve({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Stale AI TypeScript context.',
        positioning: 'Stale AI positioning.',
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(screen.getByText('No skills deepened.')).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      depth: 'expert',
      context: 'Manual TypeScript context.',
      enriched_by: 'user',
    })
  })

  it('continues when a queued skill is removed during bulk deepening', async () => {
    const deferred = createDeferred<{
      depth: 'strong'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
        {
          name: 'Ansible',
          tags: ['automation', 'ansible'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript', 'Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    render(<IdentityMapPage />)

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Deepen all skills' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      const current = useIdentityStore.getState().currentIdentity!
      useIdentityStore.getState().updateCurrentSkillGroups(
        current.skills.groups.map((group) =>
          group.id === 'platform'
            ? {
                ...group,
                items: group.items.filter((skill) => skill.name !== 'Ansible'),
              }
            : group,
        ),
      )
    })

    await act(async () => {
      deferred.resolve({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Builds TypeScript services.',
        positioning: 'Mention for backend UI roles.',
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(screen.getByText('Deepened 1 skill(s); 1 failed.')).toBeTruthy()
    })
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    expect(
      useIdentityStore
        .getState()
        .currentIdentity!.skills.groups[0]!.items.find((skill) => skill.name === 'TypeScript'),
    ).toMatchObject({
      depth: 'strong',
      enriched_by: 'llm-accepted',
    })
    expect(
      useIdentityStore
        .getState()
        .currentIdentity!.skills.groups[0]!.items.find((skill) => skill.name === 'Ansible'),
    ).toBeUndefined()
  })

  it('reports when a prop-triggered bulk skill request has no pending targets', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
          depth: 'strong',
        },
      ]
    })
    const onBulkRequestSettled = vi.fn()
    render(<SkillsBand bulkRequestId={1} onBulkRequestSettled={onBulkRequestSettled} />)

    await waitFor(() => {
      expect(screen.getByText('No pending skills to deepen.')).toBeTruthy()
    })
    expect(onBulkRequestSettled).toHaveBeenCalledWith(1, 'skipped')
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('reports blocked when a prop-triggered bulk skill request has open name suggestions', async () => {
    seed()
    const firstGroup = useIdentityStore.getState().currentIdentity!.skills.groups[0]!
    skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock.mockResolvedValueOnce([
      {
        groupId: firstGroup.id,
        currentLabel: firstGroup.label,
        suggestedLabel: 'Platform Infrastructure',
      },
    ])
    const onBulkRequestSettled = vi.fn()
    const { rerender } = render(
      <SkillsBand bulkRequestId={0} onBulkRequestSettled={onBulkRequestSettled} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Suggest group names' }))
    await screen.findByLabelText('Suggested skill group names')
    rerender(<SkillsBand bulkRequestId={1} onBulkRequestSettled={onBulkRequestSettled} />)

    await waitFor(() => {
      expect(onBulkRequestSettled).toHaveBeenCalledWith(1, 'blocked')
    })
    expect(
      screen.getByText('Apply or discard group name suggestions before deepening skills.'),
    ).toBeTruthy()
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('only keeps the untagged skill-chip warning on pending untagged skills', () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'Pending untagged',
          tags: [],
        },
        {
          name: 'Complete untagged',
          tags: [],
          depth: 'strong',
        },
        {
          name: 'Pending tagged',
          tags: ['backend'],
        },
      ]
    })
    render(<SkillsBand />)

    expect(screen.getByRole('button', { name: 'Pending untagged' }).className).toContain('untagged')
    expect(screen.getByRole('button', { name: 'Pending untagged' }).className).toContain('pending')
    expect(screen.getByRole('button', { name: 'Complete untagged' }).className).toContain(
      'complete',
    )
    expect(screen.getByRole('button', { name: 'Complete untagged' }).className).not.toContain(
      'untagged',
    )
    expect(screen.getByRole('button', { name: 'Pending tagged' }).className).toContain('pending')
    expect(screen.getByRole('button', { name: 'Pending tagged' }).className).not.toContain(
      'untagged',
    )
  })

  it('keeps bulk skill deepening visible when no skills are pending', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
          depth: 'strong',
          context: 'Used for customer-hosted deployments.',
          positioning: 'Platform modernization and Kubernetes operations.',
        },
        {
          name: 'Terraform',
          tags: ['platform', 'iac'],
          skipped_at: '2026-04-08T00:00:00.000Z',
        },
      ]
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    const actionDialog = screen.getByRole('dialog', { name: 'Identity action items' })
    expect(
      within(actionDialog).getByRole('button', {
        name: /run action: review skill depth/i,
      }).textContent,
    ).toContain('Review skill depth')
    fireEvent.click(
      within(actionDialog).getByRole('button', {
        name: /run action: review skill depth/i,
      }),
    )

    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection).toMatchObject({
        type: 'skill-item',
        groupId: 'platform',
        itemId: 'Kubernetes',
      })
    })

    const panel = screen.getByText('Skill depth').closest('.skills-enrichment-panel') as HTMLElement
    expect(within(panel).getByRole('button', { name: 'Deepen all skills' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(within(panel).queryByRole('button', { name: 'Review skill depth' })).toBeNull()
    expect(within(panel).getByText('No pending skills to deepen.')).toBeTruthy()
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('routes action controls to skill depth, positioning, and strategy generation', async () => {
    seed((id) => {
      id.skills.groups[0]!.items = [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
          depth: 'strong',
          context: 'Used for customer-hosted deployments.',
          positioning: 'Platform modernization and Kubernetes operations.',
        },
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ]
      id.roles[0]!.bullets[0]!.technologies.push('TypeScript')
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock
      .mockResolvedValueOnce({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      })
      .mockResolvedValueOnce({
        unfair_advantages: ['Platform infrastructure depth plus product judgment'],
        search_vectors: [],
        open_questions: [],
      })

    render(<IdentityMapPage />)

    const actionPanel = screen
      .getAllByRole('region', { name: 'Deepen skill evidence' })
      .find((panel) => within(panel).queryByText('Next action'))
    if (!actionPanel) throw new Error('Expected next-action skill evidence panel.')
    expect(
      within(actionPanel).getByText(
        'Bullets → skills → thesis → profiles → chapters → self-knowledge → positioning → search',
      ),
    ).toBeTruthy()
    expect(within(actionPanel).getByText('1 pending')).toBeTruthy()

    fireEvent.click(within(actionPanel).getByRole('button', { name: 'View all actions' }))
    const actionDialog = screen.getByRole('dialog', { name: 'Identity action items' })
    expect(within(actionDialog).getByText('1 Bullet evidence')).toBeTruthy()
    expect(within(actionDialog).getByText('2 Skill depth')).toBeTruthy()
    expect(within(actionDialog).getByText('3 Thesis')).toBeTruthy()
    expect(within(actionDialog).getByText('4 Profiles')).toBeTruthy()
    expect(within(actionDialog).getByText('5 Career chapters')).toBeTruthy()
    expect(within(actionDialog).getByText('6 Self-knowledge')).toBeTruthy()
    expect(within(actionDialog).getByText('7 Positioning')).toBeTruthy()
    expect(within(actionDialog).getByText('8 Search parameters')).toBeTruthy()
    expect(within(actionDialog).getByText('9 Review')).toBeTruthy()
    fireEvent.click(within(actionDialog).getByRole('button', { name: 'Close' }))

    const deepenButton = within(actionPanel).getByRole('button', {
      name: /run next action: deepen all skills \(1\)/i,
    })
    expect(deepenButton.textContent).toContain('Deepen all skills (1)')

    fireEvent.click(deepenButton)
    await waitFor(() => {
      expect(document.querySelector('[data-layer="skills"]')?.className).toContain(
        'action-highlight',
      )
    })
    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: expect.objectContaining({ name: 'TypeScript' }),
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Deepened 1 skill(s).')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: refresh positioning/i }))
    await deferDownstreamPrompt()
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
      expect.objectContaining({ mode: 'regenerate' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate parameters/i }))
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(2)
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
    )
  })

  it('regenerates the identity thesis from the action list into an applyable draft', async () => {
    seed()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockResolvedValueOnce({
      thesis: 'I turn platform complexity into product leverage.',
      title: 'Platform Systems Lead',
      origin: 'Repeated platform migration work.',
      elaboration: 'The strongest evidence sits in Kubernetes delivery and product judgment.',
    })

    const { container } = render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    const downstreamPrompt = await screen.findByRole('dialog', {
      name: 'Regenerate downstream sections?',
    })
    expect(
      within(downstreamPrompt).getByText(
        'This source opens a review draft first. Apply that draft before regenerating downstream sections.',
      ),
    ).toBeTruthy()
    expect(
      within(downstreamPrompt).getByRole('button', { name: 'Regenerate selected' }),
    ).toHaveProperty('disabled', true)
    expect(within(downstreamPrompt).getByRole('button', { name: 'Regenerate all' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(within(downstreamPrompt).getByLabelText(/Profiles/i)).toHaveProperty('disabled', true)
    fireEvent.click(within(downstreamPrompt).getByRole('button', { name: 'Defer downstream' }))

    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledWith(
        expect.objectContaining({ identity: expect.objectContaining({ name: 'Alex Example' }) }),
        'https://ai.example/proxy',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(screen.getByLabelText('Generated thesis draft')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Apply thesis' }))

    expect(useIdentityStore.getState().currentIdentity?.identity).toMatchObject({
      thesis: 'I turn platform complexity into product leverage.',
      title: 'Platform Systems Lead',
      origin: 'Repeated platform migration work.',
      elaboration: 'The strongest evidence sits in Kubernetes delivery and product judgment.',
    })
    expect(
      screen.queryByText(
        'Empty: generate or add a thesis sentence before this section can be evaluated.',
      ),
    ).toBeNull()
    const thesisBand = container.querySelector('[data-layer="thesis"]')
    expect(thesisBand).toBeTruthy()
    expect(within(thesisBand as HTMLElement).queryByText(/^Empty$/)).toBeNull()
    expect(within(thesisBand as HTMLElement).getByText(/^Draft$/)).toBeTruthy()
    expect(thesisBand?.querySelector('.thesis-strength-note')).toBeNull()
    expect(
      within(thesisBand as HTMLElement)
        .getByRole('button', { name: /I turn platform complexity/i })
        .getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('generates philosophy and interview self-knowledge from the action list', async () => {
    seed((id) => {
      id.self_model.philosophy = []
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce({
      philosophy: [
        {
          id: 'platform-judgment',
          text: 'Favor platform moves when they unlock product access.',
          tags: ['platform', 'product'],
        },
      ],
      interview_style: {
        strengths: ['Uses deployment architecture as market-access evidence.'],
        weaknesses: ['Can go too deep on systems detail before framing the business stakes.'],
        prep_strategy: 'Lead with the customer constraint, then use platform evidence as proof.',
      },
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledWith(
        expect.objectContaining({ identity: expect.objectContaining({ name: 'Alex Example' }) }),
        'https://ai.example/proxy',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.philosophy).toEqual([
      {
        id: 'platform-judgment',
        text: 'Favor platform moves when they unlock product access.',
        tags: ['platform', 'product'],
      },
    ])
    expect(useIdentityStore.getState().currentIdentity?.self_model.interview_style).toEqual({
      strengths: ['Uses deployment architecture as market-access evidence.'],
      weaknesses: ['Can go too deep on systems detail before framing the business stakes.'],
      prep_strategy: 'Lead with the customer constraint, then use platform evidence as proof.',
    })
    expect(
      screen.getByText('Generated 1 philosophy position and interview self-knowledge.'),
    ).toBeTruthy()
  })

  it('renders interview self-knowledge strengths, weaknesses, and prep strategy', () => {
    seed((id) => {
      id.self_model.interview_style = {
        strengths: ['Translate low-level platform details into product consequences.'],
        weaknesses: ['Can over-explain architecture before naming the buyer constraint.'],
        prep_strategy: 'Lead with the customer access problem, then use platform proof.',
      }
    })

    render(<IdentityMapPage />)

    const interviewSection = screen
      .getByText('Interview Self-Knowledge')
      .closest('.self-interview') as HTMLElement | null
    if (!interviewSection) throw new Error('Expected interview self-knowledge section.')

    expect(
      within(interviewSection).getByText(
        'Translate low-level platform details into product consequences.',
      ),
    ).toBeTruthy()
    expect(
      within(interviewSection).getByText(
        'Can over-explain architecture before naming the buyer constraint.',
      ),
    ).toBeTruthy()
    expect(
      within(interviewSection).getByText(
        'Lead with the customer access problem, then use platform proof.',
      ),
    ).toBeTruthy()
    expect(
      within(interviewSection)
        .getByText('Translate low-level platform details into product consequences.')
        .closest('.interview-block')
        ?.classList.contains('interview-strength'),
    ).toBe(true)
    expect(
      within(interviewSection)
        .getByText('Can over-explain architecture before naming the buyer constraint.')
        .closest('.interview-block')
        ?.classList.contains('interview-weakness'),
    ).toBe(true)
    expect(
      within(interviewSection)
        .getByText('Lead with the customer access problem, then use platform proof.')
        .closest('.interview-block')
        ?.classList.contains('interview-strategy'),
    ).toBe(true)
  })

  it('renders empty interview self-knowledge placeholders', () => {
    seed((id) => {
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })

    render(<IdentityMapPage />)

    const interviewSection = screen
      .getByText('Interview Self-Knowledge')
      .closest('.self-interview') as HTMLElement | null
    if (!interviewSection) throw new Error('Expected interview self-knowledge section.')

    expect(within(interviewSection).getAllByText(/not captured/i)).toHaveLength(3)
  })

  it('auto-dismisses self-knowledge info messages after the timeout', async () => {
    vi.useFakeTimers()
    try {
      seed((id) => {
        id.self_model.philosophy = []
        id.self_model.interview_style = {
          strengths: [],
          weaknesses: [],
          prep_strategy: '',
        }
      })
      identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce({
        philosophy: [
          {
            id: 'platform-judgment',
            text: 'Favor platform moves when they unlock product access.',
            tags: ['platform'],
          },
        ],
        interview_style: {
          strengths: [],
          weaknesses: [],
          prep_strategy: '',
        },
      })

      render(<IdentityMapPage />)

      fireEvent.click(
        within(getSelfKnowledgeControls()).getByRole('button', {
          name: /^generate self-knowledge$/i,
        }),
      )
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      const message = 'Generated 1 philosophy position and interview self-knowledge.'
      expect(screen.getByText(message)).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(8000)
      })

      expect(screen.queryByText(message)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a configuration error when generating self-knowledge has no AI proxy', async () => {
    seed((id) => {
      id.self_model.philosophy = []
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(
        screen.getByText(
          'Connect the AI proxy before generating philosophy and interview self-knowledge.',
        ),
      ).toBeTruthy()
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).not.toHaveBeenCalled()
  })

  it('shows an error and clears busy state when self-knowledge generation fails', async () => {
    seed()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)
    const controls = getSelfKnowledgeControls()
    const generateButton = within(controls).getByRole('button', {
      name: /^generate self-knowledge$/i,
    })
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(
        screen.getByText('Unable to generate philosophy and interview self-knowledge.'),
      ).toBeTruthy()
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(generateButton.getAttribute('aria-busy')).toBe('false')
  })

  it('aborts self-knowledge generation on unmount without surfacing abort errors', async () => {
    seed()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateSelfKnowledgeFromIdentityMock>>
      >()
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    const { unmount } = render(<IdentityMapPage />)

    fireEvent.click(
      within(getSelfKnowledgeControls()).getByRole('button', {
        name: /^generate self-knowledge$/i,
      }),
    )
    await waitFor(() => {
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)
    })
    const signal =
      identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mock.calls[0]?.[2]?.signal

    unmount()

    expect(signal?.aborted).toBe(true)

    await act(async () => {
      const abortError = new Error('aborted')
      abortError.name = 'AbortError'
      deferred.reject(abortError)
      await deferred.promise.catch(() => undefined)
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('does not start duplicate self-knowledge generation while a request is running', async () => {
    seed((id) => {
      id.self_model.philosophy = []
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateSelfKnowledgeFromIdentityMock>>
      >()
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()
    await waitFor(() => {
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(screen.getByText('Self-knowledge generation is already running.')).toBeTruthy()
    })
    expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve({
        philosophy: [],
        interview_style: {
          strengths: [],
          weaknesses: [],
          prep_strategy: '',
        },
      })
      await deferred.promise
    })
  })

  it('discards generated self-knowledge if identity changes during generation', async () => {
    seed((id) => {
      id.self_model.philosophy = []
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateSelfKnowledgeFromIdentityMock>>
      >()
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate self-knowledge/i }))
    await deferDownstreamPrompt()
    await waitFor(() => {
      expect(identityParameterMocks.generateSelfKnowledgeFromIdentityMock).toHaveBeenCalledTimes(1)
    })

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
      },
    })

    await act(async () => {
      deferred.resolve({
        philosophy: [
          {
            id: 'platform-judgment',
            text: 'Generated philosophy.',
            tags: ['platform'],
          },
        ],
        interview_style: {
          strengths: ['Generated strength.'],
          weaknesses: [],
          prep_strategy: '',
        },
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the self-knowledge draft.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.philosophy).toEqual([])
    expect(useIdentityStore.getState().currentIdentity?.self_model.interview_style).toEqual({
      strengths: [],
      weaknesses: [],
      prep_strategy: '',
    })
  })

  it('preserves identity when generated self-knowledge is empty', async () => {
    const existingPhilosophy = [
      {
        id: 'existing',
        text: 'Existing philosophy.',
        tags: ['existing'],
      },
    ]
    const existingInterview = {
      strengths: ['Existing strength.'],
      weaknesses: ['Existing weakness.'],
      prep_strategy: 'Existing prep.',
    }
    seed((id) => {
      id.self_model.philosophy = existingPhilosophy
      id.self_model.interview_style = existingInterview
    })
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce({
      philosophy: [],
      interview_style: {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      },
    })

    render(<IdentityMapPage />)
    fireEvent.click(
      within(getSelfKnowledgeControls()).getByRole('button', {
        name: /^generate self-knowledge$/i,
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('The generated draft did not return new self-knowledge.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.philosophy).toEqual(
      existingPhilosophy,
    )
    expect(useIdentityStore.getState().currentIdentity?.self_model.interview_style).toEqual(
      existingInterview,
    )
  })

  it('applies interview-only self-knowledge without replacing existing philosophy', async () => {
    const existingPhilosophy = [
      {
        id: 'existing',
        text: 'Existing philosophy.',
        tags: ['existing'],
      },
    ]
    seed((id) => {
      id.self_model.philosophy = existingPhilosophy
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
    })
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce({
      philosophy: [],
      interview_style: {
        strengths: ['Generated strength.'],
        weaknesses: ['Generated weakness.'],
        prep_strategy: 'Generated prep.',
      },
    })

    render(<IdentityMapPage />)
    fireEvent.click(
      within(getSelfKnowledgeControls()).getByRole('button', {
        name: /^generate self-knowledge$/i,
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('Generated 0 philosophy positions and interview self-knowledge.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.philosophy).toEqual(
      existingPhilosophy,
    )
    expect(useIdentityStore.getState().currentIdentity?.self_model.interview_style).toEqual({
      strengths: ['Generated strength.'],
      weaknesses: ['Generated weakness.'],
      prep_strategy: 'Generated prep.',
    })
  })

  it('applies philosophy-only self-knowledge without replacing existing interview notes', async () => {
    const existingInterview = {
      strengths: ['Existing strength.'],
      weaknesses: ['Existing weakness.'],
      prep_strategy: 'Existing prep.',
    }
    seed((id) => {
      id.self_model.philosophy = []
      id.self_model.interview_style = existingInterview
    })
    identityParameterMocks.generateSelfKnowledgeFromIdentityMock.mockResolvedValueOnce({
      philosophy: [
        {
          id: 'platform-judgment',
          text: 'Generated philosophy.',
          tags: ['platform'],
        },
        {
          id: 'customer-proof',
          text: 'Generated customer proof philosophy.',
          tags: ['customers'],
        },
      ],
      interview_style: {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      },
    })

    render(<IdentityMapPage />)
    fireEvent.click(
      within(getSelfKnowledgeControls()).getByRole('button', {
        name: /^generate self-knowledge$/i,
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('Generated 2 philosophy positions and interview self-knowledge.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.philosophy).toHaveLength(2)
    expect(useIdentityStore.getState().currentIdentity?.self_model.interview_style).toEqual(
      existingInterview,
    )
  })

  it('recovers thesis generation after a missing proxy configuration error', async () => {
    seed()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(
        screen.getByText('Connect the AI proxy before regenerating the identity thesis.'),
      ).toBeTruthy()
    })

    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockResolvedValueOnce({
      thesis: 'I turn platform complexity into product leverage.',
      title: 'Platform Systems Lead',
      origin: 'Repeated platform migration work.',
      elaboration: 'The strongest evidence sits in Kubernetes delivery and product judgment.',
    })

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)
    })
  })

  it('surfaces generic thesis generation failures and clears the busy state', async () => {
    seed()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate thesis$/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to regenerate identity thesis.')).toBeTruthy()
    })
    expect(
      screen.getByRole('button', { name: /^regenerate thesis$/i }).getAttribute('aria-busy'),
    ).toBe('false')
  })

  it('does not start duplicate thesis generation while a request is running', async () => {
    seed()
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityThesisFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    await deferDownstreamPrompt()
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(screen.getByText('Thesis generation is already running.')).toBeTruthy()
    })
    expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve({
        thesis: 'I turn platform complexity into product leverage.',
      })
      await deferred.promise
    })
  })

  it('aborts thesis generation on unmount without surfacing abort errors', async () => {
    seed()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityThesisFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    const { unmount } = render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate thesis$/i }))
    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)
    })
    const signal =
      identityParameterMocks.generateIdentityThesisFromIdentityMock.mock.calls[0]?.[2]?.signal

    unmount()

    expect(signal?.aborted).toBe(true)

    await act(async () => {
      const abortError = new Error('aborted')
      abortError.name = 'AbortError'
      deferred.reject(abortError)
      await deferred.promise.catch(() => undefined)
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('discards a generated thesis draft if identity changes during generation', async () => {
    seed()
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateIdentityThesisFromIdentityMock>>
      >()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: regenerate thesis/i }))
    await deferDownstreamPrompt()

    await waitFor(() => {
      expect(identityParameterMocks.generateIdentityThesisFromIdentityMock).toHaveBeenCalledTimes(1)
    })

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
      },
    })

    await act(async () => {
      deferred.resolve({
        thesis: 'I turn platform complexity into product leverage.',
        title: 'Platform Systems Lead',
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the thesis draft.'),
      ).toBeTruthy()
    })
    expect(screen.queryByLabelText('Generated thesis draft')).toBeNull()
  })

  it('discards a generated thesis draft without changing the stored thesis', async () => {
    seed()
    const originalThesis = useIdentityStore.getState().currentIdentity?.identity.thesis
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockResolvedValueOnce({
      thesis: 'I turn platform complexity into product leverage.',
      title: 'Platform Systems Lead',
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate thesis$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Generated thesis draft')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.queryByLabelText('Generated thesis draft')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.identity.thesis).toBe(originalThesis)
  })

  it('refuses to apply a generated thesis draft after identity changes', async () => {
    seed()
    const originalThesis = useIdentityStore.getState().currentIdentity?.identity.thesis
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockResolvedValueOnce({
      thesis: 'I turn platform complexity into product leverage.',
      title: 'Platform Systems Lead',
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^regenerate thesis$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Generated thesis draft')).toBeTruthy()
    })

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Apply thesis' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Identity changed since this draft was generated; discarded the thesis draft.',
        ),
      ).toBeTruthy()
    })
    expect(screen.queryByLabelText('Generated thesis draft')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.identity.thesis).toBe(originalThesis)
  })

  it('generates career chapters from roles from the action list', async () => {
    seed((id) => {
      id.self_model.arc = []
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: draft chapters/i }))

    await waitFor(() => {
      expect(useIdentityStore.getState().currentIdentity?.self_model.arc).toEqual([
        {
          company: 'Contoso Networks',
          chapter: 'Senior Platform Engineer chapter focused on Unlocked on-prem delivery.',
        },
      ])
    })
  })

  it('reviews existing career chapters instead of replacing authored arc text', () => {
    const authoredArc = [
      {
        company: 'Contoso Networks',
        chapter: 'Authored chapter about turning deployment constraints into product access.',
      },
    ]
    seed((id) => {
      id.self_model.arc = authoredArc
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: review chapters/i }))

    expect(useIdentityStore.getState().currentIdentity?.self_model.arc).toEqual(authoredArc)
  })

  it('explains why drafting chapters does not replace an existing authored arc', () => {
    const authoredArc = [
      {
        company: 'Contoso Networks',
        chapter: 'Authored chapter about turning deployment constraints into product access.',
      },
    ]
    seed((id) => {
      id.self_model.arc = authoredArc
    })

    const { rerender } = render(<SelfModelBand chapterRequestId={0} />)

    rerender(<SelfModelBand chapterRequestId={1} />)

    expect(useIdentityStore.getState().currentIdentity?.self_model.arc).toEqual(authoredArc)
    expect(
      screen.getByText(
        'Career chapters already exist. Review or edit them in the arc instead of replacing them from roles.',
      ),
    ).toBeTruthy()
  })

  it('edits, reviews, adds, and removes areas of expertise', () => {
    seed((id) => {
      id.expertise = [
        {
          id: 'customer-hosted-delivery',
          label: 'Customer-hosted delivery',
          summary: 'Draft inference from delivery evidence.',
          tags: ['platform'],
          evidence: [
            {
              kind: 'bullet',
              role_id: 'contoso',
              bullet_id: 'platform-migration',
              label: 'Contoso delivery evidence',
            },
            {
              kind: 'source',
              label: 'Legacy source label',
            },
          ],
          provenance: 'inferred',
          needs_review: true,
        },
      ]
    })

    render(<SelfModelBand />)

    const section = document.querySelector('.self-expertise')
    if (!(section instanceof HTMLElement)) {
      throw new Error('Expected expertise section to render.')
    }

    fireEvent.change(within(section).getByLabelText('Expertise label for expertise area 1'), {
      target: { value: 'Customer-hosted platform delivery' },
    })
    fireEvent.change(within(section).getByLabelText('Expertise summary for expertise area 1'), {
      target: { value: 'Designs deployment paths for regulated customers.' },
    })
    const tagsInput = within(section).getByLabelText('Expertise tags for expertise area 1')
    fireEvent.change(tagsInput, {
      target: { value: 'Platform, enterprise, platform,' },
    })
    expect(tagsInput).toHaveProperty('value', 'Platform, enterprise, platform,')
    fireEvent.blur(tagsInput)

    const evidenceInput = within(section).getByLabelText('Expertise evidence for expertise area 1')
    fireEvent.change(evidenceInput, {
      target: {
        value: 'Legacy source label\nOn-prem install evidence\nCustomer-hosted rollout proof\n',
      },
    })
    expect(evidenceInput).toHaveProperty(
      'value',
      'Legacy source label\nOn-prem install evidence\nCustomer-hosted rollout proof\n',
    )
    fireEvent.blur(evidenceInput)

    fireEvent.click(
      within(section).getByRole('button', {
        name: 'Mark expertise area reviewed: Customer-hosted platform delivery',
      }),
    )

    expect(useIdentityStore.getState().currentIdentity?.expertise[0]).toMatchObject({
      id: 'customer-hosted-delivery',
      label: 'Customer-hosted platform delivery',
      summary: 'Designs deployment paths for regulated customers.',
      tags: ['platform', 'enterprise'],
      evidence: [
        {
          kind: 'bullet',
          role_id: 'contoso',
          bullet_id: 'platform-migration',
          label: 'Contoso delivery evidence',
        },
        {
          kind: 'source',
          label: 'Legacy source label',
        },
        {
          kind: 'source',
          source_text: 'On-prem install evidence',
        },
        {
          kind: 'source',
          source_text: 'Customer-hosted rollout proof',
        },
      ],
      provenance: 'corrected',
      needs_review: false,
    })

    fireEvent.change(within(section).getByLabelText('New area of expertise'), {
      target: { value: 'Reliability economics' },
    })
    fireEvent.click(within(section).getByRole('button', { name: '+ Add' }))
    fireEvent.click(
      within(section).getByRole('button', {
        name: 'Remove expertise area: Customer-hosted platform delivery',
      }),
    )

    expect(useIdentityStore.getState().currentIdentity?.expertise).toEqual([
      expect.objectContaining({
        label: 'Reliability economics',
        provenance: 'claimed',
        needs_review: false,
      }),
    ])
  })

  it('keeps claimed expertise provenance when marking it reviewed', () => {
    seed((id) => {
      id.expertise = [
        {
          id: 'observability-cost-control',
          label: 'Observability cost control',
          summary: 'Balances visibility with platform spend.',
          tags: ['observability'],
          evidence: [],
          provenance: 'claimed',
          needs_review: true,
        },
      ]
    })

    render(<SelfModelBand />)

    const section = document.querySelector('.self-expertise')
    if (!(section instanceof HTMLElement)) {
      throw new Error('Expected expertise section to render.')
    }

    const markReviewed = within(section).getByRole('button', {
      name: 'Mark expertise area reviewed: Observability cost control',
    })
    fireEvent.click(markReviewed)

    expect(useIdentityStore.getState().currentIdentity?.expertise[0]).toMatchObject({
      id: 'observability-cost-control',
      provenance: 'claimed',
      needs_review: false,
    })
    expect(markReviewed).toHaveProperty('disabled', true)
  })

  it('surfaces a message when chapter drafting has no roles to use', async () => {
    seed((id) => {
      id.roles = []
      id.self_model.arc = []
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft chapters from roles' }))

    await waitFor(() => {
      expect(screen.getByText('Add roles before generating career chapters.')).toBeTruthy()
    })
  })

  it('uses a neutral chapter proof fallback when role bullets have no impact or outcome', async () => {
    seed((id) => {
      id.self_model.arc = []
      const role = id.roles[0]
      if (!role) return
      role.bullets = [
        {
          id: 'thin-proof',
          tags: [],
          source_text: 'Maintained the platform delivery surface.',
          problem: 'Platform work needed continuity.',
          action: 'Maintained deployment systems.',
          outcome: '',
          impact: [],
          metrics: {},
          technologies: [],
        },
      ]
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft chapters from roles' }))

    await waitFor(() => {
      expect(useIdentityStore.getState().currentIdentity?.self_model.arc).toEqual([
        {
          company: 'Contoso Networks',
          chapter: 'Senior Platform Engineer chapter focused on delivered key outcomes.',
        },
      ])
    })
  })

  it('prefers impact over outcome when drafting career chapters', async () => {
    seed((id) => {
      id.self_model.arc = []
      const bullet = id.roles[0]?.bullets[0]
      if (!bullet) return
      bullet.impact = ['Raised enterprise deployment confidence']
      bullet.outcome = 'Shipped deployment automation.'
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft chapters from roles' }))

    await waitFor(() => {
      expect(useIdentityStore.getState().currentIdentity?.self_model.arc).toEqual([
        {
          company: 'Contoso Networks',
          chapter:
            'Senior Platform Engineer chapter focused on Raised enterprise deployment confidence.',
        },
      ])
    })
  })

  it('surfaces bullet deepening before skill depth when source bullets are shallow', () => {
    seed((id) => {
      const bullet = id.roles[0]?.bullets[0]
      if (!bullet) return
      bullet.source_text = 'Ported the platform to Kubernetes-based installs.'
      bullet.problem = ''
      bullet.action = ''
      bullet.outcome = ''
      bullet.impact = []
    })

    render(<IdentityMapPage />)

    const actionPanel = screen
      .getAllByRole('region', { name: 'Deepen bullet evidence' })
      .find((panel) => within(panel).queryByText('Next action'))
    if (!actionPanel) throw new Error('Expected next-action bullet evidence panel.')
    expect(within(actionPanel).getByText('1 pending')).toBeTruthy()
    fireEvent.click(
      within(actionPanel).getByRole('button', { name: /run next action: review bullets \(1\)/i }),
    )

    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'bullet',
      roleId: 'contoso',
      bulletId: 'platform-migration',
    })
  })

  it('moves keyboard focus to the target band when jumping from the action modal', async () => {
    seed((id) => {
      const bullet = id.roles[0]?.bullets[0]
      if (!bullet) return
      bullet.source_text = 'Ported the platform to Kubernetes-based installs.'
      bullet.problem = ''
      bullet.action = ''
      bullet.outcome = ''
    })

    render(<IdentityMapPage />)
    const rolesBand = document.querySelector<HTMLElement>('[data-layer="roles"]')
    if (!rolesBand) throw new Error('Expected roles band to render.')

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    const dialog = screen.getByRole('dialog', { name: 'Identity action items' })
    const jumpButton = within(dialog).getAllByRole('button', { name: 'Jump' })[0]
    if (!jumpButton) throw new Error('Expected first action jump button.')
    fireEvent.click(jumpButton)

    await waitFor(() => {
      expect(document.activeElement).toBe(rolesBand)
    })
  })

  it('keeps the action modal keyboard-dismissable and restores focus to the trigger', async () => {
    seed()
    document.body.style.overflow = 'auto'
    const { container } = render(<IdentityMapPage />)

    const trigger = screen.getByRole('button', { name: 'View all actions' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Identity action items' })
    const canvas = container.querySelector('.identity-map-canvas')
    const inspectorSlot = container.querySelector('.identity-map-inspector-slot')

    expect(canvas?.hasAttribute('inert')).toBe(true)
    expect(inspectorSlot?.hasAttribute('inert')).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    await waitFor(() => {
      expect(document.activeElement).toBe(dialog)
    })

    const focusableButtons = within(dialog)
      .getAllByRole('button')
      .filter((button) => !(button as HTMLButtonElement).disabled)
    const firstButton = focusableButtons[0] as HTMLButtonElement
    const lastButton = focusableButtons[focusableButtons.length - 1] as HTMLButtonElement

    lastButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(firstButton)

    firstButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    fireEvent.click(dialog)
    expect(screen.getByRole('dialog', { name: 'Identity action items' })).toBeTruthy()

    const backdrop = container.querySelector('.identity-action-backdrop')
    if (!backdrop) throw new Error('Expected modal backdrop control.')
    fireEvent.click(backdrop)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Identity action items' })).toBeNull()
    })
    expect(canvas?.hasAttribute('inert')).toBe(false)
    expect(inspectorSlot?.hasAttribute('inert')).toBe(false)
    expect(document.body.style.overflow).toBe('auto')

    fireEvent.click(trigger)
    const reopenedDialog = screen.getByRole('dialog', { name: 'Identity action items' })
    fireEvent.keyDown(reopenedDialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Identity action items' })).toBeNull()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
    document.body.style.overflow = ''
  })

  it('highlights jumped action bands, replaces stale highlights, and clears the timer', () => {
    vi.useFakeTimers()
    seed((id) => {
      const bullet = id.roles[0]?.bullets[0]
      if (!bullet) return
      bullet.source_text = 'Ported the platform to Kubernetes-based installs.'
      bullet.problem = ''
      bullet.action = ''
      bullet.outcome = ''
    })

    try {
      render(<IdentityMapPage />)
      const rolesBand = document.querySelector<HTMLElement>('[data-layer="roles"]')
      const thesisBand = document.querySelector<HTMLElement>('[data-layer="thesis"]')
      if (!rolesBand || !thesisBand) throw new Error('Expected identity bands to render.')

      fireEvent.click(screen.getByRole('button', { name: 'Jump to step' }))
      expect(rolesBand.classList.contains('action-highlight')).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
      fireEvent.click(screen.getByRole('button', { name: /run action: review map/i }))
      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(rolesBand.classList.contains('action-highlight')).toBe(false)
      expect(thesisBand.classList.contains('action-highlight')).toBe(true)

      act(() => {
        vi.advanceTimersByTime(1800)
      })
      expect(thesisBand.classList.contains('action-highlight')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('prompts for profile generation when thesis exists but profiles are empty', () => {
    seed((id) => {
      id.identity.thesis = 'I turn platform complexity into product leverage.'
      id.profiles = []
      id.roles = id.roles.map((role) => ({
        ...role,
        bullets: role.bullets.map((bullet, index) => ({
          ...bullet,
          problem: bullet.problem || `Problem ${index + 1}`,
          action: bullet.action || `Action ${index + 1}`,
          outcome: bullet.outcome || `Outcome ${index + 1}`,
        })),
      }))
      id.skills.groups = id.skills.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          depth: item.depth ?? 'strong',
        })),
      }))
    })

    render(<IdentityMapPage />)

    const actionPanel = screen.getByRole('region', { name: 'Generate profile lenses' })
    expect(within(actionPanel).getByText('Next')).toBeTruthy()
    expect(
      within(actionPanel).getByRole('button', {
        name: /run next action: generate profiles/i,
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'No profiles yet. Add positioning lenses that capture distinct ways to frame the durable identity.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /^generate profiles$/i })).toBeTruthy()
  })

  it('skips chapter drafting as the next action when there are no roles', () => {
    seed((id) => {
      id.identity.thesis = 'I turn platform complexity into product leverage.'
      id.roles = []
      id.self_model.arc = []
      id.self_model.philosophy = []
      id.self_model.interview_style = {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
      id.skills.groups = id.skills.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          depth: item.depth ?? 'strong',
        })),
      }))
    })

    render(<IdentityMapPage />)

    const actionPanel = screen.getByRole('region', {
      name: 'Generate philosophy and interview self-knowledge',
    })
    expect(within(actionPanel).getByText('Next')).toBeTruthy()
    expect(
      within(actionPanel).getByRole('button', {
        name: /run next action: generate self-knowledge/i,
      }),
    ).toBeTruthy()

    fireEvent.click(within(actionPanel).getByRole('button', { name: 'View all actions' }))
    const actionDialog = screen.getByRole('dialog', { name: 'Identity action items' })
    expect(
      within(actionDialog).getByRole('button', { name: /run action: draft chapters/i }),
    ).toHaveProperty('disabled', true)
  })

  it('advances the next action from positioning to strategy to research-ready', () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
      id.self_model.competitive_moat = undefined
      id.self_model.unfair_advantages = []
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    render(<IdentityMapPage />)
    expect(screen.getByRole('region', { name: 'Generate strategic positioning' })).toBeTruthy()

    cleanup()
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
      id.self_model.competitive_moat = 'Platform engineering plus deployment architecture.'
      id.self_model.unfair_advantages = ['Kubernetes delivery plus product judgment']
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    render(<IdentityMapPage />)
    expect(screen.getByRole('region', { name: 'Generate search parameters' })).toBeTruthy()

    cleanup()
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
      id.self_model.competitive_moat = 'Platform engineering plus deployment architecture.'
      id.self_model.unfair_advantages = ['Kubernetes delivery plus product judgment']
      id.search_vectors = [
        {
          id: 'platform-vector',
          title: 'Platform engineering',
          thesis: 'Target platform engineering roles.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
          priority: 'high',
        },
      ]
      id.awareness = { open_questions: [] }
    })
    render(<IdentityMapPage />)
    // At the terminal phase the dead-end "Review the identity map" panel is replaced by
    // the research-ready state with a guided handoff to Research (M11 finding C1).
    expect(
      screen.getByRole('region', { name: 'Your identity model is ready for Research' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Research' }))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/research' })
  })

  it('does not run identity inference on map mount', () => {
    seed()

    render(<IdentityMapPage />)

    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).not.toHaveBeenCalled()
    expect(identityParameterMocks.generateSearchVectorsFromIdentityMock).not.toHaveBeenCalled()
    expect(identityParameterMocks.generateAwarenessFromIdentityMock).not.toHaveBeenCalled()
  })

  it('reruns top-level positioning refresh after each settled request', async () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock
      .mockResolvedValueOnce({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      })
      .mockResolvedValueOnce({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(2)
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
      expect.objectContaining({ mode: 'regenerate' }),
    )
  })

  it('does not start duplicate strategy generation from the top control while one is running', async () => {
    seed((id) => {
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const deferred = createDeferred<{
      unfair_advantages: string[]
      search_vectors: []
      open_questions: []
    }>()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    fireEvent.click(screen.getByRole('button', { name: /run action: generate parameters/i }))

    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByText('Strategy generation is already running.')).toBeTruthy()
    })

    await act(async () => {
      deferred.resolve({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      })
      await deferred.promise
    })
  })

  it('does not start duplicate positioning refresh from the top control while one is running', async () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
    })
    const deferred = createDeferred<{
      unfair_advantages: string[]
      search_vectors: []
      open_questions: []
    }>()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))
    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))

    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Positioning refresh is already running.')).toBeTruthy()

    await act(async () => {
      deferred.resolve({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      })
      await deferred.promise
    })
  })

  it('uses reduced-motion-safe scrolling when a top action targets a band', () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: [],
      search_vectors: [],
      open_questions: [],
    })
    const originalMatchMedia = window.matchMedia
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoViewMock = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })

    try {
      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start',
      })
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    }
  })

  it('smooth-scrolls the search band when the strategy action runs', async () => {
    seed()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: [],
      search_vectors: [],
      open_questions: [],
    })
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    try {
      render(<IdentityMapPage />)
      const searchBand = document.querySelector<HTMLElement>('[data-layer="search"]')
      if (!searchBand) throw new Error('Expected Search Parameters band to render.')
      const scrollIntoViewMock = vi.fn()
      Object.defineProperty(searchBand, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoViewMock,
      })

      fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
      fireEvent.click(screen.getByRole('button', { name: /run action: generate parameters/i }))

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        })
      })
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('smooth-scrolls when matchMedia is unavailable', () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Platform delivery chapter.' }]
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: [],
      search_vectors: [],
      open_questions: [],
    })
    const originalMatchMedia = window.matchMedia
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoViewMock = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    })

    try {
      render(<IdentityMapPage />)

      fireEvent.click(screen.getByRole('button', { name: /run next action: refresh positioning/i }))

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    }
  })

  it('does not show skill-depth controls when groups have no skills to enrich', () => {
    seed((id) => {
      id.skills.groups[0]!.items = []
    })

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View all actions' }))
    const actionDialog = screen.getByRole('dialog', { name: 'Identity action items' })
    expect(
      (
        within(actionDialog).getByRole('button', {
          name: /run action: review skill depth/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    fireEvent.click(within(actionDialog).getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('button', { name: 'Platform' })).toBeTruthy()
    expect(screen.getByText('0 items')).toBeTruthy()
    expect(screen.queryByText('Skill depth')).toBeNull()
  })

  it('keeps the map instructions off the empty identity state', () => {
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      currentIdentity: null,
      draft: null,
      mapSelection: null,
    })

    const { container } = render(<IdentityMapPage />)

    expect(screen.getByText('No identity yet')).toBeTruthy()
    expect(screen.getByText(/Bring in resumes, source notes, or identity JSON/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fill strength legend' })).toBeTruthy()
    expect(container.querySelector('.thesis-strength-note')).toBeNull()
    expect(
      within(container.querySelector('[data-layer="thesis"]') as HTMLElement).getByText(
        'Empty: generate a thesis or add one before this section can be evaluated.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Identity Import' })).toBeTruthy()
    expect(screen.queryByText('Edit the durable identity here.')).toBeNull()
    expect(screen.queryByText('Deepen evidence before generating strategy.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Generate research thesis' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Regenerate research thesis' })).toBeNull()
  })

  it('adds a prioritize rule, opens the inspector in edit mode, persists save', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add prioritize rule/i }))

    // Inspector opens in editing mode for blank rule.
    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'Platform engineering depth' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Companies investing in dev platforms.' },
    })
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const matching = useIdentityStore.getState().currentIdentity!.preferences.matching
    expect(matching.prioritize).toHaveLength(1)
    expect(matching.prioritize[0].label).toBe('Platform engineering depth')
    expect(matching.prioritize[0].weight).toBe('high')
  })

  it('adds an avoid rule, discards it via the inspector, clears selection', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add avoid rule/i }))
    expect(useIdentityStore.getState().currentIdentity!.preferences.matching.avoid).toHaveLength(1)
    expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')

    // The just-added rule auto-opens in edit mode with Discard (no Remove rule button until first save).
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(useIdentityStore.getState().currentIdentity!.preferences.matching.avoid).toHaveLength(0)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('adds an avoid rule, saves through to the avoid bucket', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add avoid rule/i }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Low-signal roles' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Avoid roles without platform ownership.' },
    })
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'hard' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const matching = useIdentityStore.getState().currentIdentity!.preferences.matching
    expect(matching.prioritize).toHaveLength(0)
    expect(matching.avoid).toHaveLength(1)
    expect(matching.avoid[0]).toMatchObject({
      label: 'Low-signal roles',
      description: 'Avoid roles without platform ownership.',
      severity: 'hard',
    })
  })

  it('full-edits an existing prioritize rule', () => {
    seed((id) => {
      id.preferences.matching.prioritize = [
        { id: 'rule-1', label: 'Old label', description: 'Old desc', weight: 'low' },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /old label/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'New label' } })
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const matching = useIdentityStore.getState().currentIdentity!.preferences.matching
    expect(matching.prioritize[0].label).toBe('New label')
    expect(matching.prioritize[0].weight).toBe('high')
  })
})

describe('Identity Map — search-vector full-edit + add/remove', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReset()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

  it('renders authored strategy vectors and open questions in the map workbench', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'v-platform',
          title: 'Backend Platform',
          priority: 'high',
          thesis: 'Lead platform investments.',
          target_roles: ['Staff Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
      id.awareness = {
        open_questions: [
          {
            id: 'q-departure',
            topic: 'Departure from Contoso',
            description: 'Why leaving',
            action: 'Prep answer',
            severity: 'high',
          },
        ],
      }
    })

    render(<IdentityMapPage />)

    expect(screen.getByText('Search Parameters')).toBeTruthy()
    expect(screen.getByText('Search Vectors')).toBeTruthy()
    expect(screen.getByText('Open Questions')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /backend platform/i }))
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'search-vector',
      id: 'v-platform',
    })
    expect(screen.getByRole('complementary').textContent).toContain('Backend Platform')

    fireEvent.click(screen.getByRole('button', { name: /departure from contoso/i }))
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'awareness-question',
      id: 'q-departure',
    })
    expect(screen.getByRole('complementary').textContent).toContain('Departure from Contoso')
  })

  it('adds a search vector, edits all required fields, saves through to the store', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add search vector/i }))

    // Inspector opens in edit mode for blank vector.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Backend Platform' } })
    fireEvent.change(screen.getByLabelText('Subtitle'), { target: { value: 'Senior IC' } })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Thesis'), {
      target: { value: 'Lead platform investments at series B/C startups.' },
    })
    fireEvent.change(screen.getByLabelText('Target roles'), {
      target: { value: 'Staff Engineer, Principal Engineer' },
    })
    fireEvent.change(screen.getByLabelText('Primary keywords'), {
      target: { value: 'platform, kubernetes' },
    })
    fireEvent.change(screen.getByLabelText('Secondary keywords'), {
      target: { value: 'observability' },
    })
    fireEvent.change(screen.getByLabelText('Supporting skills'), {
      target: { value: 'Kubernetes, Terraform' },
    })
    fireEvent.change(screen.getByLabelText('Evidence'), {
      target: { value: 'Built K8s platform at Contoso\nLed migration to Terraform' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const vectors = useIdentityStore.getState().currentIdentity!.search_vectors!
    expect(vectors).toHaveLength(1)
    const v = vectors[0]
    expect(v.title).toBe('Backend Platform')
    expect(v.subtitle).toBe('Senior IC')
    expect(v.priority).toBe('high')
    expect(v.thesis).toBe('Lead platform investments at series B/C startups.')
    expect(v.target_roles).toEqual(['Staff Engineer', 'Principal Engineer'])
    expect(v.keywords.primary).toEqual(['platform', 'kubernetes'])
    expect(v.keywords.secondary).toEqual(['observability'])
    expect(v.supporting_skills).toEqual(['Kubernetes', 'Terraform'])
    expect(v.evidence).toEqual(['Built K8s platform at Contoso', 'Led migration to Terraform'])
  })

  it('generates full strategy from the current identity and selects the first vector', async () => {
    seed((id) => {
      delete id.self_model.competitive_moat
      delete id.self_model.unfair_advantages
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      competitive_moat:
        'Platform strategy grounded in customer deployment constraints and product tradeoffs.',
      unfair_advantages: [
        'Platform infrastructure depth plus product judgment',
        'Product-aware platform infrastructure depth',
        'Customer deployment architecture evidence',
      ],
      search_vectors: [
        {
          id: 'generated-platform',
          title: 'Platform Strategy',
          priority: 'high',
          thesis: 'Lead platform bets where deployment architecture changes market access.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform strategy'], secondary: ['kubernetes'] },
          supporting_skills: ['Kubernetes'],
          supporting_bullets: ['platform-migration'],
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
        {
          id: 'generated-security',
          title: 'Security Enablement',
          priority: 'medium',
          thesis: 'Use security experience as platform leverage.',
          target_roles: ['Principal Platform Engineer'],
          keywords: { primary: ['security enablement'], secondary: ['platform'] },
          supporting_skills: ['Kubernetes'],
          supporting_bullets: ['platform-migration'],
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
      ],
      open_questions: [
        {
          id: 'generated-question',
          topic: 'Customer deployment scope',
          description: 'Clarify the strongest version of the on-prem deployment story.',
          action: 'Add customer constraints and adoption evidence.',
          severity: 'medium',
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
        {
          id: 'generated-question-2',
          topic: 'Security narrative',
          description: 'Clarify how security depth supports platform strategy.',
          action: 'Add one security-platform example.',
          severity: 'low',
          evidence: ['Contoso platform migration'],
          needs_review: true,
        },
      ],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(
        identityParameterMocks.generateStrategicPositioningFromIdentityMock,
      ).toHaveBeenCalledTimes(1)
    })
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
    )

    const identity = useIdentityStore.getState().currentIdentity!
    expect(identity.self_model.competitive_moat).toBe(
      'Platform strategy grounded in customer deployment constraints and product tradeoffs.',
    )
    expect(identity.self_model.unfair_advantages).toEqual([
      'Platform infrastructure depth plus product judgment',
      'Customer deployment architecture evidence',
    ])
    expect(identity.search_vectors).toHaveLength(2)
    expect(identity.search_vectors?.[0]).toMatchObject({
      title: 'Platform Strategy',
      needs_review: true,
    })
    expect(identity.search_vectors?.[0]?.id).not.toBe('generated-platform')
    expect(identity.awareness?.open_questions).toHaveLength(2)
    expect(identity.awareness?.open_questions[0]).toMatchObject({
      topic: 'Customer deployment scope',
      needs_review: true,
    })
    expect(identity.awareness?.open_questions[0]?.id).not.toBe('generated-question')
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'search-vector',
      id: identity.search_vectors?.[0]?.id,
    })
    expect(
      screen.getByText('Generated strategy: moat, 2 advantages, 2 vectors, 2 questions.'),
    ).toBeTruthy()
  })

  it('preserves an existing competitive moat when generating full strategy', async () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
      id.self_model.unfair_advantages = ['Existing advantage']
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      competitive_moat: 'Generated replacement moat.',
      unfair_advantages: [' existing   advantage ', 'Security plus platform leverage'],
      search_vectors: [],
      open_questions: [],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(screen.getByText('Generated strategy: 1 advantage.')).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBe(
      'Existing authored moat.',
    )
    expect(useIdentityStore.getState().currentIdentity?.self_model.unfair_advantages).toEqual([
      'Existing advantage',
      'Security plus platform leverage',
    ])
  })

  it('shows a configuration error when full strategy generation has no AI proxy', async () => {
    seed((id) => {
      delete id.self_model.competitive_moat
      delete id.self_model.unfair_advantages
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Connect the AI proxy before generating search strategy.'),
      ).toBeTruthy()
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(
      identityParameterMocks.generateStrategicPositioningFromIdentityMock,
    ).not.toHaveBeenCalled()
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBeUndefined()
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('shows an alert and preserves identity when full strategy generation fails', async () => {
    seed((id) => {
      delete id.self_model.competitive_moat
      id.self_model.unfair_advantages = ['Existing advantage']
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to generate strategy.')).toBeTruthy()
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBeUndefined()
    expect(useIdentityStore.getState().currentIdentity?.self_model.unfair_advantages).toEqual([
      'Existing advantage',
    ])
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('discards generated strategy if the identity revision changes during generation', async () => {
    seed((id) => {
      delete id.self_model.competitive_moat
      delete id.self_model.unfair_advantages
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const deferred =
      createDeferred<
        Awaited<
          ReturnType<typeof identityParameterMocks.generateStrategicPositioningFromIdentityMock>
        >
      >()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    const generatingButton = screen.getByRole('button', { name: /generating strategy/i })
    expect(generatingButton.getAttribute('aria-busy')).toBe('true')

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
        roles: [...nextIdentity.roles],
      },
    })

    await act(async () => {
      deferred.resolve({
        competitive_moat: 'Generated moat.',
        unfair_advantages: ['Generated advantage'],
        search_vectors: [
          {
            id: 'generated-platform',
            title: 'Platform Strategy',
            priority: 'high',
            thesis: 'Lead platform bets.',
            target_roles: ['Staff Platform Engineer'],
            keywords: { primary: ['platform'], secondary: [] },
          },
        ],
        open_questions: [
          {
            id: 'generated-question',
            topic: 'Customer scope',
            description: 'Clarify scope.',
            action: 'Add one example.',
          },
        ],
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the generated strategy.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.self_model.competitive_moat).toBeUndefined()
    expect(
      useIdentityStore.getState().currentIdentity?.self_model.unfair_advantages,
    ).toBeUndefined()
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('selects the first generated open question when full strategy adds no vectors', async () => {
    seed((id) => {
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      unfair_advantages: [],
      search_vectors: [],
      open_questions: [
        {
          id: 'generated-question',
          topic: 'Customer scope',
          description: 'Clarify customer deployment constraints.',
          action: 'Add one sourced example.',
          severity: 'high',
        },
      ],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(screen.getByText('Generated strategy: 1 question.')).toBeTruthy()
    })
    const questions = useIdentityStore.getState().currentIdentity?.awareness?.open_questions ?? []
    expect(questions).toHaveLength(1)
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'awareness-question',
      id: questions[0]?.id,
    })
  })

  it('reports no strategy changes when generated items duplicate the existing identity', async () => {
    seed((id) => {
      id.self_model.competitive_moat = 'Existing authored moat.'
      id.self_model.unfair_advantages = ['Existing advantage']
      id.search_vectors = [
        {
          id: 'existing-vector',
          title: 'Platform Strategy',
          priority: 'high',
          thesis: 'Existing thesis.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
      id.awareness = {
        open_questions: [
          {
            id: 'existing-question',
            topic: 'Customer scope',
            description: 'Existing description.',
            action: 'Existing action.',
          },
        ],
      }
    })
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockResolvedValueOnce({
      competitive_moat: 'Generated replacement moat.',
      unfair_advantages: [' existing   advantage '],
      search_vectors: [
        {
          id: 'generated-vector',
          title: ' platform   strategy ',
          priority: 'medium',
          thesis: 'Duplicate generated thesis.',
          target_roles: ['Principal Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ],
      open_questions: [
        {
          id: 'generated-question',
          topic: ' customer   scope ',
          description: 'Duplicate generated description.',
          action: 'Duplicate generated action.',
        },
      ],
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /^generate strategy$/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Generated strategy matched existing identity; nothing new was added.'),
      ).toBeTruthy()
    })
    const identity = useIdentityStore.getState().currentIdentity!
    expect(identity.self_model.competitive_moat).toBe('Existing authored moat.')
    expect(identity.self_model.unfair_advantages).toEqual(['Existing advantage'])
    expect(identity.search_vectors).toHaveLength(1)
    expect(identity.awareness?.open_questions).toHaveLength(1)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('generates search vectors from the current identity and selects the first result', async () => {
    seed((id) => {
      id.search_vectors = []
    })
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-platform',
        title: 'Platform Infrastructure',
        priority: 'high',
        subtitle: 'Senior platform IC',
        thesis: 'Lead platform infrastructure programs.',
        target_roles: ['Staff Platform Engineer'],
        keywords: { primary: ['platform'], secondary: ['kubernetes'] },
        supporting_skills: ['Kubernetes'],
        supporting_bullets: ['platform-migration'],
        evidence: ['Contoso platform migration'],
        needs_review: true,
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(identityParameterMocks.generateSearchVectorsFromIdentityMock).toHaveBeenCalledTimes(1)
    })
    expect(identityParameterMocks.generateSearchVectorsFromIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
    )
    const vectors = useIdentityStore.getState().currentIdentity?.search_vectors ?? []
    expect(vectors).toHaveLength(1)
    expect(vectors[0]).toMatchObject({
      title: 'Platform Infrastructure',
      needs_review: true,
    })
    expect(vectors[0].id).not.toBe('generated-platform')
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'search-vector',
      id: vectors[0].id,
    })
    expect(screen.getByText('Generated 1 search vector.')).toBeTruthy()
  })

  it('shows a configuration error when search vector generation has no AI proxy', async () => {
    seed((id) => {
      id.search_vectors = []
    })
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Connect the AI proxy before generating search strategy.'),
      ).toBeTruthy()
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(identityParameterMocks.generateSearchVectorsFromIdentityMock).not.toHaveBeenCalled()
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
  })

  it('shows an alert and preserves vectors when search-vector generation fails', async () => {
    seed((id) => {
      id.search_vectors = []
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to generate search vectors.')).toBeTruthy()
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
  })

  it('preserves existing vectors when search-vector generation returns no results', async () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'existing-vector',
          title: 'Existing vector',
          priority: 'high',
          thesis: 'Existing thesis.',
          target_roles: ['Staff Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
    })
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockResolvedValueOnce([])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(
        screen.getByText('No new search vectors came back from the current identity.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([
      {
        id: 'existing-vector',
        title: 'Existing vector',
        priority: 'high',
        thesis: 'Existing thesis.',
        target_roles: ['Staff Engineer'],
        keywords: { primary: ['platform'], secondary: [] },
      },
    ])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('assigns a fresh id when generated search vectors collide with existing ids', async () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'generated-platform',
          title: 'Existing platform vector',
          priority: 'medium',
          thesis: 'Existing platform thesis.',
          target_roles: ['Staff Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
    })
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-platform',
        title: 'Generated platform vector',
        priority: 'high',
        thesis: 'Generated platform thesis.',
        target_roles: ['Principal Engineer'],
        keywords: { primary: ['platform'], secondary: ['infrastructure'] },
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(screen.getByText('Generated 1 search vector.')).toBeTruthy()
    })
    const vectors = useIdentityStore.getState().currentIdentity?.search_vectors ?? []
    expect(vectors).toHaveLength(2)
    expect(vectors[0].id).toBe('generated-platform')
    expect(vectors[1]).toMatchObject({
      title: 'Generated platform vector',
      thesis: 'Generated platform thesis.',
    })
    expect(vectors[1].id).not.toBe('generated-platform')
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'search-vector',
      id: vectors[1].id,
    })
  })

  it('skips generated search vectors that duplicate existing titles', async () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'existing-vector',
          title: 'Existing platform vector',
          priority: 'medium',
          thesis: 'Existing platform thesis.',
          target_roles: ['Staff Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
    })
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-platform',
        title: ' existing   platform vector ',
        priority: 'high',
        thesis: 'Generated duplicate thesis.',
        target_roles: ['Principal Engineer'],
        keywords: { primary: ['platform'], secondary: ['infrastructure'] },
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Generated search vectors matched existing strategy; nothing new was added.',
        ),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toHaveLength(1)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('adds all unique generated search vectors and reports the plural count', async () => {
    seed((id) => {
      id.search_vectors = []
    })
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-platform',
        title: 'Platform Infrastructure',
        priority: 'high',
        thesis: 'Lead platform infrastructure programs.',
        target_roles: ['Staff Platform Engineer'],
        keywords: { primary: ['platform'], secondary: [] },
      },
      {
        id: 'generated-security',
        title: 'Security Enablement',
        priority: 'medium',
        thesis: 'Translate security depth into platform leverage.',
        target_roles: ['Principal Engineer'],
        keywords: { primary: ['security'], secondary: [] },
      },
      {
        id: 'generated-security-duplicate',
        title: ' security   enablement ',
        priority: 'low',
        thesis: 'Duplicate security thesis.',
        target_roles: ['Principal Engineer'],
        keywords: { primary: ['security'], secondary: [] },
      },
      {
        id: 'generated-blank',
        title: '   ',
        priority: 'low',
        thesis: 'This should be dropped because it cannot be reviewed.',
        target_roles: ['Staff Engineer'],
        keywords: { primary: [], secondary: [] },
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    await waitFor(() => {
      expect(screen.getByText('Generated 2 search vectors.')).toBeTruthy()
    })
    const vectors = useIdentityStore.getState().currentIdentity?.search_vectors ?? []
    expect(vectors.map((vector) => vector.title)).toEqual([
      'Platform Infrastructure',
      'Security Enablement',
    ])
  })

  it('discards generated vectors if the identity revision changes during generation', async () => {
    seed((id) => {
      id.search_vectors = []
    })
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateSearchVectorsFromIdentityMock>>
      >()
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))

    const generatingButton = screen.getByRole('button', { name: /generating vectors/i })
    expect(generatingButton.getAttribute('aria-busy')).toBe('true')
    expect((generatingButton as HTMLButtonElement).disabled).toBe(false)
    expect(
      screen.getByRole('button', { name: /generate questions/i }).getAttribute('aria-disabled'),
    ).toBe('true')
    expect(
      (screen.getByRole('button', { name: /add search vector/i }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: /add open question/i }) as HTMLButtonElement).disabled,
    ).toBe(true)

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
        roles: [...nextIdentity.roles],
      },
    })

    await act(async () => {
      deferred.resolve([
        {
          id: 'generated-platform',
          title: 'Platform Infrastructure',
          priority: 'high',
          thesis: 'Lead platform infrastructure programs.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ])
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the generated vectors.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.search_vectors).toEqual([])
  })

  it('blocks a second generation request before the busy state rerenders', async () => {
    seed((id) => {
      id.search_vectors = []
      id.awareness = { open_questions: [] }
    })
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateSearchVectorsFromIdentityMock>>
      >()
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReturnValueOnce(
      deferred.promise,
    )
    identityParameterMocks.generateAwarenessFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-question',
        topic: 'Departure narrative',
        description: 'Clarify why the next move makes sense.',
        action: 'Draft a concise answer.',
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate vectors/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    expect(identityParameterMocks.generateSearchVectorsFromIdentityMock).toHaveBeenCalledTimes(1)
    expect(identityParameterMocks.generateAwarenessFromIdentityMock).not.toHaveBeenCalled()

    await act(async () => {
      deferred.resolve([])
      await deferred.promise
    })
  })

  it('removes a search vector and clears selection', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'v1',
          title: 'Backend Platform',
          priority: 'high',
          thesis: 'Lead platform investments.',
          target_roles: ['Staff Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /backend platform/i }))
    // Existing vector renders in read mode; the read-mode pane has its own "Remove vector" button.
    const inspector = screen.getByRole('complementary')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Remove vector' }))

    expect(useIdentityStore.getState().currentIdentity!.search_vectors).toEqual([])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('toggles needs_review without entering edit mode', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'v1',
          title: 'Backend Platform',
          priority: 'high',
          thesis: 'Lead platform investments.',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
          needs_review: true,
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /backend platform/i }))
    fireEvent.click(
      within(screen.getByLabelText('Identity inspector')).getByRole('button', {
        name: /mark reviewed/i,
      }),
    )

    expect(useIdentityStore.getState().currentIdentity!.search_vectors![0].needs_review).toBe(false)
  })
})

describe('Identity Map — awareness-question full-edit + add/remove', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReset()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

  it('adds an open question, edits all required fields, saves', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add open question/i }))

    fireEvent.change(screen.getByLabelText('Topic'), {
      target: { value: 'Departure from Contoso' },
    })
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Why are you leaving?' },
    })
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'Prep a 60-second answer' },
    })
    fireEvent.change(screen.getByLabelText('Evidence'), {
      target: { value: 'Reorg in Q4\nManager change' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const questions = useIdentityStore.getState().currentIdentity!.awareness!.open_questions
    expect(questions).toHaveLength(1)
    const q = questions[0]
    expect(q.topic).toBe('Departure from Contoso')
    expect(q.severity).toBe('high')
    expect(q.description).toBe('Why are you leaving?')
    expect(q.action).toBe('Prep a 60-second answer')
    expect(q.evidence).toEqual(['Reorg in Q4', 'Manager change'])
  })

  it('discards a just-added question via the inspector and clears selection', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add open question/i }))
    expect(useIdentityStore.getState().currentIdentity!.awareness!.open_questions).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(useIdentityStore.getState().currentIdentity!.awareness!.open_questions).toEqual([])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('generates open questions from the current identity and selects the first result', async () => {
    seed((id) => {
      id.awareness = { open_questions: [] }
    })
    identityParameterMocks.generateAwarenessFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-question',
        topic: 'Departure narrative',
        description: 'Clarify why the next move makes sense.',
        action: 'Draft a concise answer.',
        severity: 'high',
        evidence: ['Open question from identity'],
        needs_review: true,
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(identityParameterMocks.generateAwarenessFromIdentityMock).toHaveBeenCalledTimes(1)
    })
    expect(identityParameterMocks.generateAwarenessFromIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ name: 'Alex Example' }),
      }),
      'https://ai.example/proxy',
    )
    const questions = useIdentityStore.getState().currentIdentity?.awareness?.open_questions ?? []
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({
      topic: 'Departure narrative',
      needs_review: true,
    })
    expect(questions[0].id).not.toBe('generated-question')
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'awareness-question',
      id: questions[0].id,
    })
    expect(screen.getByText('Generated 1 open question.')).toBeTruthy()
  })

  it('shows a configuration error when open-question generation has no AI proxy', async () => {
    seed((id) => {
      id.awareness = { open_questions: [] }
    })
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Connect the AI proxy before generating search strategy.'),
      ).toBeTruthy()
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(identityParameterMocks.generateAwarenessFromIdentityMock).not.toHaveBeenCalled()
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('shows an alert and preserves questions when open-question generation fails', async () => {
    seed((id) => {
      id.awareness = { open_questions: [] }
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityParameterMocks.generateAwarenessFromIdentityMock.mockRejectedValueOnce(
      new Error('proxy timeout'),
    )

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to generate open questions.')).toBeTruthy()
    })
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('preserves existing questions when open-question generation returns no results', async () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'existing-question',
            topic: 'Existing question',
            description: 'Existing description',
            action: 'Existing action',
            severity: 'medium',
          },
        ],
      }
    })
    identityParameterMocks.generateAwarenessFromIdentityMock.mockResolvedValueOnce([])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(
        screen.getByText('No new open questions came back from the current identity.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([
      {
        id: 'existing-question',
        topic: 'Existing question',
        description: 'Existing description',
        action: 'Existing action',
        severity: 'medium',
      },
    ])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('assigns a fresh id when generated open questions collide with existing ids', async () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'generated-question',
            topic: 'Existing question',
            description: 'Existing description',
            action: 'Existing action',
            severity: 'medium',
          },
        ],
      }
    })
    identityParameterMocks.generateAwarenessFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-question',
        topic: 'Generated question',
        description: 'Generated description',
        action: 'Generated action',
        severity: 'high',
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(screen.getByText('Generated 1 open question.')).toBeTruthy()
    })
    const questions = useIdentityStore.getState().currentIdentity?.awareness?.open_questions ?? []
    expect(questions).toHaveLength(2)
    expect(questions[0].id).toBe('generated-question')
    expect(questions[1]).toMatchObject({
      topic: 'Generated question',
      description: 'Generated description',
    })
    expect(questions[1].id).not.toBe('generated-question')
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'awareness-question',
      id: questions[1].id,
    })
  })

  it('skips generated open questions that duplicate existing topics', async () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'existing-question',
            topic: 'Departure narrative',
            description: 'Existing description',
            action: 'Existing action',
            severity: 'medium',
          },
        ],
      }
    })
    identityParameterMocks.generateAwarenessFromIdentityMock.mockResolvedValueOnce([
      {
        id: 'generated-question',
        topic: ' departure   narrative ',
        description: 'Generated duplicate description',
        action: 'Generated duplicate action',
        severity: 'high',
      },
    ])

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Generated open questions matched existing strategy; nothing new was added.',
        ),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toHaveLength(1)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('discards generated questions if the identity revision changes during generation', async () => {
    seed((id) => {
      id.awareness = { open_questions: [] }
    })
    const deferred =
      createDeferred<
        Awaited<ReturnType<typeof identityParameterMocks.generateAwarenessFromIdentityMock>>
      >()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReturnValueOnce(deferred.promise)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /generate questions/i }))

    const nextIdentity = useIdentityStore.getState().currentIdentity!
    useIdentityStore.setState({
      currentIdentity: {
        ...nextIdentity,
        model_revision: nextIdentity.model_revision + 1,
        roles: [...nextIdentity.roles],
      },
    })

    await act(async () => {
      deferred.resolve([
        {
          id: 'generated-question',
          topic: 'Departure narrative',
          description: 'Clarify why the next move makes sense.',
          action: 'Draft a concise answer.',
        },
      ])
      await deferred.promise
    })

    await waitFor(() => {
      expect(
        screen.getByText('Identity changed during generation; discarded the generated questions.'),
      ).toBeTruthy()
    })
    expect(useIdentityStore.getState().currentIdentity?.awareness?.open_questions).toEqual([])
  })

  it('removes an open question and clears selection', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'q1',
            topic: 'Departure',
            description: 'Why leaving',
            action: 'Prep answer',
          },
        ],
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /departure/i }))
    const inspector = screen.getByRole('complementary')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Remove question' }))

    expect(useIdentityStore.getState().currentIdentity!.awareness!.open_questions).toEqual([])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })
})

describe('Identity Map — skill inline editing', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReset()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

  it('edits skill depth inline and marks depth-dependent notes stale', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'platform, k8s, orchestration' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill).toMatchObject({
      name: 'Kubernetes',
      depth: 'expert',
      depthSource: 'corrected',
      enriched_by: 'user',
      context_stale: true,
      positioning_stale: true,
      tags: ['platform', 'k8s', 'orchestration'],
    })
    expect(skill.enriched_at).toBeTruthy()
    expect(screen.getByText('expert')).toBeTruthy()
  })

  it('edits skill depth confidence inline', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth confidence'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      depthConfidence: 'high',
      enriched_by: 'user',
    })
    expect(screen.getByText('high confidence')).toBeTruthy()
  })

  it('edits skill taxonomy, aliases, provenance, and review status inline', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.aliases = ['K8s']
      skill.career_class = 'software-engineering'
      skill.category = 'systems'
      skill.provenance = 'inferred'
      skill.needs_review = true
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Aliases (comma-separated)'), {
      target: { value: 'K8s, kube' },
    })
    fireEvent.change(screen.getByLabelText('Career class'), {
      target: { value: 'software-engineering' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'operations-tools' },
    })
    fireEvent.change(screen.getByLabelText(/^Skill status/), {
      target: { value: 'claimed' },
    })
    fireEvent.click(screen.getByLabelText('Needs review'))
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      aliases: ['K8s', 'kube'],
      career_class: 'software-engineering',
      category: 'operations-tools',
      provenance: 'claimed',
      needs_review: undefined,
    })
    expect(screen.getByText('Operations & Tools')).toBeTruthy()
    expect(screen.getByText('claimed')).toBeTruthy()
  })

  it('marks taxonomy edits as corrected when status is unchanged', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.category = 'systems'
      skill.provenance = 'inferred'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'operations-tools' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      category: 'operations-tools',
      provenance: 'corrected',
    })
  })

  it('marks alias-only taxonomy edits as corrected when status is unchanged', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.aliases = ['K8s']
      skill.provenance = 'inferred'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Aliases (comma-separated)'), {
      target: { value: 'K8s, kube' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      aliases: ['K8s', 'kube'],
      provenance: 'corrected',
    })
  })

  it('prompts for review when an inferred skill needs confirmation', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.provenance = 'inferred'
      skill.needs_review = true
      skill.aliases = ['K8s']
      skill.category = 'operations-tools'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))

    expect(
      screen.getByText(
        'This skill was inferred or imported with review requested. Confirm the category, aliases, and status before relying on it downstream.',
      ),
    ).toBeTruthy()
  })

  it('clears inline depth confidence when the depth changes', () => {
    seed((id) => {
      id.skills.groups[0]!.items[0]!.depthConfidence = 'high'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    expect((screen.getByLabelText('Depth confidence') as HTMLSelectElement).value).toBe('high')

    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    expect((screen.getByLabelText('Depth confidence') as HTMLSelectElement).value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.depth).toBe('expert')
    expect(skill.depthConfidence).toBeUndefined()
  })

  it('marks manual edits after an accepted AI draft as user-edited LLM', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.enriched_by = 'llm-accepted'
      skill.context = 'AI accepted context.'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'User refined the AI accepted context.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      context: 'User refined the AI accepted context.',
      enriched_by: 'user-edited-llm',
    })
  })

  it('preserves skipped status during tag-only inline edits', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = undefined
      skill.context = undefined
      skill.positioning = undefined
      skill.skipped_at = '2026-04-08T00:00:00.000Z'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'platform, orchestration' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      tags: ['platform', 'orchestration'],
      skipped_at: '2026-04-08T00:00:00.000Z',
    })
  })

  it('edits skill positioning from a preset dropdown inline', () => {
    seed((id) => {
      id.skills.groups[0]!.items[0]!.positioning = undefined
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    expect(screen.queryByLabelText('Custom positioning')).toBeNull()

    fireEvent.change(screen.getByLabelText('Positioning'), {
      target: { value: 'Strong match signal. Lead with it.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      positioning: 'Strong match signal. Lead with it.',
      positioning_stale: undefined,
      enriched_by: 'user',
    })
  })

  it('edits custom skill positioning inline from the dropdown custom option', () => {
    seed((id) => {
      id.skills.groups[0]!.items[0]!.positioning = 'Lead with platform modernization work.'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    expect((screen.getByLabelText('Positioning') as HTMLSelectElement).value).toBe('__custom__')
    expect((screen.getByLabelText('Custom positioning') as HTMLTextAreaElement).value).toBe(
      'Lead with platform modernization work.',
    )

    fireEvent.change(screen.getByLabelText('Custom positioning'), {
      target: { value: 'Mention Kubernetes only when embedded delivery matters.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      positioning: 'Mention Kubernetes only when embedded delivery matters.',
      enriched_by: 'user',
    })
  })

  it('clears stale flags when depth and context are edited together', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Updated Kubernetes context for embedded deployments.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.depth).toBe('expert')
    expect(skill.context).toBe('Updated Kubernetes context for embedded deployments.')
    expect(skill.context_stale).toBeUndefined()
    expect(skill.positioning_stale).toBe(true)
  })

  it('clears stale flags when inline text is removed during a depth edit', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.context = 'Existing context.'
      skill.context_stale = true
      skill.positioning = 'Existing positioning.'
      skill.positioning_stale = true
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    fireEvent.change(screen.getByLabelText('Context'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Positioning'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.context).toBeUndefined()
    expect(skill.context_stale).toBeUndefined()
    expect(skill.positioning).toBeUndefined()
    expect(skill.positioning_stale).toBeUndefined()
  })

  it('blocks AI drafting when a depthless skill has no matching bullet evidence', () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({ name: 'Elixir', tags: ['language'] })
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Elixir' }))

    expect(screen.getByText(/No direct bullet evidence matched this skill/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    expect(
      screen.getByText('No bullet evidence matched this skill. Set the depth manually.'),
    ).toBeTruthy()
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('surfaces disabled AI proxy configuration for inline skill drafting', () => {
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    expect(
      screen.getAllByText('AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.'),
    ).not.toHaveLength(0)
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).not.toHaveBeenCalled()
  })

  it('allows re-drafting a scored skill without matching bullet evidence', async () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Elixir',
        tags: ['language'],
        depth: 'working',
      })
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: 'Uses Elixir in adjacent backend contexts.',
      positioning: 'Mention only when relevant.',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Elixir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Re-draft skill' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: expect.objectContaining({ name: 'Elixir' }),
          draftDepth: 'working',
          preserveDepth: true,
        }),
      )
    })
    expect(
      screen.queryByText('No bullet evidence matched this skill. Set the depth manually.'),
    ).toBeNull()
  })

  it('drafts and applies skill depth, context, positioning, and confidence inline', async () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'expert',
      depthConfidence: 'low',
      context:
        'I author custom modules and plugins in Python, assemble roles and collections, and understand idempotence conventions.',
      positioning: 'Lead with it when relevant, but do not over-index on older Ansible markets.',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(screen.getAllByText('low confidence').length).toBeGreaterThan(0)
    })
    expect(screen.getByText(/Lead with it when relevant/i)).toBeTruthy()
    expect(screen.queryByText(/The depth inference is low confidence/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Apply draft' }))

    const skill = useIdentityStore
      .getState()
      .currentIdentity!.skills.groups[0]!.items.find((entry) => entry.name === 'Ansible')
    expect(skill).toMatchObject({
      depth: 'expert',
      depthSource: 'corrected',
      depthConfidence: 'low',
      enriched_by: 'llm-accepted',
      context:
        'I author custom modules and plugins in Python, assemble roles and collections, and understand idempotence conventions.',
      positioning: 'Lead with it when relevant, but do not over-index on older Ansible markets.',
    })
    expect(screen.getByText(/The depth inference is low confidence/i)).toBeTruthy()
  })

  it('preserves existing depth and confidence when re-drafting a scored skill', async () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = 'strong'
      skill.depthConfidence = 'high'
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: 'Refreshed Kubernetes context.',
      positioning: 'Mention when embedded deployment matters.',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Re-draft skill' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          draftDepth: 'strong',
          preserveDepth: true,
        }),
      )
    })
    expect(screen.getAllByText('high confidence').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Apply draft' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Refreshed Kubernetes context.',
      positioning: 'Mention when embedded deployment matters.',
      enriched_by: 'llm-accepted',
    })
  })

  it('falls back to existing context and positioning when an AI skill draft omits them', async () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = 'strong'
      skill.depthConfidence = 'high'
      skill.context = 'Existing Kubernetes context.'
      skill.positioning = 'Existing Kubernetes positioning.'
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: '',
      positioning: '   ',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Re-draft skill' }))

    await waitFor(() => {
      expect(screen.getAllByText('Existing Kubernetes context.').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('Existing Kubernetes positioning.').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Apply draft' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Existing Kubernetes context.',
      positioning: 'Existing Kubernetes positioning.',
      enriched_by: 'llm-accepted',
    })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit skill' }))
  })

  it('drops stale confidence when an AI draft changes the skill depth without confidence', async () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        depthConfidence: 'high',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'expert',
      context: 'Authors Ansible modules and roles.',
      positioning: 'Lead with it only when relevant.',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(screen.getByText('Authors Ansible modules and roles.')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply draft' }))

    const skill = useIdentityStore
      .getState()
      .currentIdentity!.skills.groups[0]!.items.find((entry) => entry.name === 'Ansible')
    expect(skill).toMatchObject({
      depth: 'expert',
      context: 'Authors Ansible modules and roles.',
      enriched_by: 'llm-accepted',
    })
    expect(skill?.depthConfidence).toBeUndefined()
  })

  it('aborts an in-flight skill draft when selecting another skill', async () => {
    const deferred = createDeferred<{
      depth: 'expert'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    const signal = skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mock.calls[0]?.[0]
      ?.signal as AbortSignal
    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))

    expect(signal.aborted).toBe(true)
    deferred.resolve({
      depth: 'expert',
      depthConfidence: 'high',
      context: 'Stale Ansible draft.',
      positioning: 'Stale positioning.',
    })

    await Promise.resolve()
    expect(screen.getByRole('heading', { name: 'Kubernetes' })).toBeTruthy()
    expect(screen.queryByText('Stale Ansible draft.')).toBeNull()
  })

  it('aborts an in-flight skill draft when the inspector unmounts', async () => {
    const deferred = createDeferred<{
      depth: 'expert'
      depthConfidence: 'high'
      context: string
      positioning: string
    }>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    const view = render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    const signal = skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mock.calls[0]?.[0]
      ?.signal as AbortSignal
    view.unmount()
    deferred.reject(new DOMException('Aborted', 'AbortError'))

    await act(async () => {
      await Promise.resolve()
    })
    expect(signal.aborted).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('surfaces AI draft generation failures inline', async () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockRejectedValueOnce(
      new Error('network down'),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Draft skill' })).toHaveProperty('disabled', false)
  })

  it('blocks applying an AI draft that omits depth', async () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Ansible',
        tags: ['automation', 'ansible'],
      })
      id.roles[0]!.bullets[0]!.technologies.push('Ansible')
    })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: 'Context without depth.',
      positioning: 'Positioning without depth.',
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ansible' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draft skill' }))

    await waitFor(() => {
      expect(screen.getByText('Context without depth.')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply draft' }))

    const skill = useIdentityStore
      .getState()
      .currentIdentity!.skills.groups[0]!.items.find((entry) => entry.name === 'Ansible')
    expect(skill?.depth).toBeUndefined()
    expect(
      screen.getByText('The draft did not include a depth. Set this skill manually.'),
    ).toBeTruthy()
  })

  it('renames skill groups from the map inspector', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    fireEvent.change(screen.getByLabelText('Group name'), {
      target: { value: 'Platform Engineering' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.label).toBe(
      'Platform Engineering',
    )
    expect(screen.getByRole('button', { name: 'Platform Engineering' })).toBeTruthy()
  })

  it('edits skill group taxonomy separately from the original imported label', () => {
    seed((id) => {
      id.skills.groups[0] = {
        ...id.skills.groups[0]!,
        source_label: 'Technical Skills',
        career_class: 'software-engineering',
        category: 'systems',
        provenance: 'inferred',
        needs_review: true,
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    fireEvent.change(screen.getByLabelText('Original group label'), {
      target: { value: 'Technical Skills & Tools' },
    })
    fireEvent.change(screen.getByLabelText('Career class'), {
      target: { value: 'software-engineering' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'operations-tools' },
    })
    fireEvent.change(screen.getByLabelText(/^Group status/), {
      target: { value: 'corrected' },
    })
    fireEvent.click(screen.getByLabelText('Needs review'))
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]).toMatchObject({
      label: 'Platform',
      source_label: 'Technical Skills & Tools',
      career_class: 'software-engineering',
      category: 'operations-tools',
      provenance: 'corrected',
      needs_review: undefined,
    })
    expect(screen.getByText('Technical Skills & Tools')).toBeTruthy()
    expect(screen.getByText('Operations & Tools')).toBeTruthy()
  })

  it('marks skill group taxonomy edits as corrected when status is unchanged', () => {
    seed((id) => {
      id.skills.groups[0] = {
        ...id.skills.groups[0]!,
        category: 'systems',
        provenance: 'inferred',
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'operations-tools' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]).toMatchObject({
      category: 'operations-tools',
      provenance: 'corrected',
    })
  })

  it('suggests standardized skill group names and applies them without losing metadata', async () => {
    seed((id) => {
      id.skills.groups[0] = {
        ...id.skills.groups[0]!,
        label: 'Skills 1',
        positioning: 'Platform work across Kubernetes and infrastructure.',
        calibration: 'Lead with this for platform roles.',
        is_differentiator: true,
      }
      id.skills.groups[1] = {
        id: 'app-languages',
        label: 'Also',
        positioning: 'Programming languages and app implementation.',
        items: [
          {
            name: 'TypeScript',
            tags: ['typescript'],
          },
          {
            name: 'Python',
            tags: ['python'],
          },
        ],
      }
    })
    const originalFirstGroup = useIdentityStore.getState().currentIdentity!.skills.groups[0]!
    skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock.mockResolvedValueOnce([
      {
        groupId: originalFirstGroup.id,
        currentLabel: 'Skills 1',
        suggestedLabel: 'Platform Infrastructure',
        rationale: 'Kubernetes and infrastructure skills cluster together.',
      },
      {
        groupId: useIdentityStore.getState().currentIdentity!.skills.groups[1]!.id,
        currentLabel: 'Also',
        suggestedLabel: 'Application Languages',
      },
    ])

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest group names' }))
    const proposals = await screen.findByLabelText('Suggested skill group names')
    expect(within(proposals).getByText('Platform Infrastructure')).toBeTruthy()
    expect(within(proposals).getByText('Application Languages')).toBeTruthy()
    expect(screen.getByText(/per-group revert is deferred for now/i)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Deepen all skills' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Apply suggested names' }))

    const [renamedFirstGroup, renamedSecondGroup] =
      useIdentityStore.getState().currentIdentity!.skills.groups
    expect(renamedFirstGroup!.label).toBe('Platform Infrastructure')
    expect(renamedFirstGroup!.positioning).toBe(originalFirstGroup.positioning)
    expect(renamedFirstGroup!.calibration).toBe(originalFirstGroup.calibration)
    expect(renamedFirstGroup!.is_differentiator).toBe(true)
    expect(renamedFirstGroup!.items).toHaveLength(originalFirstGroup.items.length)
    expect(renamedFirstGroup!.items.map((item) => item.name)).toEqual(
      originalFirstGroup.items.map((item) => item.name),
    )
    expect(renamedSecondGroup!.label).toBe('Application Languages')
    expect(screen.getByRole('button', { name: 'Platform Infrastructure' })).toBeTruthy()
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Suggest group names' }),
      )
    })
  })

  it('shows a configuration error before suggesting skill group names without the AI proxy', async () => {
    seed()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''
    render(<IdentityMapPage />)

    expect(
      (screen.getByRole('button', { name: 'Suggest group names' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    expect(
      await screen.findAllByText(
        'AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.',
      ),
    ).not.toHaveLength(0)
    expect(skillGroupNamingMocks.generateSkillGroupNameSuggestionsMock).not.toHaveBeenCalled()
  })

  it('saves skill group renames through the form submit path', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    const groupNameInput = screen.getByLabelText('Group name')
    fireEvent.change(groupNameInput, {
      target: { value: 'Infrastructure Platform' },
    })
    fireEvent.submit(groupNameInput.closest('form')!)

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.label).toBe(
      'Infrastructure Platform',
    )
  })

  it('keeps the original skill group name when the rename draft is blank', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    const groupNameInput = screen.getByLabelText('Group name')
    fireEvent.change(groupNameInput, { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: 'Save group' })).toHaveProperty('disabled', true)
    fireEvent.submit(groupNameInput.closest('form')!)

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.label).toBe('Platform')
  })

  it('cancels skill group edits with Escape', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit group details' }))
    fireEvent.change(screen.getByLabelText('Group name'), {
      target: { value: 'Discarded Platform' },
    })
    fireEvent.keyDown(screen.getByLabelText('Group name'), { key: 'Escape' })

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.label).toBe('Platform')
    expect(screen.queryByLabelText('Group name')).toBeNull()
  })

  it('edits skill tags inline without changing depth metadata', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = 'strong'
      skill.depthSource = 'corrected'
      skill.enriched_at = '2026-01-01T00:00:00.000Z'
      skill.enriched_by = 'user'
      skill.context_stale = undefined
      skill.positioning_stale = undefined
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'platform, container orchestration' },
    })
    fireEvent.submit(screen.getByLabelText('Tags (comma-separated)').closest('form')!)

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill).toMatchObject({
      depth: 'strong',
      depthSource: 'corrected',
      enriched_at: '2026-01-01T00:00:00.000Z',
      enriched_by: 'user',
      tags: ['platform', 'container orchestration'],
    })
    expect(skill.context_stale).toBeUndefined()
    expect(skill.positioning_stale).toBeUndefined()
  })

  it('clears skill depth inline without marking empty notes stale', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = 'strong'
      skill.depthSource = 'corrected'
      skill.depthConfidence = 'high'
      skill.context = '   '
      skill.positioning = ''
      skill.context_stale = undefined
      skill.positioning_stale = undefined
      skill.skipped_at = '2026-01-01T00:00:00.000Z'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: '' } })
    expect(screen.getByLabelText('Depth confidence')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.depth).toBeUndefined()
    expect(skill.depthSource).toBeUndefined()
    expect(skill.depthConfidence).toBeUndefined()
    expect(skill.context_stale).toBeUndefined()
    expect(skill.positioning_stale).toBeUndefined()
    expect(skill.skipped_at).toBeUndefined()
    expect(
      screen.getByText(
        'Depth is missing. Draft depth, context, and positioning here before using this skill downstream.',
      ),
    ).toBeTruthy()
  })

  it('preserves stale context and positioning flags during unrelated tag edits', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.context_stale = true
      skill.positioning_stale = true
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'platform, orchestration' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.tags).toEqual(['platform', 'orchestration'])
    expect(skill.context_stale).toBe(true)
    expect(skill.positioning_stale).toBe(true)
  })

  it('resets inline skill drafts after cancel and re-edit', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'discarded, tags' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))

    expect(screen.getByLabelText('Depth')).toHaveProperty('value', 'strong')
    expect(screen.getByLabelText('Tags (comma-separated)')).toHaveProperty(
      'value',
      'platform, kubernetes',
    )
  })

  it('drops unsaved inline skill drafts when selecting another skill', () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({
        name: 'Docker',
        depth: 'basic',
        tags: ['containers'],
      })
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'expert' } })
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'discarded, tags' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Docker' }))
    expect(screen.queryByRole('button', { name: 'Save skill' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit skill' }))
    expect(screen.getByLabelText('Depth')).toHaveProperty('value', 'basic')
    expect(screen.getByLabelText('Tags (comma-separated)')).toHaveProperty('value', 'containers')
    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]).toMatchObject({
      name: 'Kubernetes',
      depth: 'strong',
      tags: ['platform', 'kubernetes'],
    })
  })

  it('moves skills between groups from the map inspector', () => {
    seed((id) => {
      const skill = id.skills.groups[0]!.items[0]!
      skill.depth = 'expert'
      skill.depthSource = 'corrected'
      skill.depthConfidence = 'high'
      skill.context = 'Runs Kubernetes for customer-hosted platform deployments.'
      skill.positioning = 'Lead with Kubernetes platform operations.'
      skill.enriched_by = 'user'
      id.skills.groups.push({
        id: 'cloud',
        label: 'Cloud',
        items: [{ name: 'AWS', tags: ['cloud'] }],
      })
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    const targetSelect = screen.getByLabelText('Move to group') as HTMLSelectElement
    expect(within(targetSelect).queryByRole('option', { name: 'Platform' })).toBeNull()
    fireEvent.change(targetSelect, { target: { value: 'cloud' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    const groups = useIdentityStore.getState().currentIdentity!.skills.groups
    const platform = groups.find((group) => group.id === 'platform')
    const cloud = groups.find((group) => group.id === 'cloud')!
    const moved = cloud.items.find((skill) => skill.name === 'Kubernetes')!
    expect(platform?.items.some((skill) => skill.name === 'Kubernetes') ?? false).toBe(false)
    expect(moved).toMatchObject({
      depth: 'expert',
      depthSource: 'corrected',
      depthConfidence: 'high',
      context: 'Runs Kubernetes for customer-hosted platform deployments.',
      positioning: 'Lead with Kubernetes platform operations.',
      tags: ['platform', 'kubernetes'],
      enriched_by: 'user',
    })
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'skill-item',
      groupId: 'cloud',
      itemId: 'Kubernetes',
    })
  })

  it('selects the existing target skill when a move merges duplicate skill names', () => {
    seed((id) => {
      id.skills.groups[0]!.items[0] = {
        name: 'Kubernetes',
        depth: 'expert',
        depthConfidence: 'high',
        tags: ['platform'],
        positioning: 'Source positioning.',
      }
      id.skills.groups.push({
        id: 'cloud',
        label: 'Cloud',
        items: [
          { name: '  kubernetes  ', depth: 'basic', context: 'Target context.', tags: ['cloud'] },
        ],
      })
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    const targetSelect = screen.getByLabelText('Move to group') as HTMLSelectElement
    fireEvent.change(targetSelect, { target: { value: 'cloud' } })
    expect(screen.getByRole('button', { name: 'Move & merge' })).toBeTruthy()
    const mergeHint = screen.getByText(
      /cloud already has\s+kubernetes\s+\. moving will merge tags/i,
    )
    expect(mergeHint).toBeTruthy()
    expect(mergeHint.getAttribute('aria-live')).toBe('polite')
    expect(targetSelect.getAttribute('aria-describedby')).toBe(mergeHint.id)
    fireEvent.click(screen.getByRole('button', { name: 'Move & merge' }))

    const groups = useIdentityStore.getState().currentIdentity!.skills.groups
    const platform = groups.find((group) => group.id === 'platform')!
    const cloud = groups.find((group) => group.id === 'cloud')!
    const merged = cloud.items.filter((skill) => skill.name.toLowerCase() === 'kubernetes')
    expect(platform?.items.some((skill) => skill.name === 'Kubernetes') ?? false).toBe(false)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      name: 'kubernetes',
      depth: 'basic',
      context: 'Target context.',
      positioning: 'Source positioning.',
      tags: ['cloud', 'platform'],
    })
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'skill-item',
      groupId: 'cloud',
      itemId: 'kubernetes',
    })
  })

  it('hides the skill move control when there is no alternate target group', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))

    expect(screen.queryByLabelText('Move to group')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move' })).toBeNull()
  })

  it('falls back to a remaining move target when the selected target group disappears', () => {
    seed((id) => {
      id.skills.groups.push(
        {
          id: 'cloud',
          label: 'Cloud',
          items: [{ name: 'AWS', tags: ['cloud'] }],
        },
        {
          id: 'observability',
          label: 'Observability',
          items: [{ name: 'Grafana', tags: ['observability'] }],
        },
      )
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    const targetSelect = screen.getByLabelText('Move to group') as HTMLSelectElement
    fireEvent.change(targetSelect, { target: { value: 'observability' } })
    expect(targetSelect.value).toBe('observability')

    act(() => {
      const currentIdentity = useIdentityStore.getState().currentIdentity!
      useIdentityStore
        .getState()
        .updateCurrentSkillGroups(
          currentIdentity.skills.groups.filter((group) => group.id !== 'observability'),
        )
    })

    const fallbackSelect = screen.getByLabelText('Move to group') as HTMLSelectElement
    expect(fallbackSelect.value).toBe('cloud')
    fireEvent.click(screen.getByRole('button', { name: 'Move' }))

    const cloud = useIdentityStore
      .getState()
      .currentIdentity!.skills.groups.find((group) => group.id === 'cloud')!
    expect(cloud.items.some((skill) => skill.name === 'Kubernetes')).toBe(true)
    expect(useIdentityStore.getState().mapSelection).toEqual({
      type: 'skill-item',
      groupId: 'cloud',
      itemId: 'Kubernetes',
    })
  })

  it('removes skills from the map inspector and returns to the group', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove skill' }))
    expect(screen.getByText('Remove Kubernetes and its enrichment data?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups).toEqual([])
    expect(useIdentityStore.getState().mapSelection).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kubernetes' })).toBeNull()
    expect(screen.getByText(/Click any element on the map to inspect it/)).toBeTruthy()
  })

  it('cancels pending skill removal without mutating identity', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove skill' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Confirm remove' })).toBeNull()
  })

  it('resets pending skill removal when selecting another skill', () => {
    seed((id) => {
      id.skills.groups[0]!.items.push({ name: 'Docker', tags: [] })
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove skill' }))
    expect(screen.getByText('Remove Kubernetes and its enrichment data?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Docker' }))

    expect(screen.queryByRole('button', { name: 'Confirm remove' })).toBeNull()
    expect(screen.queryByText('Remove Kubernetes and its enrichment data?')).toBeNull()
  })

  it('omits the enrichment warning for raw skills', () => {
    seed((id) => {
      id.skills.groups[0]!.items[0] = { name: 'Kubernetes', tags: [] }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Kubernetes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove skill' }))

    expect(screen.getByText('Remove Kubernetes?')).toBeTruthy()
    expect(screen.queryByText('Remove Kubernetes and its enrichment data?')).toBeNull()
  })
})

describe('Identity Map — sad-path editing coverage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityThesisFromIdentityMock.mockReset()
    identityParameterMocks.generateIdentityProfilesFromIdentityMock.mockReset()
    identityParameterMocks.generateStrategicPositioningFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

  it('resets match-rule drafts from the original value after cancel and re-edit', () => {
    seed((id) => {
      id.preferences.matching.prioritize = [
        {
          id: 'rule-original',
          label: 'Original match rule',
          description: 'Original match description',
          weight: 'medium',
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /original match rule/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Cancelled match rule' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))

    expect(screen.getByLabelText('Label')).toHaveProperty('value', 'Original match rule')
  })

  it('resets search-vector drafts from the original values after cancel and re-edit', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'vector-original',
          title: 'Original vector',
          priority: 'high',
          thesis: 'Original thesis.',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /original vector/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit vector' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Cancelled vector' } })
    fireEvent.change(screen.getByLabelText('Thesis'), { target: { value: 'Cancelled thesis.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit vector' }))

    expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Original vector')
    expect(screen.getByLabelText('Thesis')).toHaveProperty('value', 'Original thesis.')
  })

  it('resets awareness-question drafts from the original values after cancel and re-edit', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'question-original',
            topic: 'Original question',
            description: 'Original question description',
            action: 'Original action',
            severity: 'medium',
          },
        ],
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /original question/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Cancelled question' } })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'Cancelled action' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))

    expect(screen.getByLabelText('Topic')).toHaveProperty('value', 'Original question')
    expect(screen.getByLabelText('Action')).toHaveProperty('value', 'Original action')
  })

  it('disables match-rule save when the label is blank', () => {
    seed((id) => {
      id.preferences.matching.prioritize = [
        {
          id: 'rule-validation',
          label: 'Validation rule',
          description: 'Validation description',
          weight: 'high',
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /validation rule/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '   ' } })

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables search-vector save when title or thesis is blank', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'vector-validation',
          title: 'Validation vector',
          priority: 'medium',
          thesis: 'Validation thesis.',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /validation vector/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit vector' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Validation vector' } })
    fireEvent.change(screen.getByLabelText('Thesis'), { target: { value: '   ' } })

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables awareness-question save when topic or action is blank', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'question-validation',
            topic: 'Validation question',
            description: 'Validation description',
            action: 'Validation action',
          },
        ],
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /validation question/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: '' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Validation question' } })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: '   ' } })

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('drops an unsaved match-rule draft when switching selection', () => {
    seed((id) => {
      id.preferences.matching.prioritize = [
        {
          id: 'rule-one',
          label: 'First rule',
          description: 'First description',
          weight: 'high',
        },
        {
          id: 'rule-two',
          label: 'Second rule',
          description: 'Second description',
          weight: 'low',
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /first rule/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Unsaved first rule' } })
    fireEvent.click(screen.getByRole('button', { name: /second rule/i }))

    const matching = useIdentityStore.getState().currentIdentity!.preferences.matching
    expect(matching.prioritize[0].label).toBe('First rule')
    expect(within(screen.getByRole('complementary')).getByText('Second description')).toBeTruthy()
  })

  it('drops an unsaved search-vector draft when switching selection', () => {
    seed((id) => {
      id.search_vectors = [
        {
          id: 'vector-one',
          title: 'First vector',
          priority: 'high',
          thesis: 'First thesis.',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
        },
        {
          id: 'vector-two',
          title: 'Second vector',
          priority: 'low',
          thesis: 'Second thesis.',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
        },
      ]
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /first vector/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit vector' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved vector' } })
    fireEvent.click(screen.getByRole('button', { name: /second vector/i }))

    const vectors = useIdentityStore.getState().currentIdentity!.search_vectors!
    expect(vectors[0].title).toBe('First vector')
    expect(within(screen.getByRole('complementary')).getByText('Second thesis.')).toBeTruthy()
  })

  it('drops an unsaved awareness-question draft when switching selection', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'question-one',
            topic: 'First question',
            description: 'First description',
            action: 'First action',
          },
          {
            id: 'question-two',
            topic: 'Second question',
            description: 'Second description',
            action: 'Second action',
          },
        ],
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /first question/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Unsaved question' } })
    fireEvent.click(screen.getByRole('button', { name: /second question/i }))

    const questions = useIdentityStore.getState().currentIdentity!.awareness!.open_questions
    expect(questions[0].topic).toBe('First question')
    expect(within(screen.getByRole('complementary')).getByText('Second description')).toBeTruthy()
  })

  it('clears awareness severity when the unset option is saved', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'question-severity',
            topic: 'Severity question',
            description: 'Severity description',
            action: 'Severity action',
            severity: 'high',
          },
        ],
      }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /severity question/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const questions = useIdentityStore.getState().currentIdentity!.awareness!.open_questions
    expect(questions[0].severity).toBeUndefined()
  })
})

describe('Identity Map — justAdded clears on Save so Cancel reverts to non-destructive', () => {
  beforeEach(() => navigateMock.mockReset())
  afterEach(() => cleanup())

  it('saving a just-added vector clears justAdded on selection so re-edit + Cancel does not discard', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add search vector/i }))
    expect(useIdentityStore.getState().mapSelection).toMatchObject({
      type: 'search-vector',
      justAdded: true,
    })

    // Fill required fields and save.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Backend Platform' } })
    fireEvent.change(screen.getByLabelText('Thesis'), { target: { value: 'Lead platform.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // After save, justAdded is cleared from selection.
    const selection = useIdentityStore.getState().mapSelection
    expect(selection?.type).toBe('search-vector')
    expect((selection as { justAdded?: boolean } | null)?.justAdded).toBeUndefined()

    // Re-enter edit mode and Cancel — vector should remain (no discard).
    fireEvent.click(screen.getByRole('button', { name: 'Edit vector' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity!.search_vectors).toHaveLength(1)
    expect(useIdentityStore.getState().currentIdentity!.search_vectors![0].title).toBe(
      'Backend Platform',
    )
  })

  it('saving a just-added match rule clears justAdded so re-edit + Cancel does not discard', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add prioritize rule/i }))
    expect(useIdentityStore.getState().mapSelection).toMatchObject({
      type: 'match-rule',
      justAdded: true,
    })

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Platform depth' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const selection = useIdentityStore.getState().mapSelection
    expect(selection?.type).toBe('match-rule')
    expect((selection as { justAdded?: boolean } | null)?.justAdded).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      useIdentityStore.getState().currentIdentity!.preferences.matching.prioritize,
    ).toHaveLength(1)
  })

  it('saving a just-added question clears justAdded so re-edit + Cancel does not discard', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add open question/i }))
    expect(useIdentityStore.getState().mapSelection).toMatchObject({
      type: 'awareness-question',
      justAdded: true,
    })

    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Comp story' } })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'Prepare answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const selection = useIdentityStore.getState().mapSelection
    expect(selection?.type).toBe('awareness-question')
    expect((selection as { justAdded?: boolean } | null)?.justAdded).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useIdentityStore.getState().currentIdentity!.awareness!.open_questions).toHaveLength(1)
  })
})
