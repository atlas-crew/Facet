import { useState, type CSSProperties, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlignJustify,
  Heading,
  Info,
  Layout,
  List,
  Paintbrush,
  Palette,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Square,
  Type,
} from 'lucide-react'

import type {
  ResumeData,
  ResumeTheme,
  ResumeThemeOverrides,
  ResumeThemePresetId,
  TemplateId,
} from '../types'
import { HelpHint } from './HelpHint'
import {
  THEME_BULLET_OPTIONS,
  THEME_DATES_ALIGNMENT_OPTIONS,
  THEME_PRESETS,
  THEME_PRESET_IDS,
  THEME_SECTION_HEADER_OPTIONS,
  THEME_TEXT_ALIGNMENT_OPTIONS,
  THEME_TEMPLATE_OPTIONS,
} from '../themes/theme'
import { FontPicker } from './FontPicker'
import { calculateDesignHealth } from '../utils/designHealth'

interface ThemeEditorPanelProps {
  activePreset: ResumeThemePresetId
  resolvedTheme: ResumeTheme
  resumeData?: ResumeData
  showHeatmap: boolean
  showDesignHealth: boolean
  isOptimizingDensity: boolean
  onSetPreset: (preset: ResumeThemePresetId) => void
  onSetOverride: <K extends keyof ResumeThemeOverrides>(
    key: K,
    value: ResumeThemeOverrides[K],
  ) => void
  onAdjustDensityStep: (direction: 'tighten' | 'loosen') => void
  onOptimizeDensity: (targetPages: number) => void
  onResetOverrides: () => void
  onToggleHeatmap: (show: boolean) => void
  onToggleDesignHealth: (show: boolean) => void
}

type NumericFieldConfig = {
  key: NumericThemeKey
  label: string
  step: number
  min: number
  max: number
}

type NumericThemeKey =
  | 'sizeBody'
  | 'sizeName'
  | 'sizeSectionHeader'
  | 'sizeRoleTitle'
  | 'sizeCompanyName'
  | 'sizeSmall'
  | 'sizeContact'
  | 'lineHeight'
  | 'bulletGap'
  | 'sectionGapBefore'
  | 'sectionGapAfter'
  | 'sectionRuleGap'
  | 'roleGap'
  | 'roleHeaderGap'
  | 'roleLineGapAfter'
  | 'paragraphGap'
  | 'contactGapAfter'
  | 'competencyGap'
  | 'projectGap'
  | 'marginTop'
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'
  | 'sectionHeaderLetterSpacing'
  | 'sectionRuleWeight'
  | 'nameLetterSpacing'
  | 'bulletIndent'
  | 'bulletHanging'
  | 'projectUrlSize'
  | 'sidebarWidth'
  | 'columnGap'

type ColorThemeKey =
  | 'colorBody'
  | 'colorHeading'
  | 'colorSection'
  | 'colorDim'
  | 'colorRule'
  | 'roleTitleColor'
  | 'datesColor'
  | 'subtitleColor'
  | 'competencyLabelColor'
  | 'projectUrlColor'

type BooleanThemeKey =
  | 'nameBold'
  | 'roleTitleItalic'
  | 'subtitleItalic'
  | 'companyBold'
  | 'competencyLabelBold'
  | 'projectNameBold'
  | 'educationSchoolBold'

type ThemeTabId =
  | 'presets'
  | 'typography'
  | 'spacing'
  | 'margins'
  | 'colors'
  | 'section-style'
  | 'layout'
  | 'bullets'
  | 'visual-aids'

