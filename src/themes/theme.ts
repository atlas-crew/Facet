import type {
  BulletChar,
  ResumeTheme,
  ResumeThemeOverrides,
  ResumeThemePresetId,
  ResumeThemeState,
  SectionHeaderStyle,
  ThemeDatesAlignment,
  ThemeTextAlignment,
} from '../types'

const DEFAULT_THEME_PRESET: ResumeThemePresetId = 'ferguson-v12'

export const THEME_LEGACY_PRESET_ALIASES: Record<string, ResumeThemePresetId> = {
  'editorial-dense': 'ferguson-v12',
}

export const THEME_LEGACY_OVERRIDE_ALIASES: Record<string, keyof ResumeThemeOverrides> = {
  sectionGap: 'sectionGapBefore',
}

const THEME_OVERRIDE_KEYS: Array<keyof ResumeThemeOverrides> = [
  'fontBody',
  'fontHeading',
  'sizeBody',
  'sizeName',
  'sizeSectionHeader',
  'sizeRoleTitle',
  'sizeCompanyName',
  'sizeSmall',
  'sizeContact',
  'lineHeight',
  'bulletGap',
  'sectionGapBefore',
  'sectionGapAfter',
  'roleGap',
  'roleLineGapAfter',
  'paragraphGap',
  'contactGapAfter',
  'competencyGap',
  'projectGap',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'colorBody',
  'colorHeading',
  'colorSection',
  'colorDim',
  'colorRule',
  'roleTitleColor',
  'datesColor',
  'subtitleColor',
  'competencyLabelColor',
  'projectUrlColor',
  'sectionHeaderStyle',
  'sectionHeaderLetterSpacing',
  'sectionRuleWeight',
  'nameLetterSpacing',
  'nameBold',
  'nameAlignment',
  'contactAlignment',
  'roleTitleItalic',
  'datesAlignment',
  'subtitleItalic',
  'companyBold',
  'bulletChar',
  'bulletIndent',
  'bulletHanging',
  'competencyLabelBold',
  'projectNameBold',
  'projectUrlSize',
  'educationSchoolBold',
]

const COLOR_KEYS = new Set<keyof ResumeThemeOverrides>([
  'colorBody',
  'colorHeading',
  'colorSection',
  'colorDim',
  'colorRule',
  'roleTitleColor',
  'datesColor',
  'subtitleColor',
  'competencyLabelColor',
  'projectUrlColor',
])

const BOOLEAN_KEYS = new Set<keyof ResumeThemeOverrides>([
  'nameBold',
  'roleTitleItalic',
  'subtitleItalic',
  'companyBold',
  'competencyLabelBold',
  'projectNameBold',
  'educationSchoolBold',
])

const NUMBER_BOUNDS: Record<string, { min: number; max: number }> = {
  sizeBody: { min: 7, max: 14 },
  sizeName: { min: 10, max: 28 },
  sizeSectionHeader: { min: 8, max: 16 },
  sizeRoleTitle: { min: 8, max: 16 },
  sizeCompanyName: { min: 8, max: 16 },
  sizeSmall: { min: 6, max: 12 },
  sizeContact: { min: 6, max: 12 },
  lineHeight: { min: 0.9, max: 1.8 },
  bulletGap: { min: 0, max: 12 },
  sectionGapBefore: { min: 0, max: 24 },
  sectionGapAfter: { min: 0, max: 12 },
  roleGap: { min: 0, max: 18 },
  roleLineGapAfter: { min: 0, max: 12 },
  paragraphGap: { min: 0, max: 12 },
  contactGapAfter: { min: 0, max: 12 },
  competencyGap: { min: 0, max: 8 },
  projectGap: { min: 0, max: 12 },
  marginTop: { min: 0.25, max: 2 },
  marginBottom: { min: 0.25, max: 2 },
  marginLeft: { min: 0.25, max: 2 },
  marginRight: { min: 0.25, max: 2 },
  sectionHeaderLetterSpacing: { min: 0, max: 8 },
  sectionRuleWeight: { min: 0, max: 3 },
  nameLetterSpacing: { min: 0, max: 8 },
  bulletIndent: { min: 0, max: 36 },
  bulletHanging: { min: 0, max: 24 },
  projectUrlSize: { min: 6, max: 12 },
}

