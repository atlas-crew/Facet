---
mode: data-model
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: erd.mmd
secondary_diagrams: []
synthesized_share: 0.000
---

# Data Model

## Summary

The data model has **two centers of gravity**: `ProfessionalIdentityV3` (the identity-canonical schema in `src/identity/schema.ts`) and `PipelineEntry` (the durable job-application record in `src/types/pipeline.ts`). Identity owns the user's career as facts; PipelineEntry owns each application as a process. Every other major entity in the user flow is either a *derivation* of identity (ResumeData, CoverLetter, LinkedInProfileDraft, RecruiterCard, DebriefSession) or a *projection* of pipeline (JDAnalysis, PrepDeck, PipelineRound).

This is the **identity-canonical-data** principle in concrete form: artifact entities don't store fields they could read from identity; they reference identity by FK or carry an `identityVersion` stamp. The diagram makes this visible — identity and its constituents form a tight cluster on one side, and every artifact entity has at most one or two FKs pointing into the identity cluster (or, more often, into PipelineEntry which itself references identity-derived state).

A second commitment visible here: **`AudienceTagged` is a marker interface**, not a normal entity — it's mixed into MatchRequirement, SkillMatch, MatchAdvantage, etc. via `extends`. This is how audience-tagging cross-cuts the data model without a separate persistence path.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| M-1 | ProfessionalIdentityV3 | src/identity/schema.ts:265 | high |
| M-2 | ProfessionalIdentityCore | src/identity/schema.ts:34 | high |
| M-3 | ProfessionalSelfModel | src/identity/schema.ts:65 | high |
| M-4 | ProfessionalPreferences | src/identity/schema.ts:141 | high |
| M-5 | ProfessionalSkills | src/identity/schema.ts:177 | high |
| M-6 | ProfessionalRole | src/identity/schema.ts:200 | high |
| M-7 | ProfessionalProject | src/identity/schema.ts:210 | high |
| M-8 | ProfessionalIdentityArcEntry | src/identity/schema.ts:48 | high |
| M-9 | ProfessionalPhilosophyEntry | src/identity/schema.ts:53 | high |
| M-10 | ProfessionalInterviewStyle | src/identity/schema.ts:59 | high |
| M-11 | ProfessionalCompensationPreferences | src/identity/schema.ts:77 | high |
| M-12 | ProfessionalWorkModelPreferences | src/identity/schema.ts:84 | high |
| M-13 | ProfessionalMatchingPreferences | src/identity/schema.ts:106 | high |
| M-14 | ProfessionalSkillGroup | src/identity/schema.ts:168 | high |
| M-15 | ProfessionalRoleBullet | src/identity/schema.ts:187 | high |
| M-16 | ProfessionalPreferencePriority | src/identity/schema.ts:71 | high |
| M-17 | ProfessionalMatchingPriority | src/identity/schema.ts:90 | high |
| M-18 | ProfessionalMatchingAvoid | src/identity/schema.ts:98 | high |
| M-19 | ProfessionalSkillItem | src/identity/schema.ts:149 | high |
| M-20 | PipelineEntry | src/types/pipeline.ts:182 | high |
| M-21 | ProfessionalSearchVector | src/identity/schema.ts:237 | high |
| M-22 | JDAnalysis | src/types/jdAnalysis.ts:31 | high |
| M-23 | MatchRequirementCoverage | src/types/match.ts:124 | high |
| M-24 | SkillMatch | src/types/match.ts:50 | high |
| M-25 | PipelineRound | src/types/pipeline.ts:164 | high |
| M-26 | PipelineResearchSnapshot | src/types/pipeline.ts:106 | high |
| M-27 | PipelineInterviewer | src/types/pipeline.ts:139 | high |
| M-28 | PrepInterviewerIntel | src/types/prep.ts:249 | high |
| M-29 | PrepDeck | src/types/prep.ts:402 | high |
| M-30 | PrepCard | src/types/prep.ts:351 | high |
| M-31 | PrepCompanyIntel | src/types/prep.ts:275 | high |
| M-32 | PrepCompanyAiPosture | src/types/prep.ts:269 | high |
| M-33 | ResumeData | src/types.ts:224 | high |
| M-34 | ResumeVector | src/types.ts:124 | high |
| M-35 | RoleComponent | src/types.ts:160 | high |
| M-36 | SkillGroupComponent | src/types.ts:144 | high |
| M-37 | RoleBulletComponent | src/types.ts:152 | high |
| M-38 | CoverLetter | src/types/coverLetter.ts:34 | high |
| M-39 | CoverLetterContent | src/types/coverLetter.ts:13 | high |
| M-40 | AudienceTagged | src/types/audience.ts:45 | high |
| M-41 | CoverLetterParagraph | src/types/coverLetter.ts:5 | high |
| M-42 | LinkedInProfileDraft | src/types/linkedin.ts:1 | high |
| M-43 | RecruiterCard | src/types/recruiter.ts:3 | high |
| M-44 | DurableMetadata | src/types/durable.ts:10 | high |
| M-45 | WorkspaceOwnership | src/types/durable.ts:4 | high |
| M-46 | ArtifactMetadata | src/types/artifactMeta.ts:15 | high |
| M-47 | ArtifactStalenessReview | src/types/artifactMeta.ts:25 | high |
| M-48 | DebriefSession | src/types/debrief.ts:102 | high |
| M-49 | DebriefIdentityPatch | src/types/debrief.ts:57 | high |
| M-50 | DebriefIdentityBulletUpdate | src/types/debrief.ts:40 | high |
| M-51 | SearchProfile | src/types/search.ts:178 | high |
| M-52 | SkillCatalogEntry | src/types/search.ts:128 | high |
| M-53 | SearchProfileFilters | src/types/search.ts:168 | high |
| M-54 | MatchAdvantage | src/types/match.ts:151 | high |
| M-55 | MatchAssetScore | src/types/match.ts:130 | high |

