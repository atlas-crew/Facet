import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CoverLetterTemplate } from '../types/coverLetter'
import {
  ensureDurableMetadata,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'
import { resolveStorage } from './storage'

interface CoverLetterState {
  templates: CoverLetterTemplate[]

  addTemplate: (template: CoverLetterTemplate) => void
  updateTemplate: (id: string, patch: Partial<CoverLetterTemplate>) => void
  deleteTemplate: (id: string) => void
  importTemplates: (templates: CoverLetterTemplate[]) => void
}

const now = () => new Date().toISOString()

const normalizeTemplate = (
  template: CoverLetterTemplate,
  options: { touch?: boolean } = {},
): CoverLetterTemplate => {
  const timestamp = now()

  return {
    ...template,
    durableMeta: options.touch
      ? touchDurableMetadata(template.durableMeta, timestamp)
      : ensureDurableMetadata(template.durableMeta, timestamp),
  }
}

export const migrateCoverLetterState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as { templates?: CoverLetterTemplate[] })
      : undefined

  return {
    ...state,
    templates: Array.isArray(state?.templates)
      ? state.templates.map((template) => normalizeTemplate(template))
      : [],
  }
}

export const useCoverLetterStore = create<CoverLetterState>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (template) => {
        set((s) => ({
          templates: [...s.templates, normalizeTemplate(template)],
        }))
      },

      updateTemplate: (id, patch) => {
        const restPatch = stripDurableMetadataPatch(patch)
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id
              ? normalizeTemplate(
                  {
                    ...t,
                    ...restPatch,
                  },
                  { touch: true },
                )
              : t
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
      },

      importTemplates: (templates) => {
        set({
          templates: templates.map((template) => normalizeTemplate(template)),
        })
      },
    }),
    {
      name: 'facet-cover-letter-data',
      version: 2,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        templates: state.templates,
      }),
      migrate: migrateCoverLetterState,
    }
  )
)
