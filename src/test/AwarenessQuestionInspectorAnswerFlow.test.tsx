// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AwarenessQuestionInspector } from '../routes/identity/inspectorSlots/AwarenessQuestionInspector'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { AnswerPatch } from '../types/identity'

// ─────────────────────────────────────────────────────────────
// Mocks (hoisted so vi.mock factories can reference them)
// ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  proposeAnswerPatch: vi.fn(),
}))

const facetEnvMock = vi.hoisted(() => ({
  facetClientEnv: {
    deploymentMode: 'self-hosted' as const,
    facetApiBaseUrl: '',
    anthropicProxyUrl: 'https://ai.example/proxy',
    anthropicProxyApiKey: '',
    supabaseUrl: '',
    supabasePublishableKey: '',
  },
}))

vi.mock('../utils/facetEnv', () => ({
  facetClientEnv: facetEnvMock.facetClientEnv,
  getFacetClientEnv: () => facetEnvMock.facetClientEnv,
}))

vi.mock('../utils/identityParametersGeneration', async () => {
  const actual =
    await vi.importActual<typeof import('../utils/identityParametersGeneration')>(
      '../utils/identityParametersGeneration',
    )
  return { ...actual, proposeAnswerPatch: mocks.proposeAnswerPatch }
})

// ─────────────────────────────────────────────────────────────
// Store helpers
// ─────────────────────────────────────────────────────────────

const seed = (modifier?: (id: ProfessionalIdentityV3) => void) => {
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
  })
  return identity
}

const getIdentity = () => useIdentityStore.getState().currentIdentity!

// Wrapper so the component re-renders when the store identity changes
function Inspector({ questionId }: { questionId: string }) {
  const identity = useIdentityStore((s) => s.currentIdentity!)
  return <AwarenessQuestionInspector identity={identity} questionId={questionId} />
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const roleBulletPatch: AnswerPatch = {
  kind: 'role-bullet',
  roleId: 'contoso',
  bullet: {
    problem: 'No observability stack',
    action: 'Shipped distributed tracing',
    outcome: 'Reduced MTTR by 40%',
  },
}

// ─────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks.proposeAnswerPatch.mockReset()
  facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
  resolveStorage().removeItem('facet-identity-workspace')
})

afterEach(() => {
  cleanup()
  resolveStorage().removeItem('facet-identity-workspace')
})

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('AwarenessQuestionInspector — answer flow (unresolved)', () => {
  it('shows an answer textarea and propose button for an unresolved question', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Gap', description: 'What gap?', action: 'Explain' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    expect(screen.getByLabelText(/your answer/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /propose update/i })).toBeTruthy()
  })

  it('disables propose button when the answer textarea is empty', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Gap', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    const btn = screen.getByRole('button', { name: /propose update/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('enables propose button once text is typed', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Gap', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'Something' },
    })

    const btn = screen.getByRole('button', { name: /propose update/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
})

describe('AwarenessQuestionInspector — happy path (answer → propose → accept → resolved)', () => {
  it('shows loading state while proposing', async () => {
    let resolvePropose!: (patch: AnswerPatch) => void
    mocks.proposeAnswerPatch.mockReturnValue(
      new Promise<AnswerPatch>((res) => {
        resolvePropose = res
      }),
    )

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    expect(screen.getByRole('button', { name: /proposing…/i })).toBeTruthy()

    // Resolve to unblock the promise
    await act(async () => {
      resolvePropose(roleBulletPatch)
    })
  })

  it('renders a proposal card after a successful propose', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/proposed update/i)).toBeTruthy()
    })

    // Role bullet description
    expect(screen.getByText(/add a bullet to/i)).toBeTruthy()
    // Accept / Edit / Skip controls
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeTruthy()
  })

  it('accept applies the patch and marks the question resolved', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    })

    // Store: question resolved with answer
    const q = getIdentity().awareness?.open_questions.find((q) => q.id === 'q1')!
    expect(q.resolved).toBe(true)
    expect(q.answer).toBe('We shipped tracing')

    // Store: role bullet appended
    const contoso = getIdentity().roles.find((r) => r.id === 'contoso')!
    expect(contoso.bullets.at(-1)?.problem).toBe('No observability stack')

    // UI: resolved badge visible
    expect(screen.getByText(/^resolved$/i)).toBeTruthy()
  })
})

