import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  IDENTITY_STORE_STORAGE_KEY,
  getActiveResumeScan,
  useIdentityStore,
} from '../store/identityStore'
import type { IntakeSource } from '../types/identity'
import { resolveStorage } from '../store/storage'
import type { ResumeScanBulkProgress, ResumeScanResult } from '../types/identity'
import { parseDeepenIdentityBulletResponse } from '../utils/identityExtraction'
import { findStaleArtifacts } from '../types/artifactMeta'

const createScanResult = (): ResumeScanResult => {
  const identity = cloneIdentityFixture()
  identity.roles[0].bullets[0].problem = ''
  identity.roles[0].bullets[0].action = ''
  identity.roles[0].bullets[0].outcome = ''
  identity.roles[0].bullets[0].impact = []
  identity.roles[0].bullets[0].metrics = {}
  identity.roles[0].bullets[0].technologies = []
  identity.roles[0].bullets[0].source_text =
    'Ported the platform to Kubernetes-based installs for on-prem customers.'
  identity.projects = [
    {
      id: 'facet',
      name: 'Facet',
      description: 'Vector-based job search platform.',
      url: 'https://facet.test',
      tags: [],
    },
  ]

  return {
    fileName: 'resume.pdf',
    pageCount: 1,
    scannedAt: '2026-04-05T00:00:00.000Z',
    rawText: 'Alex Example\nContoso Networks',
    identity,
    warnings: [],
    counts: {
      roles: 1,
      bullets: 1,
      projects: 1,
      skillGroups: 1,
      education: 0,
      extractedBullets: 1,
      decomposedBullets: 0,
      scannedBullets: 1,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    },
    layout: 'single-column' as const,
    progress: {
      bullets: {},
      bulk: {
        status: 'idle' as const,
        total: 0,
        completed: 0,
        currentBulletKey: null,
        lastUpdatedAt: null,
      },
    },
  }
}

const createMultiBulletScanResult = () => {
  const scanResult = createScanResult()
  const baseBullet = scanResult.identity.roles[0]!.bullets[0]!

  scanResult.identity.roles = [
    {
      ...scanResult.identity.roles[0]!,
      bullets: [
        {
          ...baseBullet,
          id: 'platform-migration',
          problem: '',
          action: '',
          outcome: '',
          impact: [],
          metrics: {},
          technologies: [],
          source_text: 'Ported the platform to Kubernetes-based installs.',
        },
        {
          ...baseBullet,
          id: 'observability-rollout',
          problem: '',
          action: '',
          outcome: '',
          impact: [],
          metrics: {},
          technologies: [],
          source_text: 'Rolled out Grafana dashboards for platform teams.',
        },
      ],
    },
    {
      id: 'northwind',
      company: 'Northwind Labs',
      title: 'Platform Engineer',
      dates: '2023-2025',
      bullets: [
        {
          ...baseBullet,
          id: 'release-automation',
          problem: '',
          action: '',
          outcome: '',
          impact: [],
          metrics: {},
          technologies: [],
          source_text: 'Built release automation for service teams.',
        },
      ],
    },
  ]

  return scanResult
}

const createDeepenedBullet = (roleId = 'contoso', bulletId = 'platform-migration') => ({
  summary: 'Deepened the migration bullet.',
  roleId,
  bulletId,
  bullet: {
    id: bulletId,
    problem: 'Cloud-only delivery blocked on-prem installs.',
    action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
    outcome: 'Made the product deployable in customer environments.',
    impact: ['Unlocked customer-hosted deployments'],
    metrics: { installs: 12 },
    technologies: ['Kubernetes'],
    source_text: 'ignored',
    tags: ['platform', 'kubernetes'],
  },
  rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
  assumptions: [],
  warnings: [],
})

