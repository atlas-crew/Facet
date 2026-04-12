// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useDebriefStore } from '../store/debriefStore'
import { useLinkedInStore } from '../store/linkedinStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useRecruiterStore } from '../store/recruiterStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { resolveStorage } from '../store/storage'
import { useUiStore } from '../store/uiStore'
import { cloneValue } from '../persistence/clone'
import {
  applyWorkspacePatch,
  createInMemoryPersistenceBackend,
  createPersistenceCoordinator,
} from '../persistence/coordinator'
import {
  DEFAULT_LOCAL_WORKSPACE_ID,
  DEFAULT_LOCAL_WORKSPACE_NAME,
  type FacetLocalPreferencesSnapshot,
} from '../persistence/contracts'
import {
  applyLocalPreferencesSnapshotToStores,
  applyWorkspaceSnapshotToStores,
  hydrateStoresFromLegacyStorage,
} from '../persistence/hydration'
import {
  createLocalPreferencesSnapshotFromStores,
  createWorkspaceSnapshotFromStores,
  DURABLE_PERSISTENCE_BOUNDARIES,
  LEGACY_PERSISTENCE_MIGRATION_PLAN,
  LOCAL_ONLY_PERSISTENCE_BOUNDARIES,
} from '../persistence/snapshot'
import { assertValidWorkspaceSnapshot } from '../persistence/validation'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const LEGACY_KEYS = [
  'vector-resume-data',
  'vector-resume-ui',
  'facet-pipeline-data',
  'facet-prep-workspace',
  'facet-prep-data',
  'facet-cover-letter-data',
  'facet-linkedin-workspace',
  'facet-debrief-workspace',
  'facet-search-data',
]

const clearLegacyStorage = () => {
  const storage = resolveStorage()
  for (const key of LEGACY_KEYS) {
    storage.removeItem(key)
  }
}

