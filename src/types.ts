export type VectorId = string
export type VectorSelection = VectorId | 'all'

export type ComponentPriority = 'must' | 'strong' | 'optional' | 'exclude'
export type IncludedPriority = Exclude<ComponentPriority, 'exclude'>

export const PRIORITY_ORDER: IncludedPriority[] = ['must', 'strong', 'optional']
export const DEFAULT_TARGET_PAGES = 2

export type PriorityByVector = Record<VectorId, ComponentPriority>
export type TextVariantMap = Partial<Record<VectorId, string>>
export type VariantSelection = VectorId | 'default'
export type SkillGroupOrder = { default?: number } & Record<string, number | undefined>
export type SectionHeaderStyle = 'caps-rule' | 'bold-rule' | 'bold-only' | 'underline'
export type BulletChar = '•' | '–' | '▸' | 'none'
export type ThemeTextAlignment = 'left' | 'center' | 'right'
export type ThemeDatesAlignment = 'right-tab' | 'inline'
export type TemplateId = 'classic' | 'sidebar' | 'minimalist'

export type ResumeThemePresetId =
  | 'ferguson-v12'

  | 'clean-modern'
  | 'classic-serif'
  | 'minimal'
  | 'editorial'
  | 'executive-serif'
  | 'modern-contrast'
  | 'signal-clean'
  | 'creative-bold'
  | 'academic-dense'

export interface ResumeTheme {
  id: ResumeThemePresetId
  name: string
  templateId: TemplateId
  fontBody: string
  fontHeading: string
  sizeBody: number
  sizeName: number
  sizeSectionHeader: number
  sizeRoleTitle: number
  sizeCompanyName: number
  sizeSmall: number
  sizeContact: number
  lineHeight: number
  bulletGap: number
  sectionGapBefore: number
  sectionGapAfter: number
  sectionRuleGap: number
  roleGap: number
  roleHeaderGap: number
  roleLineGapAfter: number
  paragraphGap: number
  contactGapAfter: number
  competencyGap: number
  projectGap: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  colorBody: string
  colorHeading: string
  colorSection: string
  colorDim: string
  colorRule: string
  roleTitleColor: string
  datesColor: string
  subtitleColor: string
  competencyLabelColor: string
  projectUrlColor: string
  sectionHeaderStyle: SectionHeaderStyle
  sectionHeaderLetterSpacing: number
  sectionRuleWeight: number
  nameLetterSpacing: number
  nameBold: boolean
  nameAlignment: ThemeTextAlignment
  contactAlignment: ThemeTextAlignment
  roleTitleItalic: boolean
  datesAlignment: ThemeDatesAlignment
  subtitleItalic: boolean
  companyBold: boolean
  bulletChar: BulletChar
  bulletIndent: number
  bulletHanging: number
  competencyLabelBold: boolean
  projectNameBold: boolean
  projectUrlSize: number
  educationSchoolBold: boolean

  // Template-specific tokens
  sidebarWidth?: number // in inches
  sidebarColor?: string // hex
  columnGap?: number // in points
}

export type ResumeThemeOverrides = Partial<Omit<ResumeTheme, 'id' | 'name'>>

export interface ResumeThemeState {
  preset: ResumeThemePresetId
  overrides?: ResumeThemeOverrides
  showHeatmap?: boolean
  showDesignHealth?: boolean
}

export interface SkillGroupVectorConfig {
  priority: ComponentPriority
  order: number
  content?: string
}

export interface ResumeLink {
  label?: string
  url: string
}

export interface ResumeMeta {
  name: string
  email: string
  phone: string
  location: string
  links: ResumeLink[]
}

export interface ResumeVector {
  id: VectorId
  label: string
  color: string
}

export interface TargetLineComponent {
  id: string
  vectors: PriorityByVector
  text: string
  variants?: TextVariantMap
}

export interface ProfileComponent {
  id: string
  vectors: PriorityByVector
  text: string
  variants?: TextVariantMap
}

