import { beforeEach, describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { parseDeepenIdentityBulletResponse } from '../utils/identityExtraction'

const createScanResult = () => {
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
    rawText: 'Nick Ferguson\nA10 Networks',
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

beforeEach(() => {
  resolveStorage().removeItem('facet-identity-workspace')
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: null,
    draft: null,
    draftDocument: '',
    scanResult: null,
    warnings: [],
    changelog: [],
    lastError: null,
  })
})

describe('identityStore scan progress', () => {
  it('initializes persisted scan progress when a scan result is loaded', () => {
    useIdentityStore.getState().setScanResult(createScanResult())

    const state = useIdentityStore.getState().scanResult
    expect(state?.progress.bullets['a10::platform-migration']).toMatchObject({
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

  it('normalizes numeric schema_revision values during live scan ingestion', () => {
    const scanResult = createScanResult()
    ;(scanResult.identity as { schema_revision: string | number }).schema_revision =
      3.1

    useIdentityStore.getState().setScanResult(scanResult)

    const storedIdentity = useIdentityStore.getState().scanResult?.identity
    expect(storedIdentity?.schema_revision).toBe('3.1')

    expect(() =>
      parseDeepenIdentityBulletResponse(
        JSON.stringify({
          summary: 'Deepened the migration bullet.',
          bullet: {
            role_id: 'a10',
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
    ;(scanResult.identity as { schema_revision: string | number }).schema_revision =
      3.1

    useIdentityStore.setState({
      scanResult,
      draftDocument: '',
      draft: null,
      warnings: [],
      lastError: null,
    })

    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Facet OSS')

    expect(useIdentityStore.getState().scanResult?.identity.schema_revision).toBe(
      '3.1',
    )
  })

  it('marks a scanned bullet as deepened and updates counts', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().completeScannedBulletDeepen({
      summary: 'Deepened the migration bullet.',
      roleId: 'a10',
      bulletId: 'platform-migration',
      bullet: {
        id: 'platform-migration',
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
      warnings: ['Normalized test warning.'],
    })

    const state = useIdentityStore.getState().scanResult
    expect(state?.progress.bullets['a10::platform-migration']).toMatchObject({
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
      scanResult,
      draftDocument: '',
      draft: null,
      warnings: [],
      lastError: null,
    })

    useIdentityStore.getState().completeScannedBulletDeepen({
      summary: 'Deepened the migration bullet.',
      roleId: 'a10',
      bulletId: 'platform-migration',
      bullet: {
        id: 'platform-migration',
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

    expect(useIdentityStore.getState().scanResult?.identity.schema_revision).toBe(
      '3.1',
    )
  })

  it('updates scanned project fields and keeps project counts in sync', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Facet OSS')
    useIdentityStore.getState().updateScannedProjectEntry(
      0,
      'description',
      'Targeted resume generation and pipeline tracking.',
    )
    useIdentityStore.getState().updateScannedProjectEntry(0, 'url', 'https://facet.atlascrew.dev')

    const state = useIdentityStore.getState().scanResult
    expect(state?.identity.projects[0]).toMatchObject({
      name: 'Facet OSS',
      description: 'Targeted resume generation and pipeline tracking.',
      url: 'https://facet.atlascrew.dev',
    })
    expect(state?.counts.projects).toBe(1)
  })

  it('normalizes cleared scanned project urls back to undefined', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().updateScannedProjectEntry(0, 'url', '   ')

    const state = useIdentityStore.getState().scanResult
    expect(state?.identity.projects[0]?.url).toBeUndefined()
  })

  it('tracks failure, edit, and bulk cancellation state without clearing completed work', () => {
    useIdentityStore.getState().setScanResult(createScanResult())
    useIdentityStore.getState().startScanBulkDeepen()
    useIdentityStore.getState().updateScanBulkProgress('a10::platform-migration')
    useIdentityStore.getState().failScannedBulletDeepen(
      'a10',
      'platform-migration',
      'Timed out while deepening.',
    )
    useIdentityStore.getState().markScannedBulletEdited('a10', 'platform-migration')
    useIdentityStore.getState().requestCancelScanBulkDeepen()
    useIdentityStore.getState().finishScanBulkDeepen()

    const state = useIdentityStore.getState().scanResult
    expect(state?.progress.bullets['a10::platform-migration']).toMatchObject({
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
    expect(useIdentityStore.getState().draftDocument).toContain(
      '"schema_revision": "3.1"',
    )
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

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe(
      '3.1',
    )
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
      useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items.some(
        (skill) => skill.name === 'Docker',
      ),
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
    const legacySkill = legacyIdentity.skills.groups[0]!.items[0] as typeof legacyIdentity.skills.groups[0]['items'][number] & {
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
          scanResult: null,
          warnings: [],
          changelog: [],
        },
        version: 4,
      }),
    )

    await useIdentityStore.persist.rehydrate()

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill?.positioning).toBe('Legacy positioning copy.')
    expect(useIdentityStore.getState().draftDocument).toContain('"positioning": "Legacy positioning copy."')
  })

  it('refreshes draftDocument when a persisted draft still uses search_signal', async () => {
    const legacyDraftIdentity = createIdentity()
    const legacyDraftSkill = legacyDraftIdentity.skills.groups[0]!.items[0] as typeof legacyDraftIdentity.skills.groups[0]['items'][number] & {
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
          scanResult: null,
          warnings: [],
          changelog: [],
        },
        version: 4,
      }),
    )

    await useIdentityStore.persist.rehydrate()

    expect(useIdentityStore.getState().draft?.identity.skills.groups[0]?.items[0]?.positioning).toBe(
      'Legacy draft positioning.',
    )
    expect(useIdentityStore.getState().draftDocument).toContain('"positioning": "Legacy draft positioning."')
    expect(useIdentityStore.getState().draftDocument).not.toContain('"search_signal"')
  })

  it('normalizes persisted numeric schema_revision values on rehydrate', async () => {
    const draftIdentity = createIdentity()
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draft: {
        generatedAt: '2026-04-05T00:00:00.000Z',
        summary: 'Draft summary',
        followUpQuestions: [],
        identity: draftIdentity,
        bullets: [],
        warnings: [],
      },
      scanResult: createScanResult(),
    })

    const persisted = await resolveStorage().getItem('facet-identity-workspace')
    const parsed = JSON.parse(persisted ?? '{}') as {
      state?: {
        currentIdentity?: { schema_revision?: string | number }
        draft?: { identity?: { schema_revision?: string | number } }
        scanResult?: { identity?: { schema_revision?: string | number } }
      }
    }

    if (parsed.state?.currentIdentity) {
      parsed.state.currentIdentity.schema_revision = 3.1
    }
    if (parsed.state?.draft?.identity) {
      parsed.state.draft.identity.schema_revision = 3.1
    }
    if (parsed.state?.scanResult?.identity) {
      parsed.state.scanResult.identity.schema_revision = 3.1
    }
    ;(parsed as { version?: number }).version = 3

    useIdentityStore.setState({
      currentIdentity: null,
      scanResult: null,
      draftDocument: '',
    })
    await resolveStorage().setItem('facet-identity-workspace', JSON.stringify(parsed))

    await useIdentityStore.persist.rehydrate()

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().draft?.identity.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().scanResult?.identity.schema_revision).toBe('3.1')
  })

  it('normalizes current-version persisted numeric schema_revision values on rehydrate merge', async () => {
    const draftIdentity = createIdentity()
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
      draft: {
        generatedAt: '2026-04-05T00:00:00.000Z',
        summary: 'Draft summary',
        followUpQuestions: [],
        identity: draftIdentity,
        bullets: [],
        warnings: [],
      },
      scanResult: createScanResult(),
    })

    const persisted = await resolveStorage().getItem('facet-identity-workspace')
    const parsed = JSON.parse(persisted ?? '{}') as {
      state?: {
        currentIdentity?: { schema_revision?: string | number }
        draft?: { identity?: { schema_revision?: string | number } }
        scanResult?: { identity?: { schema_revision?: string | number } }
      }
      version?: number
    }

    if (parsed.state?.currentIdentity) {
      parsed.state.currentIdentity.schema_revision = 3.1
    }
    if (parsed.state?.draft?.identity) {
      parsed.state.draft.identity.schema_revision = 3.1
    }
    if (parsed.state?.scanResult?.identity) {
      parsed.state.scanResult.identity.schema_revision = 3.1
    }
    parsed.version = 4

    useIdentityStore.setState({
      currentIdentity: null,
      draft: null,
      scanResult: null,
      draftDocument: '',
    })
    await resolveStorage().setItem('facet-identity-workspace', JSON.stringify(parsed))

    await useIdentityStore.persist.rehydrate()

    expect(useIdentityStore.getState().currentIdentity?.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().draft?.identity.schema_revision).toBe('3.1')
    expect(useIdentityStore.getState().scanResult?.identity.schema_revision).toBe('3.1')
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
      scanResult: null,
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
        { id: 'k8s-admin', label: 'Pure K8s admin roles', description: 'Avoid', severity: 'conditional' },
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

  it('bumps model_revision on scanResult identity mutations', () => {
    const scanResult = createScanResult()
    scanResult.identity.model_revision = 4
    useIdentityStore.getState().setScanResult(scanResult)

    useIdentityStore.getState().updateScannedProjectEntry(0, 'name', 'Renamed')

    // setScanResult does not bump; only mutations do. updateScannedProjectEntry is the bump point.
    // Since setScanResult runs through normalize (which preserves model_revision), we expect 4 + 1 = 5
    // Note: if setScanResult triggers normalizePersistedIdentityState, revision is preserved; mutation adds 1.
    expect(useIdentityStore.getState().scanResult?.identity.model_revision).toBe(5)
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
})