const NUMBER_FIELDS: NumericFieldConfig[] = [
  { key: 'sizeBody', label: 'Body Size (pt)', step: 0.5, min: 7, max: 14 },
  { key: 'sizeName', label: 'Name Size (pt)', step: 0.5, min: 10, max: 28 },
  { key: 'sizeSectionHeader', label: 'Section Header Size (pt)', step: 0.5, min: 8, max: 16 },
  { key: 'sizeCompanyName', label: 'Company Size (pt)', step: 0.5, min: 8, max: 16 },
  { key: 'sizeRoleTitle', label: 'Role Title Size (pt)', step: 0.5, min: 8, max: 16 },
  { key: 'sizeSmall', label: 'Small Text Size (pt)', step: 0.5, min: 6, max: 12 },
  { key: 'sizeContact', label: 'Contact Size (pt)', step: 0.5, min: 6, max: 12 },
  { key: 'lineHeight', label: 'Line Height', step: 0.05, min: 0.9, max: 1.8 },
  { key: 'nameLetterSpacing', label: 'Name Letter Spacing (pt)', step: 0.5, min: 0, max: 8 },
  { key: 'projectUrlSize', label: 'Project URL Size (pt)', step: 0.5, min: 6, max: 12 },
  { key: 'sectionGapBefore', label: 'Section Gap Before (pt)', step: 0.5, min: 0, max: 24 },
  { key: 'sectionGapAfter', label: 'Section Gap After (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'sectionRuleGap', label: 'Section Rule Gap (pt)', step: 0.5, min: 0, max: 8 },
  { key: 'roleGap', label: 'Role Gap Before (pt)', step: 0.5, min: 0, max: 18 },
  { key: 'roleHeaderGap', label: 'Role Header Gap (pt)', step: 0.5, min: 0, max: 8 },
  { key: 'roleLineGapAfter', label: 'Role Line Gap After (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'bulletGap', label: 'Bullet Gap (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'paragraphGap', label: 'Paragraph Gap (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'contactGapAfter', label: 'Contact Gap After (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'competencyGap', label: 'Competency Gap (pt)', step: 0.5, min: 0, max: 8 },
  { key: 'projectGap', label: 'Project Gap (pt)', step: 0.5, min: 0, max: 12 },
  { key: 'marginTop', label: 'Margin Top (in)', step: 0.05, min: 0.25, max: 2 },
  { key: 'marginBottom', label: 'Margin Bottom (in)', step: 0.05, min: 0.25, max: 2 },
  { key: 'marginLeft', label: 'Margin Left (in)', step: 0.05, min: 0.25, max: 2 },
  { key: 'marginRight', label: 'Margin Right (in)', step: 0.05, min: 0.25, max: 2 },
  { key: 'sectionHeaderLetterSpacing', label: 'Header Letter Spacing (pt)', step: 0.5, min: 0, max: 8 },
  { key: 'sectionRuleWeight', label: 'Rule Weight (pt)', step: 0.25, min: 0, max: 3 },
  { key: 'bulletIndent', label: 'Bullet Indent (pt)', step: 0.5, min: 0, max: 36 },
  { key: 'bulletHanging', label: 'Bullet Hanging (pt)', step: 0.5, min: 0, max: 24 },
]

const COLOR_FIELDS: Array<{ key: ColorThemeKey; label: string }> = [
  { key: 'colorBody', label: 'Body Color' },
  { key: 'colorHeading', label: 'Heading Color' },
  { key: 'colorSection', label: 'Section Color' },
  { key: 'colorDim', label: 'Dim Color' },
  { key: 'colorRule', label: 'Rule Color' },
  { key: 'roleTitleColor', label: 'Role Title Color' },
  { key: 'datesColor', label: 'Dates Color' },
  { key: 'subtitleColor', label: 'Subtitle Color' },
  { key: 'competencyLabelColor', label: 'Competency Label Color' },
  { key: 'projectUrlColor', label: 'Project URL Color' },
]

const BOOLEAN_FIELDS: Array<{ key: BooleanThemeKey; label: string }> = [
  { key: 'nameBold', label: 'Name Bold' },
  { key: 'companyBold', label: 'Company Bold' },
  { key: 'roleTitleItalic', label: 'Role Title Italic' },
  { key: 'subtitleItalic', label: 'Subtitle Italic' },
  { key: 'competencyLabelBold', label: 'Competency Label Bold' },
  { key: 'projectNameBold', label: 'Project Name Bold' },
  { key: 'educationSchoolBold', label: 'Education School Bold' },
]

const THEME_TABS: Array<{ id: ThemeTabId; label: string; icon: LucideIcon }> = [
  { id: 'presets', label: 'Presets', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'spacing', label: 'Spacing', icon: AlignJustify },
  { id: 'margins', label: 'Margins', icon: Square },
  { id: 'colors', label: 'Colors', icon: Paintbrush },
  { id: 'section-style', label: 'Section Style', icon: Heading },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'bullets', label: 'Bullets', icon: List },
  { id: 'visual-aids', label: 'Visual Aids', icon: Activity },
]

const NUMBER_FIELDS_BY_KEY = Object.fromEntries(
  NUMBER_FIELDS.map((field) => [field.key, field]),
) as Record<NumericThemeKey, NumericFieldConfig>

const toHexColor = (value: string): string => `#${value.replace(/^#/, '')}`

const sectionLabelForPreset = (style: ResumeTheme['sectionHeaderStyle']): string =>
  style === 'caps-rule'
    ? 'EXPERIENCE'
    : style === 'bold-rule'
      ? 'Experience'
      : style === 'bold-only'
        ? 'Experience'
        : 'Experience'

const sectionUsesRule = (style: ResumeTheme['sectionHeaderStyle']): boolean =>
  style === 'caps-rule' || style === 'bold-rule'

export function ThemeEditorPanel({
  activePreset,
  resolvedTheme,
  resumeData,
  showHeatmap,
  showDesignHealth,
  isOptimizingDensity,
  onSetPreset,
  onSetOverride,
  onAdjustDensityStep,
  onOptimizeDensity,
  onResetOverrides,
  onToggleHeatmap,
  onToggleDesignHealth,
}: ThemeEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<ThemeTabId>('presets')
  const health = useMemo(
    () => (showDesignHealth ? calculateDesignHealth(resolvedTheme, resumeData) : { score: 100, issues: [] }),
    [resolvedTheme, resumeData, showDesignHealth],
  )

  const renderNumberField = (fieldKey: NumericThemeKey) => {
    const field = NUMBER_FIELDS_BY_KEY[fieldKey]
    return (
      <label className="field-label" key={field.key}>
        {field.label}
        <input
          className="component-input compact"
          type="number"
          step={field.step}
          min={field.min}
          max={field.max}
          value={resolvedTheme[field.key]}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            if (!Number.isFinite(nextValue)) {
              return
            }
            onSetOverride(field.key, nextValue)
          }}
        />
      </label>
    )
  }

  const renderBooleanField = (fieldKey: BooleanThemeKey, label: string) => (
    <label className="field-label" key={fieldKey}>
      {label}
      <input
        className="component-input compact"
        type="checkbox"
        checked={resolvedTheme[fieldKey]}
        onChange={(event) => onSetOverride(fieldKey, event.target.checked)}
      />
    </label>
  )

  const renderTabContent = () => {
    if (activeTab === 'presets') {
      return (
        <div className="theme-presets-tab">
          <div className="theme-preset-grid">
            {THEME_PRESET_IDS.map((presetId) => {
              const preset = THEME_PRESETS[presetId]
              const isActive = activePreset === presetId
              return (
                <button
                  key={presetId}
                  type="button"
                  className={`theme-preset-card ${isActive ? 'active' : ''}`}
                  onClick={() => onSetPreset(presetId)}
                  aria-pressed={isActive}
                >
                  <span className="theme-preset-name">{preset.name}</span>
                  <span className="theme-preset-sample">
                    <span style={{ color: `#${preset.colorSection}` }}>Aa</span>
                    <span style={{ color: `#${preset.colorBody}` }}>Body</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="theme-gallery-header">
            <h3>Theme Gallery <HelpHint text="Presets provide a starting point. Override individual values below." placement="bottom" /></h3>
            <p>Click a card to apply a theme.</p>
          </div>
          <div className="theme-gallery-strip" aria-label="Theme visual gallery">
            {THEME_PRESET_IDS.map((presetId) => renderPresetGalleryCard(presetId))}
          </div>
        </div>
      )
    }

    if (activeTab === 'visual-aids') {
      return (
        <div className="visual-aids-panel">
          <div className="visual-aid-control">
            <label className="field-label checkbox-label">
              <input
                type="checkbox"
                checked={showHeatmap}
                aria-describedby="heatmap-help"
                onChange={(e) => onToggleHeatmap(e.target.checked)}
              />
              <Activity size={16} />
              <span>Show Density Heatmap</span>
            </label>
            <p id="heatmap-help" className="field-help">Highlights sections based on vertical space consumption.</p>
          </div>

          <div className="visual-aid-control">
            <label className="field-label checkbox-label">
              <input
                type="checkbox"
                checked={showDesignHealth}
                aria-describedby="health-help"
                onChange={(e) => onToggleDesignHealth(e.target.checked)}
              />
              <ShieldCheck size={16} />
              <span>Show Design Health Score</span>
            </label>
            <p id="health-help" className="field-help">
              Analyzes design choices and resume content for ATS and print safety.
            </p>
          </div>

          {showDesignHealth && (
            <div className="design-health-report" aria-busy={isOptimizingDensity}>
              <div className="health-score-header">
                <span className="health-score-label">
                  Health Score:{' '}
                  <span
                    className={`health-score-status ${health.score >= 90 ? 'good' : health.score >= 70 ? 'fair' : 'poor'}`}
                  >
                    {health.score >= 90 ? 'Good' : health.score >= 70 ? 'Fair' : 'Needs Work'}
                  </span>
                </span>
                <span
                  className={`health-score-value ${health.score >= 90 ? 'good' : health.score >= 70 ? 'fair' : 'poor'}`}
                >
                  {health.score}/100
                </span>
              </div>
              <div
                className="health-score-bar"
                role="progressbar"
                aria-valuenow={health.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Design health score"
              >
                <div
                  className={`health-score-fill ${health.score >= 90 ? 'good' : health.score >= 70 ? 'fair' : 'poor'}`}
                  style={{ width: `${health.score}%` }}
                />
              </div>

              {health.issues.length > 0 ? (
                <ul className="health-issues-list">
                  {health.issues.map((issue, idx) => (
                    <li key={idx} className={`health-issue-item type-${issue.type}`}>
                      {issue.type === 'error' ? <AlertTriangle size={14} /> : <Info size={14} />}
                      <span className="health-issue-copy">
                        <span>{issue.message}</span>
                        <span className="health-issue-pointer">{issue.pointer}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="health-success-msg">Your design looks ATS-safe and print-ready!</p>
              )}
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'typography') {
      return (
        <div className="theme-grid typography-tab-grid">
          <FontPicker
            label="Body Font"
            value={resolvedTheme.fontBody}
            onChange={(font) => onSetOverride('fontBody', font)}
          />
          <FontPicker
            label="Heading Font"
            value={resolvedTheme.fontHeading}
            onChange={(font) => onSetOverride('fontHeading', font)}
          />
          <div className="theme-grid">
            {renderNumberField('sizeBody')}
            {renderNumberField('sizeName')}
            {renderNumberField('sizeSectionHeader')}
            {renderNumberField('sizeCompanyName')}
            {renderNumberField('sizeRoleTitle')}
            {renderNumberField('sizeSmall')}
            {renderNumberField('sizeContact')}
            {renderNumberField('projectUrlSize')}
            {renderNumberField('nameLetterSpacing')}
            {renderNumberField('lineHeight')}
          </div>
        </div>
      )
    }

    if (activeTab === 'spacing') {
      return (
        <div className="theme-grid">
          <div className="smart-density-group">
            <span className="field-label">Smart Density Optimizer</span>
            <div className="btn-group">
              <button
                className="btn-secondary btn-sparkle"
                type="button"
                disabled={isOptimizingDensity}
                onClick={() => onOptimizeDensity(1)}
              >
                {isOptimizingDensity ? 'Working...' : (
                  <>
                    <Sparkles size={14} />
                    <span>Fit to 1 Page</span>
                  </>
                )}
              </button>
              <button
                className="btn-secondary btn-sparkle"
                type="button"
                disabled={isOptimizingDensity}
                onClick={() => onOptimizeDensity(2)}
              >
                {isOptimizingDensity ? 'Working...' : (
                  <>
                    <Sparkles size={14} />
                    <span>Fit to 2 Pages</span>
                  </>
                )}
              </button>
            </div>
            <p className="field-help">Iterative search for the optimal balance of spacing and font size.</p>
          </div>
          {renderNumberField('sectionGapBefore')}
          {renderNumberField('sectionGapAfter')}
          {renderNumberField('sectionRuleGap')}
          {renderNumberField('roleGap')}
          {renderNumberField('roleHeaderGap')}
          {renderNumberField('roleLineGapAfter')}
          {renderNumberField('bulletGap')}
          {renderNumberField('paragraphGap')}
          {renderNumberField('contactGapAfter')}
          {renderNumberField('competencyGap')}
          {renderNumberField('projectGap')}
        </div>
      )
    }

    if (activeTab === 'margins') {
      return (
        <div className="theme-grid">
          {renderNumberField('marginTop')}
          {renderNumberField('marginBottom')}
          {renderNumberField('marginLeft')}
          {renderNumberField('marginRight')}
        </div>
      )
    }

    if (activeTab === 'colors') {
      return (
        <div className="theme-grid">
          {COLOR_FIELDS.map((field) => (
            <label className="field-label" key={field.key}>
              {field.label}
              <input
                className="component-input compact"
                type="color"
                value={`#${resolvedTheme[field.key]}`}
                onChange={(event) => onSetOverride(field.key, event.target.value.replace(/^#/, ''))}
              />
            </label>
          ))}
        </div>
      )
    }

    if (activeTab === 'section-style') {
      return (
        <div className="theme-grid">
          <label className="field-label">
            Section Header Style
            <select
              className="component-input compact"
              value={resolvedTheme.sectionHeaderStyle}
              onChange={(event) =>
                onSetOverride('sectionHeaderStyle', event.target.value as ResumeTheme['sectionHeaderStyle'])
              }
            >
              {THEME_SECTION_HEADER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {renderNumberField('sectionHeaderLetterSpacing')}
          {renderNumberField('sectionRuleWeight')}
        </div>
      )
    }

    if (activeTab === 'layout') {
      return (
        <div className="theme-grid">
          <label className="field-label">
            Layout Template
            <select
              className="component-input compact"
              value={resolvedTheme.templateId}
              onChange={(event) =>
                onSetOverride('templateId', event.target.value as TemplateId)
              }
            >
              {THEME_TEMPLATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>

          {resolvedTheme.templateId === 'sidebar' && (
            <>
              {renderNumberField('sidebarWidth')}
              <label className="field-label">
                Sidebar Color
                <input
                  className="component-input compact"
                  type="color"
                  value={`#${resolvedTheme.sidebarColor || 'f8f9fa'}`}
                  onChange={(event) => onSetOverride('sidebarColor', event.target.value.replace(/^#/, ''))}
                />
              </label>
              {renderNumberField('columnGap')}
            </>
          )}

          <label className="field-label">
            Name Alignment
            <select
              className="component-input compact"
              value={resolvedTheme.nameAlignment}
              onChange={(event) =>
                onSetOverride('nameAlignment', event.target.value as ResumeTheme['nameAlignment'])
              }
            >
              {THEME_TEXT_ALIGNMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Contact Alignment
            <select
              className="component-input compact"
              value={resolvedTheme.contactAlignment}
              onChange={(event) =>
                onSetOverride('contactAlignment', event.target.value as ResumeTheme['contactAlignment'])
              }
            >
              {THEME_TEXT_ALIGNMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Dates Alignment
            <select
              className="component-input compact"
              value={resolvedTheme.datesAlignment}
              onChange={(event) =>
                onSetOverride('datesAlignment', event.target.value as ResumeTheme['datesAlignment'])
              }
            >
              {THEME_DATES_ALIGNMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {BOOLEAN_FIELDS.map((field) => renderBooleanField(field.key, field.label))}
        </div>
      )
    }

    return (
      <div className="theme-grid">
        <label className="field-label">
          Bullet Style
          <select
            className="component-input compact"
            value={resolvedTheme.bulletChar}
            onChange={(event) => onSetOverride('bulletChar', event.target.value as ResumeTheme['bulletChar'])}
          >
            {THEME_BULLET_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {renderNumberField('bulletIndent')}
        {renderNumberField('bulletHanging')}
      </div>
    )
  }

  const renderPresetGalleryCard = (presetId: ResumeThemePresetId) => {
    const preset = THEME_PRESETS[presetId]
    const isActive = activePreset === presetId
    const sectionColor = toHexColor(preset.colorSection)
    const headingColor = toHexColor(preset.colorHeading)
    const bodyColor = toHexColor(preset.colorBody)
    const dimColor = toHexColor(preset.colorDim)
    const ruleColor = toHexColor(preset.colorRule)
    const sectionIsCaps = preset.sectionHeaderStyle === 'caps-rule'
    const sectionIsUnderline = preset.sectionHeaderStyle === 'underline'
    const bulletToken = preset.bulletChar === 'none' ? '' : preset.bulletChar
    const headingStyle: CSSProperties = {
      fontFamily: `'${preset.fontHeading}', var(--font-sans)`,
      color: headingColor,
      letterSpacing: `${Math.min(preset.nameLetterSpacing / 6, 0.24).toFixed(2)}em`,
      textTransform: 'uppercase',
      fontWeight: preset.nameBold ? 700 : 500,
      fontSize: `${Math.max(10, preset.sizeName * 0.8)}px`,
      textAlign: preset.nameAlignment,
    }
    const bodyStyle: CSSProperties = {
      fontFamily: `'${preset.fontBody}', var(--font-sans)`,
      color: bodyColor,
      fontSize: `${Math.max(8, preset.sizeBody * 0.78)}px`,
      lineHeight: preset.lineHeight,
    }
    const sectionStyle: CSSProperties = {
      fontFamily: `'${preset.fontHeading}', var(--font-sans)`,
      color: sectionColor,
      letterSpacing: sectionIsCaps
        ? `${Math.min(preset.sectionHeaderLetterSpacing / 6, 0.22).toFixed(2)}em`
        : '0.02em',
      textTransform: sectionIsCaps ? 'uppercase' : 'none',
      textDecoration: sectionIsUnderline ? 'underline' : 'none',
      fontWeight: 700,
      fontSize: `${Math.max(8, preset.sizeSectionHeader * 0.75)}px`,
    }

    return (
      <button
        key={presetId}
        type="button"
        className={`theme-gallery-card ${isActive ? 'active' : ''}`}
        onClick={() => onSetPreset(presetId)}
        aria-pressed={isActive}
      >
        <span className="theme-gallery-card-name">{preset.name}</span>
        <span className="theme-gallery-card-fonts">
          {preset.fontHeading} / {preset.fontBody}
        </span>
        <div className="theme-gallery-paper">
          <p className="theme-gallery-name-line" style={headingStyle}>
            Jane Smith
          </p>
          <p className="theme-gallery-contact-line" style={{ ...bodyStyle, color: dimColor }}>
            SF · jane@example.com · github.com/jane
          </p>
          <div className="theme-gallery-section-wrap">
            <p className="theme-gallery-section-line" style={sectionStyle}>
              {sectionLabelForPreset(preset.sectionHeaderStyle)}
            </p>
            {sectionUsesRule(preset.sectionHeaderStyle) ? (
              <div
                className="theme-gallery-section-rule"
                style={{
                  background: ruleColor,
                  height: `${Math.max(1, Math.round(preset.sectionRuleWeight * 2))}px`,
                }}
              />
            ) : null}
          </div>
          <p className="theme-gallery-role-line" style={{ ...bodyStyle, color: toHexColor(preset.roleTitleColor) }}>
            Senior Backend Engineer
          </p>
          <p className="theme-gallery-bullet-line" style={bodyStyle}>
            <span style={{ color: sectionColor }}>{bulletToken}</span> Built resilient API platform.
          </p>
        </div>
      </button>
    )
  }

  return (
    <section className="theme-panel" id="theme-overrides-panel" aria-label="Theme editor">
      <div className="theme-panel-header">
        <h2>Themes</h2>
        <div className="theme-panel-actions">
          <div className="theme-density-controls" aria-label="Spacing density controls">
            <span className="theme-density-label">Density</span>
            <button
              className="btn-secondary theme-density-button"
              type="button"
              onClick={() => onAdjustDensityStep('tighten')}
              aria-label="Tighten spacing one step"
            >
              ↓ Tighten
            </button>
            <button
              className="btn-secondary theme-density-button"
              type="button"
              onClick={() => onAdjustDensityStep('loosen')}
              aria-label="Loosen spacing one step"
            >
              ↑ Loosen
            </button>
          </div>
          <button className="btn-secondary" type="button" onClick={onResetOverrides}>
            Reset to Theme
          </button>
        </div>
      </div>

      <div className="theme-tab-row" role="tablist" aria-label="Theme token groups">
        {THEME_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`theme-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`theme-panel-${tab.id}`}
              className={`theme-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className="theme-tab-panel"
        role="tabpanel"
        id={`theme-panel-${activeTab}`}
        aria-labelledby={`theme-tab-${activeTab}`}
      >
        {renderTabContent()}
      </div>
    </section>
  )
}