const SECTION_STYLES: SectionHeaderStyle[] = ['caps-rule', 'bold-rule', 'bold-only', 'underline']
const BULLET_STYLES: BulletChar[] = ['•', '–', '▸', 'none']
const TEXT_ALIGNMENT_OPTIONS: ThemeTextAlignment[] = ['left', 'center', 'right']
const DATES_ALIGNMENT_OPTIONS: ThemeDatesAlignment[] = ['right-tab', 'inline']
const FONT_FAMILY_ALIASES: Record<string, string> = {
  calibri: 'Inter',
  aptos: 'DM Sans',
  arial: 'IBM Plex Sans',
  georgia: 'PT Serif',
  cambria: 'PT Serif',
  'times new roman': 'Source Serif 4',
}

const normalizeThemeFontFamilyValue = (value: string): string => {
  const normalized = value.trim().slice(0, 80)
  const alias = FONT_FAMILY_ALIASES[normalized.toLowerCase()]
  return alias ?? normalized
}

export const THEME_PRESETS: Record<ResumeThemePresetId, ResumeTheme> = {
  'ferguson-v12': {
    id: 'ferguson-v12',
    name: 'Ferguson v1.2',
    fontBody: 'Inter',
    fontHeading: 'Inter',
    sizeBody: 9,
    sizeName: 14,
    sizeSectionHeader: 10.5,
    sizeRoleTitle: 9,
    sizeCompanyName: 10,
    sizeSmall: 8.5,
    sizeContact: 8.5,
    lineHeight: 1.15,
    bulletGap: 2.5,
    sectionGapBefore: 10,
    sectionGapAfter: 3,
    roleGap: 7,
    roleLineGapAfter: 3,
    paragraphGap: 2,
    contactGapAfter: 6,
    competencyGap: 1,
    projectGap: 3,
    marginTop: 0.45,
    marginBottom: 0.45,
    marginLeft: 0.75,
    marginRight: 0.75,
    colorBody: '333333',
    colorHeading: '1a1a1a',
    colorSection: '2b5797',
    colorDim: '666666',
    colorRule: '2b5797',
    roleTitleColor: '1a1a1a',
    datesColor: '666666',
    subtitleColor: '666666',
    competencyLabelColor: '1a1a1a',
    projectUrlColor: '2b5797',
    sectionHeaderStyle: 'caps-rule',
    sectionHeaderLetterSpacing: 3,
    sectionRuleWeight: 0.5,
    nameLetterSpacing: 4,
    nameBold: true,
    nameAlignment: 'center',
    contactAlignment: 'center',
    roleTitleItalic: true,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '•',
    bulletIndent: 18,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8.5,
    educationSchoolBold: true,
  },
  'clean-modern': {
    id: 'clean-modern',
    name: 'Clean Modern',
    fontBody: 'DM Sans',
    fontHeading: 'DM Sans',
    sizeBody: 10,
    sizeName: 16,
    sizeSectionHeader: 11,
    sizeRoleTitle: 10.5,
    sizeCompanyName: 10.5,
    sizeSmall: 9,
    sizeContact: 9,
    lineHeight: 1.2,
    bulletGap: 3,
    sectionGapBefore: 12,
    sectionGapAfter: 4,
    roleGap: 8,
    roleLineGapAfter: 4,
    paragraphGap: 4,
    contactGapAfter: 4,
    competencyGap: 4,
    projectGap: 4,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.85,
    marginRight: 0.85,
    colorBody: '2d2d2d',
    colorHeading: '111111',
    colorSection: '1a1a1a',
    colorDim: '777777',
    colorRule: 'cccccc',
    roleTitleColor: '111111',
    datesColor: '777777',
    subtitleColor: '777777',
    competencyLabelColor: '111111',
    projectUrlColor: '1a1a1a',
    sectionHeaderStyle: 'bold-rule',
    sectionHeaderLetterSpacing: 1,
    sectionRuleWeight: 0.25,
    nameLetterSpacing: 0,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: false,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '–',
    bulletIndent: 16,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 9,
    educationSchoolBold: true,
  },
  'classic-serif': {
    id: 'classic-serif',
    name: 'Classic Serif',
    fontBody: 'Source Serif 4',
    fontHeading: 'Source Serif 4',
    sizeBody: 10.5,
    sizeName: 14,
    sizeSectionHeader: 11,
    sizeRoleTitle: 10.5,
    sizeCompanyName: 10.5,
    sizeSmall: 9.5,
    sizeContact: 9.5,
    lineHeight: 1.15,
    bulletGap: 2,
    sectionGapBefore: 10,
    sectionGapAfter: 3,
    roleGap: 6,
    roleLineGapAfter: 3,
    paragraphGap: 3,
    contactGapAfter: 3,
    competencyGap: 3,
    projectGap: 3,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginLeft: 1,
    marginRight: 1,
    colorBody: '000000',
    colorHeading: '000000',
    colorSection: '000000',
    colorDim: '444444',
    colorRule: '000000',
    roleTitleColor: '000000',
    datesColor: '444444',
    subtitleColor: '444444',
    competencyLabelColor: '000000',
    projectUrlColor: '000000',
    sectionHeaderStyle: 'caps-rule',
    sectionHeaderLetterSpacing: 2,
    sectionRuleWeight: 0.75,
    nameLetterSpacing: 0,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: true,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '•',
    bulletIndent: 18,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 9.5,
    educationSchoolBold: true,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    fontBody: 'IBM Plex Sans',
    fontHeading: 'IBM Plex Sans',
    sizeBody: 8.5,
    sizeName: 12,
    sizeSectionHeader: 9.5,
    sizeRoleTitle: 9,
    sizeCompanyName: 9,
    sizeSmall: 8,
    sizeContact: 8,
    lineHeight: 1.1,
    bulletGap: 1.5,
    sectionGapBefore: 8,
    sectionGapAfter: 1.5,
    roleGap: 5,
    roleLineGapAfter: 1.5,
    paragraphGap: 1.5,
    contactGapAfter: 1.5,
    competencyGap: 1.5,
    projectGap: 1.5,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginLeft: 0.6,
    marginRight: 0.6,
    colorBody: '333333',
    colorHeading: '111111',
    colorSection: '555555',
    colorDim: '888888',
    colorRule: 'aaaaaa',
    roleTitleColor: '111111',
    datesColor: '888888',
    subtitleColor: '888888',
    competencyLabelColor: '111111',
    projectUrlColor: '555555',
    sectionHeaderStyle: 'bold-only',
    sectionHeaderLetterSpacing: 0,
    sectionRuleWeight: 0,
    nameLetterSpacing: 0,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: true,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '▸',
    bulletIndent: 14,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8,
    educationSchoolBold: true,
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial',
    fontBody: 'Newsreader',
    fontHeading: 'DM Sans',
    sizeBody: 9.5,
    sizeName: 15,
    sizeSectionHeader: 10.5,
    sizeRoleTitle: 9.5,
    sizeCompanyName: 10.5,
    sizeSmall: 8.5,
    sizeContact: 8.5,
    lineHeight: 1.2,
    bulletGap: 2.5,
    sectionGapBefore: 10,
    sectionGapAfter: 3,
    roleGap: 7,
    roleLineGapAfter: 3,
    paragraphGap: 3,
    contactGapAfter: 5,
    competencyGap: 2.5,
    projectGap: 3,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.8,
    marginRight: 0.8,
    colorBody: '272727',
    colorHeading: '141414',
    colorSection: '1d3f72',
    colorDim: '666666',
    colorRule: '1d3f72',
    roleTitleColor: '141414',
    datesColor: '666666',
    subtitleColor: '666666',
    competencyLabelColor: '141414',
    projectUrlColor: '1d3f72',
    sectionHeaderStyle: 'caps-rule',
    sectionHeaderLetterSpacing: 2,
    sectionRuleWeight: 0.5,
    nameLetterSpacing: 1,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: true,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '•',
    bulletIndent: 17,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8.5,
    educationSchoolBold: true,
  },
  'executive-serif': {
    id: 'executive-serif',
    name: 'Executive Serif',
    fontBody: 'PT Serif',
    fontHeading: 'IBM Plex Serif',
    sizeBody: 9.75,
    sizeName: 15,
    sizeSectionHeader: 10.5,
    sizeRoleTitle: 9.5,
    sizeCompanyName: 10.5,
    sizeSmall: 8.5,
    sizeContact: 8.5,
    lineHeight: 1.2,
    bulletGap: 2.25,
    sectionGapBefore: 10,
    sectionGapAfter: 3,
    roleGap: 7,
    roleLineGapAfter: 2.5,
    paragraphGap: 2.5,
    contactGapAfter: 5,
    competencyGap: 2,
    projectGap: 3,
    marginTop: 0.65,
    marginBottom: 0.65,
    marginLeft: 0.65,
    marginRight: 0.65,
    colorBody: '232323',
    colorHeading: '111111',
    colorSection: '1f3a66',
    colorDim: '5e6673',
    colorRule: '1f3a66',
    roleTitleColor: '1b2330',
    datesColor: '5e6673',
    subtitleColor: '5e6673',
    competencyLabelColor: '111111',
    projectUrlColor: '1f3a66',
    sectionHeaderStyle: 'bold-rule',
    sectionHeaderLetterSpacing: 1.5,
    sectionRuleWeight: 0.5,
    nameLetterSpacing: 0.5,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: true,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '•',
    bulletIndent: 18,
    bulletHanging: 10,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8.5,
    educationSchoolBold: true,
  },
  'modern-contrast': {
    id: 'modern-contrast',
    name: 'Modern Contrast',
    fontBody: 'Inter',
    fontHeading: 'IBM Plex Serif',
    sizeBody: 9.25,
    sizeName: 14.5,
    sizeSectionHeader: 10,
    sizeRoleTitle: 9.25,
    sizeCompanyName: 10,
    sizeSmall: 8.25,
    sizeContact: 8.25,
    lineHeight: 1.16,
    bulletGap: 2,
    sectionGapBefore: 9,
    sectionGapAfter: 2.5,
    roleGap: 6,
    roleLineGapAfter: 2.5,
    paragraphGap: 2,
    contactGapAfter: 4,
    competencyGap: 1.5,
    projectGap: 2.5,
    marginTop: 0.55,
    marginBottom: 0.55,
    marginLeft: 0.55,
    marginRight: 0.55,
    colorBody: '222222',
    colorHeading: '141414',
    colorSection: '245a8f',
    colorDim: '5f6875',
    colorRule: 'd8dee7',
    roleTitleColor: '1b2330',
    datesColor: '5f6875',
    subtitleColor: '5f6875',
    competencyLabelColor: '1b2330',
    projectUrlColor: '245a8f',
    sectionHeaderStyle: 'caps-rule',
    sectionHeaderLetterSpacing: 2,
    sectionRuleWeight: 0.4,
    nameLetterSpacing: 1,
    nameBold: true,
    nameAlignment: 'center',
    contactAlignment: 'center',
    roleTitleItalic: false,
    datesAlignment: 'right-tab',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '▸',
    bulletIndent: 16,
    bulletHanging: 9,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8.25,
    educationSchoolBold: true,
  },
  'signal-clean': {
    id: 'signal-clean',
    name: 'Signal Clean',
    fontBody: 'DM Sans',
    fontHeading: 'PT Serif',
    sizeBody: 9.5,
    sizeName: 15,
    sizeSectionHeader: 11,
    sizeRoleTitle: 9.5,
    sizeCompanyName: 10.25,
    sizeSmall: 8.5,
    sizeContact: 8.5,
    lineHeight: 1.18,
    bulletGap: 2.5,
    sectionGapBefore: 11,
    sectionGapAfter: 3.5,
    roleGap: 7,
    roleLineGapAfter: 3,
    paragraphGap: 2.5,
    contactGapAfter: 4.5,
    competencyGap: 2.5,
    projectGap: 3,
    marginTop: 0.6,
    marginBottom: 0.6,
    marginLeft: 0.6,
    marginRight: 0.6,
    colorBody: '262626',
    colorHeading: '171717',
    colorSection: '2a4d3f',
    colorDim: '65707a',
    colorRule: 'b9c6bd',
    roleTitleColor: '1d2a24',
    datesColor: '65707a',
    subtitleColor: '65707a',
    competencyLabelColor: '1d2a24',
    projectUrlColor: '2a4d3f',
    sectionHeaderStyle: 'bold-rule',
    sectionHeaderLetterSpacing: 1,
    sectionRuleWeight: 0.35,
    nameLetterSpacing: 0,
    nameBold: true,
    nameAlignment: 'left',
    contactAlignment: 'left',
    roleTitleItalic: false,
    datesAlignment: 'inline',
    subtitleItalic: true,
    companyBold: true,
    bulletChar: '–',
    bulletIndent: 16,
    bulletHanging: 9,
    competencyLabelBold: true,
    projectNameBold: true,
    projectUrlSize: 8.5,
    educationSchoolBold: true,
  },
}

