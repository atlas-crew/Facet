import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { intakeSynthesis } from '../utils/resumeScanner/intakeSynthesis'
import type {
  IntakeSource,
  ResumeScanResult,
} from '../types/identity'
import type {
  ProfessionalEducationEntry,
  ProfessionalIdentityV3,
  ProfessionalProject,
  ProfessionalRole,
  ProfessionalRoleBullet,
  ProfessionalSkillGroup,
} from '../identity/schema'

interface MakeRoleOptions {
  id: string
  company: string
  title: string
  dates: string
  bullets?: ProfessionalRoleBullet[]
}

const makeBullet = (id: string, sourceText: string): ProfessionalRoleBullet => ({
  id,
  problem: '',
  action: '',
  outcome: '',
  impact: [],
  metrics: {},
  technologies: [],
  source_text: sourceText,
  tags: [],
})

const makeRole = (options: MakeRoleOptions): ProfessionalRole => ({
  id: options.id,
  company: options.company,
  title: options.title,
  dates: options.dates,
  bullets: options.bullets ?? [],
})

const makeSkillGroup = (id: string, label: string, items: string[]): ProfessionalSkillGroup => ({
  id,
  label,
  items: items.map((name) => ({ name, tags: [] })),
})

const makeProject = (id: string, name: string, url?: string): ProfessionalProject => ({
  id,
  name,
  description: `${name} project description.`,
  tags: [],
  ...(url ? { url } : {}),
})

const makeEducation = (
  school: string,
  location: string,
  degree: string,
  year?: string,
): ProfessionalEducationEntry => ({
  school,
  location,
  degree,
  ...(year ? { year } : {}),
})

interface MakeIdentityOptions {
  roles?: ProfessionalRole[]
  skillGroups?: ProfessionalSkillGroup[]
  projects?: ProfessionalProject[]
  education?: ProfessionalEducationEntry[]
}

const makeIdentity = (options: MakeIdentityOptions): ProfessionalIdentityV3 => {
  const base = cloneIdentityFixture()
  return {
    ...base,
    roles: options.roles ?? [],
    skills: { groups: options.skillGroups ?? [] },
    projects: options.projects ?? [],
    education: options.education ?? [],
  }
}

interface MakeSourceOptions {
  id?: string
  fileName: string
  scannedAt: string
  userLabel?: string
  identity: ProfessionalIdentityV3
}

const makeResumeSource = (options: MakeSourceOptions): IntakeSource => {
  const scan: ResumeScanResult = {
    fileName: options.fileName,
    pageCount: 1,
    scannedAt: options.scannedAt,
    rawText: `Raw text from ${options.fileName}.`,
    identity: options.identity,
    warnings: [],
    counts: {
      roles: options.identity.roles.length,
      bullets: options.identity.roles.reduce((sum, role) => sum + role.bullets.length, 0),
      projects: options.identity.projects.length,
      skillGroups: options.identity.skills.groups.length,
      education: options.identity.education.length,
      extractedBullets: options.identity.roles.reduce(
        (sum, role) => sum + role.bullets.length,
        0,
      ),
      decomposedBullets: 0,
      scannedBullets: options.identity.roles.reduce(
        (sum, role) => sum + role.bullets.length,
        0,
      ),
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    },
    layout: 'single-column',
    progress: {
      bullets: {},
      bulk: {
        status: 'idle',
        total: 0,
        completed: 0,
        currentBulletKey: null,
        lastUpdatedAt: null,
      },
    },
  }
  return {
    kind: 'resume',
    id: options.id ?? `intake-${options.fileName}`,
    ...(options.userLabel ? { userLabel: options.userLabel } : {}),
    scan,
  }
}

