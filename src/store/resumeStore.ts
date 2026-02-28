import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ResumeData } from '../types'
import { defaultResumeData } from './defaultData'
import { resolveStorage } from './storage'

interface ResumeState {
  data: ResumeData
  setData: (data: ResumeData) => void
  resetToDefaults: () => void
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      data: defaultResumeData,
      setData: (data) => set({ data }),
      resetToDefaults: () => set({ data: defaultResumeData }),
    }),
    {
      name: 'vector-resume-data',
      version: 1,
      storage: createJSONStorage(resolveStorage),
    },
  ),
)
