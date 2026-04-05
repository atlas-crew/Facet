import { beforeEach, describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'

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
