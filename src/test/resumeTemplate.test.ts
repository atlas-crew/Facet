import { describe, expect, it } from 'vitest'
import resumeTemplate from '../templates/resume.typ?raw'

describe('resume typst template token coverage', () => {
  it('applies lineHeight and bulletHanging theme tokens', () => {
    expect(resumeTemplate).toContain('theme.lineHeight')
    expect(resumeTemplate).toContain('theme.bulletHanging')
  })
})
