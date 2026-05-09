// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useDebriefStore } from '../store/debriefStore'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useLinkedInStore } from '../store/linkedinStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useRecruiterStore } from '../store/recruiterStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { loadGoldenDemoWorkspace } from '../dev/goldenDemoWorkspace'
import { applyWorkspaceSnapshotToStores } from '../persistence/hydration'
import type { FacetWorkspaceSnapshot } from '../persistence'

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

describe('golden demo workspace loader', () => {
  beforeEach(() => resetStores())

  it('replaces workspace stores through the runtime and hydrates identity explicitly', async () => {
    const importWorkspaceSnapshot = vi.fn(
      async (snapshot: FacetWorkspaceSnapshot): Promise<FacetWorkspaceSnapshot> => {
        applyWorkspaceSnapshotToStores(snapshot)
        return snapshot
      },
    )

    const result = await loadGoldenDemoWorkspace({ importWorkspaceSnapshot })

    expect(importWorkspaceSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ name: 'Maya Patel Golden Workspace' }),
      }),
      { mode: 'replace' },
    )
    expect(result.identityName).toBe('Maya Patel')
    expect(result.workspaceName).toBe('Maya Patel Golden Workspace')
    expect(useIdentityStore.getState().intakeMode).toBe('paste')
    expect(useIdentityStore.getState().currentIdentity?.identity.name).toBe('Maya Patel')
    expect(usePipelineStore.getState().entries.map((entry) => entry.id)).toContain('pipe-pillar')
    expect(useJDAnalysisStore.getState().analyses.map((analysis) => analysis.id)).toContain(
      'jd-pillar-maya-1',
    )
    expect(usePrepStore.getState().decks.map((deck) => deck.id)).toContain('deck-pillar-r2')
    expect(useSearchStore.getState().runs.map((run) => run.id)).toContain(
      'srun-maya-pillar-discovery',
    )
  })
})
