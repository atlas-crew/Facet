## Design Decision

Use `ComponentPriority = 'include' | 'exclude'` rather than presence-based (`Record<VectorId, true>`). This preserves the existing `PriorityByVector = Record<VectorId, ComponentPriority>` shape and minimizes structural changes. The `'exclude'` value is kept as a representable state even though absence from the map also means excluded.

`IncludedPriority` becomes `'include'` or is removed entirely -- assembled types can drop the `priority` field since all assembled components are included by definition.

---

## Phase 1: Core Type System (`src/types.ts`)

- `ComponentPriority = 'include' | 'exclude'`
- Remove `IncludedPriority`, `PRIORITY_ORDER`, `Priority` alias
- Remove `priority` field from: `AssembledTextComponent`, `AssembledRoleBullet`, `AssembledProject`, `AssembledEducation`, `AssembledCertification`
- `AssemblyResult`: remove `mustOnlyEstimatedPages`, `mustOnlyEstimatedPageUsage`
- `EngineWarningCode`: remove `'must_over_budget'`
- Update `SkillGroupVectorConfig.priority`, `PresetOverrides.priorityOverrides[].priority`, `ComponentSuggestion.recommendedPriority`, `JdBulletAdjustment.recommended_priority`

## Phase 2: Assembler (`src/engine/assembler.ts`)

**Remove:** `PRIORITY_RANK`, `priorityRankForSorting()`, `toIncludedPriority()`, `normalizeIncludedPriority()`

**Simplify:**
- `resolvePriorityForVector()`: For `'all'`, return `'include'` if ANY value is `'include'`. For specific vector, return `priorities[vectorId] ?? null`.
- `shouldIncludeComponent()`: `override === false` -> excluded; `override === true` -> included; else `rawPriority === 'include'`
- `pickHighestPriorityText()`: Pick first candidate by sourceIndex (no priority sorting)
- Bullet assembly: **remove priority-based sorting entirely**. Source order + manual drag order is the final order.
- Remove `priority` from all assembled output objects

## Phase 3: Page Budget (`src/engine/pageBudget.ts`)

**Remove:** `buildMustOnlySnapshot()`, `removeOldestBulletByPriority()`

**Add `removeLastBullet(resume)`:** Walk roles backward, pop last bullet of last role with bullets. Remove empty roles.

**Simplify `applyPageBudget()`:**
- Remove must-only estimation and `'must_over_budget'` warning
- Trim loop: `while (over budget) { removeLastBullet() }`
- `PageBudgetResult`: remove `mustOnlyEstimatedPages`, `mustOnlyEstimatedPageUsage`

## Phase 4: Serializer (`src/engine/serializer.ts`)

- `PRIORITIES` set: `new Set(['include', 'exclude'])`
- Update `assertPriorityMap()` and `assertSkillVectorConfigMap()` error messages
- **Add legacy normalization** in `collectWarningsAndNormalizeVectors()`: map `must`/`strong`/`optional` -> `'include'` in all priority maps for imported data

## Phase 5: Store Migration (`src/store/resumeStore.ts`)

**Add v5 -> v6 migration:** Convert all `must`/`strong`/`optional` to `'include'` and drop `'exclude'` entries across: target_lines, profiles, projects, education, certifications vectors; role bullet vectors; skill group vector configs; preset priorityOverrides. Bump store version to `6`.

## Phase 6: Default Data & Utilities

- `src/store/defaultData.ts`: All `'must'`/`'strong'`/`'optional'` -> `'include'`
- `src/utils/vectorPriority.ts`: `defaultVectorsForSelection()` returns `'include'` values
- `src/utils/skillGroupVectors.ts`: `DEFAULT_SKILL_PRIORITY` -> `'include'`

## Phase 7: JD Analyzer & Suggestions

- `src/utils/jdAnalyzer.ts`: Update prompt and parsing for `'include'`/`'exclude'`
- `src/hooks/useSuggestionActions.ts`: Change hardcoded `'must'` -> `'include'`

## Phase 8: UI Components

**6 files with `cyclePriority`:** `BulletList.tsx`, `ComponentCard.tsx`, `ProjectList.tsx`, `EducationList.tsx`, `CertificationList.tsx`, `SkillGroupList.tsx`