export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ResumeThemePresetId[]

export const THEME_FONT_OPTIONS = [
  'Inter',
  'DM Sans',
  'Source Serif 4',
  'PT Serif',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Newsreader',
  'DM Mono',
]

export const THEME_FONT_FILES: Record<string, string[]> = {
  Inter: [
    '/fonts/inter/Inter-Regular.ttf',
    '/fonts/inter/Inter-Bold.ttf',
    '/fonts/inter/Inter-Italic.ttf',
    '/fonts/inter/Inter-BoldItalic.ttf',
  ],
  'DM Sans': [
    '/fonts/dm-sans/DMSans-Regular.ttf',
    '/fonts/dm-sans/DMSans-Bold.ttf',
    '/fonts/dm-sans/DMSans-Italic.ttf',
    '/fonts/dm-sans/DMSans-BoldItalic.ttf',
  ],
  'Source Serif 4': [
    '/fonts/source-serif/SourceSerif4-Regular.ttf',
    '/fonts/source-serif/SourceSerif4-Bold.ttf',
    '/fonts/source-serif/SourceSerif4-Italic.ttf',
    '/fonts/source-serif/SourceSerif4-BoldItalic.ttf',
  ],
  'PT Serif': [
    '/fonts/pt-serif/PTSerif-Regular.ttf',
    '/fonts/pt-serif/PTSerif-Bold.ttf',
    '/fonts/pt-serif/PTSerif-Italic.ttf',
    '/fonts/pt-serif/PTSerif-BoldItalic.ttf',
  ],
  'IBM Plex Sans': [
    '/fonts/ibm-plex-sans/IBMPlexSans-Regular.ttf',
    '/fonts/ibm-plex-sans/IBMPlexSans-Bold.ttf',
    '/fonts/ibm-plex-sans/IBMPlexSans-Italic.ttf',
    '/fonts/ibm-plex-sans/IBMPlexSans-BoldItalic.ttf',
  ],
  'IBM Plex Serif': [
    '/fonts/ibm-plex-serif/IBMPlexSerif-Regular.ttf',
    '/fonts/ibm-plex-serif/IBMPlexSerif-Bold.ttf',
    '/fonts/ibm-plex-serif/IBMPlexSerif-Italic.ttf',
    '/fonts/ibm-plex-serif/IBMPlexSerif-BoldItalic.ttf',
  ],
  Newsreader: [
    '/fonts/newsreader/Newsreader-Regular.ttf',
    '/fonts/newsreader/Newsreader-Bold.ttf',
    '/fonts/newsreader/Newsreader-Italic.ttf',
    '/fonts/newsreader/Newsreader-BoldItalic.ttf',
  ],
  'DM Mono': ['/fonts/dm-mono/DMMono-Regular.ttf', '/fonts/dm-mono/DMMono-Italic.ttf'],
}

