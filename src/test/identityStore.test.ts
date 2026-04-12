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
            search_signal: 'Infrastructure as code and platform automation.',
          },
        ],
      },
    ]
    return identity
  }

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
        search_signal: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      search_signal: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'user',
    })
    expect(skill?.enriched_at).toBeTruthy()
    expect(skill?.skipped_at).toBeUndefined()
    expect(useIdentityStore.getState().draftDocument).toContain('"Kubernetes"')
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
        search_signal: 'Platform modernization and Kubernetes operations.',
      },
      'llm-accepted',
    )
    useIdentityStore.getState().saveSkillEnrichment(
      'platform',
      'Terraform',
      {
        depth: 'working',
        context: 'Provisioned cloud and on-prem infrastructure.',
        search_signal: 'Infrastructure as code and platform automation.',
      },
      'user-edited-llm',
    )

    const items = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items ?? []
    expect(items[0]?.enriched_by).toBe('llm-accepted')
    expect(items[1]?.enriched_by).toBe('user-edited-llm')
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
    expect(skill?.search_signal).toBe('Infrastructure as code and platform automation.')
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
        search_signal: 'Platform modernization and Kubernetes operations.',
      },
      'user',
    )

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill?.skipped_at).toBeUndefined()
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
        search_signal: 'Platform modernization and Kubernetes operations.',
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
      enriched_by: 'user',
    })
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
})
