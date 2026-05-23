// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ProposedVectorsCard } from '../routes/identity/ProposedVectorsCard'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type {
  IdentityExtractionDraft,
  ProposedSearchVector,
  ProposedSearchVectorPatch,
} from '../types/identity'

const makeProposedVector = (
  overrides: Partial<ProposedSearchVector> = {},
): ProposedSearchVector => ({
  id: 'proposed-1',
  title: 'Platform Engineering',
  priority: 'high',
  thesis: 'Make platform complexity legible to product teams.',
  target_roles: ['Staff Platform Engineer'],
  keywords: {
    primary: ['kubernetes', 'platform'],
    secondary: ['devex'],
  },
  supporting_bullets: ['platform-migration'],
  evidenceSources: ['2 resumes labeled platform'],
  ...overrides,
})

const makeDraft = (
  proposedVectors: ProposedSearchVector[] | undefined,
): IdentityExtractionDraft => ({
  generatedAt: '2026-05-11T00:00:00.000Z',
  summary: 'Draft summary',
  followUpQuestions: [],
  identity: cloneIdentityFixture(),
  bullets: [],
  warnings: [],
  ...(proposedVectors !== undefined ? { proposedVectors } : {}),
})

const seedDraft = (draft: IdentityExtractionDraft | null) => {
  const identity = draft?.identity ?? null
  useIdentityStore.setState({
    draft,
    draftDocument: identity ? JSON.stringify(identity, null, 2) : '',
    currentIdentity: null,
  })
}

const renderProposedVectorsCardFromStore = () => {
  const view = render(<ProposedVectorsCardHarness />)
  return view
}

function ProposedVectorsCardHarness() {
  const draft = useIdentityStore((state) => state.draft)
  const acceptProposedVector = useIdentityStore((state) => state.acceptProposedVector)
  const rejectProposedVector = useIdentityStore((state) => state.rejectProposedVector)
  const editProposedVector = useIdentityStore((state) => state.editProposedVector)

  return (
    <ProposedVectorsCard
      draft={draft}
      onAccept={acceptProposedVector}
      onReject={rejectProposedVector}
      onEdit={(id: string, patch: ProposedSearchVectorPatch) =>
        editProposedVector(id, patch)
      }
    />
  )
}

beforeEach(() => {
  resolveStorage().removeItem('facet-identity-workspace')
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: null,
    draft: null,
    draftDocument: '',
    intakeSources: [],
    warnings: [],
    changelog: [],
    lastError: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('ProposedVectorsCard rendering', () => {
  it('renders title, thesis, resolved supporting bullets, evidence, and three actions', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    expect(screen.getByRole('heading', { name: 'Proposed Vectors' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Platform Engineering' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Make platform complexity legible to product teams.'),
    ).toBeTruthy()
    // supporting_bullets resolves the bullet id "platform-migration" to a role+bullet label
    expect(
      screen.getByText('Contoso Networks · Senior Platform Engineer · Bullet 1'),
    ).toBeTruthy()
    expect(screen.getByText('2 resumes labeled platform')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy()
  })

  it('renders nothing when proposedVectors is empty (no header, no container)', () => {
    seedDraft(makeDraft([]))

    const { container } = renderProposedVectorsCardFromStore()

    expect(screen.queryByRole('heading', { name: 'Proposed Vectors' })).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when draft is null', () => {
    seedDraft(null)

    const { container } = renderProposedVectorsCardFromStore()

    expect(container.firstChild).toBeNull()
  })

  it('falls back to the raw supporting_bullet value when no role/bullet id matches', () => {
    seedDraft(
      makeDraft([
        makeProposedVector({ supporting_bullets: ['Some free-form supporting evidence'] }),
      ]),
    )

    renderProposedVectorsCardFromStore()

    expect(screen.getByText('Some free-form supporting evidence')).toBeTruthy()
  })
})

describe('ProposedVectorsCard accept', () => {
  it('promotes the vector to draft.identity.search_vectors with a fresh id and removes from staging', () => {
    const proposed = makeProposedVector()
    seedDraft(makeDraft([proposed]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    })

    const state = useIdentityStore.getState()
    expect(state.draft?.proposedVectors).toBeUndefined()
    expect(state.draft?.identity.search_vectors).toHaveLength(1)
    const accepted = state.draft!.identity.search_vectors![0]
    expect(accepted.title).toBe('Platform Engineering')
    expect(accepted.thesis).toBe('Make platform complexity legible to product teams.')
    // Stripped evidenceSources off the accepted vector
    expect('evidenceSources' in accepted).toBe(false)
    // Re-id'd so the accepted entry doesn't reuse the staging id
    expect(accepted.id).not.toBe('proposed-1')
    // draftDocument re-derived from the new identity
    expect(state.draftDocument).toContain('Platform Engineering')
  })

  it('preserves any remaining proposed vectors after accepting one', () => {
    const first = makeProposedVector({ id: 'proposed-1', title: 'Platform' })
    const second = makeProposedVector({ id: 'proposed-2', title: 'Security' })
    seedDraft(makeDraft([first, second]))

    renderProposedVectorsCardFromStore()

    const firstCard = screen.getByRole('article', { name: /Platform/ })
    act(() => {
      fireEvent.click(within(firstCard).getByRole('button', { name: 'Accept' }))
    })

    const state = useIdentityStore.getState()
    expect(state.draft?.proposedVectors).toHaveLength(1)
    expect(state.draft!.proposedVectors![0].id).toBe('proposed-2')
    expect(state.draft!.identity.search_vectors).toHaveLength(1)
  })
})

describe('ProposedVectorsCard reject', () => {
  it('removes the vector from staging without touching search_vectors', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    })

    const state = useIdentityStore.getState()
    expect(state.draft?.proposedVectors).toBeUndefined()
    expect(state.draft?.identity.search_vectors ?? []).toHaveLength(0)
  })
})

