// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FillBar } from '../components/FillBar'
import { IdentityBand } from '../routes/identity/IdentityBand'

afterEach(() => cleanup())

describe('IdentityBand fill help', () => {
  it('renders an accessible fill-strength help affordance', () => {
    render(
      <IdentityBand
        layer="skills"
        name="Skills"
        subtitle="taxonomy"
        fill={{ label: 'Messy', percent: 45, tone: 'warn' }}
      >
        <p>Skill content</p>
      </IdentityBand>,
    )

    const trigger = screen.getByRole('button', { name: 'Skills fill strength help' })
    expect(trigger).toBeTruthy()
    fireEvent.focus(trigger)

    expect(screen.getByText(/Fix untagged skills, generic group names/)).toBeTruthy()
  })
})

describe('FillBar help affordance', () => {
  it('uses the fill label for the help button fallback name', () => {
    render(<FillBar label="Coverage" percent={50} helpText="Coverage help" />)

    expect(screen.getByRole('button', { name: 'Coverage fill strength help' })).toBeTruthy()
  })

  it('omits help when no help text is provided', () => {
    render(<FillBar label="Coverage" percent={50} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('labels the progressbar with the visible fill label', () => {
    render(<FillBar label="Coverage" percent={50} />)

    const progressbar = screen.getByRole('progressbar')
    const labelId = progressbar.getAttribute('aria-labelledby')
    expect(labelId).not.toBeNull()
    expect(document.getElementById(labelId as string)?.textContent).toBe('Coverage')
  })
})