describe('AwarenessQuestionInspector — skip path', () => {
  it('skip discards the proposal and leaves the question unresolved', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'Some answer' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^skip$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))
    })

    // Proposal card gone
    expect(screen.queryByText(/proposed update/i)).toBeNull()

    // Store: question NOT resolved
    const q = getIdentity().awareness?.open_questions.find((q) => q.id === 'q1')!
    expect(q.resolved).toBeUndefined()
    expect(q.answer).toBeUndefined()

    // Original roles unchanged
    const contsoBulletCount = getIdentity().roles.find((r) => r.id === 'contoso')!.bullets.length
    const fixtureBulletCount = cloneIdentityFixture().roles.find((r) => r.id === 'contoso')!.bullets.length
    expect(contsoBulletCount).toBe(fixtureBulletCount)
  })

  it('answer text is retained in the textarea after skip', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'Retained answer text' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^skip$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))
    })

    const textarea = screen.getByLabelText(/your answer/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('Retained answer text')
  })
})

describe('AwarenessQuestionInspector — error path', () => {
  it('shows an error alert and preserves typed answer on propose failure', async () => {
    mocks.proposeAnswerPatch.mockRejectedValue(new Error('Network timeout'))

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Gap', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'My important answer' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    expect(screen.getByRole('alert').textContent).toMatch(/couldn't propose/i)

    // Typed answer is preserved
    const textarea = screen.getByLabelText(/your answer/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('My important answer')

    // Store: no mutation
    const q = getIdentity().awareness?.open_questions.find((q) => q.id === 'q1')!
    expect(q.resolved).toBeUndefined()
  })

  it('shows config error message verbatim when proxy is not configured', async () => {
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Gap', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'An answer' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    expect(screen.getByRole('alert').textContent).toMatch(/connect the ai proxy/i)
  })
})

describe('AwarenessQuestionInspector — edit proposal flow', () => {
  it('edit opens a form with the proposal fields pre-filled', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    })

    expect(screen.getByText(/edit proposal/i)).toBeTruthy()
    // Problem field pre-filled
    expect(screen.getByDisplayValue('No observability stack')).toBeTruthy()
  })

  it('back returns from edit to the review card', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    })

    expect(screen.getByText(/proposed update/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^accept$/i })).toBeTruthy()
  })

  it('accepting an edited proposal applies the edited text', async () => {
    mocks.proposeAnswerPatch.mockResolvedValue(roleBulletPatch)

    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Impact', description: 'D', action: 'A' },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    fireEvent.change(screen.getByLabelText(/your answer/i), {
      target: { value: 'We shipped tracing' },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /propose update/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    })

    // Edit the problem field
    const problemField = screen.getByDisplayValue('No observability stack')
    fireEvent.change(problemField, { target: { value: 'Observability was absent' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^accept$/i }))
    })

    const contoso = getIdentity().roles.find((r) => r.id === 'contoso')!
    expect(contoso.bullets.at(-1)?.problem).toBe('Observability was absent')
  })
})

describe('AwarenessQuestionInspector — resolved state rendering', () => {
  it('resolved question shows badge and recorded answer', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'q1',
            topic: 'Leadership',
            description: 'Describe your leadership.',
            action: 'Give examples.',
            resolved: true,
            answer: 'I led the migration end to end.',
          },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    expect(screen.getByText(/^resolved$/i)).toBeTruthy()
    expect(screen.getByText('I led the migration end to end.')).toBeTruthy()
  })

  it('hides the propose button for a resolved question', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'q1',
            topic: 'Leadership',
            description: 'D',
            action: 'A',
            resolved: true,
            answer: 'Done.',
          },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    expect(screen.queryByRole('button', { name: /propose update/i })).toBeNull()
  })

  it('still shows Edit question and Remove buttons for a resolved question', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'q1',
            topic: 'Leadership',
            description: 'D',
            action: 'A',
            resolved: true,
            answer: 'Done.',
          },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    expect(screen.getByRole('button', { name: /edit question/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /remove question/i })).toBeTruthy()
  })

  it('resolved question with no recorded answer shows badge only', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          {
            id: 'q1',
            topic: 'Leadership',
            description: 'D',
            action: 'A',
            resolved: true,
          },
        ],
      }
    })

    render(<Inspector questionId="q1" />)

    expect(screen.getByText(/^resolved$/i)).toBeTruthy()
    expect(screen.queryByLabelText(/your answer/i)).toBeNull()
  })
})
