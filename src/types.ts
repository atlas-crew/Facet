import type { DurableMetadata } from './types/durable'

export type VectorId = string
export type VectorSelection = VectorId | 'all'

export type ComponentPriority = 'include' | 'exclude'
export const DEFAULT_TARGET_PAGES = 2

export type PriorityByVector = Record<VectorId, ComponentPriority>
export type TextVariantMap = Partial<Record<VectorId, string>>
export type SkillGroupOrder = { default?: number } & Record<string, number | undefined>
export type SectionHeaderStyle = 'caps-rule' | 'bold-rule' | 'bold-only' | 'underline'
export type BulletChar = '•' | '–' | '▸' | 'none'
export type ThemeTextAlignment = 'left' | 'center' | 'right'
export type ThemeDatesAlignment = 'right-tab' | 'inline'
export type TemplateId = 'classic' | 'sidebar' | 'minimalist' | 'letter'

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
  vectors: PriorityByVector
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
  id: string
  school: string
  location: string
  degree: string
  year?: string
  vectors: PriorityByVector
}

export interface CertificationComponent {
  id: string
  name: string
  issuer: string
  date?: string
  credential_id?: string
  url?: string
  vectors: PriorityByVector
}

export interface PresetOverrides {
  manualOverrides: Record<string, boolean>
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
  durableMeta?: DurableMetadata
  meta: ResumeMeta
  theme?: ResumeThemeState
  vectors: ResumeVector[]
  target_lines: TargetLineComponent[]
  profiles: ProfileComponent[]
  skill_groups: SkillGroupComponent[]
  roles: RoleComponent[]
  projects: ProjectComponent[]
  education: EducationEntry[]
  certifications: CertificationComponent[]
  presets?: Preset[]
  manualOverrides?: VectorManualOverrides
  bulletOrders?: VectorBulletOrders
  variables?: VariableRegistry
  _overridesMigrated?: boolean
}

export type ManualComponentOverrides = Record<string, boolean>
export type VectorManualOverrides = Record<VectorId | 'all', ManualComponentOverrides>


export type VariableRegistry = Record<string, string>

export type RoleBulletOrderMap = Record<string, string[]>
export type VectorBulletOrders = Record<VectorId | 'all', RoleBulletOrderMap>

export interface AssembledTextComponent {
  id: string
  text: string
}

export interface AssembledSkillGroup {
  id: string
  label: string
  content: string
}

export interface AssembledRoleBullet {
  id: string
  text: string
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
}

export interface AssembledEducation {
  id: string
  school: string
  location: string
  degree: string
  year?: string
}

export interface AssembledCertification {
  id: string
  name: string
  issuer: string
  date?: string
  credential_id?: string
  url?: string
}

export interface AssembledResume {
  selectedVector: VectorSelection
  header: ResumeMeta
  targetLine?: AssembledTextComponent
  profile?: AssembledTextComponent
  skillGroups: AssembledSkillGroup[]
  roles: AssembledRole[]
  projects: AssembledProject[]
  education: AssembledEducation[]
  certifications: AssembledCertification[]
}

export type EngineWarningCode = 'over_budget_after_trim'

export interface EngineWarning {
  code: EngineWarningCode
  message: string
}

export interface AssemblyOptions {
  selectedVector?: VectorSelection
  manualOverrides?: ManualComponentOverrides
  bulletOrderByRole?: RoleBulletOrderMap
  targetPages?: number
  trimToPageBudget?: boolean
  variables?: Record<string, string>
}

export interface AssemblyResult {
  resume: AssembledResume
  targetPages: number
  estimatedPages: number
  estimatedPageUsage: number
  trimmedBulletIds: string[]
  warnings: EngineWarning[]
}

export type VectorDef = ResumeVector
export type SkillGroup = SkillGroupComponent
export type Role = RoleComponent

// Component Creation types
export type AddComponentType =
  | 'target_line'
  | 'profile'
  | 'skill_group'
  | 'project'
  | 'bullet'
  | 'role'
  | 'education'
  | 'certification'

export interface AddComponentPayload {
  text?: string
  label?: string
  content?: string
  name?: string
  url?: string
  roleId?: string
  vectors?: PriorityByVector
  issuer?: string
  date?: string
  credential_id?: string
}

export interface ComponentSuggestion {
  recommendedPriority: ComponentPriority
  reason: string
}

export interface JdBulletAdjustment {
  bullet_id: string
  recommended_priority: ComponentPriority
  reason: string
}

export interface JdAnalysisResult {
  primary_vector: string
  bullet_adjustments: JdBulletAdjustment[]
  suggested_target_line: string
  skill_gaps: string[]
  matched_keywords: string[]
  suggested_variables: Record<string, string>
  positioning_note: string
}
