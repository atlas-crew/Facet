// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HomePage } from '../routes/home/HomePage'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useDebriefStore } from '../store/debriefStore'
import { useIdentityStore } from '../store/identityStore'
import { useLinkedInStore } from '../store/linkedinStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useRecruiterStore } from '../store/recruiterStore'
import type { PipelineEntry } from '../types/pipeline'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

const localStorageItems = new Map<string, string>()

const installLocalStorageMock = () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => localStorageItems.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageItems.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        localStorageItems.delete(key)
      }),
    },
  })
}

const createPipelineEntry = (overrides: Partial<PipelineEntry> = {}): PipelineEntry => ({
  id: 'pipe-threatx',
  company: 'ThreatX',
  role: 'Senior Platform Engineer',
  tier: '1',
  status: 'interviewing',
  comp: '',
  url: '',
  contact: '',
  vectorId: null,
  jobDescription: '',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: '',
  skillMatch: '',
  nextStep: 'Prep the reliability story',
  notes: '',
  appMethod: 'direct-apply',
  response: 'interview-scheduled',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  lastAction: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  history: [],
  ...overrides,
})

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const createScanResult = (
  overrides: {
    bulkStatus?: 'idle' | 'running' | 'cancelling'
    failedBullets?: number
    extractedBullets?: number
    deepenedBullets?: number
    editedBullets?: number
  } = {},
) =>
  ({
    counts: {
      roles: 1,
      bullets: 2,
      projects: 0,
      skillGroups: 0,
      education: 0,
      extractedBullets: overrides.extractedBullets ?? 2,
      decomposedBullets: 0,
      scannedBullets: 2,
      deepenedBullets: overrides.deepenedBullets ?? 2,
      editedBullets: overrides.editedBullets ?? 0,
      failedBullets: overrides.failedBullets ?? 0,
    },
    progress: {
      bulk: {
        status: overrides.bulkStatus ?? 'idle',
        total: 2,
        completed: 2,
        failed: 0,
        failedBaseline: 0,
        currentBulletKey: null,
        lastUpdatedAt: null,
      },
      bullets: {},
    },
  }) as never

const createPrepDeck = (overrides = {}) =>
  ({
    id: 'prep-threatx',
    title: 'ThreatX prep',
    company: 'ThreatX',
    role: 'Senior Platform Engineer',
    pipelineEntryId: null,
    updatedAt: daysAgo(1),
    cards: [{ id: 'prep-card-1', title: 'Reliability story' }],
    ...overrides,
  }) as never

const resetStores = () => {
  cleanup()
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
  useMatchStore.setState({
    jobDescription: '',
    currentReport: null,
    warnings: [],
    history: [],
  })
  usePipelineStore.setState({
    entries: [],
    sortField: 'tier',
    sortDir: 'asc',
    filters: { tier: 'all', status: 'all', search: '' },
  })
  usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
  useCoverLetterStore.setState({ templates: [] })
  useLinkedInStore.setState({ drafts: [], selectedDraftId: null })
  useRecruiterStore.setState({ cards: [], selectedCardId: null })
  useDebriefStore.setState({ sessions: [], selectedSessionId: null })
}