const readPersistedIdentityState = async () => {
  const persisted = await resolveStorage().getItem(IDENTITY_STORE_STORAGE_KEY)
  expect(persisted).toEqual(expect.any(String))
  return JSON.parse(persisted ?? '{}') as {
    state: {
      intakeMode?: string
      sourceMaterial?: string
      correctionNotes?: string
      draft?: unknown
      draftDocument?: string
      intakeSources?: IntakeSource[]
      warnings?: string[]
      mapSelection?: unknown
    }
    version: number
  }
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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('identityStore scan progress', () => {
  it('initializes persisted scan progress when a scan result is loaded', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bullets['contoso::platform-migration']).toMatchObject({
      status: 'idle',
      confidence: 'stated',
      lastError: null,
    })
    expect(state?.counts).toMatchObject({
      scannedBullets: 1,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    })
  })

  it('keeps scan count keys in primary-then-derived order for debugging', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    expect(Object.keys(getActiveResumeScan(useIdentityStore.getState())?.counts ?? {})).toEqual([
      'roles',
      'bullets',
      'projects',
      'skillGroups',
      'education',
      'extractedBullets',
      'decomposedBullets',
      'scannedBullets',
      'deepenedBullets',
      'editedBullets',
      'failedBullets',
    ])
  })

  it('initializes scan progress for every role and bullet when a multi-role result is loaded', () => {
    useIdentityStore.getState().setScanResult(createMultiBulletScanResult())

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(Object.keys(state?.progress.bullets ?? {}).sort()).toEqual([
      'contoso::observability-rollout',
      'contoso::platform-migration',
      'northwind::release-automation',
    ])
    expect(state?.progress.bullets).toMatchObject({
      'contoso::platform-migration': {
        status: 'idle',
        confidence: 'stated',
        lastError: null,
      },
      'contoso::observability-rollout': {
        status: 'idle',
        confidence: 'stated',
        lastError: null,
      },
      'northwind::release-automation': {
        status: 'idle',
        confidence: 'stated',
        lastError: null,
      },
    })
    expect(state?.progress.bulk).toMatchObject({
      status: 'idle',
      total: 3,
      completed: 0,
      currentBulletKey: null,
    })
    expect(state?.counts).toMatchObject({
      roles: 2,
      bullets: 3,
      extractedBullets: 3,
      scannedBullets: 3,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    })
  })

  it('clamps stale persisted bulk completion counts to the current scan total', () => {
    const scanResult = createScanResult()
    scanResult.progress.bulk = {
      status: 'running',
      total: 99,
      completed: 99,
      currentBulletKey: 'contoso::platform-migration',
      lastUpdatedAt: '2026-04-05T00:00:00.000Z',
    } satisfies ResumeScanBulkProgress

    useIdentityStore.getState().setScanResult(scanResult)

    expect(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk).toMatchObject({
      status: 'running',
      total: 1,
      completed: 1,
      currentBulletKey: 'contoso::platform-migration',
    })
  })

  it('normalizes numeric schema_revision values during live scan ingestion', () => {
    const scanResult = createScanResult()
    ;(scanResult.identity as { schema_revision: string | number }).schema_revision = 3.1

    useIdentityStore.getState().setScanResult(scanResult)

    const storedIdentity = getActiveResumeScan(useIdentityStore.getState())?.identity
    expect(storedIdentity?.schema_revision).toBe('3.1')

    expect(() =>
      parseDeepenIdentityBulletResponse(
        JSON.stringify({
          summary: 'Deepened the migration bullet.',
          bullet: {
            role_id: 'contoso',
            bullet_id: 'platform-migration',
            problem: 'Cloud-only delivery blocked on-prem installs.',
            action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
            outcome: 'Made the product deployable in customer environments.',
            impact: ['Unlocked customer-hosted deployments'],
            metrics: { installs: 12 },
            technologies: ['Kubernetes'],
            tags: ['platform', 'kubernetes'],
            rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
          },
        }),
        storedIdentity!,
      ),
    ).not.toThrow()
  })

  it('normalizes numeric schema_revision values when a stale scan identity is edited in place', () => {
    const scanResult = createScanResult()
    ;(scanResult.identity as { schema_revision: string | number }).schema_revision = 3.1

    useIdentityStore.setState({
      intakeSources: [{ kind: 'resume', id: 'test-intake', scan: scanResult }],
      draftDocument: '',
      draft: null,
      warnings: [],
      lastError: null,
    })

    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Facet OSS')

    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.schema_revision).toBe('3.1')
  })

  it('marks a scanned bullet as deepened and updates counts', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    const beforeBullets = getActiveResumeScan(useIdentityStore.getState())!.progress.bullets
    useIdentityStore.getState().completeScannedBulletDeepen({
      ...createDeepenedBullet(),
      warnings: ['Normalized test warning.'],
    })

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bullets).not.toBe(beforeBullets)
    expect(beforeBullets['contoso::platform-migration']?.status).toBe('idle')
    expect(state?.progress.bullets['contoso::platform-migration']).toMatchObject({
      status: 'completed',
      confidence: 'guessing',
      lastError: null,
    })
    expect(state?.counts).toMatchObject({
      scannedBullets: 0,
      deepenedBullets: 1,
      editedBullets: 0,
      failedBullets: 0,
      decomposedBullets: 1,
    })
    expect(state?.identity.roles[0]?.bullets[0]?.source_text).toBe(
      'Ported the platform to Kubernetes-based installs for on-prem customers.',
    )
    expect(useIdentityStore.getState().warnings).toContain('Normalized test warning.')
  })

  it('normalizes numeric schema_revision values when completing deepen against stale scan state', () => {
    const scanResult = createScanResult()
    ;(scanResult.identity as { schema_revision: string | number }).schema_revision = 3.1

    useIdentityStore.setState({
      intakeSources: [{ kind: 'resume', id: 'test-intake', scan: scanResult }],
      draftDocument: '',
      draft: null,
      warnings: [],
      lastError: null,
    })

    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())

    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.schema_revision).toBe('3.1')
  })

  it('updates scanned project fields and keeps project counts in sync', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Facet OSS')
    useIdentityStore
      .getState()
      .updateScannedProjectEntry(
        0,
        'description',
        'Targeted resume generation and pipeline tracking.',
      )
    useIdentityStore.getState().updateScannedProjectEntry(0, 'url', 'https://facet.example.dev')

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.identity.projects[0]).toMatchObject({
      name: 'Facet OSS',
      description: 'Targeted resume generation and pipeline tracking.',
      url: 'https://facet.example.dev',
    })
    expect(state?.counts.projects).toBe(1)
  })

  it('normalizes cleared scanned project urls back to undefined', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().updateScannedProjectEntry(0, 'url', '   ')

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.identity.projects[0]?.url).toBeUndefined()
  })

  it('updates scanned education fields and normalizes cleared optional years', () => {
    const scanResult = createScanResult()
    scanResult.identity.education = [
      {
        school: 'State University',
        location: 'Ann Arbor, MI',
        degree: 'BS Computer Science',
        year: '2014',
      },
    ]

    useIdentityStore.getState().setScanResult(scanResult)
    useIdentityStore.getState().updateScannedEducationEntry(0, 'school', 'State Tech')
    useIdentityStore.getState().updateScannedEducationEntry(0, 'degree', 'BS Computer Engineering')
    useIdentityStore.getState().updateScannedEducationEntry(0, 'location', 'Detroit, MI')
    useIdentityStore.getState().updateScannedEducationEntry(0, 'year', '   ')

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.identity.education[0]).toEqual({
      school: 'State Tech',
      location: 'Detroit, MI',
      degree: 'BS Computer Engineering',
    })
    expect(state?.counts.education).toBe(1)
  })

  it('preserves whitespace-only required scanned education fields', () => {
    const scanResult = createScanResult()
    scanResult.identity.education = [
      {
        school: 'State University',
        location: 'Ann Arbor, MI',
        degree: 'BS Computer Science',
        year: '2014',
      },
    ]

    useIdentityStore.getState().setScanResult(scanResult)
    useIdentityStore.getState().updateScannedEducationEntry(0, 'school', '   ')
    useIdentityStore.getState().updateScannedEducationEntry(0, 'degree', '  ')

    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.education[0]).toMatchObject({
      school: '   ',
      degree: '  ',
      year: '2014',
    })
  })

  it('keeps scanned education unchanged when updates target an out-of-bounds index', () => {
    const scanResult = createScanResult()
    scanResult.identity.education = [
      {
        school: 'State University',
        location: 'Ann Arbor, MI',
        degree: 'BS Computer Science',
        year: '2014',
      },
    ]
    useIdentityStore.getState().setScanResult(scanResult)

    const before = structuredClone(getActiveResumeScan(useIdentityStore.getState()))
    expect(() => {
      useIdentityStore.getState().updateScannedEducationEntry(99, 'school', 'Corrupted School')
    }).not.toThrow()

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.identity.education).toEqual(before?.identity.education)
    expect(state?.counts.education).toBe(1)
  })

  it('keeps scanned projects unchanged when updates target an out-of-bounds index', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    const before = structuredClone(getActiveResumeScan(useIdentityStore.getState()))
    expect(() => {
      useIdentityStore.getState().updateScannedProjectEntry(99, 'name', 'Corrupted Project')
    }).not.toThrow()

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.identity.projects).toEqual(before?.identity.projects)
    expect(state?.counts.projects).toBe(1)
  })

  it('records scanned bullet failure state before any later overwrite', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    useIdentityStore
      .getState()
      .failScannedBulletDeepen('contoso', 'platform-migration', 'Timed out while deepening.')

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bullets['contoso::platform-migration']).toMatchObject({
      status: 'failed',
      confidence: 'stated',
      lastError: 'Timed out while deepening.',
    })
    expect(state?.counts).toMatchObject({
      scannedBullets: 0,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 1,
    })
  })

  it('leaves existing scan state unchanged when completing a missing role or bullet', () => {
    const cases = [
      createDeepenedBullet('missing-role', 'platform-migration'),
      createDeepenedBullet('contoso', 'missing-bullet'),
    ]
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    for (const deepenResult of cases) {
      useIdentityStore.getState().setScanResult(createScanResult())
      const before = structuredClone(getActiveResumeScan(useIdentityStore.getState()))
      const beforeWarnings = [...useIdentityStore.getState().warnings]
      const beforeDraftDocument = useIdentityStore.getState().draftDocument

      expect(() => {
        useIdentityStore.getState().completeScannedBulletDeepen({
          ...deepenResult,
          warnings: ['Stale warning.'],
        })
      }, `${deepenResult.roleId}::${deepenResult.bulletId}`).not.toThrow()

      const state = getActiveResumeScan(useIdentityStore.getState())
      expect(state?.identity).toEqual(before?.identity)
      expect(state?.progress.bullets).toEqual(before?.progress.bullets)
      expect(state?.counts).toEqual(before?.counts)
      expect(Object.keys(state?.progress.bullets ?? [])).toEqual(['contoso::platform-migration'])
      expect(useIdentityStore.getState().warnings).toEqual(beforeWarnings)
      expect(useIdentityStore.getState().draftDocument).toBe(beforeDraftDocument)
    }

    expect(warnSpy).toHaveBeenCalledTimes(cases.length)
  })

  it('does not advance running bulk progress when completing a missing role or bullet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T00:00:00.000Z'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    const beforeBulk = structuredClone(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk)

    vi.setSystemTime(new Date('2026-04-05T00:00:01.000Z'))
    useIdentityStore
      .getState()
      .completeScannedBulletDeepen(createDeepenedBullet('missing-role', 'platform-migration'))

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(beforeBulk).toMatchObject({
      status: 'running',
      completed: 0,
      lastUpdatedAt: '2026-04-05T00:00:00.000Z',
    })
    expect(state?.progress.bulk).toEqual(beforeBulk)
    expect(state?.counts).toMatchObject({
      scannedBullets: 1,
      deepenedBullets: 0,
      failedBullets: 0,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      'Dropped scanned bullet deepen completion for missing bullet.',
      {
        roleId: 'missing-role',
        bulletId: 'platform-migration',
      },
    )
  })

  it('caps successful running bulk completion at the bulk total', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T00:00:00.000Z'))
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    const scanResult = getActiveResumeScan(useIdentityStore.getState())!
    useIdentityStore.setState({
      intakeSources: [
        {
          kind: 'resume',
          id: 'test-intake',
          scan: {
            ...scanResult,
            progress: {
              ...scanResult.progress,
              bulk: {
                ...scanResult.progress.bulk,
                completed: scanResult.progress.bulk.total,
              },
            },
          },
        },
      ],
    })

    vi.setSystemTime(new Date('2026-04-05T00:00:01.000Z'))
    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())

    expect(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk).toMatchObject({
      status: 'running',
      total: 1,
      completed: 1,
      lastUpdatedAt: '2026-04-05T00:00:01.000Z',
    })
  })

  it('preserves non-running bulk progress when completing a missing role or bullet', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cases = [
      {
        label: 'idle bulk',
        prepare: () => {
          useIdentityStore.getState().setScanResult(createScanResult())
        },
      },
      {
        label: 'cancelling bulk',
        prepare: () => {
          useIdentityStore.getState().setScanResult(createScanResult())
          useIdentityStore.getState().startScanBulkDeepen()
          useIdentityStore.getState().requestCancelScanBulkDeepen()
        },
      },
    ]

    for (const testCase of cases) {
      testCase.prepare()
      const beforeBulk = structuredClone(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk)

      useIdentityStore
        .getState()
        .completeScannedBulletDeepen(createDeepenedBullet('missing-role', 'platform-migration'))

      expect(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk, testCase.label).toEqual(
        beforeBulk,
      )
    }
  })

  it('advances running bulk progress when a scanned bullet completes successfully', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T00:00:00.000Z'))
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    const beforeBulk = getActiveResumeScan(useIdentityStore.getState())?.progress.bulk

    vi.setSystemTime(new Date('2026-04-05T00:00:01.000Z'))
    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(beforeBulk).toMatchObject({
      status: 'running',
      completed: 0,
      lastUpdatedAt: '2026-04-05T00:00:00.000Z',
    })
    expect(state?.progress.bulk).toMatchObject({
      status: 'running',
      total: 1,
      completed: 1,
      currentBulletKey: null,
      lastUpdatedAt: '2026-04-05T00:00:01.000Z',
    })
  })

  it('does not double-count duplicate successful completions for the same bullet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T00:00:00.000Z'))
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())

    vi.setSystemTime(new Date('2026-04-05T00:00:01.000Z'))
    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())

    expect(getActiveResumeScan(useIdentityStore.getState())?.progress.bulk).toMatchObject({
      status: 'running',
      total: 1,
      completed: 1,
      lastUpdatedAt: '2026-04-05T00:00:00.000Z',
    })
  })

  it('tracks bulk deepen running progress and cancellation before finish', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    useIdentityStore.getState().startScanBulkDeepen()
    let state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bulk).toMatchObject({
      status: 'running',
      total: 1,
      completed: 0,
      currentBulletKey: null,
    })
    expect(state?.progress.bulk.lastUpdatedAt).toEqual(expect.any(String))

    useIdentityStore.getState().updateScanBulkProgress('contoso::platform-migration')
    state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bulk).toMatchObject({
      status: 'running',
      completed: 0,
      currentBulletKey: 'contoso::platform-migration',
    })

    useIdentityStore.getState().requestCancelScanBulkDeepen()
    state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bulk).toMatchObject({
      status: 'cancelling',
      currentBulletKey: 'contoso::platform-migration',
    })

    useIdentityStore.getState().finishScanBulkDeepen()
    state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bulk).toMatchObject({
      status: 'idle',
      completed: 0,
      currentBulletKey: null,
    })
  })

  it('persists the cancellation intermediate state until finish resets bulk progress', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T00:00:00.000Z'))
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    useIdentityStore.getState().updateScanBulkProgress('contoso::platform-migration')

    vi.setSystemTime(new Date('2026-04-05T00:00:01.000Z'))
    useIdentityStore.getState().requestCancelScanBulkDeepen()

    let persisted = await readPersistedIdentityState()
    expect(persisted.state.intakeSources?.[0]?.kind === 'resume' ? persisted.state.intakeSources[0].scan.progress.bulk : undefined).toMatchObject({
      status: 'cancelling',
      completed: 0,
      currentBulletKey: 'contoso::platform-migration',
      lastUpdatedAt: '2026-04-05T00:00:01.000Z',
    })

    vi.setSystemTime(new Date('2026-04-05T00:00:02.000Z'))
    useIdentityStore.getState().finishScanBulkDeepen()

    persisted = await readPersistedIdentityState()
    expect(persisted.state.intakeSources?.[0]?.kind === 'resume' ? persisted.state.intakeSources[0].scan.progress.bulk : undefined).toMatchObject({
      status: 'idle',
      completed: 0,
      currentBulletKey: null,
      lastUpdatedAt: '2026-04-05T00:00:02.000Z',
    })
  })

  it('clears scan result state and persists the reset storage shape', async () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().clearScanResult()

    let persisted = await readPersistedIdentityState()
    expect(getActiveResumeScan(useIdentityStore.getState())).toBeNull()
    expect(useIdentityStore.getState().draftDocument).toBe('')
    expect(useIdentityStore.getState().warnings).toEqual([])
    expect(persisted).toMatchObject({
      version: 5,
      state: {
        intakeSources: [],
        draftDocument: '',
        warnings: [],
      },
    })

    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().setScanResult(null)

    persisted = await readPersistedIdentityState()
    expect(getActiveResumeScan(useIdentityStore.getState())).toBeNull()
    expect(useIdentityStore.getState().draftDocument).toBe('')
    expect(useIdentityStore.getState().warnings).toEqual([])
    expect(persisted).toMatchObject({
      version: 5,
      state: {
        intakeSources: [],
        draftDocument: '',
        warnings: [],
      },
    })
  })

  it('keeps mixed multi-bullet scan counts consistent across deepen fail and edit states', () => {
    useIdentityStore.getState().setScanResult(createMultiBulletScanResult())

    useIdentityStore.getState().completeScannedBulletDeepen(createDeepenedBullet())
    useIdentityStore
      .getState()
      .failScannedBulletDeepen(
        'contoso',
        'observability-rollout',
        'Could not infer enough evidence.',
      )
    useIdentityStore.getState().markScannedBulletEdited('northwind', 'release-automation')

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bullets['contoso::platform-migration']?.status).toBe('completed')
    expect(state?.progress.bullets['contoso::observability-rollout']).toMatchObject({
      status: 'failed',
      lastError: 'Could not infer enough evidence.',
    })
    expect(state?.progress.bullets['northwind::release-automation']?.status).toBe('edited')
    expect(state?.counts).toMatchObject({
      roles: 2,
      bullets: 3,
      extractedBullets: 3,
      scannedBullets: 0,
      deepenedBullets: 1,
      editedBullets: 1,
      failedBullets: 1,
    })
  })

  it('tracks failure, edit, and bulk cancellation state without clearing completed work', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    useIdentityStore.getState().updateScanBulkProgress('contoso::platform-migration')
    useIdentityStore
      .getState()
      .failScannedBulletDeepen('contoso', 'platform-migration', 'Timed out while deepening.')
    useIdentityStore.getState().markScannedBulletEdited('contoso', 'platform-migration')
    useIdentityStore.getState().requestCancelScanBulkDeepen()
    useIdentityStore.getState().finishScanBulkDeepen()

    const state = getActiveResumeScan(useIdentityStore.getState())
    expect(state?.progress.bullets['contoso::platform-migration']).toMatchObject({
      status: 'edited',
      confidence: 'corrected',
    })
    expect(state?.progress.bulk).toMatchObject({
      status: 'idle',
      currentBulletKey: null,
    })
    expect(state?.counts).toMatchObject({
      editedBullets: 1,
      failedBullets: 0,
    })
  })
})

