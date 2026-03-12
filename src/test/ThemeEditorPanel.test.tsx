// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeEditorPanel } from '../components/ThemeEditorPanel'
import { THEME_PRESETS } from '../themes/theme'

afterEach(cleanup)

function renderPanel() {
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
      showHeatmap={false}
      showDesignHealth={false}
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
})