export const THEME_SECTION_HEADER_OPTIONS = SECTION_STYLES
export const THEME_BULLET_OPTIONS = BULLET_STYLES
export const THEME_TEXT_ALIGNMENT_OPTIONS = TEXT_ALIGNMENT_OPTIONS
export const THEME_DATES_ALIGNMENT_OPTIONS = DATES_ALIGNMENT_OPTIONS

const isThemePresetId = (value: string): value is ResumeThemePresetId => value in THEME_PRESETS

const resolvePresetAlias = (value: string | undefined): ResumeThemePresetId | undefined => {
  if (!value) {
    return undefined
  }
  if (isThemePresetId(value)) {
    return value
  }
  return THEME_LEGACY_PRESET_ALIASES[value]
}

const applyLegacyOverrideAliases = (
  overrides: ResumeThemeOverrides | undefined,
): ResumeThemeOverrides | undefined => {
  if (!overrides) {
    return undefined
  }

  const mapped: ResumeThemeOverrides = { ...overrides }
  for (const [legacyKey, nextKey] of Object.entries(THEME_LEGACY_OVERRIDE_ALIASES)) {
    const legacyValue = (mapped as Record<string, unknown>)[legacyKey]
    if (legacyValue === undefined || mapped[nextKey] !== undefined) {
      continue
    }
    mapped[nextKey] = legacyValue as never
  }

  return mapped
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

const normalizeColor = (value: string): string | null => {
  const raw = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(raw)) {
    return null
  }
  return raw.toLowerCase()
}