describe('identityStore non-scan field setters', () => {
  it('updates intake source fields directly', async () => {
    useIdentityStore.getState().setIntakeMode('paste')
    useIdentityStore.getState().setSourceMaterial('Resume pasted from source.')
    useIdentityStore.getState().setCorrectionNotes('Keep platform/security emphasis.')

    expect(useIdentityStore.getState()).toMatchObject({
      intakeMode: 'paste',
      sourceMaterial: 'Resume pasted from source.',
      correctionNotes: 'Keep platform/security emphasis.',
    })

    const persisted = await readPersistedIdentityState()
    expect(persisted.state).toMatchObject({
      intakeMode: 'paste',
      sourceMaterial: 'Resume pasted from source.',
      correctionNotes: 'Keep platform/security emphasis.',
    })
  })

  it('validates map selections without persisting UI ephemera', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({ currentIdentity: identity })

    useIdentityStore.getState().setMapSelection({ type: 'role', id: 'contoso' })

    expect(useIdentityStore.getState().mapSelection).toEqual({ type: 'role', id: 'contoso' })

    const persisted = await readPersistedIdentityState()
    expect(persisted.state).not.toHaveProperty('mapSelection')

    useIdentityStore.getState().setMapSelection({ type: 'role', id: 'missing-role' })
    expect(useIdentityStore.getState().mapSelection).toBeNull()

    useIdentityStore.getState().setMapSelection(null)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('updates and clears draft/error fields directly', () => {
    const identity = cloneIdentityFixture()

    useIdentityStore.getState().setDraft({
      generatedAt: '2026-04-05T00:00:00.000Z',
      summary: 'Generated identity draft.',
      followUpQuestions: ['Which platform migration had the largest impact?'],
      identity,
      bullets: [],
      warnings: ['Needs metric follow-up.'],
    })
    useIdentityStore.getState().setDraftDocument('manual draft edits')
    useIdentityStore.setState({ lastError: 'Temporary import failure.' })
    useIdentityStore.getState().clearLastError()

    expect(useIdentityStore.getState()).toMatchObject({
      draftDocument: 'manual draft edits',
      warnings: ['Needs metric follow-up.'],
      lastError: null,
    })

    useIdentityStore.setState({ lastError: 'Draft parse failed.' })
    useIdentityStore.getState().clearDraft()

    expect(useIdentityStore.getState()).toMatchObject({
      draft: null,
      draftDocument: '',
      lastError: null,
    })
  })
})

describe('identityStore skill enrichment', () => {
  const createIdentity = () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [
          { name: 'Kubernetes', tags: ['platform', 'kubernetes'] },
          {
            name: 'Terraform',
            tags: ['platform', 'iac'],
            context: 'Provisioned cloud and on-prem infrastructure.',
            positioning: 'Infrastructure as code and platform automation.',
          },
        ],
      },
    ]
    return identity
  }

  it('normalizes numeric schema_revision values when setting a draft directly', () => {
    const draftIdentity = createIdentity()
    ;(draftIdentity as { schema_revision: string | number }).schema_revision = 3.1

    useIdentityStore.getState().setDraft({
      generatedAt: '2026-04-05T00:00:00.000Z',
      summary: 'Draft summary',
      followUpQuestions: [],
      identity: draftIdentity,
      bullets: [],
      warnings: [],
    })

    expect(useIdentityStore.getState().draft?.identity.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().draftDocument).toContain('"schema_revision": "3.1"')
  })

  it('normalizes numeric schema_revision values when current identity updates run on stale state', () => {
    const staleIdentity = createIdentity()
    ;(staleIdentity as { schema_revision: string | number }).schema_revision = 3.1

    useIdentityStore.setState({
      currentIdentity: staleIdentity,
      draftDocument: '',
      draft: null,
    })

    useIdentityStore.getState().updateCurrentWorkModel({
      preference: 'hybrid',
    })

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().currentIdentity?.preferences.work_model).toEqual({
      preference: 'hybrid',
    })
  })

  it('saves manual enrichment and updates the draft document when no draft is active', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draftDocument: '',
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Kubernetes',
      {
        depth: 'strong',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'user',
    })
    expect(skill?.enriched_at).toBeTruthy()
    expect(skill?.skipped_at).toBeUndefined()
    expect(useIdentityStore.getState().draftDocument).toContain('"Kubernetes"')
  })

  it('stores optional enrichment fields as undefined when a depth-only review is saved', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draftDocument: '',
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Kubernetes',
      {
        depth: 'working',
        context: '   ',
        positioning: '   ',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'working',
      context: undefined,
      positioning: undefined,
      context_stale: undefined,
      positioning_stale: undefined,
    })
  })

  it('stores llm-accepted and user-edited-llm enrichment sources', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Kubernetes',
      {
        depth: 'strong',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
      },
      'llm-accepted',
    )
    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Terraform',
      {
        depth: 'working',
        context: 'Provisioned cloud and on-prem infrastructure.',
        positioning: 'Infrastructure as code and platform automation.',
      },
      'user-edited-llm',
    )

    const items = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items ?? []
    expect(items[0]?.enriched_by).toBe('llm-accepted')
    expect(items[1]?.enriched_by).toBe('user-edited-llm')
  })

  it('persists stale flags when depth changes invalidate optional fields', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Terraform',
      {
        depth: 'working',
        context: 'Provisioned cloud and on-prem infrastructure.',
        positioning: 'Infrastructure as code and platform automation.',
        contextStale: true,
        positioningStale: true,
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(skill).toMatchObject({
      depth: 'working',
      context_stale: true,
      positioning_stale: true,
    })
  })

  it('marks a skill skipped without clearing any existing enrichment fields', () => {
    const identity = createIdentity()
    identity.skills.groups[0]!.items[1]!.depth = 'working'
    useIdentityStore.setState({
      currentIdentity: identity,
    })

    useIdentityStore.getState().skipSkillEnrichment('platform', 'Terraform')

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(skill?.depth).toBe('working')
    expect(skill?.context).toBe('Provisioned cloud and on-prem infrastructure.')
    expect(skill?.positioning).toBe('Infrastructure as code and platform automation.')
    expect(skill?.skipped_at).toBeTruthy()
  })

  it('clears skipped_at when a skipped skill is saved again', () => {
    const identity = createIdentity()
    identity.skills.groups[0]!.items[0]!.skipped_at = '2026-04-08T00:00:00.000Z'
    useIdentityStore.setState({
      currentIdentity: identity,
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Kubernetes',
      {
        depth: 'strong',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill?.skipped_at).toBeUndefined()
  })

  it('matches enrichment updates case-insensitively within the same group', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'kubernetes',
      {
        depth: 'strong',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      name: 'Kubernetes',
      depth: 'strong',
      enriched_by: 'user',
    })
  })

  it('adds and removes skills on the current identity', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draftDocument: '',
    })

    useIdentityStore.getState().addSkillToCurrentIdentity('platform', 'Docker')
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[2]).toMatchObject({
      name: 'Docker',
      tags: [],
    })

    useIdentityStore.getState().removeSkillFromCurrentIdentity('platform', 'Docker')
    expect(
      useIdentityStore
        .getState()
        .currentIdentity?.skills.groups[0]?.items.some((skill) => skill.name === 'Docker'),
    ).toBe(false)
  })

  it('does not add duplicate skills within the same group', () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draftDocument: '',
    })

    useIdentityStore.getState().addSkillToCurrentIdentity('platform', 'kubernetes')

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(2)
  })

  it('rehydrates persisted enrichment state from storage', async () => {
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
    })

    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Kubernetes',
      {
        depth: 'strong',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const persisted = await resolveStorage().getItem('facet-identity-workspace')
    expect(persisted).toContain('"Kubernetes"')

    useIdentityStore.setState({
      currentIdentity: null,
      draftDocument: '',
    })
    await resolveStorage().setItem('facet-identity-workspace', persisted ?? '')

    await useIdentityStore.persist.rehydrate()

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'strong',
      positioning: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'user',
    })
  })

  it('migrates legacy search_signal enrichment data into positioning on rehydrate', async () => {
    const legacyIdentity = createIdentity()
    const legacySkill = legacyIdentity.skills.groups[0]!
      .items[0] as (typeof legacyIdentity.skills.groups)[0]['items'][number] & {
      search_signal?: string
    }
    legacySkill.search_signal = 'Legacy positioning copy.'

    useIdentityStore.setState({
      currentIdentity: null,
      draftDocument: '',
    })

    await resolveStorage().setItem(
      'facet-identity-workspace',
      JSON.stringify({
        state: {
          intakeMode: 'upload',
          sourceMaterial: '',
          correctionNotes: '',
          currentIdentity: legacyIdentity,
          draft: null,
          draftDocument: '',
          intakeSources: [],
          warnings: [],
          changelog: [],
        },
        version: 4,
      }),
    )

    await useIdentityStore.persist.rehydrate()

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill?.positioning).toBe('Legacy positioning copy.')
    expect(useIdentityStore.getState().draftDocument).toContain(
      '"positioning": "Legacy positioning copy."',
    )
  })

  it('refreshes draftDocument when a persisted draft still uses search_signal', async () => {
    const legacyDraftIdentity = createIdentity()
    const legacyDraftSkill = legacyDraftIdentity.skills.groups[0]!
      .items[0] as (typeof legacyDraftIdentity.skills.groups)[0]['items'][number] & {
      search_signal?: string
    }
    legacyDraftSkill.search_signal = 'Legacy draft positioning.'

    useIdentityStore.setState({
      currentIdentity: null,
      draft: null,
      draftDocument: '',
    })

    await resolveStorage().setItem(
      'facet-identity-workspace',
      JSON.stringify({
        state: {
          intakeMode: 'upload',
          sourceMaterial: '',
          correctionNotes: '',
          currentIdentity: null,
          draft: {
            generatedAt: '2026-04-12T15:00:00.000Z',
            summary: 'Draft summary',
            followUpQuestions: [],
            identity: legacyDraftIdentity,
            bullets: [],
            warnings: [],
          },
          draftDocument: JSON.stringify(legacyDraftIdentity, null, 2),
          intakeSources: [],
          warnings: [],
          changelog: [],
        },
        version: 4,
      }),
    )

    await useIdentityStore.persist.rehydrate()

    expect(
      useIdentityStore.getState().draft?.identity.skills.groups[0]?.items[0]?.positioning,
    ).toBe('Legacy draft positioning.')
    expect(useIdentityStore.getState().draftDocument).toContain(
      '"positioning": "Legacy draft positioning."',
    )
    expect(useIdentityStore.getState().draftDocument).not.toContain('"search_signal"')
  })

  it('normalizes persisted numeric schema_revision values on rehydrate from legacy v3 state', async () => {
    // Hand-craft a v3-shape persisted state with legacy `scanResult` field; verifies both
    // the scanResult -> intakeSources shape migration and schema_revision normalization.
    const currentIdentity = createIdentity()
    ;(currentIdentity as { schema_revision: string | number }).schema_revision = 3.1
    const draftIdentity = createIdentity()
    ;(draftIdentity as { schema_revision: string | number }).schema_revision = 3.1
    const legacyScan = createScanResult()
    ;(legacyScan.identity as { schema_revision: string | number }).schema_revision = 3.1

    // Clear in-memory state BEFORE writing the storage envelope so the auto-write
    // from setState doesn't overwrite the hand-crafted v3 state we're about to load.
    useIdentityStore.setState({
      currentIdentity: null,
      draft: null,
      intakeSources: [],
      draftDocument: '',
    })

    const v3Persisted = {
      state: {
        currentIdentity,
        draft: {
          generatedAt: '2026-04-05T00:00:00.000Z',
          summary: 'Draft summary',
          followUpQuestions: [],
          identity: draftIdentity,
          bullets: [],
          warnings: [],
        },
        scanResult: legacyScan,
      },
      version: 3,
    }
    await resolveStorage().setItem(IDENTITY_STORE_STORAGE_KEY, JSON.stringify(v3Persisted))

    await useIdentityStore.persist.rehydrate()

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().draft?.identity.schema_revision).toBe('3.1')
    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.schema_revision).toBe('3.1')
  })

  it('normalizes current-version persisted numeric schema_revision values on rehydrate merge', async () => {
    const currentIdentity = createIdentity()
    ;(currentIdentity as { schema_revision: string | number }).schema_revision = 3.1
    const draftIdentity = createIdentity()
    ;(draftIdentity as { schema_revision: string | number }).schema_revision = 3.1
    const scanForIntake = createScanResult()
    ;(scanForIntake.identity as { schema_revision: string | number }).schema_revision = 3.1

    // Clear in-memory state BEFORE writing storage so setState's auto-write
    // does not overwrite the v5 envelope we're loading.
    useIdentityStore.setState({
      currentIdentity: null,
      draft: null,
      intakeSources: [],
      draftDocument: '',
    })

    const v5Persisted = {
      state: {
        currentIdentity,
        draft: {
          generatedAt: '2026-04-05T00:00:00.000Z',
          summary: 'Draft summary',
          followUpQuestions: [],
          identity: draftIdentity,
          bullets: [],
          warnings: [],
        },
        intakeSources: [{ kind: 'resume' as const, id: 'test-intake', scan: scanForIntake }],
      },
      version: 5,
    }
    await resolveStorage().setItem(IDENTITY_STORE_STORAGE_KEY, JSON.stringify(v5Persisted))

    await useIdentityStore.persist.rehydrate()

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().draft?.identity.schema_revision).toBe('3.1')
    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.schema_revision).toBe('3.1')
  })
})

