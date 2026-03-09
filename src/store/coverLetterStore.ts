import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CoverLetterTemplate } from '../types/coverLetter'
import { resolveStorage } from './storage'
import { createId } from '../utils/idUtils'

interface CoverLetterState {
  templates: CoverLetterTemplate[]
  
  addTemplate: (template: Omit<CoverLetterTemplate, 'id'>) => void
  updateTemplate: (id: string, patch: Partial<CoverLetterTemplate>) => void
  deleteTemplate: (id: string) => void
  importTemplates: (templates: CoverLetterTemplate[]) => void
}

export const useCoverLetterStore = create<CoverLetterState>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (template) => {
        const newTemplate: CoverLetterTemplate = {
          ...template,
          id: createId('clt'),
        }
        set((s) => ({ templates: [...s.templates, newTemplate] }))
      },

      updateTemplate: (id, patch) => {
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
      },

      importTemplates: (templates) => {
        set({ templates })
      }
    }),
    {
      name: 'facet-cover-letter-data',
      version: 1,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        templates: state.templates
      }),
    }
  )
)