export interface SkillGroupComponent {
  id: string
  label: string
  content: string
  order?: SkillGroupOrder
  vectors?: Record<VectorId, SkillGroupVectorConfig>
}

export interface RoleBulletComponent {
  id: string
  label?: string
  vectors: PriorityByVector
  text: string
  variants?: TextVariantMap
}

export interface RoleComponent {
  id: string
  company: string
  title: string
  dates: string
  location?: string | null
  subtitle?: string | null
  bullets: RoleBulletComponent[]
}

export interface ProjectComponent {
  id: string
  name: string
  url?: string
  vectors: PriorityByVector
  text: string
  variants?: TextVariantMap
}

export interface EducationEntry {
  school: string
  location: string
  degree: string
  year?: string
}

export interface PresetOverrides {
  manualOverrides: Record<string, boolean>
  variantOverrides: Record<string, VariantSelection>
  bulletOrders: RoleBulletOrderMap
  priorityOverrides?: Array<{
    bulletId: string
    vectorId: VectorId
    priority: ComponentPriority
  }>
  theme?: ResumeThemeState
  targetLineId?: string
  profileId?: string
  skillGroupOrder?: string[]
}

export interface Preset {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  baseVector: VectorSelection
  overrides: PresetOverrides
}

export interface ResumeData {
  version: number
  meta: ResumeMeta
  theme?: ResumeThemeState
  vectors: ResumeVector[]
  target_lines: TargetLineComponent[]
  profiles: ProfileComponent[]
  skill_groups: SkillGroupComponent[]
  roles: RoleComponent[]
  projects: ProjectComponent[]
  education: EducationEntry[]
  presets?: Preset[]
  manualOverrides?: VectorManualOverrides
  variantOverrides?: VectorVariantOverrides
  bulletOrders?: VectorBulletOrders
  _overridesMigrated?: boolean
}

export type ManualComponentOverrides = Record<string, boolean>
export type VectorManualOverrides = Record<VectorId | 'all', ManualComponentOverrides>

export type ManualVariantOverrides = Record<string, VariantSelection>
export type VectorVariantOverrides = Record<VectorId | 'all', ManualVariantOverrides>

export type RoleBulletOrderMap = Record<string, string[]>
export type VectorBulletOrders = Record<VectorId | 'all', RoleBulletOrderMap>

export interface AssembledTextComponent {
  id: string
  text: string
  priority: IncludedPriority
}

export interface AssembledSkillGroup {
  id: string
  label: string
  content: string
}

export interface AssembledRoleBullet {
  id: string
  text: string
  priority: IncludedPriority
}

export interface AssembledRole {
  id: string
  company: string
  title: string
  dates: string
  location?: string | null
  subtitle?: string | null
  bullets: AssembledRoleBullet[]
}

export interface AssembledProject {
  id: string
  name: string
  url?: string
  text: string
  priority: IncludedPriority
}

export interface AssembledResume {
  selectedVector: VectorSelection
  header: ResumeMeta
  targetLine?: AssembledTextComponent
  profile?: AssembledTextComponent
  skillGroups: AssembledSkillGroup[]
  roles: AssembledRole[]
  projects: AssembledProject[]
  education: EducationEntry[]
}

export type EngineWarningCode = 'must_over_budget' | 'over_budget_after_trim'

export interface EngineWarning {
  code: EngineWarningCode
  message: string
}

export interface AssemblyOptions {
  selectedVector?: VectorSelection
  manualOverrides?: ManualComponentOverrides
  variantOverrides?: ManualVariantOverrides
  bulletOrderByRole?: RoleBulletOrderMap
  targetPages?: number
  trimToPageBudget?: boolean
}

export interface AssemblyResult {
  resume: AssembledResume
  targetPages: number
  estimatedPages: number
  estimatedPageUsage: number
  mustOnlyEstimatedPages: number
  mustOnlyEstimatedPageUsage: number
  trimmedBulletIds: string[]
  warnings: EngineWarning[]
}

// UI aliases
export type Priority = ComponentPriority
export type VectorDef = ResumeVector
export type SkillGroup = SkillGroupComponent
export type Role = RoleComponent
