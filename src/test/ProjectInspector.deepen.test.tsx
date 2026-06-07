// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { facetClientEnv } from '../utils/facetEnv'
import { deepenIdentityProject } from '../utils/identityExtraction'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { IdentityDeepenedProject } from '../types/identity'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}))

vi.mock('../utils/identityExtraction', async (orig) => {
  const actual = await orig<typeof import('../utils/identityExtraction')>()
  return {
    ...actual,
    deepenIdentityProject: vi.fn(),
  }
})

const deepenMock = vi.mocked(deepenIdentityProject)

const seed = (modifier?: (id: ReturnType<typeof cloneIdentityFixture>) => void) => {
  const identity = cloneIdentityFixture()
  identity.projects = [
    {
      id: 'installer',
      name: 'Enterprise installer',
      description: 'Built a customer-hosted installer.',
      tags: ['platform'],
    },
  ]
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
    mapSelection: { type: 'project', id: 'installer' },
  })
}

const buildDeepenResult = (
  overrides: Partial<IdentityDeepenedProject> = {},
): IdentityDeepenedProject => ({
  summary: 'Deepened project.',
  projectId: 'installer',
  project: {
    id: 'installer',
    name: 'Enterprise installer',
    description: 'Built a customer-hosted installer.',
    problem: 'Enterprise customers needed customer-hosted deployment.',
    action: 'Built a Kubernetes installer and release workflow.',
    outcome: 'Unlocked self-hosted deployments.',
    impact: ['Reduced deployment friction'],
    metrics: { services_packaged: 8 },
    technologies: ['Kubernetes', 'Helm'],
    assumptions: ['Installer ownership inferred from project description'],
    tags: ['platform', 'kubernetes'],
  },
  rewrite: 'Built a Kubernetes installer for enterprise deployments.',
  assumptions: [],
  warnings: [],
  ...overrides,
})

