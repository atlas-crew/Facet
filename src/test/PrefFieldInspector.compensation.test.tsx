// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ProfessionalPreferences } from '../identity/schema'
import { PrefFieldInspector } from '../routes/identity/inspectorSlots/PrefFieldInspector'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import type { PreferenceFieldKey } from '../types/identity'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const identityGenerationMocks = vi.hoisted(() => ({
  generateCompensationSuggestionFromIdentity: vi.fn(),
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

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

vi.mock('../utils/facetEnv', () => ({
  facetClientEnv: facetEnvMock.facetClientEnv,
  getFacetClientEnv: () => facetEnvMock.facetClientEnv,
}))

vi.mock('../utils/identityParametersGeneration', async () => {
  const actual =
    await vi.importActual<typeof import('../utils/identityParametersGeneration')>(
      '../utils/identityParametersGeneration',
    )
  return {
    ...actual,
    generateCompensationSuggestionFromIdentity:
      identityGenerationMocks.generateCompensationSuggestionFromIdentity,
  }
})

const seed = (
  compensation: ProfessionalPreferences['compensation'] = {
    priorities: [{ item: 'base', weight: 'high' }],
  },
) => {
  const identity = cloneIdentityFixture()
  identity.preferences.compensation = compensation
  resolveStorage().removeItem('facet-identity-workspace')
  useIdentityStore.setState({
    currentIdentity: identity,
    draftDocument: JSON.stringify(identity, null, 2),
    draft: null,
    intakeSources: [],
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
    aiGenerationUndo: null,
  })
}

function Inspector({ field = 'compensation.notes' }: { field?: PreferenceFieldKey }) {
  const identity = useIdentityStore((state) => state.currentIdentity!)
  return <PrefFieldInspector identity={identity} field={field} />
}

describe('PrefFieldInspector compensation suggestion', () => {
  beforeEach(() => {
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockReset()
    facetEnvMock.facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    resolveStorage().removeItem('facet-identity-workspace')
    seed()
  })

  afterEach(() => {
    cleanup()
    resolveStorage().removeItem('facet-identity-workspace')
  })

  it('loads an AI compensation suggestion into editable fields before saving', async () => {
    seed({
      notes: [
        'Existing compensation note.',
        'Suggested range rationale: Outdated range.',
      ].join('\n\n'),
      priorities: [{ item: 'base', weight: 'high' }],
    })
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockResolvedValue({
      base_floor: 220000,
      base_target: 275000,
      justification:
        'Advisory range for staff platform scope, remote market, and enterprise delivery evidence.',
    })

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))

    await waitFor(() => {
      expect(screen.getByText(/Floor: \$220,000/i)).toBeTruthy()
    })
    expect(identityGenerationMocks.generateCompensationSuggestionFromIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ identity: expect.objectContaining({ name: 'Alex Example' }) }),
      'https://ai.example/proxy',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    fireEvent.click(screen.getByRole('button', { name: /use suggestion/i }))

    const floorInput = screen.getByLabelText(/base floor/i) as HTMLInputElement
    fireEvent.change(floorInput, { target: { value: '225000' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toMatchObject({
      base_floor: 225000,
      base_target: 275000,
      notes:
        'Existing compensation note.\n\nSuggested range rationale: Advisory range for staff platform scope, remote market, and enterprise delivery evidence.',
      priorities: [{ item: 'base', weight: 'high' }],
    })
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation.notes).not.toContain(
      'Outdated range',
    )
    expect(screen.queryByText(/Suggested compensation/i)).toBeNull()
  })

  it('shows a pending state and ignores duplicate suggestion clicks while generating', async () => {
    const deferred = createDeferred<{
      base_floor: number
      base_target: number
      justification: string
    }>()
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockReturnValue(
      deferred.promise,
    )

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))

    const pendingButton = screen.getByRole('button', { name: /suggesting/i })
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true)
    expect(pendingButton.getAttribute('aria-busy')).toBe('true')

    fireEvent.click(pendingButton)
    expect(identityGenerationMocks.generateCompensationSuggestionFromIdentity).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve({
        base_floor: 220000,
        base_target: 275000,
        justification: 'Advisory range.',
      })
      await deferred.promise
    })

    expect(screen.getByText(/Floor: \$220,000/i)).toBeTruthy()
  })

  it('loads an active suggestion when editing compensation directly', async () => {
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockResolvedValue({
      base_floor: 220000,
      base_target: 275000,
      justification: 'Advisory range.',
    })

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))
    await waitFor(() => {
      expect(screen.getByText(/Floor: \$220,000/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))

    expect((screen.getByLabelText(/base floor/i) as HTMLInputElement).value).toBe('220000')
    expect((screen.getByLabelText(/base target/i) as HTMLInputElement).value).toBe('275000')
    expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe(
      'Suggested range rationale: Advisory range.',
    )
  })

  it('discards an in-flight suggestion when the selected field changes', async () => {
    const deferred = createDeferred<{
      base_floor: number
      base_target: number
      justification: string
    }>()
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockReturnValue(
      deferred.promise,
    )
    const { rerender } = render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))
    rerender(<Inspector field="work_model.preference" />)

    await act(async () => {
      deferred.resolve({
        base_floor: 220000,
        base_target: 275000,
        justification: 'Late advisory range.',
      })
      await deferred.promise
    })

    expect(screen.queryByText(/Suggested compensation/i)).toBeNull()
    expect(screen.queryByText(/Late advisory range/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /suggest range/i })).toBeNull()
  })

  it('resets edit state when the selected field changes', () => {
    const { rerender } = render(<Inspector field="work_model.preference" />)

    fireEvent.click(screen.getByRole('button', { name: /edit field/i }))
    fireEvent.change(screen.getByLabelText(/value/i), { target: { value: 'Remote first' } })
    rerender(<Inspector field="compensation.notes" />)

    expect(screen.queryByLabelText(/value/i)).toBeNull()
    expect(screen.queryByLabelText(/base floor/i)).toBeNull()
    expect(screen.getByRole('button', { name: /edit compensation/i })).toBeTruthy()
  })

  it('surfaces a configuration error when the AI proxy is not connected', async () => {
    facetEnvMock.facetClientEnv.anthropicProxyUrl = ''

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/connect the ai proxy/i)
    expect(identityGenerationMocks.generateCompensationSuggestionFromIdentity).not.toHaveBeenCalled()
  })

  it('surfaces generic AI failures and re-enables the suggestion action', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockRejectedValue(
      new Error('provider unavailable'),
    )

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/couldn't suggest compensation/i)
    })
    const button = screen.getByRole('button', { name: /suggest range/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.getAttribute('aria-busy')).toBe('false')
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('keeps aborted suggestion requests silent and re-enables the action', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    identityGenerationMocks.generateCompensationSuggestionFromIdentity.mockRejectedValue(
      new DOMException('aborted', 'AbortError'),
    )

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /suggest range/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /suggest range/i }).getAttribute('aria-busy')).toBe(
        'false',
      )
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(consoleErrorSpy).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('blocks saving when manual compensation values invert the range', () => {
    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '250000' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '200000' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/base target must be greater/i)
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('allows equal manual compensation floor and target values', () => {
    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '250000' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '250000' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toMatchObject({
      base_floor: 250000,
      base_target: 250000,
    })
  })

  it('cancels compensation edits without saving the abandoned draft', () => {
    seed({
      base_floor: 210000,
      base_target: 260000,
      notes: 'Existing notes',
      priorities: [{ item: 'base', weight: 'high' }],
    })

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '230000' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText(/base floor/i)).toBeNull()
    expect(screen.getByRole('button', { name: /edit compensation/i })).toBeTruthy()
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      base_floor: 210000,
      base_target: 260000,
      notes: 'Existing notes',
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('blocks saving when manual compensation values are not positive numbers', () => {
    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '220000' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/base target must be greater than 0/i)
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('blocks saving when manual compensation values are outside the plausible salary range', () => {
    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '250000' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '1500000' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/\$40,000 and \$1,000,000/i)
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('validates the manual base floor before target values', () => {
    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '250000' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/base floor must be greater than 0/i)
    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('clears existing compensation numbers when saved with blank inputs', () => {
    seed({
      base_floor: 210000,
      base_target: 260000,
      notes: 'Existing notes',
      priorities: [{ item: 'base', weight: 'high' }],
    })

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/base floor/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/base target/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      notes: 'Existing notes',
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('clears compensation notes when saved with a blank notes draft', () => {
    seed({
      base_floor: 210000,
      base_target: 260000,
      notes: 'Existing notes',
      priorities: [{ item: 'base', weight: 'high' }],
    })

    render(<Inspector />)

    fireEvent.click(screen.getByRole('button', { name: /edit compensation/i }))
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(useIdentityStore.getState().currentIdentity?.preferences.compensation).toEqual({
      base_floor: 210000,
      base_target: 260000,
      priorities: [{ item: 'base', weight: 'high' }],
    })
  })

  it('keeps the compensation suggestion action scoped to compensation fields', () => {
    render(<Inspector field="work_model.preference" />)

    expect(screen.queryByRole('button', { name: /suggest range/i })).toBeNull()
    expect(screen.getByRole('button', { name: /edit field/i })).toBeTruthy()
  })
})
