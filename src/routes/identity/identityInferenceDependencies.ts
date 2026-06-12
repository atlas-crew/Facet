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

/**
 * Intra-identity inference DAG (Graph 2), keyed by *material inputs* (upstream).
 *
 * Each entry lists the inference sections whose output is a **primary driver** of
 * this section's generation — not merely present in the serialized prompt. Every
 * identity generator builds its prompt from the *entire* identity
 * (`identityParametersGeneration.ts` `buildGenerationPrompt`), so the mechanical
 * dependency is all-on-all and useless as a signal. This map is therefore an
 * **authored semantic under-approximation**: a deliberate subset of the generous
 * "use X as evidence" instructions, chosen so a correction flags exactly the
 * sections a user expects their edit to have moved (Thread 3 of the identity
 * derivation-graph roadmap).
 *
 * Inclusion rule (validated against each consuming generator's prompt):
 *   R is an input of S iff R is a named primary driver of S's output. Presence in
 *   context is not an edge.
 *
 * Forward-only invariant: every input precedes its section in IDENTITY_INFERENCE_ORDER.
 * The generators are full-context so a later section sits in an earlier one's prompt
 * too, but those are pre-existing-context refinements, not derivation edges — encoding
 * them would make the graph cyclic and reintroduce the linear chain's paranoia
 * ("correct your moat → thesis stale"), which contradicts the user's mental model of
 * "what could my edit have changed downstream." The forward-only rule is enforced by test.
 *
 * Downstream (consumers) is the transpose closure of this map — see
 * `getDownstreamIdentityInferenceSections`.
 */
const IDENTITY_INFERENCE_INPUTS = {
  // Root evidence: deepened from raw `roles[].bullets[].source_text`. No upstream section.
  bullets: [],
  // Depth/calibration grounded in demonstrated use across roles/bullets and projects.
  skills: ['bullets'],
  // generateIdentityThesisFromIdentity: "Use roles, projects, skills ... as evidence."
  // (`profiles`/`self_model` in that prompt are forward refs — thesis precedes both — so
  // they are pre-existing context, not edges.)
  thesis: ['bullets', 'skills'],
  // generateIdentityProfilesFromIdentity: "Use roles, projects, skills, thesis ... as
  // evidence." (`self_model` resolves to thesis core, already covered; `expertise` is not an
  // inference section.)
  profiles: ['bullets', 'skills', 'thesis'],
  // Authored from `roles` (company/title/date sequence). SelfModelBand forbids auto-deriving
  // the arc from roles — roles are *input context*, the arc is interpretation — so the only
  // material driver is the role spine (`bullets`). Notably NOT downstream of skills/thesis/
  // profiles: the headline precision win over the linear chain, which flagged the arc stale
  // after any earlier edit.
  chapters: ['bullets'],
  // generateSelfKnowledgeFromIdentity grounds philosophy/interview_style in roles/bullets, the
  // career arc (`self_model.arc` = chapters), and the thesis. Skills/profiles are curated out
  // (named in the prompt but not primary drivers of philosophy — accepted false negative).
  selfKnowledge: ['bullets', 'chapters', 'thesis'],
  // generateStrategicPositioningFromIdentity: "Use the roles, projects, skills ... and existing
  // self_model as evidence." The moat builds on the thesis, skills, the career arc
  // (`self_model.arc` = chapters), and the philosophy (`self_model.philosophy` = selfKnowledge).
  // `profiles` is named in the prompt but curated out — it is a sibling presentation lens, not a
  // driver of the moat (a downstream leaf, per the Thread-3 design table).
  positioning: ['bullets', 'skills', 'thesis', 'chapters', 'selfKnowledge'],
  // Terminal. Search vectors are grounded in the thesis, positioning, skills, the career arc
  // (`self_model.arc` = chapters), and the philosophy (`self_model.philosophy` = selfKnowledge).
  // `preferences` is an external region (not an inference section), so it carries no
  // intra-identity edge.
  search: ['skills', 'thesis', 'chapters', 'selfKnowledge', 'positioning'],
} as const satisfies Record<IdentityInferenceSection, readonly IdentityInferenceSection[]>

/**
 * Identity field-path roots each inference section *owns* (produces), expressed in the same
 * dotted vocabulary as `artifactMeta.identityFields` / `buildSkillIdentityFields`
 * (e.g. `skills.<name>.depth`). One vocabulary spans both staleness graphs: a Graph 1 mutation
 * field (identity → downstream artifact) and a Graph 2 input edge (intra-identity) describe the
 * same region with the same string, so the fingerprint mechanism (TASK-168 / Option C) does not
 * need a second scheme.
 *
 * Roots are prefix-matched: a field belongs to a section iff it equals a root or extends it with
 * a `.` segment. `thesis` deliberately owns only the narrative sub-fields of the `identity`
 * region, not contact basics (`identity.name`/`identity.email`) — correcting an email is not an
 * inference edit and must match no section.
 */
