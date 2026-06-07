// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import type { ResumeScanResult } from '../types/identity'
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
    mapSelection: {
      type: 'bullet',
      roleId: 'contoso',
      bulletId: 'platform-migration',
    },
  })
}

const createScanResult = (
  identity: ReturnType<typeof cloneIdentityFixture>,
  progress: ResumeScanResult['progress'],
): ResumeScanResult => ({
  fileName: 'resume.pdf',
  pageCount: 1,
  scannedAt: '2026-06-01T00:00:00.000Z',
  rawText: 'Alex Example\nContoso Networks',
  identity,
  warnings: [],
  counts: {
    roles: identity.roles.length,
    bullets: identity.roles.reduce((count, role) => count + role.bullets.length, 0),
    projects: identity.projects.length,
    skillGroups: identity.skills.groups.length,
    education: identity.education.length,
    extractedBullets: 1,
    decomposedBullets: 1,
    scannedBullets: 1,
    deepenedBullets: 1,
    editedBullets: 0,
    failedBullets: 0,
  },
  layout: 'single-column',
  progress,
})

describe('BulletInspector — source_text sheet canary', () => {
  beforeEach(() => navigateMock.mockReset())
  afterEach(() => cleanup())

  it('shows "Add source text" when bullet has no source_text', () => {
    seed()
    render(<IdentityMapPage />)
    expect(screen.getByRole('button', { name: 'Add source text' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit source text' })).toBeNull()
  })

  it('shows "Edit source text" when bullet has existing source_text', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Migrated K8s services from monorepo to platform'
    })
    render(<IdentityMapPage />)
    expect(screen.getByRole('button', { name: 'Edit source text' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add source text' })).toBeNull()
  })

  it('opens the sheet with the current source_text on click', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Original raw bullet from the resume'
    })
    render(<IdentityMapPage />)

    expect(screen.queryByRole('region', { name: 'Edit source text' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))
    expect(screen.getByRole('region', { name: 'Edit source text' })).not.toBeNull()
    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    expect(textarea.value).toBe('Original raw bullet from the resume')
  })

  it('Save persists the new source_text to the store and closes the sheet', () => {
    seed()
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Newly captured raw text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBe('Newly captured raw text')
    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('Cancel closes the sheet without persisting', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Already saved'
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'discarded edits' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBe('Already saved')
    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('Save with empty input clears the source_text field on the bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'To be cleared'
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBeUndefined()
  })

  it('closes the sheet when the bullet selection changes to a different bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'First bullet source'
      id.roles[0].bullets.push({
        id: 'second-bullet',
        problem: 'Second problem',
        action: 'Second action',
        outcome: 'Second outcome',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
      })
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))
    expect(screen.getByRole('region', { name: 'Edit source text' })).not.toBeNull()

    act(() => {
      useIdentityStore.setState({
        mapSelection: { type: 'bullet', roleId: 'contoso', bulletId: 'second-bullet' },
      })
    })

    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('source_text save is independent of the aside problem/action/outcome edit mode', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Initial source'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit bullet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const sheet = screen.getByRole('region', { name: /source text/i })
    const textarea = within(sheet).getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Updated source only' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    const bullet = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]
    expect(bullet.source_text).toBe('Updated source only')
    expect(bullet.problem).toBe('Cloud-only delivery blocked on-prem deployments.')
  })

  it('shows metrics as key/value rows and an edit affordance when metrics exist', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = {
        services_ported: 12,
        'p95-latency_ms': 220,
        revenue_protected: '$1.2M',
        audited: true,
      }
    })
    render(<IdentityMapPage />)

    const metrics = screen.getByText('Metrics').closest('.inspector-read-section')
    expect(metrics).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('Services ported')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('12')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('P95 latency ms')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('220')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('Revenue protected')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('$1.2M')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('Audited')).not.toBeNull()
    expect(within(metrics as HTMLElement).getByText('true')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Edit metrics' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add metrics' })).toBeNull()
  })

  it('shows technologies, tags, and scan deepening assumptions in read mode', () => {
    const identity = cloneIdentityFixture()
    identity.roles[0].bullets[0].technologies = ['Kubernetes', 'Helm']
    identity.roles[0].bullets[0].tags = ['platform', 'delivery']
    identity.roles[0].bullets[0].impact = ['Unlocked customer-managed deployments']
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identity,
      draft: null,
      draftDocument: '',
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: createScanResult(identity, {
            bullets: {
              'contoso::platform-migration': {
                status: 'completed',
                confidence: 'guessing',
                lastError: null,
                updatedAt: '2026-06-01T00:00:00.000Z',
                explanation: {
                  summary: 'AI deepened this bullet from the scanned resume.',
                  rewrite: 'Ported the platform to Kubernetes-based customer installs.',
                  assumptions: [
                    { label: 'customer deployment scope', confidence: 'guessing' },
                    { label: 'Kubernetes evidence', confidence: 'confirmed' },
                    { label: 'resume stated scope', confidence: 'stated' },
                  ],
                  warnings: ['Validate whether Helm was explicit in the source text.'],
                },
              },
            },
            bulk: {
              status: 'idle',
              total: 1,
              completed: 1,
              failed: 0,
              failedBaseline: 0,
              currentBulletKey: null,
              lastUpdatedAt: null,
            },
          }),
        },
      ],
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: {
        type: 'bullet',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      },
    })

    render(<IdentityMapPage />)

    const technologies = screen.getByText('Technologies').closest('.inspector-read-section')
    expect(technologies).not.toBeNull()
    expect(within(technologies as HTMLElement).getByText('Kubernetes')).not.toBeNull()
    expect(within(technologies as HTMLElement).getByText('Helm')).not.toBeNull()

    const tags = screen.getByText('Tags').closest('.inspector-read-section')
    expect(tags).not.toBeNull()
    expect(within(tags as HTMLElement).getByText('platform')).not.toBeNull()
    expect(within(tags as HTMLElement).getByText('delivery')).not.toBeNull()

    const evidence = screen.getByRole('region', { name: 'Deepening evidence' })
    expect(
      within(evidence).getByText('AI deepened this bullet from the scanned resume.'),
    ).not.toBeNull()
    expect(within(evidence).getByText('Current AI rewrite')).not.toBeNull()
    expect(
      within(evidence).getByText('Ported the platform to Kubernetes-based customer installs.'),
    ).not.toBeNull()
    const guessingChip = within(evidence).getByText('customer deployment scope · Guessing')
    expect(guessingChip.className).toContain('tone-guessing')
    const confirmedChip = within(evidence).getByText('Kubernetes evidence · Confirmed')
    expect(confirmedChip.className).toContain('tone-confirmed')
    const statedChip = within(evidence).getByText('resume stated scope · Stated')
    expect(statedChip.className).toContain('tone-stated')
    expect(
      within(evidence).getByText('Validate whether Helm was explicit in the source text.'),
    ).not.toBeNull()
  })

  it('filters blank read-mode list items and hides empty list sections', () => {
    seed((id) => {
      id.roles[0].bullets[0].technologies = []
      id.roles[0].bullets[0].tags = ['  ', 'platform', '', ' delivery ']
      id.roles[0].bullets[0].impact = []
    })

    render(<IdentityMapPage />)

    expect(screen.queryByText('Technologies')).toBeNull()
    expect(screen.queryByText('Impact')).toBeNull()
    const tags = screen.getByText('Tags').closest('.inspector-read-section')
    expect(tags).not.toBeNull()
    expect(within(tags as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(within(tags as HTMLElement).getByText('platform')).not.toBeNull()
    expect(within(tags as HTMLElement).getByText('delivery')).not.toBeNull()
  })

  it('shows warning-only deepening evidence without blank summary sections', () => {
    const identity = cloneIdentityFixture()
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identity,
      draft: null,
      draftDocument: '',
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: createScanResult(identity, {
            bullets: {
              'contoso::platform-migration': {
                status: 'completed',
                confidence: 'guessing',
                lastError: null,
                updatedAt: '2026-06-01T00:00:00.000Z',
                explanation: {
                  summary: '   ',
                  rewrite: '',
                  assumptions: [],
                  warnings: ['Confirm the deployment scope before using this claim.'],
                },
              },
            },
            bulk: {
              status: 'idle',
              total: 1,
              completed: 1,
              failed: 0,
              failedBaseline: 0,
              currentBulletKey: null,
              lastUpdatedAt: null,
            },
          }),
        },
      ],
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: {
        type: 'bullet',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      },
    })

    render(<IdentityMapPage />)

    const evidence = screen.getByRole('region', { name: 'Deepening evidence' })
    expect(within(evidence).getByText('Warnings')).not.toBeNull()
    expect(
      within(evidence).getByText('Confirm the deployment scope before using this claim.'),
    ).not.toBeNull()
    expect(within(evidence).queryByText('Current AI rewrite')).toBeNull()
    expect(within(evidence).queryByText('Assumptions')).toBeNull()
  })

  it('shows corrected confidence labels from scan evidence', () => {
    const identity = cloneIdentityFixture()
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identity,
      draft: null,
      draftDocument: '',
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: createScanResult(identity, {
            bullets: {
              'contoso::platform-migration': {
                status: 'completed',
                confidence: 'corrected',
                lastError: null,
                updatedAt: '2026-06-01T00:00:00.000Z',
                explanation: {
                  summary: '',
                  rewrite: '',
                  assumptions: [{ label: 'deployment count', confidence: 'corrected' }],
                  warnings: [],
                },
              },
            },
            bulk: {
              status: 'idle',
              total: 1,
              completed: 1,
              failed: 0,
              failedBaseline: 0,
              currentBulletKey: null,
              lastUpdatedAt: null,
            },
          }),
        },
      ],
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: {
        type: 'bullet',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      },
    })

    render(<IdentityMapPage />)

    const chip = screen.getByText('deployment count · Corrected')
    expect(chip.className).toContain('tone-corrected')
  })

  it('hides empty metrics and empty scan evidence sections', () => {
    const identity = cloneIdentityFixture()
    identity.roles[0].bullets[0].metrics = {}
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identity,
      draft: null,
      draftDocument: '',
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: createScanResult(identity, {
            bullets: {
              'contoso::platform-migration': {
                status: 'completed',
                confidence: 'stated',
                lastError: null,
                updatedAt: '2026-06-01T00:00:00.000Z',
                explanation: {
                  summary: '',
                  rewrite: '',
                  assumptions: [],
                  warnings: [],
                },
              },
            },
            bulk: {
              status: 'idle',
              total: 1,
              completed: 1,
              failed: 0,
              failedBaseline: 0,
              currentBulletKey: null,
              lastUpdatedAt: null,
            },
          }),
        },
      ],
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: {
        type: 'bullet',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      },
    })

    render(<IdentityMapPage />)

    expect(screen.queryByText('Metrics')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Deepening evidence' })).toBeNull()
  })

  it('does not show scan evidence from a different bullet key', () => {
    const identity = cloneIdentityFixture()
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identity,
      draft: null,
      draftDocument: '',
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: createScanResult(identity, {
            bullets: {
              'contoso::other-bullet': {
                status: 'completed',
                confidence: 'confirmed',
                lastError: null,
                updatedAt: '2026-06-01T00:00:00.000Z',
                explanation: {
                  summary: 'Evidence for a different bullet.',
                  rewrite: '',
                  assumptions: [],
                  warnings: [],
                },
              },
            },
            bulk: {
              status: 'idle',
              total: 1,
              completed: 1,
              failed: 0,
              failedBaseline: 0,
              currentBulletKey: null,
              lastUpdatedAt: null,
            },
          }),
        },
      ],
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: {
        type: 'bullet',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      },
    })

    render(<IdentityMapPage />)

    expect(screen.queryByRole('region', { name: 'Deepening evidence' })).toBeNull()
    expect(screen.queryByText('Evidence for a different bullet.')).toBeNull()
  })

  it('opens the metrics sheet and persists valid JSON to the canonical bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = { services_ported: 12 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    const sheet = screen.getByRole('region', { name: 'Edit metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    expect(textarea.value).toBe(JSON.stringify({ services_ported: 12 }, null, 2))

    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          latency_ms: 120,
          validated: true,
          ignored_nested: { value: 1 },
        }),
      },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics
    expect(stored).toEqual({ latency_ms: 120, validated: true })
    expect(screen.queryByRole('region', { name: /metrics/i })).toBeNull()
  })

  it('keeps the metrics sheet open and leaves the store unchanged for invalid JSON', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = {}
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Add metrics' }))
    const sheet = screen.getByRole('region', { name: 'Add metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(within(sheet).getByRole('alert').textContent).toContain(
      'Metrics must be valid JSON before you save.',
    )
    expect(useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics).toEqual({})
    expect(screen.getByRole('region', { name: 'Add metrics' })).not.toBeNull()
  })

  it('saves empty metrics input as an empty object', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = { services_ported: 12 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    const sheet = screen.getByRole('region', { name: 'Edit metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics).toEqual({})
  })
})
