// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
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
  beforeEach(() => navigateMock.mockReset())
  afterEach(() => cleanup())

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
  beforeEach(() => navigateMock.mockReset())
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
  beforeEach(() => navigateMock.mockReset())
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

describe('Identity Map — sad-path editing coverage', () => {
  beforeEach(() => navigateMock.mockReset())
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