export const IDENTITY_INFERENCE_SECTION_FIELDS = {
  bullets: ['roles', 'projects'],
  skills: ['skills'],
  thesis: ['identity.thesis', 'identity.title', 'identity.origin', 'identity.elaboration'],
  profiles: ['profiles'],
  chapters: ['self_model.arc'],
  selfKnowledge: ['self_model.philosophy', 'self_model.interview_style'],
  positioning: ['self_model.competitive_moat', 'self_model.unfair_advantages'],
  search: ['search_vectors'],
} as const satisfies Record<IdentityInferenceSection, readonly string[]>

const sectionOrderIndex = new Map(
  IDENTITY_INFERENCE_ORDER.map((section, index) => [section, index] as const),
)

// Transpose of IDENTITY_INFERENCE_INPUTS: section → sections that consume it as a direct input.
// Precomputed once so downstream resolution is a plain adjacency walk.
const IDENTITY_INFERENCE_CONSUMERS: Record<
  IdentityInferenceSection,
  IdentityInferenceSection[]
> = Object.fromEntries(
  IDENTITY_INFERENCE_ORDER.map((section) => [section, [] as IdentityInferenceSection[]]),
) as Record<IdentityInferenceSection, IdentityInferenceSection[]>

for (const section of IDENTITY_INFERENCE_ORDER) {
  for (const input of IDENTITY_INFERENCE_INPUTS[section]) {
    IDENTITY_INFERENCE_CONSUMERS[input].push(section)
  }
}

export function getIdentityInferenceSectionLabel(section: IdentityInferenceSection): string {
  return IDENTITY_INFERENCE_SECTION_LABELS[section]
}

/**
 * Direct material inputs of a section (the upstream edges). Use to scope a fingerprint to the
 * sections a generator actually consumed, rather than hashing the full identity.
 */
export function getUpstreamIdentityInferenceSections(
  section: IdentityInferenceSection,
): IdentityInferenceSection[] {
  return sortIdentityInferenceSections(IDENTITY_INFERENCE_INPUTS[section])
}

/**
 * Sections whose recorded output may be stale once `section` is corrected or regenerated —
 * the transitive closure of consumers (the transpose of the input DAG), in inference order.
 *
 * Precise, not paranoid: a section appears only if it (transitively) names `section` a material
 * driver. Correcting the thesis no longer flags `chapters`, because the career arc is authored
 * from roles and never consumes the thesis.
 */
export function getDownstreamIdentityInferenceSections(
  section: IdentityInferenceSection,
): IdentityInferenceSection[] {
  const downstream = new Set<IdentityInferenceSection>()
  const visit = (current: IdentityInferenceSection) => {
    for (const consumer of IDENTITY_INFERENCE_CONSUMERS[current]) {
      if (downstream.has(consumer)) continue
      downstream.add(consumer)
      visit(consumer)
    }
  }

  visit(section)
  return sortIdentityInferenceSections([...downstream])
}

/**
 * The identity field-path roots a section consumes: the union of its upstream sections' owned
 * fields. This is the `inputs(section)` set the fingerprint-derived staleness (Option C) hashes
 * — without it, "hash everything this section saw" degenerates to the full identity and every
 * edit looks stale.
 */
export function getIdentityInferenceInputFields(section: IdentityInferenceSection): string[] {
  const fields = new Set<string>()
  for (const input of IDENTITY_INFERENCE_INPUTS[section]) {
    for (const field of IDENTITY_INFERENCE_SECTION_FIELDS[input]) {
      fields.add(field)
    }
  }
  return [...fields]
}

/**
 * Reverse lookup bridging Graph 1 → Graph 2: the inference section that owns a given identity
 * field path, or `undefined` when no section claims it (e.g. contact basics, `expertise`,
 * `preferences`). Lets a recorded identity mutation (whose `fields` use the shared vocabulary)
 * drive the intra-identity cascade. Matches by exact equality or `.`-delimited prefix.
 */
export function getIdentityInferenceSectionForField(
  fieldPath: string,
): IdentityInferenceSection | undefined {
  const normalized = fieldPath.trim()
  if (!normalized) return undefined
  for (const section of IDENTITY_INFERENCE_ORDER) {
    for (const root of IDENTITY_INFERENCE_SECTION_FIELDS[section]) {
      if (normalized === root || normalized.startsWith(root + '.')) {
        return section
      }
    }
  }
  return undefined
}

export function sortIdentityInferenceSections(
  sections: readonly IdentityInferenceSection[],
): IdentityInferenceSection[] {
  return [...new Set(sections)].sort(
    (a, b) => (sectionOrderIndex.get(a) ?? 0) - (sectionOrderIndex.get(b) ?? 0),
  )
}