describe('identityStore model_revision', () => {
  const seedCurrent = (revision = 0) => {
    const identity = cloneIdentityFixture()
    identity.model_revision = revision
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
      draft: null,
      intakeSources: [],
      warnings: [],
      changelog: [],
      lastError: null,
    })
  }

  it('bumps model_revision when updating matching preferences', () => {
    seedCurrent(5)

    useIdentityStore.getState().updateCurrentMatching({
      prioritize: [],
      avoid: [
        {
          id: 'k8s-admin',
          label: 'Pure K8s admin roles',
          description: 'Avoid',
          severity: 'conditional',
        },
      ],
    })

    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(6)
  })

  it('compounds model_revision across successive mutations', () => {
    seedCurrent(0)

    const store = useIdentityStore.getState()
    store.updateCurrentMatching({ prioritize: [], avoid: [] })
    store.updateCurrentWorkModel({ preference: 'hybrid' })
    store.updateCurrentAwarenessQuestions([
      { id: 'q1', topic: 'Departure', description: 'Why leaving', action: 'Prep answer' },
    ])

    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(3)
  })

  it('treats current identity update helpers as no-ops when no identity is loaded', () => {
    const store = useIdentityStore.getState()

    expect(() => {
      store.updateCurrentIdentityCore({ name: 'No loaded identity' })
      store.updateCurrentProfiles([])
      store.updateCurrentPhilosophy([])
      store.updateCurrentSelfModelArc([])
      store.updateCurrentRoles([])
      store.updateCurrentProjects([])
      store.updateCurrentSkillGroups([])
      store.updateCurrentCompensation({ base_floor: 180000, priorities: [] })
      store.updateCurrentWorkModel({ preference: 'remote' })
      store.updateCurrentConstraints({ title_flexibility: ['Staff Engineer'] })
      store.updateCurrentMatching({ prioritize: [], avoid: [] })
      store.updateCurrentInterviewProcess({
        accepted_formats: ['system design'],
        strong_fit_signals: ['platform depth'],
        red_flags: [],
      })
      store.updateCurrentSearchVectors([
        {
          id: 'vec-platform',
          title: 'Platform Engineering',
          priority: 'high',
          thesis: 'Lead platform investments.',
          target_roles: ['Staff Platform Engineer'],
          keywords: { primary: ['platform'], secondary: [] },
        },
      ])
      store.updateCurrentAwarenessQuestions([
        { id: 'q1', topic: 'Departure', description: 'Why leaving', action: 'Prep answer' },
      ])
      store.updateCurrentAccuracyRules({ resume: 'Preserve measured claims.' })
    }).not.toThrow()

    expect(useIdentityStore.getState()).toMatchObject({
      currentIdentity: null,
      draftDocument: '',
      lastError: null,
    })
  })

  it('rehydrates and blocks current identity mutations when storage has a newer revision', () => {
    seedCurrent(5)
    const staleInMemoryName = useIdentityStore.getState().currentIdentity?.identity.name
    const newerIdentity = cloneIdentityFixture()
    newerIdentity.model_revision = 7
    newerIdentity.identity.name = 'Newer Tab Identity'
    newerIdentity.preferences.work_model = { preference: 'onsite' }

    resolveStorage().setItem(
      IDENTITY_STORE_STORAGE_KEY,
      JSON.stringify({
        state: {
          currentIdentity: newerIdentity,
          draft: null,
          draftDocument: JSON.stringify(newerIdentity, null, 2),
          intakeSources: [],
          warnings: [],
          changelog: [],
        },
        version: 4,
      }),
    )

    useIdentityStore.getState().updateCurrentWorkModel({ preference: 'hybrid' })

    const state = useIdentityStore.getState()
    expect(staleInMemoryName).not.toBe('Newer Tab Identity')
    expect(state.currentIdentity?.model_revision).toBe(7)
    expect(state.currentIdentity?.identity.name).toBe('Newer Tab Identity')
    expect(state.currentIdentity?.preferences.work_model).toEqual({ preference: 'onsite' })
    expect(state.lastError).toBe(
      'Identity was updated in another tab. Review the latest model and retry your change.',
    )
    expect(state.draftDocument).toContain('Newer Tab Identity')
  })

  it('bumps model_revision and marks depthSource=corrected on saveSkillEnrichment', () => {
    seedCurrent(2)

    useIdentityStore
      .getState()
      .saveSkillEnrichment(
        'platform',
        'Kubernetes',
        { depth: 'architectural', context: 'Build platforms around it', positioning: '' },
        'user',
      )

    const identity = useIdentityStore.getState().currentIdentity
    const skill = identity?.skills.groups[0].items.find((s) => s.name === 'Kubernetes')
    expect(identity?.model_revision).toBe(3)
    expect(skill?.depth).toBe('architectural')
    expect(skill?.depthSource).toBe('corrected')
  })

  it('flags older theses as stale after a vector change bumps the revision (TASK-158 AC #8)', () => {
    seedCurrent(2)
    const thesisBeforeChange = { id: 'thesis-1', identityVersion: 2 }

    useIdentityStore.getState().updateCurrentSearchVectors([
      {
        id: 'vec-platform',
        title: 'Platform Engineering',
        priority: 'high',
        thesis: 'Build resilient internal platforms.',
        target_roles: ['Staff Platform Engineer'],
        keywords: { primary: ['platform'], secondary: [] },
      },
    ])

    const currentRevision = useIdentityStore.getState().currentIdentity?.model_revision
    expect(currentRevision).toBe(3)
    expect(findStaleArtifacts(currentRevision ?? 0, { theses: [thesisBeforeChange] })).toEqual([
      { artifactType: 'thesis', artifactId: 'thesis-1', identityVersion: 2 },
    ])
  })

  it('flags older theses as stale after a skill-depth change bumps the revision (TASK-158 AC #8)', () => {
    seedCurrent(2)
    const thesisBeforeChange = { id: 'thesis-1', identityVersion: 2 }

    useIdentityStore
      .getState()
      .saveSkillEnrichment(
        'platform',
        'Kubernetes',
        { depth: 'architectural', context: 'Architected platforms around it', positioning: '' },
        'user',
      )

    const currentRevision = useIdentityStore.getState().currentIdentity?.model_revision
    expect(currentRevision).toBe(3)
    expect(findStaleArtifacts(currentRevision ?? 0, { theses: [thesisBeforeChange] })).toEqual([
      { artifactType: 'thesis', artifactId: 'thesis-1', identityVersion: 2 },
    ])
  })

  it('bumps model_revision on scanResult identity mutations', () => {
    const scanResult = createScanResult()
    scanResult.identity.model_revision = 4
    useIdentityStore.getState().setScanResult(scanResult)

    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Renamed')

    // setScanResult does not bump; only mutations do. updateScannedProjectEntry is the bump point.
    // Since setScanResult runs through normalize (which preserves model_revision), we expect 4 + 1 = 5
    // Note: if setScanResult triggers normalizePersistedIdentityState, revision is preserved; mutation adds 1.
    expect(getActiveResumeScan(useIdentityStore.getState())?.identity.model_revision).toBe(5)
  })

  it('advances model_revision past previous currentIdentity on importIdentity', () => {
    seedCurrent(9)

    const fresh = cloneIdentityFixture()
    fresh.model_revision = 0
    useIdentityStore.getState().importIdentity(fresh)

    // New identity's revision = max(0, 9) + 1 = 10 — prevents artifacts from appearing fresh
    // after a full replacement that would otherwise reset the counter.
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(10)
  })

  it('advances model_revision past previous currentIdentity on applyDraft (replace mode)', () => {
    seedCurrent(12)

    const draft = cloneIdentityFixture()
    draft.model_revision = 2
    useIdentityStore.setState({
      draft: {
        identity: draft,
        summary: 'test',
        followUpQuestions: [],
        warnings: [],
        generatedAt: '2026-04-20T00:00:00.000Z',
        bullets: [],
      },
      draftDocument: JSON.stringify(draft, null, 2),
    })

    useIdentityStore.getState().applyDraft('replace')

    // max(2, 12) + 1 = 13
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(13)
  })

  it('merges draft identity sections without dropping current-only records', () => {
    seedCurrent(4)

    const current = cloneIdentityFixture()
    current.model_revision = 4
    current.roles.push({
      ...current.roles[0],
      id: 'current-only-role',
      company: 'Current Only Co',
      bullets: [],
    })
    useIdentityStore.setState({
      currentIdentity: current,
      draftDocument: JSON.stringify(current, null, 2),
      changelog: [],
    })

    const draft = cloneIdentityFixture()
    draft.model_revision = 1
    draft.identity.thesis = 'Draft thesis from corrected source material'
    draft.roles[0] = {
      ...draft.roles[0],
      title: 'Principal Platform Engineer',
    }
    draft.projects.push({
      id: 'draft-only-project',
      name: 'Draft Only Project',
      description: 'New project from the corrected draft.',
      url: 'https://example.test/project',
      tags: ['platform'],
    })
    useIdentityStore.setState({
      draft: {
        identity: draft,
        summary: 'Corrected draft ready.',
        followUpQuestions: [],
        warnings: [],
        generatedAt: '2026-04-20T00:00:00.000Z',
        bullets: [],
      },
      draftDocument: JSON.stringify(draft, null, 2),
    })

    const result = useIdentityStore.getState().applyDraft('merge')

    expect(result.summary).toMatch(/Merged identity draft/)
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(5)
    expect(useIdentityStore.getState().currentIdentity?.identity.thesis).toBe(
      'Draft thesis from corrected source material',
    )
    expect(
      useIdentityStore.getState().currentIdentity?.roles.find((role) => role.id === 'contoso')
        ?.title,
    ).toBe('Principal Platform Engineer')
    expect(
      useIdentityStore
        .getState()
        .currentIdentity?.roles.some((role) => role.id === 'current-only-role'),
    ).toBe(true)
    expect(
      useIdentityStore
        .getState()
        .currentIdentity?.projects.some((project) => project.id === 'draft-only-project'),
    ).toBe(true)
    expect(useIdentityStore.getState().changelog[0]).toMatchObject({
      action: 'draft-applied',
      mode: 'merge',
    })
  })
})

