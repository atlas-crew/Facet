import { describe, expect, it } from 'vitest'

import type { JDAnalysis, SkillMatch } from '../types/jdAnalysis'
import {
  buildSkillIdentityFields,
  collectIdentityFieldsFromJdSkillMatches,
} from '../utils/identityFieldDeps'

const buildSkillMatch = (skillName: string): SkillMatch =>
  ({
    skillName,
    jdRequirement: '',
    requirementStrength: 'required',
    userDepth: 'expert',
    userPositioning: '',
    matchQuality: 'strong',
    presentationGuidance: '',
  }) as SkillMatch

const buildJdAnalysis = (skillMatches: SkillMatch[]): JDAnalysis =>
  ({ skillMatches }) as unknown as JDAnalysis

describe('identityFieldDeps', () => {
  describe('buildSkillIdentityFields', () => {
    it('returns the canonical depth/context/positioning trio for a skill', () => {
      expect(buildSkillIdentityFields('Kubernetes')).toEqual([
        'skills.Kubernetes.depth',
        'skills.Kubernetes.context',
        'skills.Kubernetes.positioning',
      ])
    })

    it('trims surrounding whitespace before composing field paths', () => {
      expect(buildSkillIdentityFields('  Rust  ')).toEqual([
        'skills.Rust.depth',
        'skills.Rust.context',
        'skills.Rust.positioning',
      ])
    })

    it('returns an empty array when the name is blank', () => {
      expect(buildSkillIdentityFields('')).toEqual([])
      expect(buildSkillIdentityFields('   ')).toEqual([])
    })
  })

  describe('collectIdentityFieldsFromJdSkillMatches', () => {
    it('returns undefined when the analysis is null', () => {
      expect(collectIdentityFieldsFromJdSkillMatches(null)).toBeUndefined()
    })

    it('returns undefined when there are no skill matches', () => {
      expect(collectIdentityFieldsFromJdSkillMatches(buildJdAnalysis([]))).toBeUndefined()
    })

    it('emits depth/context/positioning paths for each matched skill', () => {
      const result = collectIdentityFieldsFromJdSkillMatches(
        buildJdAnalysis([buildSkillMatch('Kubernetes'), buildSkillMatch('Rust')]),
      )
      expect(result).toEqual([
        'skills.Kubernetes.depth',
        'skills.Kubernetes.context',
        'skills.Kubernetes.positioning',
        'skills.Rust.depth',
        'skills.Rust.context',
        'skills.Rust.positioning',
      ])
    })

    it('deduplicates fields when the same skill appears twice', () => {
      const result = collectIdentityFieldsFromJdSkillMatches(
        buildJdAnalysis([buildSkillMatch('Kubernetes'), buildSkillMatch('Kubernetes')]),
      )
      expect(result).toEqual([
        'skills.Kubernetes.depth',
        'skills.Kubernetes.context',
        'skills.Kubernetes.positioning',
      ])
    })

    it('skips matches with empty skillName so callers do not emit garbage paths', () => {
      const result = collectIdentityFieldsFromJdSkillMatches(
        buildJdAnalysis([buildSkillMatch(''), buildSkillMatch('Rust')]),
      )
      expect(result).toEqual([
        'skills.Rust.depth',
        'skills.Rust.context',
        'skills.Rust.positioning',
      ])
    })
  })
})
