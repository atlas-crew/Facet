import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { AnswerPatch } from '../types/identity'

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

beforeEach(() => {
  resolveStorage().removeItem('facet-identity-workspace')
})

afterEach(() => {
  resolveStorage().removeItem('facet-identity-workspace')
})

// ─────────────────────────────────────────────────────────────
// resolveAwarenessQuestion
// ─────────────────────────────────────────────────────────────

describe('resolveAwarenessQuestion', () => {
  it('sets answer and resolved:true on the matching question', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Topic A', description: 'Desc A', action: 'Answer it' },
          { id: 'q2', topic: 'Topic B', description: 'Desc B', action: 'Answer it' },
        ],
      }
    })

    useIdentityStore.getState().resolveAwarenessQuestion('q1', 'My answer here')

    const questions = getIdentity().awareness?.open_questions ?? []
    const q1 = questions.find((q) => q.id === 'q1')
    const q2 = questions.find((q) => q.id === 'q2')

    expect(q1?.answer).toBe('My answer here')
    expect(q1?.resolved).toBe(true)
    expect(q2?.answer).toBeUndefined()
    expect(q2?.resolved).toBeUndefined()
  })

  it('trims whitespace from the answer', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Topic', description: 'Desc', action: 'Do' },
        ],
      }
    })

    useIdentityStore.getState().resolveAwarenessQuestion('q1', '  padded answer  ')

    const q1 = getIdentity().awareness?.open_questions?.find((q) => q.id === 'q1')
    expect(q1?.answer).toBe('padded answer')
  })

  it('sets resolved:true even when answer is empty after trim', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Topic', description: 'Desc', action: 'Do' },
        ],
      }
    })

    useIdentityStore.getState().resolveAwarenessQuestion('q1', '   ')

    const q1 = getIdentity().awareness?.open_questions?.find((q) => q.id === 'q1')
    expect(q1?.resolved).toBe(true)
    expect(q1?.answer).toBeUndefined()
  })

  it('leaves other questions untouched (immutable map)', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'A', description: 'DA', action: 'X', answer: 'existing' },
          { id: 'q2', topic: 'B', description: 'DB', action: 'Y' },
        ],
      }
    })

    const before = getIdentity().awareness?.open_questions ?? []

    useIdentityStore.getState().resolveAwarenessQuestion('q2', 'new answer')

    const after = getIdentity().awareness?.open_questions ?? []
    const q1After = after.find((q) => q.id === 'q1')!

    expect(q1After.answer).toBe('existing')
    expect(q1After.resolved).toBeUndefined()
    // array reference must differ (immutable update produced a new array)
    expect(before === after).toBe(false)
  })

  it('is a no-op for an id that does not exist', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'Topic', description: 'Desc', action: 'Do' },
        ],
      }
    })

    const revisionBefore = getIdentity().model_revision

    useIdentityStore.getState().resolveAwarenessQuestion('ghost-id', 'answer')

    // model_revision bumps on any mutation; a pure no-op still runs through
    // updateCurrentIdentity and will bump. What matters is the data is unchanged.
    const questions = getIdentity().awareness?.open_questions ?? []
    expect(questions).toHaveLength(1)
    expect(questions[0].resolved).toBeUndefined()
    expect(questions[0].answer).toBeUndefined()
    // revision may or may not bump — we only assert data integrity
    void revisionBefore
  })
})

// ─────────────────────────────────────────────────────────────
// applyAnswerPatch — role-bullet
// ─────────────────────────────────────────────────────────────