describe('intakeSynthesis', () => {
  it('passes through a single source without altering identity shape', () => {
    const role = makeRole({
      id: 'contoso',
      company: 'Contoso Networks',
      title: 'Staff Platform Engineer',
      dates: 'Jan 2022 – Present',
      bullets: [makeBullet('migration', 'Ported platform to Kubernetes.')],
    })
    const identity = makeIdentity({
      roles: [role],
      skillGroups: [makeSkillGroup('platform', 'Platform', ['Kubernetes'])],
    })
    const source = makeResumeSource({
      fileName: 'resume.pdf',
      scannedAt: '2026-04-05T00:00:00.000Z',
      identity,
    })

    const seed = intakeSynthesis([source])

    expect(seed.identity.roles).toHaveLength(1)
    expect(seed.identity.roles[0]?.id).toBe('contoso')
    expect(seed.identity.roles[0]?.title).toBe('Staff Platform Engineer')
    expect(seed.identity.skills.groups).toHaveLength(1)
    expect(seed.identity.skills.groups[0]?.items[0]?.name).toBe('Kubernetes')
    expect(seed.bulletVariantPools).toEqual({
      contoso: [{ source: 'resume.pdf', text: 'Ported platform to Kubernetes.' }],
    })
    expect(seed.roleVariantTitles).toEqual({})
  })

  it('keeps separate roles when the same company has non-overlapping date ranges', () => {
    const earlyRole = makeRole({
      id: 'contoso-early',
      company: 'Contoso Networks',
      title: 'Senior Platform Engineer',
      dates: 'Jan 2018 – Dec 2020',
      bullets: [makeBullet('early-1', 'Built the initial deployment pipeline.')],
    })
    const lateRole = makeRole({
      id: 'contoso-late',
      company: 'Contoso Networks',
      title: 'Staff Platform Engineer',
      dates: 'Jan 2023 – Present',
      bullets: [makeBullet('late-1', 'Migrated workloads to EKS.')],
    })
    const earlySource = makeResumeSource({
      fileName: 'old.pdf',
      scannedAt: '2026-01-01T00:00:00.000Z',
      identity: makeIdentity({ roles: [earlyRole] }),
    })
    const lateSource = makeResumeSource({
      fileName: 'new.pdf',
      scannedAt: '2026-04-05T00:00:00.000Z',
      identity: makeIdentity({ roles: [lateRole] }),
    })

    const seed = intakeSynthesis([earlySource, lateSource])

    expect(seed.identity.roles).toHaveLength(2)
    expect(seed.identity.roles.map((role) => role.id).sort()).toEqual([
      'contoso-early',
      'contoso-late',
    ])
    expect(seed.roleVariantTitles).toEqual({})
    expect(seed.bulletVariantPools['contoso-early']).toEqual([
      { source: 'old.pdf', text: 'Built the initial deployment pipeline.' },
    ])
    expect(seed.bulletVariantPools['contoso-late']).toEqual([
      { source: 'new.pdf', text: 'Migrated workloads to EKS.' },
    ])
  })

  it('clusters same-company-overlapping-dates roles and lets the most-recent title win', () => {
    const olderRole = makeRole({
      id: 'contoso-older',
      company: 'Contoso Networks',
      title: 'Senior Platform Engineer',
      dates: 'Jan 2022 – Dec 2023',
      bullets: [makeBullet('older-1', 'Old phrasing of the platform migration bullet.')],
    })
    const newerRole = makeRole({
      id: 'contoso-newer',
      company: 'Contoso Networks',
      title: 'Staff Platform Engineer',
      dates: 'Jan 2022 – Present',
      bullets: [makeBullet('newer-1', 'Refined phrasing of the same migration bullet.')],
    })
    const olderSource = makeResumeSource({
      fileName: 'older.pdf',
      scannedAt: '2026-01-01T00:00:00.000Z',
      userLabel: 'platform',
      identity: makeIdentity({ roles: [olderRole] }),
    })
    const newerSource = makeResumeSource({
      fileName: 'newer.pdf',
      scannedAt: '2026-04-05T00:00:00.000Z',
      userLabel: 'security',
      identity: makeIdentity({ roles: [newerRole] }),
    })

    const seed = intakeSynthesis([olderSource, newerSource])

    expect(seed.identity.roles).toHaveLength(1)
    expect(seed.identity.roles[0]?.id).toBe('contoso-newer')
    expect(seed.identity.roles[0]?.title).toBe('Staff Platform Engineer')
    expect(seed.roleVariantTitles).toEqual({
      'contoso-newer': ['Senior Platform Engineer'],
    })
    expect(seed.bulletVariantPools['contoso-newer']).toEqual([
      {
        source: 'older.pdf',
        label: 'platform',
        text: 'Old phrasing of the platform migration bullet.',
      },
      {
        source: 'newer.pdf',
        label: 'security',
        text: 'Refined phrasing of the same migration bullet.',
      },
    ])
  })

  it('resolves conflicting skill group categorizations by majority vote', () => {
    const platformIdentity = makeIdentity({
      skillGroups: [makeSkillGroup('platform', 'Platform', ['Kubernetes'])],
    })
    const platformAgainIdentity = makeIdentity({
      skillGroups: [makeSkillGroup('platform', 'Platform', ['Kubernetes'])],
    })
    const cloudIdentity = makeIdentity({
      skillGroups: [makeSkillGroup('cloud', 'Cloud', ['Kubernetes'])],
    })

    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'a.pdf',
        scannedAt: '2026-01-01T00:00:00.000Z',
        identity: platformIdentity,
      }),
      makeResumeSource({
        fileName: 'b.pdf',
        scannedAt: '2026-02-01T00:00:00.000Z',
        identity: platformAgainIdentity,
      }),
      makeResumeSource({
        fileName: 'c.pdf',
        scannedAt: '2026-03-01T00:00:00.000Z',
        identity: cloudIdentity,
      }),
    ])

    const platformGroup = seed.identity.skills.groups.find((group) => group.label === 'Platform')
    const cloudGroup = seed.identity.skills.groups.find((group) => group.label === 'Cloud')
    expect(platformGroup?.items.map((item) => item.name)).toContain('Kubernetes')
    expect(cloudGroup).toBeUndefined()
  })

  it('breaks 1-1 group ties by most-recent scan', () => {
    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'older.pdf',
        scannedAt: '2026-01-01T00:00:00.000Z',
        identity: makeIdentity({
          skillGroups: [makeSkillGroup('platform', 'Platform', ['Kubernetes'])],
        }),
      }),
      makeResumeSource({
        fileName: 'newer.pdf',
        scannedAt: '2026-04-05T00:00:00.000Z',
        identity: makeIdentity({
          skillGroups: [makeSkillGroup('cloud', 'Cloud', ['Kubernetes'])],
        }),
      }),
    ])

    const cloudGroup = seed.identity.skills.groups.find((group) => group.label === 'Cloud')
    expect(cloudGroup?.items.map((item) => item.name)).toEqual(['Kubernetes'])
    const platformGroup = seed.identity.skills.groups.find((group) => group.label === 'Platform')
    expect(platformGroup).toBeUndefined()
  })

  it('dedupes projects by id and lets the most-recent fields win', () => {
    const olderIdentity = makeIdentity({
      projects: [makeProject('facet', 'Facet')],
    })
    const newerIdentity = makeIdentity({
      projects: [makeProject('facet', 'Facet OSS', 'https://facet.test'), makeProject('atlas', 'Atlas Crew')],
    })

    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'older.pdf',
        scannedAt: '2026-01-01T00:00:00.000Z',
        identity: olderIdentity,
      }),
      makeResumeSource({
        fileName: 'newer.pdf',
        scannedAt: '2026-04-05T00:00:00.000Z',
        identity: newerIdentity,
      }),
    ])

    expect(seed.identity.projects.map((project) => project.id)).toEqual(['facet', 'atlas'])
    const facet = seed.identity.projects.find((project) => project.id === 'facet')
    expect(facet?.name).toBe('Facet OSS')
    expect(facet?.url).toBe('https://facet.test')
  })

  it('unions education by fingerprint (school+location+degree+year)', () => {
    const sharedDegree = makeEducation('Glen Hollow CC', 'Rivertown, OR', 'AAS, CIS', '2020')
    const otherDegree = makeEducation('State University', 'Denver, CO', 'BS, CS', '2018')

    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'a.pdf',
        scannedAt: '2026-01-01T00:00:00.000Z',
        identity: makeIdentity({ education: [sharedDegree, otherDegree] }),
      }),
      makeResumeSource({
        fileName: 'b.pdf',
        scannedAt: '2026-04-05T00:00:00.000Z',
        identity: makeIdentity({ education: [sharedDegree] }),
      }),
    ])

    expect(seed.identity.education).toHaveLength(2)
    expect(seed.identity.education.map((entry) => entry.school)).toEqual([
      'Glen Hollow CC',
      'State University',
    ])
  })

  it('throws a descriptive error for unimplemented IntakeSource arms', () => {
    const futureSource = {
      kind: 'jd',
      id: 'jd-1',
      analysis: {},
    } as unknown as IntakeSource

    expect(() => intakeSynthesis([futureSource])).toThrow(
      /jd source arm is not yet implemented/,
    )
  })

  it('throws when given an empty source list', () => {
    expect(() => intakeSynthesis([])).toThrow(/at least one IntakeSource required/)
  })

  it('builds the bullet variant pool from every contributing source within a cluster', () => {
    const baseRole = (id: string, title: string) =>
      makeRole({
        id,
        company: 'Contoso Networks',
        title,
        dates: 'Jan 2022 – Present',
        bullets: [
          makeBullet(`${id}-a`, `${id} bullet A`),
          makeBullet(`${id}-b`, `${id} bullet B`),
        ],
      })

    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'older.pdf',
        scannedAt: '2026-01-01T00:00:00.000Z',
        userLabel: 'platform',
        identity: makeIdentity({ roles: [baseRole('contoso-1', 'Older Title')] }),
      }),
      makeResumeSource({
        fileName: 'newer.pdf',
        scannedAt: '2026-04-05T00:00:00.000Z',
        userLabel: 'security',
        identity: makeIdentity({ roles: [baseRole('contoso-2', 'Newer Title')] }),
      }),
    ])

    expect(seed.identity.roles).toHaveLength(1)
    const canonicalId = seed.identity.roles[0]!.id
    expect(canonicalId).toBe('contoso-2')
    expect(seed.bulletVariantPools[canonicalId]).toEqual([
      { source: 'older.pdf', label: 'platform', text: 'contoso-1 bullet A' },
      { source: 'older.pdf', label: 'platform', text: 'contoso-1 bullet B' },
      { source: 'newer.pdf', label: 'security', text: 'contoso-2 bullet A' },
      { source: 'newer.pdf', label: 'security', text: 'contoso-2 bullet B' },
    ])
  })

  it('falls back to exact date-string match when role dates are unparseable', () => {
    const sourceA = makeResumeSource({
      fileName: 'a.pdf',
      scannedAt: '2026-01-01T00:00:00.000Z',
      identity: makeIdentity({
        roles: [
          makeRole({
            id: 'contoso-a',
            company: 'Contoso',
            title: 'Engineer',
            dates: 'See attached for tenure history',
          }),
        ],
      }),
    })
    const sourceB = makeResumeSource({
      fileName: 'b.pdf',
      scannedAt: '2026-04-01T00:00:00.000Z',
      identity: makeIdentity({
        roles: [
          makeRole({
            id: 'contoso-b',
            company: 'Contoso',
            title: 'Engineer',
            dates: 'See attached for tenure history',
          }),
        ],
      }),
    })
    const sourceC = makeResumeSource({
      fileName: 'c.pdf',
      scannedAt: '2026-04-02T00:00:00.000Z',
      identity: makeIdentity({
        roles: [
          makeRole({
            id: 'contoso-c',
            company: 'Contoso',
            title: 'Engineer',
            dates: 'Different free-form description',
          }),
        ],
      }),
    })

    const seed = intakeSynthesis([sourceA, sourceB, sourceC])
    // sourceA + sourceB cluster (exact date match). sourceC has a different
    // unparseable string, so it stands alone.
    expect(seed.identity.roles).toHaveLength(2)
  })

  it('drops bullets without source_text from the variant pool', () => {
    const role = makeRole({
      id: 'contoso',
      company: 'Contoso',
      title: 'Engineer',
      dates: '2022 – Present',
      bullets: [
        makeBullet('with-text', 'Has source text.'),
        { ...makeBullet('no-text', ''), source_text: undefined },
      ],
    })
    const seed = intakeSynthesis([
      makeResumeSource({
        fileName: 'resume.pdf',
        scannedAt: '2026-04-05T00:00:00.000Z',
        identity: makeIdentity({ roles: [role] }),
      }),
    ])

    expect(seed.bulletVariantPools.contoso).toEqual([
      { source: 'resume.pdf', text: 'Has source text.' },
    ])
  })
})
