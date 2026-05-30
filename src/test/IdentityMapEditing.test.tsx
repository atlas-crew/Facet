// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)
const identityParameterMocks = vi.hoisted(() => ({
  generateSearchVectorsFromIdentityMock: vi.fn(),
  generateAwarenessFromIdentityMock: vi.fn(),
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

vi.mock('../utils/facetEnv', () => facetEnvMock)

vi.mock('../utils/identityParametersGeneration', () => ({
  generateSearchVectorsFromIdentity: identityParameterMocks.generateSearchVectorsFromIdentityMock,
  generateAwarenessFromIdentity: identityParameterMocks.generateAwarenessFromIdentityMock,
}))

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
    intakeSources: [],
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
  })
}

describe('Identity Map — match-rule add/remove', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
  })
  afterEach(() => cleanup())

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

  it('renders dark-theme controls for strategic positioning inputs', () => {
    seed()
    render(<IdentityMapPage />)

    expect(screen.getByLabelText('Competitive moat').classList.contains('self-moat-textarea')).toBe(
      true,
    )
    expect(
      screen.getByLabelText('New unfair advantage').classList.contains('self-advantage-input'),
    ).toBe(true)
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

    expect(screen.getByText('Search Strategy')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: /mark reviewed/i }))

    expect(useIdentityStore.getState().currentIdentity!.search_vectors![0].needs_review).toBe(false)
  })
})

describe('Identity Map — awareness-question full-edit + add/remove', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
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
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }))

    const skill = useIdentityStore.getState().currentIdentity!.skills.groups[0]!.items[0]!
    expect(skill.depth).toBeUndefined()
    expect(skill.depthSource).toBeUndefined()
    expect(skill.context_stale).toBeUndefined()
    expect(skill.positioning_stale).toBeUndefined()
    expect(skill.skipped_at).toBeUndefined()
    expect(
      screen.getByText(
        'Depth is missing. Context and positioning can still be refined in the wizard.',
      ),
    ).toBeTruthy()
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
})

describe('Identity Map — sad-path editing coverage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    identityParameterMocks.generateSearchVectorsFromIdentityMock.mockReset()
    identityParameterMocks.generateAwarenessFromIdentityMock.mockReset()
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
