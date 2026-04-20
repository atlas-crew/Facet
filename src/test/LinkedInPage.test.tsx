// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LinkedInPage } from '../routes/linkedin/LinkedInPage'
import { useIdentityStore } from '../store/identityStore'
import { useLinkedInStore } from '../store/linkedinStore'
import { resolveStorage } from '../store/storage'
import type { ProfessionalIdentityV3 } from '../identity/schema'

const identityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Nick Ferguson',
    email: 'nick@example.com',
    phone: '555-0100',
    location: 'Tampa, FL',
    links: [],
    thesis: 'I build platform systems that make hard things routine.',
  },
  self_model: {
    arc: [],
    philosophy: [
      {
        id: 'absorb-complexity',
        text: 'I absorb platform complexity so product teams can move faster.',
        tags: ['platform', 'devex'],
      },
    ],
    interview_style: {
      strengths: ['system design'],
      weaknesses: ['whiteboard trivia'],
      prep_strategy: 'Map stories to requirements.',
    },
  },
  preferences: {
    compensation: {
      priorities: [{ item: 'base', weight: 'high' }],
    },
    work_model: {
      preference: 'remote',
    },
    matching: { prioritize: [], avoid: [] },
  },
  skills: {
    groups: [
      {
        id: 'platform',
        label: 'Platform',
        items: [
          { name: 'Kubernetes', tags: ['platform', 'kubernetes'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'platform-profile',
      tags: ['platform'],
      text: 'I make infrastructure tradeoffs legible for product teams.',
    },
  ],
  roles: [
    {
      id: 'a10',
      company: 'A10 Networks',
      title: 'Senior Platform Engineer',
      dates: '2025-2026',
      bullets: [
        {
          id: 'platform-migration',
          problem: 'Cloud-only delivery blocked on-prem deployments.',
          action: 'Ported the platform to Kubernetes-based installs.',
          outcome: 'Made the product deployable in customer environments.',
          impact: ['Unlocked on-prem delivery'],
          metrics: { services_ported: 12 },
          technologies: ['Kubernetes'],
          tags: ['platform', 'kubernetes'],
        },
      ],
    },
  ],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: 'nick-voice',
    resume_skill: 'nick-resume',
  },
}

describe('LinkedInPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-linkedin-workspace')
    useLinkedInStore.setState({ drafts: [], selectedDraftId: null })
    useIdentityStore.setState({
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identityFixture,
      draft: null,
      draftDocument: JSON.stringify(identityFixture, null, 2),
      warnings: [],
      changelog: [],
      lastError: null,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Platform LinkedIn Draft',
                headline: 'Staff Platform Engineer | Kubernetes | Developer Productivity',
                about: 'I build platform systems that reduce complexity for product teams.',
                topSkills: ['Kubernetes', 'Platform Engineering', 'Developer Productivity'],
                featuredHighlights: ['Ported a platform for on-prem installs.', 'Translate infrastructure tradeoffs into product delivery decisions.'],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('generates a LinkedIn draft from the current identity model', async () => {
    render(<LinkedInPage />)

    fireEvent.change(screen.getByPlaceholderText(/Staff platform engineer/i), {
      target: { value: 'Staff platform engineer' },
    })
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useLinkedInStore.getState().drafts).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('Platform LinkedIn Draft')).toBeTruthy()
    expect(screen.getByDisplayValue('Staff Platform Engineer | Kubernetes | Developer Productivity')).toBeTruthy()
  })

  it('shows hosted upgrade messaging when LinkedIn generation is paywalled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'linkedin.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<LinkedInPage />)
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Upgrade to AI Pro')
    })
  })
})