describe('ProjectInspector — deepen project', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    deepenMock.mockReset()
    facetClientEnv.anthropicProxyUrl = 'http://localhost:9001'
  })
  afterEach(() => cleanup())

  it('calls deepenIdentityProject and applies structured project evidence', async () => {
    seed((id) => {
      id.projects[0]!.source_text = 'Raw project notes about Kubernetes installer.'
    })
    deepenMock.mockResolvedValue(buildDeepenResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))

    expect(deepenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9001/',
        projectId: 'installer',
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    const project = useIdentityStore.getState().currentIdentity!.projects[0]!
    expect(project).toMatchObject({
      problem: 'Enterprise customers needed customer-hosted deployment.',
      action: 'Built a Kubernetes installer and release workflow.',
      outcome: 'Unlocked self-hosted deployments.',
      metrics: { services_packaged: 8 },
      technologies: ['Kubernetes', 'Helm'],
    })
    expect(project.source_text).toBe('Raw project notes about Kubernetes installer.')
  })

  it('merges project deepening onto the latest store snapshot', async () => {
    seed((id) => {
      id.projects[0]!.source_text = 'Original notes.'
    })
    let resolveDeepen: (result: IdentityDeepenedProject) => void = () => undefined
    deepenMock.mockReturnValue(
      new Promise<IdentityDeepenedProject>((resolve) => {
        resolveDeepen = resolve
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))

    act(() => {
      useIdentityStore.getState().updateCurrentProjects([
        {
          ...useIdentityStore.getState().currentIdentity!.projects[0]!,
          source_text: 'Concurrent notes saved while deepening.',
        },
      ])
    })

    await act(async () => {
      resolveDeepen(buildDeepenResult())
      await Promise.resolve()
    })

    const project = useIdentityStore.getState().currentIdentity!.projects[0]!
    expect(project.problem).toBe('Enterprise customers needed customer-hosted deployment.')
    expect(project.source_text).toBe('Concurrent notes saved while deepening.')
  })

  it('preserves existing structured evidence when sparse deepening output omits fields', async () => {
    seed((id) => {
      id.projects[0] = {
        ...id.projects[0]!,
        problem: 'Existing problem.',
        action: 'Existing action.',
        outcome: 'Existing outcome.',
        impact: ['Existing impact'],
        metrics: { existing_metric: 4 },
        technologies: ['ExistingTech'],
        assumptions: ['Existing assumption'],
      }
    })
    deepenMock.mockResolvedValue(
      buildDeepenResult({
        project: {
          id: 'installer',
          name: 'Enterprise installer',
          description: 'Built a customer-hosted installer.',
          problem: '',
          action: '',
          outcome: '',
          impact: [],
          metrics: {},
          technologies: [],
          assumptions: [],
          tags: ['platform'],
        },
        assumptions: [{ label: 'Sparse output used existing fields', confidence: 'guessing' }],
        warnings: ['Project deepen response was sparse.'],
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(useIdentityStore.getState().currentIdentity!.projects[0]).toMatchObject({
      problem: 'Existing problem.',
      action: 'Existing action.',
      outcome: 'Existing outcome.',
      impact: ['Existing impact'],
      metrics: { existing_metric: 4 },
      technologies: ['ExistingTech'],
      assumptions: ['Existing assumption'],
    })
    expect(screen.getByText('Project deepening notes')).not.toBeNull()
    expect(screen.getByText('Project deepen response was sparse.')).not.toBeNull()
    expect(screen.getByText('Sparse output used existing fields (guessing)')).not.toBeNull()
  })

  it('does not resurrect a project removed while deepening', async () => {
    seed()
    let resolveDeepen: (result: IdentityDeepenedProject) => void = () => undefined
    deepenMock.mockReturnValue(
      new Promise<IdentityDeepenedProject>((resolve) => {
        resolveDeepen = resolve
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))

    act(() => {
      useIdentityStore.getState().updateCurrentProjects([])
    })

    await act(async () => {
      resolveDeepen(buildDeepenResult())
      await Promise.resolve()
    })

    expect(useIdentityStore.getState().currentIdentity!.projects).toEqual([])
  })

  it('aborts in-flight project deepening on unmount', async () => {
    seed()
    let resolveDeepen: (result: IdentityDeepenedProject) => void = () => undefined
    let capturedSignal: AbortSignal | undefined
    deepenMock.mockImplementation(({ signal }) => {
      capturedSignal = signal
      return new Promise<IdentityDeepenedProject>((resolve) => {
        resolveDeepen = resolve
      })
    })
    const { unmount } = render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))
    unmount()

    expect(capturedSignal?.aborted).toBe(true)

    await act(async () => {
      resolveDeepen(buildDeepenResult())
      await Promise.resolve()
    })

    expect(useIdentityStore.getState().currentIdentity!.projects[0]!.problem).toBeUndefined()
  })

  it('shows a running label and then a retryable error when project deepening fails', async () => {
    seed()
    let rejectDeepen: (reason: Error) => void = () => undefined
    deepenMock.mockReturnValue(
      new Promise<IdentityDeepenedProject>((_, reject) => {
        rejectDeepen = reject
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen project' }))
    expect((screen.getByRole('button', { name: 'Deepening…' }) as HTMLButtonElement).disabled).toBe(
      true,
    )

    await act(async () => {
      rejectDeepen(new Error('Project deepen failed'))
      await Promise.resolve()
    })

    expect(screen.getByText('Project deepen failed').closest('[role="alert"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Retry deepen' })).not.toBeNull()
  })

  it('lets users edit source text and metrics for project evidence', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Add source text' }))
    fireEvent.change(screen.getByLabelText('Source text'), {
      target: { value: 'Raw installer notes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add metrics' }))
    fireEvent.change(screen.getByLabelText('Metrics JSON'), {
      target: { value: '{ "services_packaged": 8 }' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity!.projects[0]).toMatchObject({
      source_text: 'Raw installer notes',
      metrics: { services_packaged: 8 },
    })
  })

  it('renders structured project evidence in read mode', () => {
    seed((id) => {
      id.projects[0] = {
        ...id.projects[0]!,
        problem: 'Enterprise deployments were hard to repeat.',
        action: 'Built an installer workflow.',
        outcome: 'Deployment handoffs became predictable.',
        impact: [' Reduced support load ', ''],
        metrics: { services_packaged: 8 },
        technologies: ['Kubernetes', ''],
        assumptions: ['Metric came from launch notes'],
      }
    })
    render(<IdentityMapPage />)

    expect(screen.getByText('Problem')).not.toBeNull()
    expect(screen.getByText('Enterprise deployments were hard to repeat.')).not.toBeNull()
    expect(screen.getByText('Action')).not.toBeNull()
    expect(screen.getByText('Built an installer workflow.')).not.toBeNull()
    expect(screen.getByText('Outcome')).not.toBeNull()
    expect(screen.getByText('Deployment handoffs became predictable.')).not.toBeNull()
    expect(screen.getByText('Impact')).not.toBeNull()
    expect(screen.getByText('Reduced support load')).not.toBeNull()
    expect(screen.getByText('Metrics')).not.toBeNull()
    expect(screen.getByText('services_packaged')).not.toBeNull()
    expect(screen.getByText('8')).not.toBeNull()
    expect(screen.getByText('Technologies')).not.toBeNull()
    expect(screen.getAllByText('Kubernetes').length).toBeGreaterThan(0)
    expect(screen.getByText('Assumptions')).not.toBeNull()
    expect(screen.getByText('Metric came from launch notes')).not.toBeNull()
  })

  it('disables project deepening when AI is unavailable or source evidence is empty', () => {
    facetClientEnv.anthropicProxyUrl = ''
    seed()
    render(<IdentityMapPage />)

    expect(
      (screen.getByRole('button', { name: 'AI not configured' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    cleanup()
    facetClientEnv.anthropicProxyUrl = 'http://localhost:9001'
    seed((id) => {
      id.projects[0]!.description = ''
      id.projects[0]!.source_text = undefined
    })
    render(<IdentityMapPage />)

    expect(
      (screen.getByRole('button', { name: 'Add source text first' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('rejects non-scalar project metrics before saving', () => {
    seed((id) => {
      id.projects[0]!.metrics = { services_packaged: 8 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    fireEvent.change(screen.getByLabelText('Metrics JSON'), {
      target: { value: '{ "services_packaged": { "count": 9 } }' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      screen.getByText('Metrics values must be strings, numbers, or booleans before you save.'),
    ).not.toBeNull()
    expect(useIdentityStore.getState().currentIdentity!.projects[0]!.metrics).toEqual({
      services_packaged: 8,
    })
  })

  it('rejects malformed and non-object metrics JSON before saving', () => {
    seed((id) => {
      id.projects[0]!.metrics = { services_packaged: 8 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    fireEvent.change(screen.getByLabelText('Metrics JSON'), {
      target: { value: '{ not valid json' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Metrics must be valid JSON before you save.')).not.toBeNull()
    expect(useIdentityStore.getState().currentIdentity!.projects[0]!.metrics).toEqual({
      services_packaged: 8,
    })

    fireEvent.change(screen.getByLabelText('Metrics JSON'), {
      target: { value: '[1, 2, 3]' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Metrics must be a JSON object before you save.')).not.toBeNull()
    expect(useIdentityStore.getState().currentIdentity!.projects[0]!.metrics).toEqual({
      services_packaged: 8,
    })
  })

  it('clears source text and metrics to undefined when saved empty', () => {
    seed((id) => {
      id.projects[0]!.source_text = 'Raw installer notes'
      id.projects[0]!.metrics = { services_packaged: 8 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))
    fireEvent.change(screen.getByLabelText('Source text'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    fireEvent.change(screen.getByLabelText('Metrics JSON'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const project = useIdentityStore.getState().currentIdentity!.projects[0]!
    expect(project.source_text).toBeUndefined()
    expect(project.metrics).toBeUndefined()
  })

  it('saves manually edited project evidence fields', () => {
    seed()
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit project' }))
    fireEvent.change(screen.getByLabelText('Problem'), {
      target: { value: 'Enterprise deployments were difficult to repeat.' },
    })
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'Built a packaged installer and release checklist.' },
    })
    fireEvent.change(screen.getByLabelText('Outcome'), {
      target: { value: 'Deployment handoffs became repeatable.' },
    })
    fireEvent.change(screen.getByLabelText('Impact (one per line)'), {
      target: {
        value: 'Reduced handoff risk, improving rollout confidence\nImproved release readiness',
      },
    })
    fireEvent.change(screen.getByLabelText('Technologies (comma-separated)'), {
      target: { value: 'Kubernetes, Helm' },
    })
    fireEvent.change(screen.getByLabelText('Assumptions (one per line)'), {
      target: { value: 'Impact came from project notes, not customer telemetry' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity!.projects[0]).toMatchObject({
      problem: 'Enterprise deployments were difficult to repeat.',
      action: 'Built a packaged installer and release checklist.',
      outcome: 'Deployment handoffs became repeatable.',
      impact: ['Reduced handoff risk, improving rollout confidence', 'Improved release readiness'],
      technologies: ['Kubernetes', 'Helm'],
      assumptions: ['Impact came from project notes, not customer telemetry'],
    })
  })
})
