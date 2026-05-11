import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getCurrentBulletDeepenKey,
  useIdentityStore,
} from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import type { IdentityDeepenedBullet } from '../types/identity'
import { cloneIdentityFixture } from './fixtures/identityFixture'

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
    mapSelection: null,
    currentBulletDeepen: {},
  })
}

const buildDeepenResult = (
  overrides: Partial<IdentityDeepenedBullet> = {},
): IdentityDeepenedBullet => ({
  summary: 'Sharpened the action and added an outcome metric.',
  roleId: 'contoso',
  bulletId: 'platform-migration',
  bullet: {
    id: 'platform-migration',
    problem: 'Updated problem statement.',
    action: 'Updated action.',
    outcome: 'Updated outcome with metric.',
    impact: ['Cut deployment friction'],
    metrics: { services_ported: 12 },
    technologies: ['Kubernetes', 'Helm'],
    tags: ['platform'],
  },
  rewrite: 'Reframed for impact.',
  assumptions: [],
  warnings: [],
  ...overrides,
})

describe('identityStore — current bullet deepen', () => {
  beforeEach(() => seed())
  afterEach(() => {
    useIdentityStore.setState({ currentBulletDeepen: {} })
  })

  it('startCurrentBulletDeepen records a running entry for the bullet', () => {
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'platform-migration')
    const entry = useIdentityStore.getState().currentBulletDeepen[
      getCurrentBulletDeepenKey('contoso', 'platform-migration')
    ]
    expect(entry?.status).toBe('running')
    expect(entry?.lastError).toBeUndefined()
  })

  it('completeCurrentBulletDeepen applies the deepened bullet to currentIdentity and clears the entry', () => {
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'platform-migration')
    useIdentityStore.getState().completeCurrentBulletDeepen(buildDeepenResult())

    const bullet = useIdentityStore
      .getState()
      .currentIdentity!.roles[0].bullets[0]
    expect(bullet.problem).toBe('Updated problem statement.')
    expect(bullet.outcome).toBe('Updated outcome with metric.')
    expect(bullet.metrics.services_ported).toBe(12)
    expect(useIdentityStore.getState().currentBulletDeepen).toEqual({})
  })

  it('completeCurrentBulletDeepen preserves the bullet source_text', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Original captured text'
    })
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'platform-migration')
    useIdentityStore.getState().completeCurrentBulletDeepen(
      buildDeepenResult({
        bullet: {
          ...buildDeepenResult().bullet,
          source_text: 'AI-suggested replacement source',
        },
      }),
    )
    const bullet = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]
    expect(bullet.source_text).toBe('Original captured text')
  })

  it('completeCurrentBulletDeepen drops the result when the bullet was removed', () => {
    seed()
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'missing-bullet')
    useIdentityStore.getState().completeCurrentBulletDeepen(
      buildDeepenResult({ bulletId: 'missing-bullet' }),
    )
    const bullet = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]
    expect(bullet.problem).toBe('Cloud-only delivery blocked on-prem deployments.')
    expect(
      useIdentityStore.getState().currentBulletDeepen[
        getCurrentBulletDeepenKey('contoso', 'missing-bullet')
      ],
    ).toEqual({ status: 'running' })
  })

  it('failCurrentBulletDeepen marks the entry as failed with the error message', () => {
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'platform-migration')
    useIdentityStore.getState().failCurrentBulletDeepen(
      'contoso',
      'platform-migration',
      'Network timeout while deepening.',
    )
    const entry = useIdentityStore.getState().currentBulletDeepen[
      getCurrentBulletDeepenKey('contoso', 'platform-migration')
    ]
    expect(entry).toEqual({
      status: 'failed',
      lastError: 'Network timeout while deepening.',
    })
  })

  it('completeCurrentBulletDeepen aggregates new warnings into the store warnings list', () => {
    useIdentityStore.getState().startCurrentBulletDeepen('contoso', 'platform-migration')
    useIdentityStore.getState().completeCurrentBulletDeepen(
      buildDeepenResult({ warnings: ['Some assumption noted'] }),
    )
    expect(useIdentityStore.getState().warnings).toContain('Some assumption noted')
  })
})
