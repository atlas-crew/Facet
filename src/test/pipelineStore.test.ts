import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  migratePipelineState,
  usePipelineStore,
} from '../store/pipelineStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useIdentityStore } from '../store/identityStore'
import type { PipelineEntry } from '../types/pipeline'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'
import { defaultResumeData } from '../store/defaultData'

const makeEntry = (overrides: Partial<PipelineEntry> = {}): Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'> => ({
  company: 'Acme Corp',
  role: 'Staff Engineer',
  tier: '1',
  status: 'researching',
  comp: '$170K–$210K',
  url: 'https://example.com',
  contact: '',
  vectorId: null,
  jobDescription: '',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: '',
  skillMatch: '',
  nextStep: '',
  notes: '',
  appMethod: 'direct-apply',
  response: 'none',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  ...overrides,
})

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.setState({ entries: [], sortField: 'tier', sortDir: 'asc', filters: { tier: 'all', status: 'all', search: '' } })
    useJDAnalysisStore.setState({ analyses: [] })
    useCoverLetterStore.setState({
      letters: [],
      snapshots: [],
      activeLetterId: null,
      templates: [],
    })
    useIdentityStore.setState({ currentIdentity: null })
    useResumeStore.setState({
      ...normalizeResumeWorkspaceData(defaultResumeData),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  })

  it('adds an entry with generated id, createdAt, lastAction, and history', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toMatch(/^pipe-/)
    expect(entries[0].createdAt).toBeTruthy()
    expect(entries[0].lastAction).toBeTruthy()
    expect(entries[0].history).toHaveLength(1)
    expect(entries[0].history[0].note).toBe('Created')
    expect(entries[0].company).toBe('Acme Corp')
    expect(entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(entries[0].durableMeta?.revision).toBe(0)
  })

  it('updates an entry and bumps lastAction', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    const before = usePipelineStore.getState().entries[0]
    usePipelineStore.getState().updateEntry(id, {
      company: 'Initech',
      durableMeta: {
        workspaceId: 'ignored-workspace',
        tenantId: 'tenant-x',
        userId: 'user-x',
        schemaVersion: 99,
        revision: 41,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    })
    const updated = usePipelineStore.getState().entries[0]
    expect(updated.company).toBe('Initech')
    expect(updated.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated.durableMeta?.createdAt).toBe(before.durableMeta?.createdAt)
    expect(updated.durableMeta?.revision).toBe((before.durableMeta?.revision ?? 0) + 1)
  })

  it('clears pipeline cover letter links when the linked letter is deleted', () => {
    usePipelineStore.getState().addEntry(makeEntry({ coverLetterId: 'letter-1' }))
    usePipelineStore.getState().addEntry(makeEntry({ company: 'Other Corp', coverLetterId: 'letter-2' }))
    const entryId = usePipelineStore.getState().entries[0].id
    useCoverLetterStore.getState().createLetter({
      id: 'letter-1',
      content: {
        name: 'Acme Letter',
        header: 'Jane Smith',
        greeting: 'Dear Hiring Manager,',
        paragraphs: [{ id: 'paragraph-1', text: 'I can help.', vectors: {} }],
        signOff: 'Sincerely, Jane',
      },
      pipelineEntryId: entryId,
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
    })

    useCoverLetterStore.getState().deleteLetter('letter-1')

    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBeNull()
    expect(usePipelineStore.getState().entries[1]?.coverLetterId).toBe('letter-2')
  })

  it('soft-deletes an entry without removing durable records', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    usePipelineStore.getState().addEntry(makeEntry({ company: 'Other' }))
    expect(usePipelineStore.getState().entries).toHaveLength(2)
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().deleteEntry(id)
    expect(usePipelineStore.getState().entries).toHaveLength(2)
    expect(usePipelineStore.getState().entries[0].deletedAt).toBeTruthy()
    expect(usePipelineStore.getState().entries[1].company).toBe('Other')
  })

  it('clears canonical JD analysis when an entry is soft-deleted', () => {
    usePipelineStore.getState().addEntry(makeEntry({ jdAnalysisId: 'analysis-1' }))
    const id = usePipelineStore.getState().entries[0].id
    useJDAnalysisStore.setState({
      analyses: [
        {
          id: 'analysis-1',
          pipelineEntryId: id,
          jdTextHash: 'abc',
          identityVersion: 1,
          modelVersion: 'test',
          generatedAt: '2026-04-14T12:00:00.000Z',
          updatedAt: '2026-04-14T12:00:00.000Z',
          warnings: [],
          company: 'Acme Corp',
          role: 'Staff Engineer',
          summary: '',
          analyzedJobDescription: '',
          jobDescriptionWordCount: 0,
          jobDescriptionTruncated: false,
          requirements: [],
          overallFit: 'moderate',
          fitScore: 0,
          confidence: 'low',
          recommendation: 'consider',
          oneLineSummary: '',
          rationale: '',
          matchedVectors: [],
          primaryVectorId: null,
          skillMatches: [],
          evidenceMapping: {
            topBullets: [],
            topSkills: [],
            topProjects: [],
            topProfiles: [],
            topPhilosophy: [],
          },
          strengthsToLead: [],
          advantages: [],
          advantageHypotheses: [],
          gaps: [],
          gapFocus: [],
          watchOuts: [],
          triggeredPrioritize: [],
          triggeredAvoid: [],
          relevantAwareness: [],
          positioningRecommendations: [],
          requirementCoverageScore: 0,
          matchedRequirementIds: [],
          matchedKeywords: [],
        },
      ],
    })

    usePipelineStore.getState().deleteEntry(id)

    expect(usePipelineStore.getState().entries[0].jdAnalysisId).toBeNull()
    expect(useJDAnalysisStore.getState().analyses).toEqual([])
  })

  it('adds a history note', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().addHistoryNote(id, 'Recruiter call')
    const entry = usePipelineStore.getState().entries[0]
    expect(entry.history).toHaveLength(2)
    expect(entry.history[1].note).toBe('Recruiter call')
  })

  it('sets status and adds history entry', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().setStatus(id, 'applied')
    const entry = usePipelineStore.getState().entries[0]
    expect(entry.status).toBe('applied')
    expect(entry.history).toHaveLength(2)
    expect(entry.history[1].note).toContain('applied')
  })

  it('creates an immutable resume snapshot when status transitions to applied', () => {
    const resumeId = useResumeStore.getState().activeResumeId
    expect(resumeId).toBeTruthy()
    usePipelineStore.getState().addEntry(makeEntry({ resumeId }))
    const id = usePipelineStore.getState().entries[0].id

    usePipelineStore.getState().setStatus(id, 'applied')

    const entry = usePipelineStore.getState().entries[0]
    expect(entry.resumeSnapshotId).toBeTruthy()
    expect(useResumeStore.getState().snapshots[0]).toMatchObject({
      id: entry.resumeSnapshotId,
      sourceResumeId: resumeId,
      pipelineEntryId: id,
      identityVersionAtApply: null,
    })
  })

  it('creates paired resume and cover letter snapshots when applying with a letter draft', () => {
    useIdentityStore.setState({ currentIdentity: { model_revision: 5 } as never })
    const resumeId = useResumeStore.getState().activeResumeId
    expect(resumeId).toBeTruthy()
    usePipelineStore.getState().addEntry(makeEntry({ resumeId }))
    const id = usePipelineStore.getState().entries[0].id
    const sourceResume = useResumeStore.getState().resumes.find((resume) => resume.id === resumeId)
    expect(sourceResume).toBeTruthy()
    const letter = useCoverLetterStore.getState().createLetter({
      content: {
        name: 'Pipeline Letter',
        header: 'Header',
        greeting: 'Hello',
        paragraphs: [{ id: 'paragraph-1', text: 'I can help.', vectors: {} }],
        signOff: 'Thanks',
      },
      pipelineEntryId: id,
      sourceResumeId: resumeId!,
      sourceResumeHash: sourceResume!.contentHash,
      identityVersion: 3,
    })

    usePipelineStore.getState().setStatus(id, 'applied')

    const entry = usePipelineStore.getState().entries[0]
    const resumeSnapshot = useResumeStore.getState().snapshots[0]
    const letterSnapshot = useCoverLetterStore.getState().snapshots[0]
    expect(entry).toMatchObject({
      resumeSnapshotId: resumeSnapshot?.id,
      coverLetterId: letter.id,
      coverLetterSnapshotId: letterSnapshot?.id,
    })
    expect(resumeSnapshot).toMatchObject({
      pipelineEntryId: id,
      identityVersionAtApply: 5,
    })
    expect(letterSnapshot).toMatchObject({
      sourceLetterId: letter.id,
      sourceResumeSnapshotId: resumeSnapshot?.id,
      identityVersionAtGeneration: 3,
      identityVersionAtApply: 5,
    })
  })

  it('uses the pipeline entry coverLetterId when multiple letter drafts exist', () => {
    const resumeId = useResumeStore.getState().activeResumeId
    expect(resumeId).toBeTruthy()
    usePipelineStore.getState().addEntry(makeEntry({ resumeId }))
    const id = usePipelineStore.getState().entries[0].id
    const sourceResume = useResumeStore.getState().resumes.find((resume) => resume.id === resumeId)
    expect(sourceResume).toBeTruthy()
    useCoverLetterStore.getState().createLetter({
      id: 'letter-stale',
      content: {
        name: 'Stale Letter',
        header: 'Header',
        greeting: 'Hello',
        paragraphs: [],
        signOff: 'Thanks',
      },
      pipelineEntryId: id,
      sourceResumeId: resumeId!,
      sourceResumeHash: sourceResume!.contentHash,
    })
    const selectedLetter = useCoverLetterStore.getState().createLetter({
      id: 'letter-selected',
      content: {
        name: 'Selected Letter',
        header: 'Header',
        greeting: 'Hello',
        paragraphs: [],
        signOff: 'Thanks',
      },
      pipelineEntryId: id,
      sourceResumeId: resumeId!,
      sourceResumeHash: sourceResume!.contentHash,
    })
    usePipelineStore.getState().updateEntry(id, { coverLetterId: selectedLetter.id })

    usePipelineStore.getState().setStatus(id, 'applied')

    expect(usePipelineStore.getState().entries[0].coverLetterSnapshotId).toBeTruthy()
    expect(useCoverLetterStore.getState().snapshots[0]?.sourceLetterId).toBe('letter-selected')
  })

  it('throws before updating the pipeline entry when paired snapshot writes fail', () => {
    const resumeId = useResumeStore.getState().activeResumeId
    expect(resumeId).toBeTruthy()
    usePipelineStore.getState().addEntry(makeEntry({ resumeId }))
    const id = usePipelineStore.getState().entries[0].id
    const sourceResume = useResumeStore.getState().resumes.find((resume) => resume.id === resumeId)
    expect(sourceResume).toBeTruthy()
    useCoverLetterStore.getState().createLetter({
      content: {
        name: 'Pipeline Letter',
        header: 'Header',
        greeting: 'Hello',
        paragraphs: [],
        signOff: 'Thanks',
      },
      pipelineEntryId: id,
      sourceResumeId: resumeId!,
      sourceResumeHash: sourceResume!.contentHash,
    })
    const originalAddSnapshot = useCoverLetterStore.getState().addSnapshot
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    useCoverLetterStore.setState({
      addSnapshot: () => {
        throw new Error('snapshot write failed')
      },
    })

    expect(() => usePipelineStore.getState().setStatus(id, 'applied')).toThrow(
      /Could not create application snapshots/,
    )

    expect(usePipelineStore.getState().entries[0].status).toBe('researching')
    expect(usePipelineStore.getState().entries[0].resumeSnapshotId ?? null).toBeNull()
    expect(usePipelineStore.getState().entries[0].coverLetterSnapshotId ?? null).toBeNull()
    expect(useResumeStore.getState().snapshots).toEqual([])
    useCoverLetterStore.setState({ addSnapshot: originalAddSnapshot })
    consoleSpy.mockRestore()
  })

  it('blocks applied status when the linked resume is missing', () => {
    usePipelineStore.getState().addEntry(makeEntry({ resumeId: 'missing-resume' }))
    const id = usePipelineStore.getState().entries[0].id

    expect(() => usePipelineStore.getState().setStatus(id, 'applied')).toThrow(
      /Could not find the resume/,
    )

    expect(usePipelineStore.getState().entries[0].status).toBe('researching')
    expect(useResumeStore.getState().snapshots).toEqual([])
  })

  it('sets sort field and toggles direction', () => {
    usePipelineStore.getState().setSort('company')
    expect(usePipelineStore.getState().sortField).toBe('company')
    expect(usePipelineStore.getState().sortDir).toBe('asc')
    usePipelineStore.getState().setSort('company')
    expect(usePipelineStore.getState().sortDir).toBe('desc')
  })

  it('sets filters', () => {
    usePipelineStore.getState().setFilter('tier', '1')
    expect(usePipelineStore.getState().filters.tier).toBe('1')
    usePipelineStore.getState().setFilter('search', 'acme')
    expect(usePipelineStore.getState().filters.search).toBe('acme')
  })

  it('imports entries replacing existing', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    const imported: PipelineEntry[] = [
      { ...makeEntry({ company: 'Imported' }), id: 'pipe-imp-1', createdAt: '2026-01-01', lastAction: '2026-01-01', history: [] },
    ]
    usePipelineStore.getState().importEntries(imported)
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    expect(usePipelineStore.getState().entries[0].company).toBe('Imported')
    expect(usePipelineStore.getState().entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(usePipelineStore.getState().entries[0].durableMeta?.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('exports entries', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    usePipelineStore.getState().addEntry(makeEntry({ company: 'Two' }))
    const exported = usePipelineStore.getState().exportEntries()
    expect(exported).toHaveLength(2)
  })

  it('migrates persisted entries to durable ISO timestamps and defaults invalid state', () => {
    const migrated = migratePipelineState({
      entries: [
        {
          ...makeEntry({ company: 'Legacy' }),
          id: 'pipe-legacy-1',
          createdAt: '2026-01-01',
          lastAction: '2026-01-01',
          history: [],
          research: {
            status: 'investigated',
            summary: 'Fetched public job and company context',
            jobDescriptionSummary: '',
            interviewSignals: ['Recruiter screen is likely'],
            people: [
              {
                name: 'Alex Smith',
                title: 'Director of Platform',
                company: 'Legacy',
                profileUrl: 'https://www.linkedin.com/in/alex-smith',
                relevance: 'Likely org lead',
              },
            ],
            sources: [
              {
                label: 'Legacy job posting',
                url: 'https://example.com/jobs/legacy',
                kind: 'job-posting',
              },
              {
                label: '',
                kind: 'other',
              },
            ],
            searchQueries: ['Legacy staff engineer job'],
            lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
          },
        },
      ],
    })

    expect(migrated.entries).toHaveLength(1)
    expect(migrated.entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(migrated.entries[0].durableMeta?.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(migrated.entries[0].research).toEqual({
      status: 'investigated',
      summary: 'Fetched public job and company context',
      jobDescriptionSummary: '',
      interviewSignals: ['Recruiter screen is likely'],
      people: [
        {
          name: 'Alex Smith',
          title: 'Director of Platform',
          company: 'Legacy',
          profileUrl: 'https://www.linkedin.com/in/alex-smith',
          relevance: 'Likely org lead',
        },
      ],
      sources: [
        {
          label: 'Legacy job posting',
          url: 'https://example.com/jobs/legacy',
          kind: 'job-posting',
        },
      ],
      searchQueries: ['Legacy staff engineer job'],
      lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
    })
    expect(migrated.sortField).toBe('tier')
    expect(migrated.sortDir).toBe('asc')

    expect(migratePipelineState('bad-state').entries).toEqual([])
  })

  it('drops research snapshots that only preserve timestamp metadata', () => {
    const migrated = migratePipelineState({
      entries: [
        {
          ...makeEntry({ company: 'Timestamp Only' }),
          id: 'pipe-legacy-2',
          createdAt: '2026-01-01',
          lastAction: '2026-01-01',
          history: [],
          research: {
            status: 'investigated',
            summary: '',
            jobDescriptionSummary: '',
            interviewSignals: [],
            people: [],
            sources: [],
            searchQueries: [],
            lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
          },
        },
      ],
    })

    expect(migrated.entries[0]?.research).toBeUndefined()
  })

  it('derives structured resume generation metadata from legacy resumeVariant fields during migration', () => {
    const migrated = migratePipelineState({
      entries: [
        {
          ...makeEntry({
            company: 'Legacy Variant',
            vectorId: 'platform',
            presetId: 'preset-7',
            resumeVariant: 'Platform Focus',
          }),
          id: 'pipe-legacy-variant',
          createdAt: '2026-01-01',
          lastAction: '2026-01-01',
          history: [],
        },
      ],
    })

    expect(migrated.entries[0]?.resumeGeneration).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'preset-7',
      variantId: null,
      variantLabel: 'Platform Focus',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('keeps legacy pipeline mirrors synced when structured resume generation is updated', () => {
    usePipelineStore.getState().addEntry(
      makeEntry({
        company: 'Acme Corp',
        role: 'Staff Platform Engineer',
      }),
    )

    const id = usePipelineStore.getState().entries[0].id

    usePipelineStore.getState().updateEntry(id, {
      resumeGeneration: {
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        presetId: 'preset-7',
        variantId: 'variant-7',
        variantLabel: 'Acme Corp · Staff Platform Engineer',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: ['platform', 'backend'],
        lastGeneratedAt: '2026-04-18T13:00:00.000Z',
      },
    })

    expect(usePipelineStore.getState().entries[0]).toMatchObject({
      vectorId: 'platform',
      presetId: 'preset-7',
      resumeVariant: '',
      resumeGeneration: {
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        presetId: 'preset-7',
        variantId: 'variant-7',
        variantLabel: 'Acme Corp · Staff Platform Engineer',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: ['platform', 'backend'],
        lastGeneratedAt: '2026-04-18T13:00:00.000Z',
      },
    })
  })

  describe('rounds and interviewers', () => {
    const addEntryAndGetId = () => {
      usePipelineStore.getState().addEntry(makeEntry())
      return usePipelineStore.getState().entries[0].id
    }

    const getEntry = (id: string) =>
      usePipelineStore.getState().entries.find((e) => e.id === id)!

    it('adds a round with generated id, timestamps, and history note', () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'HM screen', format: 'hm-screen' })

      const entry = getEntry(id)
      expect(entry.interviewRounds).toHaveLength(1)
      const round = entry.interviewRounds![0]
      expect(round.id).toMatch(/^round-/)
      expect(round.label).toBe('HM screen')
      expect(round.format).toBe('hm-screen')
      expect(round.interviewers).toEqual([])
      expect(round.createdAt).toBeTruthy()
      expect(round.updatedAt).toBe(round.createdAt)
      expect(entry.history.at(-1)?.note).toBe('Added round: HM screen')
    })

    it('updateRound bumps updatedAt but preserves id and createdAt', async () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'First', format: 'hr-screen' })
      const original = getEntry(id).interviewRounds![0]

      await new Promise((r) => setTimeout(r, 5))
      usePipelineStore
        .getState()
        .updateRound(id, original.id, { label: 'Renamed', id: 'hacked' as never, createdAt: 'nope' })

      const updated = getEntry(id).interviewRounds![0]
      expect(updated.id).toBe(original.id)
      expect(updated.createdAt).toBe(original.createdAt)
      expect(updated.label).toBe('Renamed')
      expect(updated.updatedAt).not.toBe(original.updatedAt)
    })

    it('deleteRound removes the target round and leaves siblings', () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'A', format: 'hr-screen' })
      usePipelineStore.getState().addRound(id, { label: 'B', format: 'hm-screen' })
      const [roundA] = getEntry(id).interviewRounds!

      usePipelineStore.getState().deleteRound(id, roundA.id)

      const rounds = getEntry(id).interviewRounds!
      expect(rounds).toHaveLength(1)
      expect(rounds[0].label).toBe('B')
    })

    it('addInterviewer, updateInterviewer, and deleteInterviewer are scoped to the right round', () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'Panel', format: 'peer-panel' })
      const roundId = getEntry(id).interviewRounds![0].id

      usePipelineStore.getState().addInterviewer(id, roundId, {
        name: 'Doug',
        title: 'Staff',
        linkedInUrl: 'https://linkedin.com/in/doug',
      })

      const afterAdd = getEntry(id).interviewRounds![0]
      expect(afterAdd.interviewers).toHaveLength(1)
      const doug = afterAdd.interviewers[0]
      expect(doug.id).toMatch(/^iv-/)
      expect(doug.name).toBe('Doug')
      expect(doug.title).toBe('Staff')
      expect(doug.linkedInUrl).toBe('https://linkedin.com/in/doug')

      usePipelineStore.getState().updateInterviewer(id, roundId, doug.id, {
        title: 'Principal',
        id: 'hacked' as never,
      })
      const updated = getEntry(id).interviewRounds![0].interviewers[0]
      expect(updated.id).toBe(doug.id)
      expect(updated.title).toBe('Principal')

      usePipelineStore.getState().deleteInterviewer(id, roundId, doug.id)
      expect(getEntry(id).interviewRounds![0].interviewers).toHaveLength(0)
    })

    it('addInterviewer strips dangerous URL schemes from linkedInUrl', () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'Panel', format: 'peer-panel' })
      const roundId = getEntry(id).interviewRounds![0].id

      const cases: Array<{ name: string; input: string; expect: string | undefined }> = [
        { name: 'Mallory', input: 'javascript:alert(1)', expect: undefined },
        { name: 'Eve', input: 'data:text/html,<script>alert(1)</script>', expect: undefined },
        { name: 'Bob', input: '  JAVASCRIPT:alert(1)  ', expect: undefined },
        { name: 'Vbs', input: 'vbscript:msgbox(1)', expect: undefined },
        { name: 'File', input: 'file:///etc/passwd', expect: undefined },
        { name: 'Blob', input: 'blob:https://evil.example/abcd', expect: undefined },
        // HTML URL parser strips tab/LF/CR before scheme resolution — so these
        // would execute as javascript: at render time. Sanitizer must mirror.
        { name: 'Tab', input: 'java\tscript:alert(1)', expect: undefined },
        { name: 'Newline', input: 'j\nav\nascript:alert(1)', expect: undefined },
        { name: 'CR', input: 'javas\rcript:alert(1)', expect: undefined },
        // Legitimate values must survive untouched.
        { name: 'Alice', input: 'https://linkedin.com/in/alice', expect: 'https://linkedin.com/in/alice' },
        { name: 'Partial', input: 'linkedin.com/in/partial', expect: 'linkedin.com/in/partial' },
        { name: 'BareHttp', input: 'http://example.com', expect: 'http://example.com' },
      ]

      for (const c of cases) {
        usePipelineStore.getState().addInterviewer(id, roundId, {
          name: c.name,
          linkedInUrl: c.input,
        })
      }

      const ivs = getEntry(id).interviewRounds![0].interviewers
      for (const c of cases) {
        expect(ivs.find((i) => i.name === c.name)!.linkedInUrl).toBe(c.expect)
      }
    })

    it('updateInterviewer strips dangerous URL schemes from linkedInUrl', () => {
      const id = addEntryAndGetId()
      usePipelineStore.getState().addRound(id, { label: 'Panel', format: 'peer-panel' })
      const roundId = getEntry(id).interviewRounds![0].id
      usePipelineStore.getState().addInterviewer(id, roundId, {
        name: 'Alice',
        linkedInUrl: 'https://linkedin.com/in/alice',
      })
      const ivId = getEntry(id).interviewRounds![0].interviewers[0].id

      usePipelineStore.getState().updateInterviewer(id, roundId, ivId, {
        linkedInUrl: 'javascript:alert(1)',
      })
      expect(getEntry(id).interviewRounds![0].interviewers[0].linkedInUrl).toBeUndefined()

      // Patches without linkedInUrl must not clobber the existing value.
      usePipelineStore.getState().updateInterviewer(id, roundId, ivId, {
        linkedInUrl: 'https://linkedin.com/in/alice-v2',
      })
      usePipelineStore.getState().updateInterviewer(id, roundId, ivId, { title: 'Staff' })
      const iv = getEntry(id).interviewRounds![0].interviewers[0]
      expect(iv.linkedInUrl).toBe('https://linkedin.com/in/alice-v2')
      expect(iv.title).toBe('Staff')
    })

    it('round mutations bump the entry durableMeta revision', () => {
      const id = addEntryAndGetId()
      const beforeRev = getEntry(id).durableMeta!.revision

      usePipelineStore.getState().addRound(id, { label: 'R', format: 'hr-screen' })
      expect(getEntry(id).durableMeta!.revision).toBe(beforeRev + 1)

      const roundId = getEntry(id).interviewRounds![0].id
      usePipelineStore.getState().updateRound(id, roundId, { notes: 'hi' })
      expect(getEntry(id).durableMeta!.revision).toBe(beforeRev + 2)
    })
  })
})