- Replace `cyclePriority()` with `togglePriority()`: returns opposite state
- **Remove priority-quick-toggle button** entirely (Eye/EyeOff + matrix dots suffice)
- Matrix dots: binary toggle instead of 4-state cycle
- `VectorPriorityEditor.tsx`: Replace 4-option dropdown with checkbox toggle per vector

## Phase 9: BuildPage & StatusBar

- `src/routes/build/BuildPage.tsx`: Remove `mustOnlyOverPageLimit`, `mustOverBudget` prop, simplify warning filter
- `src/components/StatusBar.tsx`: Remove `mustOverBudget` prop and warning display

## Phase 10: CSS (`src/index.css`)

**Remove:** `--priority-must/strong/optional` properties (3 themes), `.priority-must/strong/optional/exclude` classes, `.priority-quick-toggle.*` rules, `.priority-strip.priority-*` (4 variants)

**Add:** `--priority-include/exclude` properties, `.priority-include/exclude` classes, `.priority-strip.priority-include/exclude`

## Phase 11: Tests (17 files)

All test files referencing priority values need updating: `assembler.test.ts`, `pageBudget.test.ts`, `pageBudgetInternals.test.ts`, `serializer.test.ts`, `resumeStore.test.ts`, `ComparisonDiff.test.tsx`, `fixtures/assembledResume.ts`, `jdAnalyzer.test.ts`, `templates.test.ts`, `typstRenderer.test.ts`, `usePdfPreview.test.tsx`, `VectorPriorityEditor.test.tsx`, `SkillGroupList.test.tsx`, `ProjectList.test.tsx`, `importMerge.test.ts`, `skillGroupVectors.test.ts`, `letterAssembler.test.ts`

## Phase 12: Cover Letter Module

Check `src/types/coverLetter.ts` and `src/engine/letterAssembler.ts` for priority references.

---

## Implementation Order

1. Types (Phase 1)
2. Engine core (Phases 2, 3, 4 -- independent after Phase 1)
3. Store migration (Phase 5)
4. Utilities (Phase 6)
5. JD Analyzer (Phase 7)
6. UI components (Phases 8, 9)
7. CSS (Phase 10)
8. Tests (Phase 11 -- alongside each phase)
9. Cover letter (Phase 12)

## Risk Areas

- **localStorage migration**: v6 migration must handle all nested structures (role bullets, skill group vectors, presets)
- **Serializer backward compat**: Imported YAML with legacy values needs auto-normalization
- **JD Analyzer**: AI prompt must be updated to avoid returning old values
- **Presets**: Existing presets contain priorityOverrides with old values

## Complete File List (37 files)

**Source (20):** `src/types.ts`, `src/engine/assembler.ts`, `src/engine/pageBudget.ts`, `src/engine/serializer.ts`, `src/store/resumeStore.ts`, `src/store/defaultData.ts`, `src/utils/vectorPriority.ts`, `src/utils/skillGroupVectors.ts`, `src/utils/jdAnalyzer.ts`, `src/hooks/useSuggestionActions.ts`, `src/components/BulletList.tsx`, `src/components/ComponentCard.tsx`, `src/components/ProjectList.tsx`, `src/components/EducationList.tsx`, `src/components/CertificationList.tsx`, `src/components/SkillGroupList.tsx`, `src/components/VectorPriorityEditor.tsx`, `src/components/StatusBar.tsx`, `src/routes/build/BuildPage.tsx`, `src/index.css`

**Tests (17):** `src/test/assembler.test.ts`, `src/test/pageBudget.test.ts`, `src/test/pageBudgetInternals.test.ts`, `src/test/serializer.test.ts`, `src/test/resumeStore.test.ts`, `src/test/ComparisonDiff.test.tsx`, `src/test/fixtures/assembledResume.ts`, `src/test/jdAnalyzer.test.ts`, `src/test/templates.test.ts`, `src/test/typstRenderer.test.ts`, `src/test/usePdfPreview.test.tsx`, `src/test/VectorPriorityEditor.test.tsx`, `src/test/SkillGroupList.test.tsx`, `src/test/ProjectList.test.tsx`, `src/test/importMerge.test.ts`, `src/test/skillGroupVectors.test.ts`, `src/test/letterAssembler.test.ts`
