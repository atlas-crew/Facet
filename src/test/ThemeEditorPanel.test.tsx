// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeEditorPanel } from '../components/ThemeEditorPanel'
import { defaultResumeData } from '../store/defaultData'
import { THEME_PRESETS } from '../themes/theme'
import type { ResumeData } from '../types'

afterEach(cleanup)

function renderPanel(options: { showDesignHealth?: boolean; resumeData?: ResumeData } = {}) {
  const onSetPreset = vi.fn()
  const onSetOverride = vi.fn()
  const onAdjustDensityStep = vi.fn()
  const onResetOverrides = vi.fn()
  const onToggleHeatmap = vi.fn()
  const onToggleDesignHealth = vi.fn()
  const onOptimizeDensity = vi.fn()

  render(
    <ThemeEditorPanel
      activePreset="ferguson-v12"
      resolvedTheme={THEME_PRESETS['ferguson-v12']}
      resumeData={options.resumeData}
      showHeatmap={false}
      showDesignHealth={options.showDesignHealth ?? false}
      isOptimizingDensity={false}
      onSetPreset={onSetPreset}
      onSetOverride={onSetOverride}
      onAdjustDensityStep={onAdjustDensityStep}
      onOptimizeDensity={onOptimizeDensity}
      onResetOverrides={onResetOverrides}
      onToggleHeatmap={onToggleHeatmap}
      onToggleDesignHealth={onToggleDesignHealth}
    />,
  )

  return { onSetPreset, onSetOverride, onAdjustDensityStep, onResetOverrides, onToggleHeatmap, onToggleDesignHealth, onOptimizeDensity }
}

describe('ThemeEditorPanel preset gallery', () => {
  it('renders the visual gallery and new preset labels in the Presets tab', () => {
    renderPanel()
    // Presets tab is the default active tab
    expect(screen.getByText('Theme Gallery')).toBeTruthy()
    expect(screen.getAllByText('Executive Serif').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Modern Contrast').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Signal Clean').length).toBeGreaterThan(0)
  })

  it('applies a preset when clicking a card in the gallery strip', () => {
    const { onSetPreset } = renderPanel()
    // Presets tab is default, so gallery is already visible
    const gallery = document.querySelector('.theme-gallery-strip')
    expect(gallery).toBeTruthy()

    const button = Array.from(gallery!.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Signal Clean'),
    )
    expect(button).toBeTruthy()
    fireEvent.click(button!)

    expect(onSetPreset).toHaveBeenCalledWith('signal-clean')
  })

  it('supports one-step tighten and loosen spacing controls', () => {
    const { onAdjustDensityStep } = renderPanel()
    const densityControls = screen.getByLabelText('Spacing density controls')

    fireEvent.click(
      within(densityControls).getByRole('button', { name: 'Tighten spacing one step' }),
    )
    fireEvent.click(
      within(densityControls).getByRole('button', { name: 'Loosen spacing one step' }),
    )

    expect(onAdjustDensityStep).toHaveBeenNthCalledWith(1, 'tighten')
    expect(onAdjustDensityStep).toHaveBeenNthCalledWith(2, 'loosen')
  }, 10000)

  it('surfaces actionable design health pointers for resume field issues', () => {
    renderPanel({
      showDesignHealth: true,
      resumeData: {
        ...defaultResumeData,
        meta: {
          ...defaultResumeData.meta,
          phone: '',
          links: [{ label: 'Portfolio', url: 'not a link' }],
        },
      },
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Visual Aids' }))

    expect(screen.getByText('Contact info is incomplete: missing Phone.')).toBeTruthy()
    expect(screen.getByText('Resume content: Phone')).toBeTruthy()
    expect(screen.getByText(/Header link "Portfolio" is not formatted/)).toBeTruthy()
    expect(screen.getByText('Resume content: Header links')).toBeTruthy()
  })

  it('does not scan resume content while design health is hidden', () => {
    const resumeData = { ...defaultResumeData } as ResumeData
    Object.defineProperty(resumeData, 'roles', {
      get() {
        throw new Error('roles should not be read while design health is hidden')
      },
    })

    expect(() => renderPanel({ showDesignHealth: false, resumeData })).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('tab', { name: 'Visual Aids' }))).not.toThrow()
    expect(screen.queryByText(/roles should not be read/)).toBeNull()
  })
})