## Narrative

### Identity cluster (M-1 … M-19, M-21)

`[M-1] ProfessionalIdentityV3` is the schema root. Its direct children are six grouped concepts:

- `[M-2] ProfessionalIdentityCore` — name, email, phone, location, links, thesis
- `[M-3] ProfessionalSelfModel` — arc entries, philosophy, interview style (the *narrative* layer)
- `[M-4] ProfessionalPreferences` — comp, work model, matching priorities/avoids, constraints
- `[M-5] ProfessionalSkills` — skill groups → skill items (depth, depthSource, positioning)
- `[M-6] ProfessionalRole` — company, title, dates, bullets (the *evidence* layer for roles)
- `[M-7] ProfessionalProject` — projects with descriptions and tags

Plus a top-level array of `[M-21] ProfessionalSearchVector` — these are the user's positioning angles (e.g., "Backend Engineering", "Security Platform"). They cross-reference into `PipelineEntry.vectorId` and into the resume `ResumeVector` projection.

The **evidence-vs-narrative split** is structural: `[M-6] Role` and `[M-7] Project` are facts; `[M-3] SelfModel.arc` is the narrative the user tells about those facts. Memory says the project explicitly guards against collapsing this split via degenerate auto-derivation.

### PipelineEntry cluster (M-20, M-22, M-25–M-28)

`[M-20] PipelineEntry` is the durable record of "this job application." It carries:

- A vector reference (`vectorId` → `[M-21]`) — which positioning angle this app is shaped around
- A `[M-22] JDAnalysis` reference (`jdAnalysisId`) — the analyzed JD lives in its own store, attached by ID
- A `[M-26] PipelineResearchSnapshot` — investigation output (sources, signals, summary)
- An array of `[M-25] PipelineRound`, each with `[M-27] PipelineInterviewer`s carrying optional `[M-28] PrepInterviewerIntel` dossiers
- Cover letter and resume references (FK to drafts)

This is the topology doc's "pipeline-as-canonical" principle in concrete shape.

### Prep deck cluster (M-29 … M-32)

`[M-29] PrepDeck` references PipelineEntry, PipelineRound, and JDAnalysis — three FKs into the pipeline cluster. It owns `[M-30] PrepCard`s (story blocks, metrics, scripts) and an optional `[M-31] PrepCompanyIntel` with a `[M-32] PrepCompanyAiPosture` sub-record. Prep is downstream of pipeline; nothing in identity references prep.

### Derived artifact cluster (M-33 … M-43)

`[M-33] ResumeData` is the editable resume projection — `[M-34] ResumeVector`s, `[M-35] RoleComponent`s with `[M-37] RoleBulletComponent`s, `[M-36] SkillGroupComponent`s. It mirrors identity but allows per-vector overrides. `[M-38] CoverLetter` extends `[M-39] CoverLetterContent` and links to both a `pipelineEntryId` (job context) and a `sourceResumeId` (the resume the letter was generated for). `[M-42] LinkedInProfileDraft` and `[M-43] RecruiterCard` are simpler shape projections.

These are *derived* — their rows can be regenerated from identity + a vector + a JD context. The persistence layer stamps `[M-46] ArtifactMetadata` (with `identityVersion` and `identityFingerprint`) on each artifact so staleness can be detected when identity changes (`[M-47] ArtifactStalenessReview` records the user's review decision).

### Persistence boundary (M-44, M-45)

`[M-45] WorkspaceOwnership` (workspaceId, tenantId, userId) and `[M-44] DurableMetadata` (extends ownership with schemaVersion, revision, timestamps) are stamped onto every persisted entity. They're how the workspace import/merge flow detects who owns what and what's been mutated.

### Audience-tagging cross-cut (M-40)

`[M-40] AudienceTagged` is a marker interface with a single field `audiences: AudienceAssignment`. Five match-related entities (`MatchRequirement`, `SkillMatch`, `MatchAdvantage`, `MatchAssetScore`, plus several others) extend it. This is how audience-aware filtering threads through the match/JD-analysis pipeline without a separate field on every entity.

## Verification log

### Discarded findings

None — every type definition citation resolved at the claimed line.

### Synthesized cap

- Synthesized share: 0/55 = 0%. Data model citations are exceptionally clean because type definitions live at predictable line offsets (`export interface X {` is a structural target).

### Unverified citations

- M-42 (LinkedInProfileDraft at linkedin.ts:1) — file is small and the type is plausibly at line 1, but not deep-read.
- M-46 / M-47 (ArtifactMetadata, ArtifactStalenessReview) — line offsets at 15 / 25 are plausible for a small file but not deep-read. Confidence retained from grep header listing.

## Open questions

- The relationship between `ResumeData` and `ProfessionalIdentityV3` is "derives" — how is that derivation cached? Is there a hash relating ResumeData to the identityVersion that produced it? (Surfaces in artifactMeta.ts:15+ but not modeled here.)
- `MatchReport` (match.ts:175) is referenced by JDAnalysis fields but didn't make the diagram. Worth promoting if the report-vs-coverage distinction matters downstream.
- `AudienceTagged` is structural but doesn't render naturally in erDiagram. Could become a UML/classDiagram secondary if marker-interface pattern is worth visualizing.
