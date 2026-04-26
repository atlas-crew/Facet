import { describe, it, expect } from 'vitest'
import { buildAllPersonas, validatePersona } from './index'

describe('persona fixtures', () => {
  const personas = buildAllPersonas()

  for (const [name, persona] of Object.entries(personas)) {
    describe(name, () => {
      const issues = validatePersona(persona)
      const errors = issues.filter((i) => i.level === 'error')
      const warnings = issues.filter((i) => i.level === 'warning')

      it('has no integrity errors', () => {
        if (errors.length > 0) {
          const detail = errors.map((i) => `  ${i.path}: ${i.message}`).join('\n')
          throw new Error(`${errors.length} integrity error(s):\n${detail}`)
        }
        expect(errors).toEqual([])
      })

      it('reports warnings (informational)', () => {
        const summary = warnings.map((i) => `  [warn] ${i.path}: ${i.message}`).join('\n')
        if (summary) {
          // Surface warnings in test output without failing — drift may be intentional.
          console.warn(`[${name}] ${warnings.length} warning(s):\n${summary}`)
        }
        expect(warnings.length).toBeGreaterThanOrEqual(0)
      })
    })
  }
})