describe('persistence foundation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    clearLegacyStorage()

    useResumeStore.setState({
      data: defaultResumeData,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    usePrepStore.setState({
      decks: [],
      activeDeckId: null,
    })
    useCoverLetterStore.setState({
      templates: [],
    })
    useLinkedInStore.setState({
      drafts: [],
      selectedDraftId: null,
    })
    useRecruiterStore.setState({
      cards: [],
      selectedCardId: null,
    })
    useDebriefStore.setState({
      sessions: [],
      selectedSessionId: null,
    })
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
    })
    useUiStore.setState({
      selectedVector: 'all',
      panelRatio: 0.45,
      appearance: 'system',
      viewMode: 'pdf',
      showHeatmap: false,
      showDesignHealth: false,
      suggestionModeActive: false,
      comparisonVector: null,
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 7,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
      tourCompleted: false,
    })
    clearLegacyStorage()
  })

  it('captures only durable workspace artifacts in the unified snapshot', () => {
    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-1',
          company: 'Acme',
          role: 'Staff Engineer',
          tier: '1',
          status: 'applied',
          comp: '$250k',
          url: 'https://example.com/jobs/1',
          contact: 'recruiter@example.com',
          vectorId: 'backend',
          jobDescription: 'Build platforms',
          presetId: null,
          resumeVariant: 'default',
          positioning: 'Platform-heavy fit',
          skillMatch: 'Strong',
          nextStep: 'Wait',
          notes: 'Strong fit',
          appMethod: 'direct-apply',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '2026-03-11',
          dateClosed: '',
          lastAction: '2026-03-11',
          createdAt: '2026-03-11',
          history: [{ date: '2026-03-11', note: 'Created' }],
        },
      ],
      sortField: 'company',
      sortDir: 'desc',
      filters: { tier: '1', status: 'applied', search: 'Acme' },
    })
    usePrepStore.setState({
      decks: [
        {
          id: 'prep-deck-1',
          title: 'Interview Prep',
          company: 'Acme',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          updatedAt: '2026-03-11T00:00:00.000Z',
          cards: [],
        },
      ],
      activeDeckId: 'prep-deck-1',
    })
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'letter-1',
          name: 'Default',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [],
          signOff: 'Thanks',
        },
      ],
    })
    useLinkedInStore.setState({
      drafts: [
        {
          id: 'linkedin-1',
          name: 'Platform Draft',
          focus: 'Platform engineering',
          audience: 'Hiring managers',
          headline: 'Staff Platform Engineer',
          about: 'I build platform systems.',
          topSkills: ['Kubernetes'],
          featuredHighlights: ['Ported platform installs.'],
          generatedAt: '2026-03-11T00:00:00.000Z',
        },
      ],
      selectedDraftId: 'linkedin-1',
    })
    useRecruiterStore.setState({
      cards: [
        {
          id: 'recruiter-1',
          generatedAt: '2026-03-11T00:00:00.000Z',
          company: 'Acme',
          role: 'Staff Engineer',
          candidateName: 'Jane Smith',
          candidateTitle: 'Staff Platform Engineer',
          matchScore: 0.82,
          summary: 'Strong platform and reliability fit.',
          recruiterHook: 'Jane Smith is a strong fit for Acme.',
          suggestedIntro: 'Lead with platform migration wins.',
          topReasons: ['Strong match on platform scope'],
          proofPoints: ['Acme: Ported a platform to Kubernetes-based installs.'],
          skillHighlights: ['Kubernetes'],
          positioningAngles: ['Lead with platform reliability.'],
          likelyConcerns: ['Domain ramp may take time.'],
          gapBridges: ['Bridge gaps through adjacent platform delivery work.'],
          notes: 'Keep the positioning grounded in the match report.',
        },
      ],
      selectedCardId: 'recruiter-1',
    })
    useSearchStore.setState({
      profile: {
        id: 'sprof-1',
        skills: [],
        vectors: [],
        workSummary: [],
        openQuestions: [],
        constraints: {
          compensation: '$250k',
          locations: ['Remote'],
          clearance: '',
          companySize: '',
        },
        filters: {
          prioritize: ['platform'],
          avoid: ['ad-tech'],
        },
        interviewPrefs: {
          strongFit: ['ownership'],
          redFlags: ['low scope'],
        },
        inferredAt: '2026-03-11T00:00:00.000Z',
        inferredFromResumeVersion: defaultResumeData.version,
      },
      requests: [],
      runs: [],
    })
    useUiStore.setState({
      selectedVector: 'backend',
      panelRatio: 0.6,
      appearance: 'dark',
      viewMode: 'live',
      showHeatmap: true,
      showDesignHealth: true,
      suggestionModeActive: true,
      comparisonVector: 'all',
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 30,
      backupReminderSnoozedUntil: '2026-03-18T12:00:00.000Z',
      lastBackupAt: '2026-03-01T12:00:00.000Z',
      tourCompleted: true,
    })

    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      workspaceName: 'Acme Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    expect(snapshot.snapshotVersion).toBe(1)
    expect(snapshot.tenantId).toBeNull()
    expect(snapshot.userId).toBeNull()
    expect(snapshot.workspace).toEqual({
      id: 'ws-1',
      name: 'Acme Workspace',
      revision: 0,
      updatedAt: '2026-03-11T12:00:00.000Z',
    })
    expect(snapshot.artifacts.resume.artifactId).toBe('ws-1:resume')
    expect(snapshot.artifacts.pipeline.payload.entries).toHaveLength(1)
    expect(snapshot.artifacts.prep.payload.decks).toHaveLength(1)
    expect(snapshot.artifacts.coverLetters.payload.templates).toHaveLength(1)
    expect(snapshot.artifacts.linkedin.payload.drafts).toHaveLength(1)
    expect(snapshot.artifacts.recruiter.payload.cards).toHaveLength(1)
    expect(snapshot.artifacts.debrief.payload.sessions).toEqual([])
    expect(snapshot.artifacts.research.payload.profile?.id).toBe('sprof-1')
    expect(snapshot.artifacts.pipeline.payload).not.toHaveProperty('sortField')
    expect(snapshot.artifacts.prep.payload).not.toHaveProperty('activeDeckId')

    snapshot.artifacts.resume.payload.meta.name = 'Changed in snapshot'
    expect(useResumeStore.getState().data.meta.name).toBe(defaultResumeData.meta.name)
  })

  it('uses local workspace defaults when snapshot helpers receive no explicit request', () => {
    const workspaceSnapshot = createWorkspaceSnapshotFromStores()
    const localPreferencesSnapshot = createLocalPreferencesSnapshotFromStores()

    expect(workspaceSnapshot.workspace.id).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(workspaceSnapshot.workspace.name).toBe(DEFAULT_LOCAL_WORKSPACE_NAME)
    expect(workspaceSnapshot.exportedAt).toEqual(expect.any(String))
    expect(localPreferencesSnapshot.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(localPreferencesSnapshot.exportedAt).toEqual(expect.any(String))
  })

  it('captures local-only preferences separately from durable workspace content', () => {
    useUiStore.setState({
      selectedVector: 'backend',
      panelRatio: 0.55,
      appearance: 'dark',
      viewMode: 'live',
      showHeatmap: true,
      showDesignHealth: false,
      suggestionModeActive: true,
      comparisonVector: 'all',
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 30,
      backupReminderSnoozedUntil: '2026-03-20T12:00:00.000Z',
      lastBackupAt: '2026-03-01T12:00:00.000Z',
      tourCompleted: true,
    })
    usePipelineStore.setState({
      entries: [],
      sortField: 'company',
      sortDir: 'desc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    usePrepStore.setState({
      decks: [],
      activeDeckId: 'prep-deck-1',
    })
    useLinkedInStore.setState({
      drafts: [],
      selectedDraftId: 'linkedin-1',
    })
    useRecruiterStore.setState({
      cards: [],
      selectedCardId: 'recruiter-1',
    })
    useDebriefStore.setState({
      sessions: [],
      selectedSessionId: 'debrief-1',
    })

    const snapshot = createLocalPreferencesSnapshotFromStores('ws-1', '2026-03-11T12:00:00.000Z')

    expect(snapshot.workspaceId).toBe('ws-1')
    expect(snapshot.ui.selectedVector).toBe('backend')
    expect(snapshot.ui.backupReminderIntervalDays).toBe(30)
    expect(snapshot.ui.lastBackupAt).toBe('2026-03-01T12:00:00.000Z')
    expect(snapshot.pipeline.sortField).toBe('company')
    expect(snapshot.prep.activeDeckId).toBe('prep-deck-1')
    expect(snapshot.linkedin.selectedDraftId).toBe('linkedin-1')
    expect(snapshot.recruiter.selectedCardId).toBe('recruiter-1')
    expect(snapshot.debrief.selectedSessionId).toBe('debrief-1')
    expect(snapshot.ui).not.toHaveProperty('comparisonVector')
  })

  it('hydrates workspace artifacts into stores without sharing snapshot references', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      workspaceName: 'Workspace One',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    snapshot.artifacts.resume.payload.meta.name = 'Hydrated Name'
    snapshot.artifacts.pipeline.payload.entries = [
      {
        id: 'pipe-1',
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'screening',
        comp: '',
        url: '',
        contact: '',
        vectorId: 'backend',
        jobDescription: '',
        presetId: null,
        resumeVariant: 'default',
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
        dateApplied: '2026-03-11',
        dateClosed: '',
        lastAction: '2026-03-11',
        createdAt: '2026-03-11',
        history: [{ date: '2026-03-11', note: 'Created' }],
      },
    ]
    snapshot.artifacts.prep.payload.decks = [
      {
        id: 'deck-1',
        title: 'Prep Deck',
        company: 'Acme',
        role: 'Staff Engineer',
        vectorId: 'backend',
        pipelineEntryId: 'pipe-1',
        updatedAt: '2026-03-11T12:00:00.000Z',
        cards: [],
      },
    ]
    snapshot.artifacts.coverLetters.payload.templates = [
      {
        id: 'letter-1',
        name: 'Default',
        header: 'Header',
        greeting: 'Hello',
        paragraphs: [],
        signOff: 'Thanks',
      },
    ]
    snapshot.artifacts.linkedin.payload.drafts = [
      {
        id: 'linkedin-1',
        name: 'Platform Draft',
        focus: 'Platform engineering',
        audience: 'Hiring managers',
        headline: 'Staff Platform Engineer',
        about: 'I build platform systems.',
        topSkills: ['Kubernetes'],
        featuredHighlights: ['Ported platform installs.'],
        generatedAt: '2026-03-11T12:00:00.000Z',
      },
    ]
    snapshot.artifacts.recruiter.payload.cards = [
      {
        id: 'recruiter-1',
        generatedAt: '2026-03-11T12:00:00.000Z',
        company: 'Acme',
        role: 'Staff Engineer',
        candidateName: 'Jane Smith',
        candidateTitle: 'Staff Platform Engineer',
        matchScore: 0.82,
        summary: 'Strong platform fit.',
        recruiterHook: 'Jane Smith is a strong fit for Acme.',
        suggestedIntro: 'Lead with platform migration wins.',
        topReasons: ['Strong match on platform scope'],
        proofPoints: ['Acme: Ported the platform to Kubernetes-based installs.'],
        skillHighlights: ['Kubernetes'],
        positioningAngles: ['Lead with platform reliability.'],
        likelyConcerns: ['Domain ramp may take time.'],
        gapBridges: ['Bridge through adjacent platform delivery work.'],
        notes: 'Keep the positioning grounded in the match report.',
      },
    ]
    snapshot.artifacts.debrief.payload.sessions = [
      {
        id: 'debrief-1',
        generatedAt: '2026-03-11T12:00:00.000Z',
        company: 'Acme',
        role: 'Staff Engineer',
        sourceKind: 'pipeline',
        pipelineEntryId: 'pipe-1',
        roundName: 'Hiring Manager',
        interviewDate: '2026-03-11',
        outcome: 'advance',
        jobDescription: 'Build platforms',
        rawNotes: 'Talked through platform migration.',
        questionsAsked: [{ question: 'Tell me about platform migrations.' }],
        whatWorked: ['Clear migration story'],
        whatDidnt: ['Metrics were fuzzy'],
        storiesTold: [],
        summary: 'Strong platform narrative.',
        overallTakeaway: 'Lead with the migration story.',
        anchorStories: [],
        recurringGaps: [],
        bestFitCompanyTypes: [],
        identityDraft: {
          generatedAt: '2026-03-11T12:00:00.000Z',
          summary: 'Confirm impact metrics.',
          followUpQuestions: ['What was the rollout size?'],
          identity: {
            version: 3,
            schema_revision: '3.1',
            identity: {
              name: 'Jane Smith',
              email: '',
              phone: '',
              location: '',
              links: [],
              thesis: '',
            },
            self_model: {
              arc: [],
              philosophy: [],
              interview_style: {
                strengths: [],
                weaknesses: [],
                prep_strategy: '',
              },
            },
            preferences: {
              compensation: { priorities: [] },
              work_model: { preference: 'remote' },
              matching: { prioritize: [], avoid: [] },
            },
            skills: { groups: [] },
            profiles: [],
            roles: [],
            projects: [],
            education: [],
            generator_rules: {
              voice_skill: 'voice',
              resume_skill: 'resume',
            },
          },
          bullets: [],
          warnings: [],
        },
        correctionNotes: ['Add the production rollout metric.'],
        followUpQuestions: ['What was the rollout size?'],
        warnings: [],
      },
    ]
    snapshot.artifacts.research.payload.profile = {
      id: 'profile-1',
      skills: [],
      vectors: [],
      workSummary: [],
      openQuestions: [],
      constraints: {
        compensation: '',
        locations: [],
        clearance: '',
        companySize: '',
      },
      filters: {
        prioritize: [],
        avoid: [],
      },
      interviewPrefs: {
        strongFit: [],
        redFlags: [],
      },
      inferredAt: '2026-03-11T12:00:00.000Z',
      inferredFromResumeVersion: 1,
    }

    applyWorkspaceSnapshotToStores(snapshot)

    useResumeStore.getState().updateMetaField('name', 'Mutated In Store')

    expect(useResumeStore.getState().data.meta.name).toBe('Mutated In Store')
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    expect(usePrepStore.getState().activeDeckId).toBe('deck-1')
    expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    expect(useLinkedInStore.getState().drafts).toHaveLength(1)
    expect(useRecruiterStore.getState().cards).toHaveLength(1)
    expect(useDebriefStore.getState().sessions).toHaveLength(1)
    expect(useSearchStore.getState().profile?.id).toBe('profile-1')
    expect(snapshot.artifacts.resume.payload.meta.name).toBe('Hydrated Name')
  })

  it('hydrates local preferences into UI, pipeline, and prep stores', () => {
    const snapshot: FacetLocalPreferencesSnapshot = {
      snapshotVersion: 1,
      workspaceId: 'ws-1',
      ui: {
        selectedVector: 'backend',
        panelRatio: 0.6,
        appearance: 'dark',
        viewMode: 'live',
        showHeatmap: true,
        showDesignHealth: true,
        suggestionModeActive: true,
        backupRemindersEnabled: true,
        backupReminderIntervalDays: 7,
        backupReminderSnoozedUntil: '2026-03-18T12:00:00.000Z',
        lastBackupAt: '2026-03-10T12:00:00.000Z',
        tourCompleted: true,
      },
      pipeline: {
        sortField: 'company',
        sortDir: 'desc',
      },
      prep: {
        activeDeckId: 'deck-1',
      },
      linkedin: {
        selectedDraftId: 'linkedin-1',
      },
      recruiter: {
        selectedCardId: 'recruiter-1',
      },
      debrief: {
        selectedSessionId: 'debrief-1',
      },
      exportedAt: '2026-03-11T12:00:00.000Z',
    }

    applyLocalPreferencesSnapshotToStores(snapshot)

    expect(useUiStore.getState().appearance).toBe('dark')
    expect(useUiStore.getState().selectedVector).toBe('backend')
    expect(useUiStore.getState().backupReminderSnoozedUntil).toBe('2026-03-18T12:00:00.000Z')
    expect(usePipelineStore.getState().sortField).toBe('company')
    expect(usePipelineStore.getState().sortDir).toBe('desc')
    expect(usePrepStore.getState().activeDeckId).toBe('deck-1')
    expect(useLinkedInStore.getState().selectedDraftId).toBe('linkedin-1')
    expect(useRecruiterStore.getState().selectedCardId).toBe('recruiter-1')
    expect(useDebriefStore.getState().selectedSessionId).toBe('debrief-1')
  })

  it('documents the migration map from legacy storage keys', () => {
    expect(DURABLE_PERSISTENCE_BOUNDARIES.map((entry) => entry.source)).toEqual([
      'resumeStore.data',
      'pipelineStore.entries',
      'prepStore.decks',
      'coverLetterStore.templates',
      'linkedinStore.drafts',
      'recruiterStore.cards',
      'debriefStore.sessions',
      'searchStore.profile,requests,runs',
    ])
    expect(LOCAL_ONLY_PERSISTENCE_BOUNDARIES.map((entry) => entry.target)).toEqual([
      'localPreferences.ui',
      'excluded',
      'localPreferences.pipeline',
      'localPreferences.prep',
      'localPreferences.linkedin',
      'localPreferences.recruiter',
      'localPreferences.debrief',
    ])
    expect(LEGACY_PERSISTENCE_MIGRATION_PLAN.map((entry) => entry.storageKey)).toEqual([
      'vector-resume-data',
      'facet-pipeline-data',
      'facet-prep-workspace',
      'facet-prep-data',
      'facet-cover-letter-data',
      'facet-linkedin-workspace',
      'facet-debrief-workspace',
      'facet-search-data',
      'vector-resume-ui',
    ])
  })

  it('applies workspace patches immutably across workspace metadata and artifacts', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const patched = applyWorkspacePatch(snapshot, {
      tenantId: 'tenant-1',
      userId: 'user-1',
      workspace: {
        name: 'Team Workspace',
      },
      artifacts: {
        pipeline: {
          revision: 4,
        },
      },
    })

    expect(patched.tenantId).toBe('tenant-1')
    expect(patched.userId).toBe('user-1')
    expect(patched.workspace.name).toBe('Team Workspace')
    expect(patched.artifacts.pipeline.revision).toBe(4)
    expect(snapshot.tenantId).toBeNull()
    expect(snapshot.userId).toBeNull()
    expect(snapshot.workspace.name).toBe('Facet Local Workspace')
    expect(snapshot.artifacts.pipeline.revision).toBe(0)
  })

  it('returns false when no legacy persisted storage is present', () => {
    expect(hydrateStoresFromLegacyStorage()).toBe(false)
    expect(useResumeStore.getState().data).toEqual(defaultResumeData)
    expect(usePipelineStore.getState().entries).toEqual([])
  })

  it('preserves workspace identity even when runtime patches attempt to change workspace ids', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-stable',
      workspaceName: 'Stable Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const patched = applyWorkspacePatch(snapshot, {
      workspace: {
        name: 'Renamed Workspace',
        id: 'ws-forged',
      } as never,
    })

    expect(patched.workspace.id).toBe('ws-stable')
    expect(patched.workspace.name).toBe('Renamed Workspace')
  })

  it('preserves artifact identity fields when runtime patches include unexpected artifact metadata', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-identity',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const patched = applyWorkspacePatch(snapshot, {
      artifacts: {
        resume: {
          revision: 9,
          payload: {
            ...snapshot.artifacts.resume.payload,
            meta: {
              ...snapshot.artifacts.resume.payload.meta,
              name: 'Patched Name',
            },
          },
          artifactId: 'forged-artifact-id',
          artifactType: 'pipeline',
          workspaceId: 'other-workspace',
          schemaVersion: 999,
          updatedAt: '2020-01-01T00:00:00.000Z',
        } as never,
      },
    })

    expect(patched.artifacts.resume.artifactId).toBe(snapshot.artifacts.resume.artifactId)
    expect(patched.artifacts.resume.artifactType).toBe('resume')
    expect(patched.artifacts.resume.workspaceId).toBe('ws-identity')
    expect(patched.artifacts.resume.schemaVersion).toBe(snapshot.artifacts.resume.schemaVersion)
    expect(patched.artifacts.resume.updatedAt).not.toBe(snapshot.artifacts.resume.updatedAt)
    expect(patched.artifacts.resume.revision).toBe(9)
    expect(patched.artifacts.resume.payload.meta.name).toBe('Patched Name')
  })

  it('treats empty patches as immutable no-ops and rejects unknown artifact keys', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-empty',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const unchanged = applyWorkspacePatch(snapshot, {})
    expect(unchanged).toEqual(snapshot)
    expect(unchanged).not.toBe(snapshot)

    expect(() =>
      applyWorkspacePatch(
        snapshot,
        {
          artifacts: {
            bogus: { revision: 1 },
          } as never,
        },
      ),
    ).toThrow(/Unknown artifact type/)

    expect(() =>
      applyWorkspacePatch(
        snapshot,
        {
          artifacts: {
            resume: 42 as never,
          },
        },
      ),
    ).toThrow(/Artifact patch must be an object/)

    const withNullArtifactPatch = applyWorkspacePatch(snapshot, {
      artifacts: {
        resume: null as never,
      },
    })
    expect(withNullArtifactPatch.artifacts.resume).toEqual(snapshot.artifacts.resume)
  })

  it('provides a backend-agnostic persistence coordinator', async () => {
    const backend = createInMemoryPersistenceBackend()
    const coordinator = createPersistenceCoordinator({
      backend,
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const exported = await coordinator.exportWorkspaceSnapshot({
      workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
      exportedAt: '2026-03-11T12:00:00.000Z',
    })
    expect(exported.workspace.id).toBe(DEFAULT_LOCAL_WORKSPACE_ID)

    const saved = await coordinator.saveWorkspacePatch(DEFAULT_LOCAL_WORKSPACE_ID, {
      workspace: {
        name: 'Team Workspace',
      },
      tenantId: 'tenant-1',
      userId: 'user-1',
    })

    expect(saved.workspace.name).toBe('Team Workspace')
    expect(saved.workspace.revision).toBe(1)
    expect(saved.tenantId).toBe('tenant-1')
    expect(saved.userId).toBe('user-1')
    expect(saved.workspace.updatedAt).not.toBe('2026-03-11T12:00:00.000Z')

    const bootstrapped = await coordinator.bootstrap(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(bootstrapped.snapshot?.workspace.name).toBe('Team Workspace')
    expect(bootstrapped.status.phase).toBe('ready')
  })

  it('returns defensive status clones and loads persisted workspaces directly', async () => {
    const backend = createInMemoryPersistenceBackend()
    const seeded = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-load',
      workspaceName: 'Loaded Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })
    backend.saveWorkspaceSnapshot(seeded)

    const coordinator = createPersistenceCoordinator({
      backend,
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const loaded = await coordinator.loadWorkspace('ws-load')
    expect(loaded?.workspace.name).toBe('Loaded Workspace')

    const firstStatus = coordinator.getStatus()
    firstStatus.phase = 'error'
    firstStatus.activeWorkspaceId = 'tampered'

    const secondStatus = coordinator.getStatus()
    expect(secondStatus.phase).toBe('ready')
    expect(secondStatus.activeWorkspaceId).toBe('ws-load')
    expect(secondStatus.lastHydratedAt).toEqual(expect.any(String))
  })

  it('increments revision from the persisted snapshot, not from the patch payload', async () => {
    const backend = createInMemoryPersistenceBackend()
    const coordinator = createPersistenceCoordinator({
      backend,
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const first = await coordinator.saveWorkspacePatch(DEFAULT_LOCAL_WORKSPACE_ID, {
      workspace: {
        name: 'First save',
      },
    })
    const second = await coordinator.saveWorkspacePatch(DEFAULT_LOCAL_WORKSPACE_ID, {
      workspace: {
        name: 'Second save',
      },
    })

    expect(first.workspace.revision).toBe(1)
    expect(second.workspace.revision).toBe(2)
  })

  it('imports validated workspace snapshots in replace and merge modes', async () => {
    const backend = createInMemoryPersistenceBackend()
    const mergeImportedSnapshot = vi.fn((current, imported) => ({
      ...(current ?? imported),
      ...imported,
      workspace: {
        ...imported.workspace,
        name: `${current?.workspace.name ?? 'current'} + ${imported.workspace.name}`,
      },
    }))
    const coordinator = createPersistenceCoordinator({
      backend,
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
      mergeImportedSnapshot,
    })

    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-import',
      workspaceName: 'Imported Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })
    assertValidWorkspaceSnapshot(imported)

    const replaced = await coordinator.importWorkspaceSnapshot(imported, { mode: 'replace' })
    expect(replaced.workspace.name).toBe('Imported Workspace')
    expect(mergeImportedSnapshot).not.toHaveBeenCalled()

    const merged = await coordinator.importWorkspaceSnapshot(
      {
        ...imported,
        workspace: {
          ...imported.workspace,
          name: 'Merged Workspace',
        },
      },
      { mode: 'merge' },
    )
    expect(merged.workspace.name).toBe('Imported Workspace + Merged Workspace')
    expect(mergeImportedSnapshot).toHaveBeenCalledTimes(1)
  })

  it('surfaces coordinator errors for invalid imports and failing backends', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: {
        kind: 'memory',
        loadWorkspaceSnapshot: () => {
          throw new Error('load failed')
        },
        saveWorkspaceSnapshot: (snapshot) => snapshot,
      },
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    await expect(coordinator.bootstrap('broken')).rejects.toThrow('load failed')
    expect(coordinator.getStatus().phase).toBe('error')
    expect(coordinator.getStatus().lastError).toBe('load failed')

    const mergeCoordinator = createPersistenceCoordinator({
      backend: createInMemoryPersistenceBackend(),
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-import',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    let saveCalls = 0
    const validationCoordinator = createPersistenceCoordinator({
      backend: {
        kind: 'memory',
        loadWorkspaceSnapshot: () => null,
        saveWorkspaceSnapshot: (snapshot) => {
          saveCalls += 1
          return snapshot
        },
      },
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    await expect(
      validationCoordinator.importWorkspaceSnapshot(
        {
          ...imported,
          snapshotVersion: 999 as 1,
        },
        { mode: 'replace' },
      ),
    ).rejects.toThrow(/expected 1, got 999/)
    expect(saveCalls).toBe(0)
    expect(validationCoordinator.getStatus().phase).toBe('idle')

    await expect(
      mergeCoordinator.importWorkspaceSnapshot(
        imported,
        { mode: 'merge' },
      ),
    ).rejects.toThrow(/Merge import requires mergeImportedSnapshot/)
  })

  it('bootstraps empty backends without claiming hydration', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: createInMemoryPersistenceBackend(),
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const result = await coordinator.bootstrap('empty-workspace')
    expect(result.snapshot).toBeNull()
    expect(result.status.phase).toBe('ready')
    expect(result.status.lastHydratedAt).toBeNull()
  })

  it('validates workspace snapshot edge cases directly', () => {
    expect(() => assertValidWorkspaceSnapshot(null)).toThrow(/must be an object/)
    expect(() => assertValidWorkspaceSnapshot([])).toThrow(/must be an object/)
    expect(() => assertValidWorkspaceSnapshot(undefined)).toThrow(/must be an object/)
    expect(() => assertValidWorkspaceSnapshot(42)).toThrow(/must be an object/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        snapshotVersion: 1,
        workspace: { id: 42 },
        artifacts: {},
      }),
    ).toThrow(/workspace.id string/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        snapshotVersion: 1,
      }),
    ).toThrow(/workspace.id string/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        snapshotVersion: 1,
        workspace: { id: 'ws-1' },
      }),
    ).toThrow(/valid workspace metadata/)

    const valid = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          resume: undefined,
        },
      }),
    ).toThrow(/artifacts.resume/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          resume: {
            ...valid.artifacts.resume,
            artifactType: 'pipeline',
          },
        },
      }),
    ).toThrow(/mismatched artifacts.resume.artifactType/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          resume: {
            ...valid.artifacts.resume,
            payload: undefined,
          },
        },
      }),
    ).toThrow(/missing artifacts.resume.payload/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        workspace: {
          ...valid.workspace,
          revision: 'bad',
        },
      }),
    ).toThrow(/valid workspace metadata/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          pipeline: {
            ...valid.artifacts.pipeline,
            schemaVersion: 'bad',
          },
        },
      }),
    ).toThrow(/invalid artifacts.pipeline metadata/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          prep: {
            ...valid.artifacts.prep,
            payload: {
              decks: null,
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.prep.payload.decks/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          coverLetters: {
            ...valid.artifacts.coverLetters,
            payload: {
              templates: null,
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.coverLetters.payload.templates/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          research: {
            ...valid.artifacts.research,
            payload: {
              profile: [],
              requests: [],
              runs: [],
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.research.payload shape/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          research: {
            ...valid.artifacts.research,
            payload: {
              profile: null,
              requests: null,
              runs: [],
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.research.payload shape/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          research: {
            ...valid.artifacts.research,
            payload: {
              profile: null,
              requests: [],
              runs: null,
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.research.payload shape/)
    expect(() =>
      assertValidWorkspaceSnapshot({
        ...valid,
        artifacts: {
          ...valid.artifacts,
          pipeline: {
            ...valid.artifacts.pipeline,
            payload: {
              entries: null,
            },
          },
        },
      }),
    ).toThrow(/invalid artifacts.pipeline.payload.entries/)
  })

  it('uses native structuredClone when available and preserves non-JSON-safe details', () => {
    const createdAt = new Date('2026-03-11T12:00:00.000Z')
    const original = {
      nested: { count: 1 },
      createdAt,
      optional: undefined as string | undefined,
    }

    const cloned = cloneValue(original)

    expect(cloned).not.toBe(original)
    expect(cloned.nested).not.toBe(original.nested)
    expect(cloned.createdAt).toBeInstanceOf(Date)
    expect(cloned.createdAt).toEqual(createdAt)
    expect(cloned).toHaveProperty('optional', undefined)

    cloned.nested.count = 2
    expect(original.nested.count).toBe(1)
  })

  it('loads missing workspaces as null while leaving the coordinator ready', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: createInMemoryPersistenceBackend(),
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    const loaded = await coordinator.loadWorkspace('missing-workspace')
    expect(loaded).toBeNull()
    expect(coordinator.getStatus().phase).toBe('ready')
  })

  it('normalizes imported snapshots that predate recruiter, linkedin, and debrief artifacts', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: createInMemoryPersistenceBackend(),
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
      mergeImportedSnapshot: (_, imported) => imported,
    })

    const legacySnapshot = buildWorkspaceSnapshot()
    delete ((legacySnapshot.artifacts as unknown) as { recruiter?: unknown }).recruiter
    delete ((legacySnapshot.artifacts as unknown) as { linkedin?: unknown }).linkedin
    delete ((legacySnapshot.artifacts as unknown) as { debrief?: unknown }).debrief

    const saved = await coordinator.importWorkspaceSnapshot(legacySnapshot as typeof legacySnapshot)

    expect(saved.artifacts.recruiter.payload.cards).toEqual([])
    expect(saved.artifacts.recruiter.artifactType).toBe('recruiter')
    expect(saved.artifacts.linkedin.payload.drafts).toEqual([])
    expect(saved.artifacts.linkedin.artifactType).toBe('linkedin')
    expect(saved.artifacts.debrief.payload.sessions).toEqual([])
    expect(saved.artifacts.debrief.artifactType).toBe('debrief')
  })

  it('surfaces loadWorkspace backend failures as error status', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: {
        kind: 'memory',
        loadWorkspaceSnapshot: () => {
          throw new Error('load failed')
        },
        saveWorkspaceSnapshot: (snapshot) => snapshot,
      },
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    await expect(coordinator.loadWorkspace('broken-workspace')).rejects.toThrow('load failed')
    expect(coordinator.getStatus().phase).toBe('error')
    expect(coordinator.getStatus().lastError).toBe('load failed')
  })

  it('surfaces save and import backend write failures as error status', async () => {
    const failingBackend = {
      kind: 'memory' as const,
      loadWorkspaceSnapshot: () => null,
      saveWorkspaceSnapshot: () => {
        throw new Error('save failed')
      },
    }

    const coordinator = createPersistenceCoordinator({
      backend: failingBackend,
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    await expect(
      coordinator.saveWorkspacePatch('broken-save', {
        workspace: {
          name: 'Broken',
        },
      }),
    ).rejects.toThrow('save failed')
    expect(coordinator.getStatus().phase).toBe('error')
    expect(coordinator.getStatus().lastError).toBe('save failed')

    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'broken-import',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    await expect(
      coordinator.importWorkspaceSnapshot(imported, { mode: 'replace' }),
    ).rejects.toThrow('save failed')
    expect(coordinator.getStatus().phase).toBe('error')
    expect(coordinator.getStatus().lastError).toBe('save failed')
  })

  it('clones primitives and exercises the JSON fallback path explicitly', () => {
    expect(cloneValue(42)).toBe(42)
    expect(cloneValue('facet')).toBe('facet')
    expect(cloneValue(null)).toBeNull()
    expect(cloneValue(true)).toBe(true)

    vi.stubGlobal('structuredClone', undefined)

    const original = {
      nested: { count: 1 },
      createdAt: new Date('2026-03-11T12:00:00.000Z'),
      optional: undefined as string | undefined,
    }
    const cloned = cloneValue(original) as typeof original & { createdAt: string }

    expect(cloned).toEqual({
      nested: { count: 1 },
      createdAt: '2026-03-11T12:00:00.000Z',
    })

    cloned.nested.count = 2
    expect(original.nested.count).toBe(1)
  })

  it('surfaces generic bootstrap errors when the backend throws non-Error values', async () => {
    const coordinator = createPersistenceCoordinator({
      backend: {
        kind: 'memory',
        loadWorkspaceSnapshot: () => {
          throw 'bootstrap failed'
        },
        saveWorkspaceSnapshot: (snapshot) => snapshot,
      },
      readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    })

    let thrown: unknown = null

    try {
      await coordinator.bootstrap('broken-workspace')
    } catch (error) {
      thrown = error
    }

    expect(thrown).not.toBeNull()
    expect(coordinator.getStatus().phase).toBe('error')
    expect(coordinator.getStatus().lastError).toBe('Failed to bootstrap persistence')
  })

  it('keeps the in-memory backend isolated across save, load, list, and delete', async () => {
    const backend = createInMemoryPersistenceBackend()
    const first = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      workspaceName: 'First',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })
    const second = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-2',
      workspaceName: 'Second',
      exportedAt: '2026-03-11T12:05:00.000Z',
    })

    backend.saveWorkspaceSnapshot(first)
    backend.saveWorkspaceSnapshot(second)
    first.workspace.name = 'Mutated after save'

    const loaded = await backend.loadWorkspaceSnapshot('ws-1')
    expect(loaded?.workspace.name).toBe('First')

    const listed = await backend.listWorkspaceSnapshots?.()
    expect(listed).toHaveLength(2)
    if (listed?.[0]) {
      listed[0].workspace.name = 'Mutated listed copy'
    }

    const loadedAgain = await backend.loadWorkspaceSnapshot('ws-1')
    expect(loadedAgain?.workspace.name).toBe('First')

    await backend.deleteWorkspaceSnapshot?.('ws-1')
    expect(await backend.loadWorkspaceSnapshot('ws-1')).toBeNull()
  })
})
