import { describe, expect, it } from 'vitest'
import {
  getDownstreamIdentityInferenceSections,
  sortIdentityInferenceSections,
} from '../routes/identity/identityInferenceDependencies'

describe('identityInferenceDependencies', () => {
  it('resolves downstream sections in inference order', () => {
    expect(getDownstreamIdentityInferenceSections('bullets')).toEqual([
      'skills',
      'thesis',
      'profiles',
      'chapters',
      'selfKnowledge',
      'positioning',
      'search',
    ])
    expect(getDownstreamIdentityInferenceSections('thesis')).toEqual([
      'profiles',
      'chapters',
      'selfKnowledge',
      'positioning',
      'search',
    ])
    expect(getDownstreamIdentityInferenceSections('positioning')).toEqual(['search'])
    expect(getDownstreamIdentityInferenceSections('search')).toEqual([])
  })

  it('sorts and deduplicates selected downstream sections', () => {
    expect(sortIdentityInferenceSections(['search', 'profiles', 'search', 'thesis'])).toEqual([
      'thesis',
      'profiles',
      'search',
    ])
  })
})