describe('HomePage', () => {
  beforeEach(() => {
    localStorageItems.clear()
    installLocalStorageMock()
    window.localStorage.removeItem?.('facet-home-dismissed-notifications')
    resetStores()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the main workflow entry points', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { name: /choose the fastest starting point/i })).toBeTruthy()
    const startFromResumeLinks = screen.getAllByRole('link', { name: /start from resume/i })
    expect(startFromResumeLinks[0]?.getAttribute('href')).toBe('/identity')
    expect(
      screen.getAllByRole('link', { name: /start from job description/i })[0]?.getAttribute('href'),
    ).toBe('/match')
    expect(
      screen.getAllByRole('link', { name: /open resume builder/i })[0]?.getAttribute('href'),
    ).toBe('/build')
    expect(screen.queryByRole('heading', { name: /start something new/i })).toBeNull()
    const firstRunIcons = document.querySelectorAll('.home-first-run-card svg')
    expect(firstRunIcons.length).toBeGreaterThanOrEqual(3)
    firstRunIcons.forEach((icon) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true')
    })
    expect(screen.queryByText(/resume operating system/i)).toBeNull()
    expect(screen.queryByText(/the full loop, in order/i)).toBeNull()
  })

  it('hides first-run onboarding once the authenticated workspace has activity', () => {
    usePipelineStore.setState({
      entries: [createPipelineEntry()],
    })

    render(<HomePage />)

    expect(screen.queryByRole('heading', { name: /choose the fastest starting point/i })).toBeNull()
    expect(screen.getByRole('heading', { name: /start something new/i })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /review active opportunities/i }).getAttribute('href'),
    ).toBe('/pipeline')
  })

  it('offers an active work affordance when identity work is unfinished', () => {
    useIdentityStore.setState({
      sourceMaterial: 'Senior platform engineer resume text',
    })

    render(<HomePage />)

    expect(
      screen.getByRole('link', { name: /continue identity draft/i }).getAttribute('href'),
    ).toBe('/identity')
    expect(screen.getByText(/resume scanning, editing, or deepening the model/i)).toBeTruthy()
  })

  it('shows the pipeline as an actionable gateway', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry(),
        createPipelineEntry({
          id: 'pipe-applied',
          company: 'Linear',
          role: 'Infrastructure Lead',
          status: 'applied',
          nextStep: 'Waiting for response',
        }),
        createPipelineEntry({
          id: 'pipe-closed',
          company: 'OldCo',
          role: 'Staff Engineer',
          status: 'closed',
          nextStep: '',
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByRole('link', { name: /2 opportunities/i }).getAttribute('href')).toBe(
      '/pipeline',
    )
    expect(screen.getByText(/2 opportunities — 1 awaiting your action/i)).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: /senior platform engineer at threatx/i })
        .getAttribute('href'),
    ).toBe('/pipeline')
  })

  it('surfaces and dismisses time-sensitive interview notifications', () => {
    const scheduledFor = daysFromNow(2)
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-system-design',
              label: 'System design',
              format: 'system-design',
              scheduledFor,
              interviewers: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByText(/threatx interview/i)).toBeTruthy()
    expect(
      screen.getAllByText(/system design for senior platform engineer/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /^open$/i }).getAttribute('href')).toBe('/pipeline')

    fireEvent.click(screen.getByRole('button', { name: /dismiss threatx interview/i }))

    expect(screen.queryByText(/threatx interview/i)).toBeNull()
    expect(screen.getByText(/no time-sensitive notifications/i)).toBeTruthy()
  })

  it('persists dismissed notifications across remounts', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-hm',
              label: 'Hiring manager',
              format: 'hm-screen',
              scheduledFor: daysFromNow(1),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    const { unmount } = render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss threatx interview/i }))

    expect(window.localStorage.getItem('facet-home-dismissed-notifications')).toContain(
      'round-pipe-threatx-round-hm',
    )

    unmount()
    render(<HomePage />)

    expect(screen.queryByText(/threatx interview/i)).toBeNull()
    expect(screen.getByText(/no time-sensitive notifications/i)).toBeTruthy()
  })

  it('ignores corrupted dismissed-notification storage', () => {
    const payloads = [
      '{not json',
      JSON.stringify({ stale: true }),
      JSON.stringify([1, null, 'other-id']),
    ]

    for (const payload of payloads) {
      resetStores()
      localStorageItems.set('facet-home-dismissed-notifications', payload)
      usePipelineStore.setState({
        entries: [
          createPipelineEntry({
            interviewRounds: [
              {
                id: 'round-storage',
                label: 'Storage screen',
                format: 'hm-screen',
                scheduledFor: daysFromNow(1),
                interviewers: [],
                createdAt: daysAgo(1),
                updatedAt: daysAgo(1),
              },
            ],
          }),
        ],
      })

      render(<HomePage />)

      expect(screen.getByText(/threatx interview/i)).toBeTruthy()
    }

    resetStores()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new Error('blocked')
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    })
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-throw',
              label: 'Storage screen',
              format: 'hm-screen',
              scheduledFor: daysFromNow(1),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByText(/threatx interview/i)).toBeTruthy()
  })

  it('keeps dismissal usable when localStorage writes fail', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceeded')
        }),
        removeItem: vi.fn(),
      },
    })
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-private-mode',
              label: 'Screen',
              format: 'hm-screen',
              scheduledFor: daysFromNow(1),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss threatx interview/i }))

    expect(screen.queryByText(/threatx interview/i)).toBeNull()
  })

  it('surfaces stale saved JDs as actionable notifications', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          status: 'researching',
          jobDescription: 'Senior platform role JD',
          lastAction: daysAgo(6),
          createdAt: daysAgo(6),
          nextStep: '',
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByText(/threatx jd is waiting/i)).toBeTruthy()
    expect(
      screen.getByText(/saved role context has not been turned into a resume or prep action yet/i),
    ).toBeTruthy()
  })

  it('uses createdAt for stale JD detection when lastAction is empty', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          status: 'researching',
          jobDescription: 'Untouched JD',
          lastAction: '',
          createdAt: daysAgo(7),
          nextStep: '',
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByText(/threatx jd is waiting/i)).toBeTruthy()
  })

  it('filters passive pipeline next steps from awaiting-action and secondary cards', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          id: 'pipe-monitor',
          company: 'MonitorCo',
          role: 'Backend Engineer',
          status: 'applied',
          nextStep: 'Monitor responses',
        }),
        createPipelineEntry({
          id: 'pipe-none',
          company: 'NoneCo',
          role: 'API Engineer',
          status: 'applied',
          nextStep: 'none',
        }),
        createPipelineEntry({
          id: 'pipe-action',
          company: 'ActionCo',
          role: 'Infra Engineer',
          status: 'applied',
          nextStep: 'Prep panel story',
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getByText(/3 opportunities — 1 awaiting your action/i)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /infra engineer at actionco/i }).getAttribute('href'),
    ).toBe('/pipeline')
    expect(screen.queryByRole('link', { name: /backend engineer at monitorco/i })).toBeNull()
  })

  it('chooses the soonest unfinished scheduled interview round', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-past',
              label: 'Past screen',
              format: 'hm-screen',
              scheduledFor: daysAgo(1),
              interviewers: [],
              createdAt: daysAgo(3),
              updatedAt: daysAgo(3),
            },
            {
              id: 'round-complete',
              label: 'Completed screen',
              format: 'behavioral',
              scheduledFor: daysFromNow(1),
              outcome: 'completed',
              interviewers: [],
              createdAt: daysAgo(3),
              updatedAt: daysAgo(3),
            },
            {
              id: 'round-later',
              label: 'Later panel',
              format: 'peer-panel',
              scheduledFor: daysFromNow(5),
              interviewers: [],
              createdAt: daysAgo(3),
              updatedAt: daysAgo(3),
            },
            {
              id: 'round-soonest',
              label: 'HM screen',
              format: 'hm-screen',
              scheduledFor: daysFromNow(3),
              interviewers: [],
              createdAt: daysAgo(3),
              updatedAt: daysAgo(3),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.getAllByText(/hm screen for senior platform engineer/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/past screen for senior platform engineer/i)).toBeNull()
    expect(screen.queryByText(/completed screen for senior platform engineer/i)).toBeNull()
  })

  it('does not treat a completed identity model alone as active work', () => {
    useIdentityStore.setState({
      currentIdentity: {} as never,
    })

    render(<HomePage />)

    expect(screen.queryByRole('link', { name: /continue identity draft/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /choose the fastest starting point/i })).toBeNull()
    expect(screen.getByRole('heading', { name: /start something new/i })).toBeTruthy()
    expect(screen.getByText(/nothing in progress/i)).toBeTruthy()
  })

  it('only treats scans as active when scan work is unfinished', () => {
    for (const scanResult of [
      createScanResult({ bulkStatus: 'running' }),
      createScanResult({ failedBullets: 1 }),
      createScanResult({ extractedBullets: 3, deepenedBullets: 1, editedBullets: 1 }),
    ]) {
      resetStores()
      useIdentityStore.setState({
        intakeSources: [{ kind: 'resume', id: 'test-intake', scan: scanResult }],
      })
      render(<HomePage />)
      expect(screen.getByRole('link', { name: /continue identity draft/i })).toBeTruthy()
    }

    resetStores()
    useIdentityStore.setState({
      intakeSources: [{ kind: 'resume', id: 'test-intake', scan: createScanResult() }],
    })
    render(<HomePage />)

    expect(screen.queryByRole('link', { name: /continue identity draft/i })).toBeNull()
    expect(screen.getByText(/nothing in progress/i)).toBeTruthy()
  })

  it('uses the expected primary action priority for non-identity work', () => {
    const cases = [
      {
        setup: () => useMatchStore.setState({ jobDescription: 'Principal platform JD' }),
        name: /continue current job match/i,
        href: '/match',
      },
      {
        setup: () =>
          usePrepStore.setState({ decks: [createPrepDeck()], activeDeckId: 'prep-threatx' }),
        name: /prep: senior platform engineer/i,
        href: '/prep',
      },
      {
        setup: () => useCoverLetterStore.setState({ templates: [{} as never] }),
        name: /continue cover letter draft/i,
        href: '/letters',
      },
      {
        setup: () => useLinkedInStore.setState({ drafts: [{} as never], selectedDraftId: null }),
        name: /continue linkedin draft/i,
        href: '/linkedin',
      },
      {
        setup: () => useRecruiterStore.setState({ cards: [{} as never], selectedCardId: null }),
        name: /continue recruiter card/i,
        href: '/recruiter',
      },
      {
        setup: () => useDebriefStore.setState({ sessions: [{} as never], selectedSessionId: null }),
        name: /continue interview debrief/i,
        href: '/debrief',
      },
    ]

    for (const item of cases) {
      resetStores()
      item.setup()
      render(<HomePage />)
      expect(screen.getByRole('link', { name: item.name }).getAttribute('href')).toBe(item.href)
    }
  })

  it('does not notify on JDs that are not stale actionable work', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          id: 'pipe-generated',
          jobDescription: 'Already generated',
          resumeGeneration: {} as never,
          lastAction: daysAgo(8),
        }),
        createPipelineEntry({
          id: 'pipe-closed',
          status: 'closed',
          jobDescription: 'Closed role',
          lastAction: daysAgo(8),
        }),
        createPipelineEntry({
          id: 'pipe-recent',
          jobDescription: 'Recent role',
          lastAction: daysAgo(2),
        }),
        createPipelineEntry({
          id: 'pipe-empty',
          jobDescription: '',
          lastAction: daysAgo(8),
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.queryByText(/jd is waiting/i)).toBeNull()
    expect(screen.getByText(/no time-sensitive notifications/i)).toBeTruthy()
  })

  it('prunes dismissed notification ids when their signal disappears', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-prune',
              label: 'Screen',
              format: 'hm-screen',
              scheduledFor: daysFromNow(1),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    const { rerender } = render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss threatx interview/i }))
    expect(window.localStorage.getItem('facet-home-dismissed-notifications')).toContain(
      'round-pipe-threatx-round-prune',
    )

    usePipelineStore.setState({ entries: [] })
    rerender(<HomePage />)

    expect(window.localStorage.getItem('facet-home-dismissed-notifications')).not.toContain(
      'round-pipe-threatx-round-prune',
    )
  })

  it('honors the upcoming interview notification window', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          status: 'applied',
          nextStep: 'Waiting',
          interviewRounds: [
            {
              id: 'round-too-far',
              label: 'Far interview',
              format: 'hm-screen',
              scheduledFor: daysFromNow(20),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    const { rerender } = render(<HomePage />)

    expect(screen.queryByText(/threatx interview/i)).toBeNull()
    expect(screen.getByText(/no time-sensitive notifications/i)).toBeTruthy()

    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          status: 'applied',
          nextStep: 'Waiting',
          interviewRounds: [
            {
              id: 'round-in-window',
              label: 'Soon interview',
              format: 'hm-screen',
              scheduledFor: daysFromNow(13),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })
    rerender(<HomePage />)

    expect(screen.getByText(/threatx interview/i)).toBeTruthy()
  })

  it('falls back to readable round format labels', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-format',
              label: '   ',
              format: 'system-design',
              scheduledFor: daysFromNow(2),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    expect(
      screen.getAllByText(/system design for senior platform engineer/i).length,
    ).toBeGreaterThan(0)
  })

  it('ignores malformed dates when deriving notifications', () => {
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          status: 'researching',
          jobDescription: 'Malformed dates',
          lastAction: 'not-a-date',
          createdAt: 'also-not-a-date',
          nextStep: '',
          interviewRounds: [
            {
              id: 'round-bad-date',
              label: 'Bad date',
              format: 'hm-screen',
              scheduledFor: 'not-a-date',
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    render(<HomePage />)

    expect(screen.queryByText(/threatx interview/i)).toBeNull()
    expect(screen.queryByText(/jd is waiting/i)).toBeNull()
    expect(screen.getByText(/no time-sensitive notifications/i)).toBeTruthy()
  })

  it('refreshes notification eligibility while the page stays mounted', async () => {
    vi.useFakeTimers()
    try {
      const base = new Date('2026-01-10T12:00:00Z')
      vi.setSystemTime(base)
      usePipelineStore.setState({
        entries: [
          createPipelineEntry({
            status: 'researching',
            jobDescription: 'Nearly stale JD',
            lastAction: new Date(base.getTime() - 5 * 86_400_000 + 30 * 60_000).toISOString(),
            createdAt: new Date(base.getTime() - 5 * 86_400_000 + 30 * 60_000).toISOString(),
            nextStep: '',
          }),
        ],
      })

      render(<HomePage />)

      expect(screen.queryByText(/threatx jd is waiting/i)).toBeNull()

      await act(async () => {
        vi.advanceTimersByTime(31 * 60_000)
      })

      expect(screen.getByText(/threatx jd is waiting/i)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not duplicate prep cards when prep is already the primary action', () => {
    usePrepStore.setState({ decks: [createPrepDeck()], activeDeckId: 'prep-threatx' })

    render(<HomePage />)

    expect(
      screen.getByRole('link', { name: /prep: senior platform engineer/i }).getAttribute('href'),
    ).toBe('/prep')
    expect(screen.queryByText(/review prep cards/i)).toBeNull()
  })

  it('surfaces match output as a secondary action', () => {
    useMatchStore.setState({
      currentReport: {
        matchScore: 0.82,
        role: 'Senior Platform Engineer',
        company: 'ThreatX',
        warnings: [],
      } as never,
    })

    render(<HomePage />)

    expect(
      screen.getByRole('link', { name: /turn the match into an output/i }).getAttribute('href'),
    ).toBe('/letters')
  })

  it('surfaces prep cards as a secondary action when another workspace is primary', () => {
    useMatchStore.setState({ jobDescription: 'ThreatX senior platform JD' })
    usePrepStore.setState({ decks: [createPrepDeck()], activeDeckId: 'prep-threatx' })

    render(<HomePage />)

    expect(
      screen.getByRole('link', { name: /continue current job match/i }).getAttribute('href'),
    ).toBe('/match')
    expect(screen.getByRole('link', { name: /review prep cards/i }).getAttribute('href')).toBe(
      '/prep',
    )
  })

  it('caps active work at two cards', () => {
    useIdentityStore.setState({ sourceMaterial: 'Resume text' })
    usePipelineStore.setState({
      entries: [
        createPipelineEntry({
          interviewRounds: [
            {
              id: 'round-cap',
              label: 'Screen',
              format: 'hm-screen',
              scheduledFor: daysFromNow(2),
              interviewers: [],
              createdAt: daysAgo(1),
              updatedAt: daysAgo(1),
            },
          ],
        }),
      ],
    })

    const { container } = render(<HomePage />)

    expect(container.querySelectorAll('.home-work-card')).toHaveLength(2)
  })

  it('uses singular pipeline glance copy for one active opportunity', () => {
    usePipelineStore.setState({ entries: [createPipelineEntry({ nextStep: 'Prep story' })] })

    render(<HomePage />)

    expect(screen.getByText(/1 opportunity — 1 awaiting your action/i)).toBeTruthy()
  })

  it('clears the notification refresh interval on unmount', () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    try {
      const { unmount } = render(<HomePage />)
      unmount()
      expect(clearIntervalSpy).toHaveBeenCalled()
    } finally {
      clearIntervalSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