const normalizeString = (value: string): string => value.trim().slice(0, 80)

const sanitizeOverrideEntry = <K extends keyof ResumeThemeOverrides>(
  key: K,
  value: ResumeThemeOverrides[K],
): ResumeThemeOverrides[K] | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'boolean') {
    if (BOOLEAN_KEYS.has(key)) {
      return value
    }
    return undefined
  }

  if (typeof value === 'string') {
    if (COLOR_KEYS.has(key)) {
      const normalized = normalizeColor(value)
      return (normalized ?? undefined) as ResumeThemeOverrides[K]
    }

    if (key === 'sectionHeaderStyle') {
      if (SECTION_STYLES.includes(value as SectionHeaderStyle)) {
        return value as ResumeThemeOverrides[K]
      }
      return undefined
    }

    if (key === 'bulletChar') {
      if (BULLET_STYLES.includes(value as BulletChar)) {
        return value as ResumeThemeOverrides[K]
      }
      return undefined
    }

    if (key === 'nameAlignment' || key === 'contactAlignment') {
      if (TEXT_ALIGNMENT_OPTIONS.includes(value as ThemeTextAlignment)) {
        return value as ResumeThemeOverrides[K]
      }
      return undefined
    }

    if (key === 'datesAlignment') {
      if (DATES_ALIGNMENT_OPTIONS.includes(value as ThemeDatesAlignment)) {
        return value as ResumeThemeOverrides[K]
      }
      return undefined
    }

    if (key === 'fontBody' || key === 'fontHeading') {
      const normalizedFont = normalizeThemeFontFamilyValue(value)
      return (normalizedFont.length > 0 ? normalizedFont : undefined) as ResumeThemeOverrides[K]
    }

    const normalized = normalizeString(value)
    return (normalized.length > 0 ? normalized : undefined) as ResumeThemeOverrides[K]
  }

  if (typeof value === 'number') {
    const bounds = NUMBER_BOUNDS[key]
    if (!bounds || Number.isNaN(value)) {
      return undefined
    }
    return clampNumber(value, bounds.min, bounds.max) as ResumeThemeOverrides[K]
  }

  return undefined
}

