export const IDENTITY_INFERENCE_ORDER = [
  'bullets',
  'skills',
  'thesis',
  'profiles',
  'chapters',
  'selfKnowledge',
  'positioning',
  'search',
] as const

export type IdentityInferenceSection = (typeof IDENTITY_INFERENCE_ORDER)[number]

export const IDENTITY_INFERENCE_SECTION_LABELS = {
  bullets: 'Bullet evidence',
  skills: 'Skill depth',
  thesis: 'Thesis',
  profiles: 'Profiles',
  chapters: 'Career chapters',
  selfKnowledge: 'Self-knowledge',
  positioning: 'Positioning',
  search: 'Search parameters',
} as const satisfies Record<IdentityInferenceSection, string>

const IDENTITY_INFERENCE_DEPENDENCIES = {
  // Conservative authoring order: later sections are treated as downstream of
  // earlier sections even when the semantic dependency is indirect. The prompt
  // should over-warn about stale inference rather than hide a possible invalidation.
  bullets: ['skills'],
  skills: ['thesis'],
  thesis: ['profiles'],
  profiles: ['chapters'],
  chapters: ['selfKnowledge'],
  selfKnowledge: ['positioning'],
  positioning: ['search'],
  search: [],
} as const satisfies Record<IdentityInferenceSection, readonly IdentityInferenceSection[]>

const sectionOrderIndex = new Map(
  IDENTITY_INFERENCE_ORDER.map((section, index) => [section, index] as const),
)

export function getIdentityInferenceSectionLabel(section: IdentityInferenceSection): string {
  return IDENTITY_INFERENCE_SECTION_LABELS[section]
}

export function getDownstreamIdentityInferenceSections(
  section: IdentityInferenceSection,
): IdentityInferenceSection[] {
  const downstream = new Set<IdentityInferenceSection>()
  const visit = (current: IdentityInferenceSection) => {
    for (const child of IDENTITY_INFERENCE_DEPENDENCIES[current]) {
      if (downstream.has(child)) continue
      downstream.add(child)
      visit(child)
    }
  }

  visit(section)
  return [...downstream].sort(
    (a, b) => (sectionOrderIndex.get(a) ?? 0) - (sectionOrderIndex.get(b) ?? 0),
  )
}

export function sortIdentityInferenceSections(
  sections: readonly IdentityInferenceSection[],
): IdentityInferenceSection[] {
  return [...new Set(sections)].sort(
    (a, b) => (sectionOrderIndex.get(a) ?? 0) - (sectionOrderIndex.get(b) ?? 0),
  )
}
