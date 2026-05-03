import { create } from 'zustand'
import type {
  CoverLetter,
  CoverLetterContent,
  CoverLetterSnapshot,
  CoverLetterTemplate,
  CoverLetterWorkspaceData,
} from '../types/coverLetter'
import {
  coverLetterContentFromInput,
  coverLetterToLegacyTemplate,
  createCoverLetterEntity,
  normalizeCoverLetterWorkspacePayload,
  updateCoverLetterEntity,
} from '../utils/coverLetterEntities'

interface CreateCoverLetterInput {
  content: CoverLetterContent
  pipelineEntryId: string
  sourceResumeId: string
  sourceResumeHash: string
  identityVersion?: number | null
  identityFields?: string[]
  generatedAt?: string
  id?: string
}

type CoverLetterTemplatePatch = Partial<CoverLetterContent> &
  Partial<Pick<CoverLetter, 'stalenessReview'>>

interface CoverLetterState {
  letters: CoverLetter[]
  snapshots: CoverLetterSnapshot[]
  activeLetterId: string | null

  templates: CoverLetterTemplate[]

  createLetter: (input: CreateCoverLetterInput) => CoverLetter
  upsertLetterForPipelineEntry: (input: CreateCoverLetterInput) => CoverLetter
  updateLetter: (
    id: string,
    patch: Partial<CoverLetterContent> &
      Partial<Pick<CoverLetter, 'sourceResumeId' | 'sourceResumeHash' | 'identityVersion' | 'identityFields' | 'stalenessReview'>>,
  ) => void
  deleteLetter: (id: string) => void
  addSnapshot: (snapshot: CoverLetterSnapshot) => void
  removeSnapshot: (id: string) => void
  importWorkspaceData: (data: CoverLetterWorkspaceData) => void

  addTemplate: (
    template: CoverLetterTemplate & { sourceResumeId?: string; sourceResumeHash?: string },
  ) => void
  updateTemplate: (id: string, patch: CoverLetterTemplatePatch) => void
  deleteTemplate: (id: string) => void
  importTemplates: (templates: CoverLetterTemplate[]) => void
}

const legacyTemplatesFromLetters = (letters: CoverLetter[]) =>
  letters.map((letter) => coverLetterToLegacyTemplate(letter))

const stateFromWorkspaceData = (data: CoverLetterWorkspaceData) => ({
  letters: data.letters,
  snapshots: data.snapshots,
  activeLetterId: data.letters[0]?.id ?? null,
  templates: legacyTemplatesFromLetters(data.letters),
})

export const useCoverLetterStore = create<CoverLetterState>()((set, get) => ({
  letters: [],
  snapshots: [],
  activeLetterId: null,
  templates: [],

  createLetter: (input) => {
    if (get().letters.some((letter) => letter.id === input.id)) {
      throw new Error(`Cover letter "${input.id}" already exists.`)
    }
    const letter = createCoverLetterEntity(input)
    set((state) => {
      const letters = [...state.letters, letter]
      return {
        letters,
        templates: legacyTemplatesFromLetters(letters),
        activeLetterId: letter.id,
      }
    })
    return letter
  },

  upsertLetterForPipelineEntry: (input) => {
    const existing = get().letters.find((letter) => letter.pipelineEntryId === input.pipelineEntryId)
    if (!existing) {
      return get().createLetter(input)
    }

    const letter = updateCoverLetterEntity(existing, {
      ...coverLetterContentFromInput(input.content),
      sourceResumeId: input.sourceResumeId,
      sourceResumeHash: input.sourceResumeHash,
      identityVersion: input.identityVersion ?? null,
      identityFields: input.identityFields,
    })
    set((state) => {
      const letters = state.letters.map((item) => (item.id === letter.id ? letter : item))
      return {
        letters,
        templates: legacyTemplatesFromLetters(letters),
        activeLetterId: letter.id,
      }
    })
    return letter
  },

  updateLetter: (id, patch) => {
    set((state) => {
      const letters = state.letters.map((letter) =>
        letter.id === id ? updateCoverLetterEntity(letter, patch) : letter,
      )
      return {
        letters,
        templates: legacyTemplatesFromLetters(letters),
      }
    })
  },

  deleteLetter: (id) => {
    set((state) => {
      const letters = state.letters.filter((letter) => letter.id !== id)
      const activeLetterId =
        state.activeLetterId === id ? letters[0]?.id ?? null : state.activeLetterId
      return {
        letters,
        templates: legacyTemplatesFromLetters(letters),
        activeLetterId,
      }
    })
  },

  addSnapshot: (snapshot) => {
    set((state) => ({
      snapshots: (
        state.snapshots.some((existing) => existing.id === snapshot.id)
          ? state.snapshots.map((existing) => (existing.id === snapshot.id ? snapshot : existing))
          : [...state.snapshots, snapshot]
      ).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
  },

  removeSnapshot: (id) => {
    set((state) => ({
      snapshots: state.snapshots.filter((snapshot) => snapshot.id !== id),
    }))
  },

  importWorkspaceData: (data) => {
    set(stateFromWorkspaceData(normalizeCoverLetterWorkspacePayload(data)))
  },

  addTemplate: (template) => {
    if (!template.pipelineEntryId || !template.sourceResumeId || !template.sourceResumeHash) {
      console.warn('Skipping legacy cover letter template without pipeline and source resume anchors.')
      return
    }
    if (get().letters.some((letter) => letter.pipelineEntryId === template.pipelineEntryId)) {
      console.warn('Skipping legacy cover letter template because the pipeline entry already has a draft.')
      return
    }
    const duplicateId = get().letters.some((letter) => letter.id === template.id)
    get().createLetter({
      id: duplicateId ? undefined : template.id,
      content: coverLetterContentFromInput(template),
      pipelineEntryId: template.pipelineEntryId,
      sourceResumeId: template.sourceResumeId,
      sourceResumeHash: template.sourceResumeHash,
      identityVersion: template.identityVersion ?? null,
      identityFields: template.identityFields,
      generatedAt: template.generatedAt,
    })
  },

  updateTemplate: (id, patch) => {
    get().updateLetter(id, patch)
  },

  deleteTemplate: (id) => {
    get().deleteLetter(id)
  },

  importTemplates: (_templates) => {
    for (const template of _templates) {
      get().addTemplate(template)
    }
  },
}))
