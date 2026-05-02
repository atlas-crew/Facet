import { describe, expect, it } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { ResumeMeta } from '../types'
import {
  applyCoverLetterCandidateMetaToAssembledResume,
  resolveCoverLetterCandidateMeta,
} from '../utils/coverLetterCandidate'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const resumeMeta: ResumeMeta = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '555-0000',
  location: 'Austin, TX',
  links: [{ label: 'Portfolio', url: 'https://jane.example.com' }],
}

describe('coverLetterCandidate', () => {
  it('resolves cover letter contact from the active identity', () => {
    const identity = cloneIdentityFixture()
    identity.identity.name = 'Nicholas Ferguson'
    identity.identity.display_name = 'Nick Ferguson'
    identity.identity.email = 'nick@example.dev'
    identity.identity.phone = '555-0101'
    identity.identity.location = 'New York, NY'
    identity.identity.links = [{ id: 'github', url: 'github.com/nferguson' }]

    expect(resolveCoverLetterCandidateMeta(resumeMeta, identity)).toEqual({
      name: 'Nick Ferguson',
      email: 'nick@example.dev',
      phone: '555-0101',
      location: 'New York, NY',
      links: [{ label: 'github', url: 'github.com/nferguson' }],
    })
  })

  it('falls back to resume contact fields while respecting intentionally empty identity links', () => {
    const identity = cloneIdentityFixture()
    identity.identity.name = 'Nicholas Ferguson'
    identity.identity.display_name = ''
    identity.identity.email = ''
    identity.identity.phone = ''
    identity.identity.location = ''
    identity.identity.links = []

    expect(resolveCoverLetterCandidateMeta(resumeMeta, identity)).toEqual({
      name: 'Nicholas Ferguson',
      email: 'jane@example.com',
      phone: '555-0000',
      location: 'Austin, TX',
      links: [],
    })
  })

  it('returns resume contact when identity is unavailable or malformed', () => {
    expect(resolveCoverLetterCandidateMeta(resumeMeta, null)).toBe(resumeMeta)
    expect(resolveCoverLetterCandidateMeta(resumeMeta, {} as ProfessionalIdentityV3)).toBe(resumeMeta)
  })

  it('falls back to resume links when a malformed identity omits links', () => {
    const identity = {
      ...cloneIdentityFixture(),
      identity: {
        name: 'Nicholas Ferguson',
      },
    } as ProfessionalIdentityV3

    expect(resolveCoverLetterCandidateMeta(resumeMeta, identity as ProfessionalIdentityV3).links).toBe(resumeMeta.links)
  })

  it('returns resume contact when identity names are blank', () => {
    const identity = cloneIdentityFixture()
    identity.identity.name = ' '
    identity.identity.display_name = ''

    expect(resolveCoverLetterCandidateMeta(resumeMeta, identity)).toBe(resumeMeta)
  })

  it('trims identity contact fields before rendering the cover letter header', () => {
    const identity = cloneIdentityFixture()
    identity.identity.name = ' Nicholas Ferguson '
    identity.identity.display_name = ''
    identity.identity.email = ' nick@example.dev '
    identity.identity.phone = ' 555-0101 '
    identity.identity.location = ' New York, NY '
    identity.identity.links = [{ id: ' github ', url: ' github.com/nferguson ' }]

    expect(resolveCoverLetterCandidateMeta(resumeMeta, identity)).toEqual({
      name: 'Nicholas Ferguson',
      email: 'nick@example.dev',
      phone: '555-0101',
      location: 'New York, NY',
      links: [{ label: 'github', url: 'github.com/nferguson' }],
    })
  })

  it('applies candidate contact to an assembled resume header', () => {
    const assembled = {
      header: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        subtitle: 'Platform engineer',
      },
      roles: [{ company: 'Acme' }],
    }

    expect(applyCoverLetterCandidateMetaToAssembledResume(assembled, resumeMeta)).toEqual({
      header: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-0000',
        location: 'Austin, TX',
        links: resumeMeta.links,
        subtitle: 'Platform engineer',
      },
      roles: [{ company: 'Acme' }],
    })
  })

  it('creates an assembled resume header when none exists', () => {
    const assembled = {
      roles: [{ company: 'Acme' }],
    }

    expect(applyCoverLetterCandidateMetaToAssembledResume(assembled, resumeMeta)).toEqual({
      header: resumeMeta,
      roles: [{ company: 'Acme' }],
    })
  })

  it('leaves non-object assembled payloads unchanged', () => {
    expect(applyCoverLetterCandidateMetaToAssembledResume(null, resumeMeta)).toBeNull()
    expect(applyCoverLetterCandidateMetaToAssembledResume(['entry'], resumeMeta)).toEqual(['entry'])
    expect(applyCoverLetterCandidateMetaToAssembledResume('resume', resumeMeta)).toBe('resume')
  })

  it('replaces malformed assembled resume headers with candidate contact', () => {
    expect(applyCoverLetterCandidateMetaToAssembledResume({ header: null }, resumeMeta)).toEqual({
      header: resumeMeta,
    })
    expect(applyCoverLetterCandidateMetaToAssembledResume({ header: [{}] }, resumeMeta)).toEqual({
      header: resumeMeta,
    })
  })
})
