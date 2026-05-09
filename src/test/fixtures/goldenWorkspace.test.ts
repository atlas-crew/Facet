// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { defaultResumeData } from '../../store/defaultData'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useDebriefStore } from '../../store/debriefStore'
import { useIdentityStore } from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { useLinkedInStore } from '../../store/linkedinStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { usePrepStore } from '../../store/prepStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../../store/resumeStore'
import { useSearchStore } from '../../store/searchStore'
import { createWorkspaceSnapshotFromStores } from '../../persistence/snapshot'
import { assertValidWorkspaceSnapshot } from '../../persistence/validation'
import { buildMayaPatelPersona, validatePersona } from './personas'
import {
  buildMayaPatelGoldenWorkspace,
  IDENTITY_STORE_VERSION,
  MAYA_PATEL_GOLDEN_WORKSPACE_ID,
} from './goldenWorkspace'

const resetStores = () => {
  useResumeStore.setState({
    ...normalizeResumeWorkspaceData(defaultResumeData),
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
  useJDAnalysisStore.setState({ analyses: [] })
  usePrepStore.setState({ decks: [], activeDeckId: null })
  useCoverLetterStore.setState({
    letters: [],
    snapshots: [],
    activeLetterId: null,
    templates: [],
  })
  useLinkedInStore.setState({ drafts: [], selectedDraftId: null })
  useRecruiterStore.setState({ cards: [], selectedCardId: null })
  useDebriefStore.setState({ sessions: [], selectedSessionId: null })
  useSearchStore.setState({
    profile: null,
    requests: [],
    runs: [],
    theses: [],
    activeThesisId: null,
    feedbackEvents: [],
    activeResearchJob: null,
  })
  useIdentityStore.setState({
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: null,
    draft: null,
    draftDocument: '',
    scanResult: null,
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
  })
}

describe('Maya Patel golden workspace fixture', () => {
  beforeEach(() => resetStores())

  it('builds a valid workspace snapshot with an explicit identity payload', () => {
    const golden = buildMayaPatelGoldenWorkspace()

    expect(() => assertValidWorkspaceSnapshot(golden.snapshot)).not.toThrow()
    expect(golden.snapshot.workspace.id).toBe(MAYA_PATEL_GOLDEN_WORKSPACE_ID)
    expect(golden.identity.identity.name).toBe('Maya Patel')
    expect(golden.identityStorageEnvelope.version).toBe(IDENTITY_STORE_VERSION)
    expect(golden.identityStorageEnvelope.state.currentIdentity.identity.name).toBe('Maya Patel')
    expect(golden.identityStorageEnvelope.state.draftDocument).toContain('"name": "Maya Patel"')
    expect(golden.snapshot.artifacts.pipeline.payload.entries[0]?.jdAnalysisId).toBe(
      'jd-pillar-maya-1',
    )
    expect(golden.snapshot.artifacts.coverLetters.payload.letters[0]?.sourceResumeId).toBe(
      'resume-maya-appsec',
    )
  })

  it('returns cloned data instead of mutating persona singletons', () => {
    const first = buildMayaPatelGoldenWorkspace()
    first.snapshot.artifacts.pipeline.payload.entries[0]!.company = 'Mutated Company'
    first.identity.identity.name = 'Mutated Name'

    const second = buildMayaPatelGoldenWorkspace()
    const persona = buildMayaPatelPersona()

    expect(second.snapshot.artifacts.pipeline.payload.entries[0]?.company).toBe('Pillar Systems')
    expect(second.identity.identity.name).toBe('Maya Patel')
    expect(persona.pipelineEntries[0]?.company).toBe('Pillar Systems')
    expect(validatePersona(persona).filter((issue) => issue.level === 'error')).toEqual([])
  })

  it('hydrates workspace and identity stores, then re-exports durable golden artifacts', () => {
    const golden = buildMayaPatelGoldenWorkspace()

    golden.hydrateIntoStores()

    expect(useIdentityStore.getState().currentIdentity?.identity.name).toBe('Maya Patel')
    expect(usePipelineStore.getState().entries.map((entry) => entry.id)).toContain('pipe-pillar')
    expect(useJDAnalysisStore.getState().analyses.map((analysis) => analysis.id)).toContain(
      'jd-pillar-maya-1',
    )
    expect(useCoverLetterStore.getState().letters.map((letter) => letter.id)).toContain(
      'cover-pillar-maya-1',
    )
    expect(useLinkedInStore.getState().drafts.map((draft) => draft.id)).toContain(
      'linkedin-maya-appsec',
    )
    expect(useRecruiterStore.getState().cards.map((card) => card.id)).toContain(
      'recruiter-pillar-maya-1',
    )
    expect(useDebriefStore.getState().sessions.map((session) => session.id)).toContain(
      'debrief-pillar-r1',
    )
    expect(useSearchStore.getState().runs.map((run) => run.id)).toContain(
      'srun-maya-pillar-discovery',
    )

    const reexported = createWorkspaceSnapshotFromStores({
      workspaceId: golden.snapshot.workspace.id,
      workspaceName: golden.snapshot.workspace.name,
      exportedAt: golden.snapshot.exportedAt,
    })

    expect(() => assertValidWorkspaceSnapshot(reexported)).not.toThrow()
    expect(reexported.artifacts.resume.payload.resumes.map((resume) => resume.id)).toContain(
      'resume-maya-appsec',
    )
    expect(reexported.artifacts.pipeline.payload.entries.map((entry) => entry.id)).toContain(
      'pipe-pillar',
    )
    expect(
      reexported.artifacts.jdAnalysis.payload.analyses.map((analysis) => analysis.id),
    ).toContain('jd-pillar-maya-1')
    expect(reexported.artifacts.prep.payload.decks.map((deck) => deck.id)).toContain(
      'deck-pillar-r2',
    )
    expect(
      reexported.artifacts.coverLetters.payload.snapshots.map((snapshot) => snapshot.id),
    ).toContain('cover-snap-pillar-maya-1')
    expect(reexported.artifacts.coverLetters.payload.letters[0]?.contentHash).toBe(
      golden.snapshot.artifacts.coverLetters.payload.letters[0]?.contentHash,
    )
    expect(reexported.artifacts.coverLetters.payload.snapshots[0]?.contentHash).toBe(
      golden.snapshot.artifacts.coverLetters.payload.snapshots[0]?.contentHash,
    )
    expect(reexported.artifacts.linkedin.payload.drafts.map((draft) => draft.id)).toContain(
      'linkedin-maya-appsec',
    )
    expect(reexported.artifacts.recruiter.payload.cards.map((card) => card.id)).toContain(
      'recruiter-pillar-maya-1',
    )
    expect(reexported.artifacts.debrief.payload.sessions.map((session) => session.id)).toContain(
      'debrief-pillar-r1',
    )
    expect(reexported.artifacts.research.payload.requests.map((request) => request.id)).toContain(
      'sreq-maya-payments-appsec',
    )
    expect(reexported.artifacts.research.payload.theses?.map((thesis) => thesis.id)).toContain(
      'thesis-maya-payments-appsec',
    )
  })
})