export const getThemePreset = (preset: ResumeThemePresetId): ResumeTheme => ({ ...THEME_PRESETS[preset] })

export const sanitizeThemeOverrides = (
  overrides: ResumeThemeOverrides | undefined,
  preset: ResumeThemePresetId,
): ResumeThemeOverrides | undefined => {
  const aliasedOverrides = applyLegacyOverrideAliases(overrides)
  if (!aliasedOverrides) {
    return undefined
  }

  const clean: ResumeThemeOverrides = {}
  const presetTheme = THEME_PRESETS[preset]
  for (const key of THEME_OVERRIDE_KEYS) {
    const normalized = sanitizeOverrideEntry(key, aliasedOverrides[key])
    if (normalized === undefined) {
      continue
    }
    if (normalized === presetTheme[key]) {
      continue
    }
    ;(clean as Record<string, string | number | boolean>)[key] = normalized as
      | string
      | number
      | boolean
  }

  return Object.keys(clean).length > 0 ? clean : undefined
}

export const normalizeThemeState = (theme: ResumeThemeState | undefined): ResumeThemeState => {
  const preset = resolvePresetAlias(theme?.preset) ?? DEFAULT_THEME_PRESET
  const overrides = sanitizeThemeOverrides(theme?.overrides, preset)
  return overrides ? { preset, overrides } : { preset }
}

export const resolveThemeFontFamily = (value: string): string => normalizeThemeFontFamilyValue(value)

export const getThemeFontFiles = (theme: Pick<ResumeTheme, 'fontBody' | 'fontHeading'>): string[] => {
  const families = [
    resolveThemeFontFamily(theme.fontBody),
    resolveThemeFontFamily(theme.fontHeading),
  ]
  const files = families.flatMap((family) => THEME_FONT_FILES[family] ?? [])
  return Array.from(new Set(files))
}

export const resolveTheme = (theme: ResumeThemeState | undefined): ResumeTheme => {
  const normalized = normalizeThemeState(theme)
  const preset = THEME_PRESETS[normalized.preset]
  return {
    ...preset,
    ...(normalized.overrides ?? {}),
  }
}