describe('ProposedVectorsCard edit', () => {
  it('opens the inline editor, saves the patch, and shows the updated values', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement
    const thesisInput = screen.getByLabelText('Thesis') as HTMLTextAreaElement
    const primaryInput = screen.getByLabelText('Primary keywords') as HTMLInputElement

    act(() => {
      fireEvent.change(titleInput, { target: { value: 'Edited Platform Title' } })
      fireEvent.change(thesisInput, { target: { value: 'Updated thesis.' } })
      fireEvent.change(primaryInput, { target: { value: 'platform, kubernetes, helm' } })
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })

    const state = useIdentityStore.getState()
    expect(state.draft?.proposedVectors).toHaveLength(1)
    const edited = state.draft!.proposedVectors![0]
    expect(edited.title).toBe('Edited Platform Title')
    expect(edited.thesis).toBe('Updated thesis.')
    expect(edited.keywords.primary).toEqual(['platform', 'kubernetes', 'helm'])

    // After saving, the editor closes and the read-only view shows the new title.
    expect(
      screen.getByRole('heading', { name: 'Edited Platform Title' }),
    ).toBeTruthy()
  })

  it('shows a validation error and keeps the editor open when title or thesis is empty', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement
    act(() => {
      fireEvent.change(titleInput, { target: { value: '   ' } })
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })

    expect(screen.getByText('Title and thesis are required before saving.')).toBeTruthy()
    // Editor still open
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    // Store unchanged
    expect(useIdentityStore.getState().draft!.proposedVectors![0].title).toBe(
      'Platform Engineering',
    )
  })

  it('discards local edits when Cancel is clicked', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement
    act(() => {
      fireEvent.change(titleInput, { target: { value: 'Throwaway edit' } })
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    // Store untouched
    expect(useIdentityStore.getState().draft!.proposedVectors![0].title).toBe(
      'Platform Engineering',
    )
    // Editor closed, original heading visible
    expect(screen.queryByLabelText('Title')).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Platform Engineering' }),
    ).toBeTruthy()
  })

  it('accepts the edited vector after save (edit-then-accept flow)', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })
    act(() => {
      fireEvent.change(screen.getByLabelText('Title') as HTMLInputElement, {
        target: { value: 'Refined Platform Title' },
      })
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    })

    const state = useIdentityStore.getState()
    expect(state.draft?.proposedVectors).toBeUndefined()
    expect(state.draft?.identity.search_vectors).toHaveLength(1)
    expect(state.draft!.identity.search_vectors![0].title).toBe('Refined Platform Title')
  })
})

describe('ProposedVectorsCard draft-application clears staging', () => {
  it('drops draft.proposedVectors when applyDraft replaces the identity', () => {
    seedDraft(makeDraft([makeProposedVector()]))

    renderProposedVectorsCardFromStore()

    expect(screen.getByRole('heading', { name: 'Proposed Vectors' })).toBeTruthy()

    act(() => {
      useIdentityStore.getState().applyDraft('replace')
    })

    expect(useIdentityStore.getState().draft?.proposedVectors).toBeUndefined()
    expect(screen.queryByRole('heading', { name: 'Proposed Vectors' })).toBeNull()
  })
})
