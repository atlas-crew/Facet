// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SearchInstancePreferences } from '../routes/research/searchWorkspaceComponents'

afterEach(() => {
  cleanup()
})

const baseIdentity: React.ComponentProps<typeof SearchInstancePreferences>['identityBase'] = {
  constraints: { compensation: '$220k base', locations: ['Denver'], clearance: '', companySize: '' },
  filters: { prioritize: [], avoid: [] },
  interviewPrefs: { strongFit: [], redFlags: [] },
}

describe('SearchInstancePreferences "Edit in Identity" retrofit', () => {
  it('invokes the onNavigateToIdentity callback when the button is clicked', () => {
    const onNavigateToIdentity = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={null}
        onUpdateOverrides={() => {}}
        onNavigateToIdentity={onNavigateToIdentity}
      />,
    )

    screen.getByRole('button', { name: 'Edit in Identity' }).click()
    expect(onNavigateToIdentity).toHaveBeenCalledTimes(1)
  })

  it('component contract: parent owns the navigation shape — the button just fires the callback', () => {
    // The retrofit lives on the caller (ResearchPage's onNavigateToIdentity prop
    // implementation). This test pins the button's contract: it MUST call the
    // prop on click. ResearchPage's implementation passes
    // navigate({ to: '/identity', search: { focus: 'preferences', return: '/research' } })
    // which is verified by the bridge tests in IdentityMapPage.deepLink.test.tsx
    // (focus + return processing) and by manual eye-check on the dev server.
    const callbacks: Array<() => void> = []
    const onNavigateToIdentity = vi.fn(() => callbacks.push(() => {}))
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={null}
        onUpdateOverrides={() => {}}
        onNavigateToIdentity={onNavigateToIdentity}
      />,
    )

    const button = screen.getByRole('button', { name: 'Edit in Identity' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    button.click()
    expect(onNavigateToIdentity).toHaveBeenCalledTimes(1)
  })
})