describe('applyAnswerPatch — role-bullet', () => {
  it('appends a bullet to the named role', () => {
    seed()

    const patch: AnswerPatch = {
      kind: 'role-bullet',
      roleId: 'contoso',
      bullet: {
        problem: 'No observability stack',
        action: 'Shipped distributed tracing',
        outcome: 'Reduced MTTR by 40%',
        impact: ['Faster incident response'],
        technologies: ['OpenTelemetry'],
        tags: ['observability'],
      },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const roles = getIdentity().roles
    const contoso = roles.find((r) => r.id === 'contoso')!
    const newBullet = contoso.bullets.at(-1)!

    expect(newBullet.problem).toBe('No observability stack')
    expect(newBullet.action).toBe('Shipped distributed tracing')
    expect(newBullet.outcome).toBe('Reduced MTTR by 40%')
    expect(newBullet.impact).toEqual(['Faster incident response'])
    expect(newBullet.technologies).toEqual(['OpenTelemetry'])
    expect(newBullet.tags).toEqual(['observability'])
    expect(typeof newBullet.id).toBe('string')
    expect(newBullet.id.length).toBeGreaterThan(0)
  })

  it('preserves all other roles and their existing bullets', () => {
    seed((id) => {
      id.roles.push({
        id: 'other-co',
        company: 'Other Co',
        title: 'Engineer',
        dates: '2022-2024',
        bullets: [
          {
            id: 'existing-bullet',
            problem: 'P',
            action: 'A',
            outcome: 'O',
            impact: [],
            metrics: {},
            technologies: [],
            tags: [],
          },
        ],
      })
    })

    const patch: AnswerPatch = {
      kind: 'role-bullet',
      roleId: 'contoso',
      bullet: { problem: 'P2', action: 'A2', outcome: 'O2' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const roles = getIdentity().roles
    const otherCo = roles.find((r) => r.id === 'other-co')!
    expect(otherCo.bullets).toHaveLength(1)
    expect(otherCo.bullets[0].id).toBe('existing-bullet')

    const contoso = roles.find((r) => r.id === 'contoso')!
    // original bullet preserved + new one appended
    expect(contoso.bullets).toHaveLength(2)
    expect(contoso.bullets[0].id).toBe('platform-migration')
  })

  it('defaults missing optional bullet fields to empty values', () => {
    seed()

    const patch: AnswerPatch = {
      kind: 'role-bullet',
      roleId: 'contoso',
      bullet: { problem: 'P', action: 'A', outcome: 'O' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const contoso = getIdentity().roles.find((r) => r.id === 'contoso')!
    const newBullet = contoso.bullets.at(-1)!
    expect(newBullet.impact).toEqual([])
    expect(newBullet.metrics).toEqual({})
    expect(newBullet.technologies).toEqual([])
    expect(newBullet.tags).toEqual([])
  })

  it('is a safe no-op when roleId does not exist', () => {
    seed()

    const rolesBefore = getIdentity().roles
    const patch: AnswerPatch = {
      kind: 'role-bullet',
      roleId: 'ghost-role',
      bullet: { problem: 'P', action: 'A', outcome: 'O' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    // roles array must be unchanged
    expect(getIdentity().roles).toEqual(rolesBefore)
  })
})

// ─────────────────────────────────────────────────────────────
// applyAnswerPatch — skill
// ─────────────────────────────────────────────────────────────

describe('applyAnswerPatch — skill', () => {
  it('adds the skill to the named group', () => {
    seed()

    const patch: AnswerPatch = {
      kind: 'skill',
      groupId: 'platform',
      skillName: 'Helm',
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const group = getIdentity().skills.groups.find((g) => g.id === 'platform')!
    expect(group.items.some((i) => i.name === 'Helm')).toBe(true)
  })

  it('is a no-op (safe) when groupId does not exist', () => {
    seed()

    const groupsBefore = getIdentity().skills.groups
    const patch: AnswerPatch = {
      kind: 'skill',
      groupId: 'ghost-group',
      skillName: 'Helm',
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    // No new groups were added and no items changed in existing groups
    const groupsAfter = getIdentity().skills.groups
    expect(groupsAfter).toHaveLength(groupsBefore.length)
    expect(groupsAfter.every((g) => !g.items.some((i) => i.name === 'Helm'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// applyAnswerPatch — self-model-arc
// ─────────────────────────────────────────────────────────────

describe('applyAnswerPatch — self-model-arc', () => {
  it('appends an arc entry to self_model.arc', () => {
    seed((id) => {
      id.self_model.arc = [{ company: 'OldCo', chapter: 'First chapter' }]
    })

    const patch: AnswerPatch = {
      kind: 'self-model-arc',
      entry: { company: 'NewCo', chapter: 'Second chapter' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const arc = getIdentity().self_model.arc
    expect(arc).toHaveLength(2)
    expect(arc[1]).toEqual({ company: 'NewCo', chapter: 'Second chapter' })
    expect(arc[0]).toEqual({ company: 'OldCo', chapter: 'First chapter' })
  })

  it('works when arc is initially empty', () => {
    seed((id) => {
      id.self_model.arc = []
    })

    const patch: AnswerPatch = {
      kind: 'self-model-arc',
      entry: { company: 'Acme', chapter: 'Origin' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    expect(getIdentity().self_model.arc).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────
// applyAnswerPatch — competitive-moat
// ─────────────────────────────────────────────────────────────

describe('applyAnswerPatch — competitive-moat', () => {
  it('sets self_model.competitive_moat', () => {
    seed()

    const patch: AnswerPatch = {
      kind: 'competitive-moat',
      text: 'I can ship platform abstractions without slowing product velocity.',
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    expect(getIdentity().self_model.competitive_moat).toBe(
      'I can ship platform abstractions without slowing product velocity.',
    )
  })
})

// ─────────────────────────────────────────────────────────────
// applyAnswerPatch — unfair-advantage
// ─────────────────────────────────────────────────────────────

describe('applyAnswerPatch — unfair-advantage', () => {
  it('merges new items with existing unfair_advantages', () => {
    seed((id) => {
      id.self_model.unfair_advantages = ['Deep Kubernetes knowledge']
    })

    const patch: AnswerPatch = {
      kind: 'unfair-advantage',
      items: ['Security background', 'Compliance experience'],
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const advantages = getIdentity().self_model.unfair_advantages ?? []
    expect(advantages).toContain('Deep Kubernetes knowledge')
    expect(advantages).toContain('Security background')
    expect(advantages).toContain('Compliance experience')
  })

  it('deduplicates near-duplicate entries', () => {
    seed((id) => {
      id.self_model.unfair_advantages = ['deep kubernetes knowledge']
    })

    const patch: AnswerPatch = {
      kind: 'unfair-advantage',
      items: ['Deep Kubernetes Knowledge'],
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    const advantages = getIdentity().self_model.unfair_advantages ?? []
    expect(advantages.length).toBeLessThanOrEqual(1)
  })

  it('works when unfair_advantages is initially undefined', () => {
    seed((id) => {
      delete id.self_model.unfair_advantages
    })

    const patch: AnswerPatch = {
      kind: 'unfair-advantage',
      items: ['First advantage'],
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    expect(getIdentity().self_model.unfair_advantages).toContain('First advantage')
  })
})

// ─────────────────────────────────────────────────────────────
// Immutability
// ─────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('role-bullet patch does not mutate the original roles array', () => {
    seed()
    const rolesBefore = getIdentity().roles
    const contsoBulletsBefore = rolesBefore.find((r) => r.id === 'contoso')!.bullets

    const patch: AnswerPatch = {
      kind: 'role-bullet',
      roleId: 'contoso',
      bullet: { problem: 'P', action: 'A', outcome: 'O' },
    }

    useIdentityStore.getState().applyAnswerPatch(patch)

    expect(contsoBulletsBefore).toHaveLength(1)
    const rolesAfter = getIdentity().roles
    expect(rolesAfter === rolesBefore).toBe(false)
  })

  it('resolveAwarenessQuestion does not mutate the original questions array', () => {
    seed((id) => {
      id.awareness = {
        open_questions: [
          { id: 'q1', topic: 'T', description: 'D', action: 'A' },
        ],
      }
    })

    const questionsBefore = getIdentity().awareness!.open_questions
    useIdentityStore.getState().resolveAwarenessQuestion('q1', 'answer')
    const questionsAfter = getIdentity().awareness!.open_questions

    expect(questionsBefore === questionsAfter).toBe(false)
    expect(questionsBefore[0].resolved).toBeUndefined()
  })
})