describe('identityStore intake sources (multi-source intake)', () => {
  const createResumeSource = (id: string, fileName: string, userLabel?: string): IntakeSource => ({
    kind: 'resume',
    id,
    userLabel,
    scan: { ...createScanResult(), fileName },
  })

  it('appends sources in order and keeps the first as the active scan', () => {
    const first = createResumeSource('intake-1', 'platform.pdf')
    const second = createResumeSource('intake-2', 'security.pdf')

    useIdentityStore.getState().appendIntakeSource(first)
    useIdentityStore.getState().appendIntakeSource(second)

    const sources = useIdentityStore.getState().intakeSources
    expect(sources.map((entry) => entry.id)).toEqual(['intake-1', 'intake-2'])
    expect(getActiveResumeScan(useIdentityStore.getState())?.fileName).toBe('platform.pdf')
  })

  it('seeds draftDocument and warnings on the first append only', () => {
    const first = createResumeSource('intake-1', 'first.pdf')
    first.scan = {
      ...first.scan,
      warnings: [
        { code: 'two-column-layout', severity: 'warning', message: 'First file warning.' },
      ],
    }
    const second = createResumeSource('intake-2', 'second.pdf')
    second.scan = {
      ...second.scan,
      warnings: [
        { code: 'two-column-layout', severity: 'warning', message: 'Second file warning.' },
      ],
    }

    useIdentityStore.getState().appendIntakeSource(first)
    expect(useIdentityStore.getState().draftDocument.length).toBeGreaterThan(0)
    expect(useIdentityStore.getState().warnings).toEqual(['First file warning.'])

    const draftAfterFirst = useIdentityStore.getState().draftDocument
    useIdentityStore.getState().appendIntakeSource(second)

    expect(useIdentityStore.getState().draftDocument).toBe(draftAfterFirst)
    expect(useIdentityStore.getState().warnings).toEqual(['First file warning.'])
  })

  it('removes a non-primary source without touching the active scan', () => {
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-1', 'one.pdf'))
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-2', 'two.pdf'))
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-3', 'three.pdf'))

    useIdentityStore.getState().removeIntakeSource('intake-2')

    expect(useIdentityStore.getState().intakeSources.map((entry) => entry.id)).toEqual([
      'intake-1',
      'intake-3',
    ])
    expect(getActiveResumeScan(useIdentityStore.getState())?.fileName).toBe('one.pdf')
  })

  it('promotes the next source when the active one is removed', () => {
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-1', 'one.pdf'))
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-2', 'two.pdf'))

    useIdentityStore.getState().removeIntakeSource('intake-1')

    expect(useIdentityStore.getState().intakeSources.map((entry) => entry.id)).toEqual(['intake-2'])
    expect(getActiveResumeScan(useIdentityStore.getState())?.fileName).toBe('two.pdf')
  })

  it('is a no-op when removing an unknown id', () => {
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-1', 'one.pdf'))
    const before = useIdentityStore.getState().intakeSources

    useIdentityStore.getState().removeIntakeSource('does-not-exist')

    expect(useIdentityStore.getState().intakeSources).toBe(before)
  })

  it('sets, trims, and clears the userLabel on a source by id', () => {
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-1', 'one.pdf'))
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-2', 'two.pdf'))

    useIdentityStore.getState().setIntakeSourceLabel('intake-2', '  security  ')
    expect(useIdentityStore.getState().intakeSources[1]?.userLabel).toBe('security')

    useIdentityStore.getState().setIntakeSourceLabel('intake-2', '   ')
    expect(useIdentityStore.getState().intakeSources[1]?.userLabel).toBeUndefined()
  })

  it('persists intakeSources including userLabel across reload shapes', async () => {
    useIdentityStore.getState().appendIntakeSource(createResumeSource('intake-1', 'one.pdf'))
    useIdentityStore.getState().setIntakeSourceLabel('intake-1', 'platform')

    const persisted = await readPersistedIdentityState()
    expect(persisted.state.intakeSources?.[0]).toMatchObject({
      kind: 'resume',
      id: 'intake-1',
      userLabel: 'platform',
    })
  })
})
