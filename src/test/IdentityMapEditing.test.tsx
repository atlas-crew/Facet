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
    scanResult: null,
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
    expect(v.evidence).toEqual([
      'Built K8s platform at Contoso',
      'Led migration to Terraform',
    ])
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

    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Departure from Contoso' } })
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

describe('Identity Map — justAdded clears on Save so Cancel reverts to non-destructive', () => {
  beforeEach(() => navigateMock.mockReset())
  afterEach(() => cleanup())

  it('saving a just-added vector clears justAdded on selection so re-edit + Cancel does not discard', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /add search vector/i }))
    expect(useIdentityStore.getState().mapSelection).toMatchObject({ type: 'search-vector', justAdded: true })

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
    expect(useIdentityStore.getState().currentIdentity!.search_vectors![0].title).toBe('Backend Platform')
  })
})
