import { useId } from 'react'
import { Sparkles, X } from 'lucide-react'
import type {
  SearchAssumption,
  SearchCompanySize,
  SearchInstanceOverrides,
  SearchProfile,
  SearchThesis,
  SkillCatalogEntry,
} from '../../types/search'
import { searchProfileFilterLabels } from '../../utils/searchProfileFilters'
import { formatSalaryBand, parseLegacySalaryBand } from '../../utils/searchSalary'
import { joinTags, splitTags } from './researchUtils'

const COMPANY_SIZE_OPTIONS: Array<{ value: SearchCompanySize | ''; label: string }> = [
  { value: '', label: 'No preference' },
  { value: 'startup', label: 'Startup' },
  { value: 'growth', label: 'Growth' },
  { value: 'mid-market', label: 'Mid-market' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'public', label: 'Public' },
  { value: 'any', label: 'Any size' },
]

const formatDepthLabel = (depth: SkillCatalogEntry['depth']): string => {
  if (depth === 'avoid') return 'Avoid'
  return depth.charAt(0).toUpperCase() + depth.slice(1).replace('-', ' ')
}

interface SearchThesisWorkspaceProps {
  activeThesis: SearchThesis | null
  isGeneratingThesis: boolean
  isSearching: boolean
  hasIdentity: boolean
  correctionsDraft: string
  onCorrectionsChange: (value: string) => void
  directiveDraft: string
  onDirectiveChange: (value: string) => void
  onRegenerate: () => void
  onCorrectAssumption?: (assumption: SearchAssumption) => void
}

interface SearchAssumptionsDisclosureProps {
  assumptions?: readonly SearchAssumption[]
  onCorrectAssumption?: (assumption: SearchAssumption) => void
}

export function SearchAssumptionsDisclosure({
  assumptions,
  onCorrectAssumption,
}: SearchAssumptionsDisclosureProps) {
  if (!assumptions || assumptions.length === 0) return null

  return (
    <details className="research-assumptions" open>
      <summary>
        <span>Assumptions ({assumptions.length})</span>
        <small>we made these calls because the input was ambiguous</small>
      </summary>
      <ul className="research-assumption-list">
        {assumptions.map((assumption) => (
          <li key={assumption.id} className="research-assumption-item">
            <div>
              <p>{assumption.claim}</p>
              <span>
                {assumption.confidence} confidence
                {assumption.rationale ? <> - {assumption.rationale}</> : null}
              </span>
            </div>
            {assumption.overridable && onCorrectAssumption ? (
              <button
                type="button"
                className="research-btn research-btn-ghost"
                onClick={() => onCorrectAssumption(assumption)}
              >
                Correct?
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function SearchThesisWorkspace({
  activeThesis,
  isGeneratingThesis,
  isSearching,
  hasIdentity,
  correctionsDraft,
  onCorrectionsChange,
  directiveDraft,
  onDirectiveChange,
  onRegenerate,
  onCorrectAssumption,
}: SearchThesisWorkspaceProps) {
  const busy = isGeneratingThesis || isSearching
  const directiveChanged = (activeThesis?.customDirective ?? '') !== directiveDraft.trim()
  const correctionsHaveContent = correctionsDraft.trim().length > 0
  const buttonLabel = isGeneratingThesis
    ? 'Generating…'
    : !activeThesis
      ? 'Generate Thesis'
      : correctionsHaveContent || directiveChanged
        ? 'Regenerate with changes'
        : 'Regenerate Thesis'

  return (
    <section
      className="research-card research-thesis-workspace"
      aria-label="Search thesis workspace"
    >
      <div className="research-card-header">
        <div>
          <h2>Search Thesis</h2>
          <p>
            The model proposes search angles and a strategic thesis from your identity. Add a
            correction comment or a custom directive, then regenerate.
          </p>
        </div>
        <div className="research-header-actions">
          <button
            type="button"
            className="research-btn research-btn-primary"
            onClick={onRegenerate}
            disabled={!hasIdentity || busy}
            aria-busy={isGeneratingThesis}
          >
            <Sparkles size={16} />
            {buttonLabel}
          </button>
        </div>
      </div>

      {!hasIdentity ? (
        <p className="research-muted">
          Identity model required to generate a search thesis. Set up identity to enable AI thesis
          generation.
        </p>
      ) : !activeThesis ? (
        <div className="research-thesis-empty">
          <p>
            No thesis yet. The first generation produces a starting point — angles the model thinks
            fit your identity, plus inferred per-search constraints below. You'll correct from
            there.
          </p>
          <label className="research-field">
            <span>Custom search direction (optional)</span>
            <input
              className="research-input"
              value={directiveDraft}
              onChange={(event) => onDirectiveChange(event.target.value)}
              placeholder='e.g. "Research adjacent CTO roles at platform-modernization startups"'
            />
            <small className="research-muted">
              Use this when you want a search angle the model could not have inferred.
            </small>
          </label>
        </div>
      ) : (
        <div className="research-thesis-body">
          <SearchAssumptionsDisclosure
            assumptions={activeThesis.assumptions}
            onCorrectAssumption={onCorrectAssumption}
          />

          <div className="research-thesis-angles">
            <h3 className="research-subtitle">Search Angles</h3>
            {activeThesis.searchLanes.length === 0 ? (
              <p className="research-muted">No search angles in the current thesis.</p>
            ) : (
              <ol className="research-thesis-angle-list">
                {activeThesis.searchLanes.map((lane) => (
                  <li key={lane.id} className="research-thesis-angle">
                    <h4>{lane.title}</h4>
                    <p>{lane.rationale}</p>
                    {lane.competitiveContext ? (
                      <p className="research-thesis-angle-context">{lane.competitiveContext}</p>
                    ) : null}
                    {lane.targetSignals.length > 0 ? (
                      <p className="research-thesis-angle-signals">
                        <strong>Signals:</strong> {lane.targetSignals.join(', ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {activeThesis.narrative ? (
            <div className="research-thesis-narrative">
              <h3 className="research-subtitle">Narrative</h3>
              {activeThesis.narrative.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index}>{paragraph.trim()}</p>
              ))}
            </div>
          ) : null}

          <div className="research-thesis-controls">
            <label className="research-field">
              <span>Corrections (applied on regenerate)</span>
              <textarea
                className="research-textarea"
                rows={3}
                value={correctionsDraft}
                onChange={(event) => onCorrectionsChange(event.target.value)}
                placeholder="What should the model adjust on the next regeneration? e.g. 'Drop Kubernetes admin framing — emphasize platform leverage.'"
              />
            </label>

            <label className="research-field">
              <span>Custom search direction</span>
              <input
                className="research-input"
                value={directiveDraft}
                onChange={(event) => onDirectiveChange(event.target.value)}
                placeholder='e.g. "Research adjacent CTO roles at platform-modernization startups"'
              />
              <small className="research-muted">
                Persists across regenerations. Use this for search angles the model would not infer
                on its own.
              </small>
            </label>
          </div>
        </div>
      )}
    </section>
  )
}

interface SearchSkillsTableProps {
  skills: SkillCatalogEntry[]
  hiddenSkillIds: string[]
  hasActiveThesis: boolean
  onToggleHidden: (skillId: string) => void
}

export function SearchSkillsTable({
  skills,
  hiddenSkillIds,
  hasActiveThesis,
  onToggleHidden,
}: SearchSkillsTableProps) {
  const hiddenSet = new Set(hiddenSkillIds)

  return (
    <section className="research-card research-skills-card" aria-label="Skills for this search">
      <div className="research-card-header">
        <div>
          <h2>Skills</h2>
          <p>
            Identity skills the search will weigh.{' '}
            {hasActiveThesis
              ? 'Hide a skill to remove it from this search only — your identity is unchanged.'
              : 'Generate a thesis to enable per-search hide controls.'}
          </p>
        </div>
      </div>

      {skills.length === 0 ? (
        <p className="research-muted">No identity-derived skills yet.</p>
      ) : (
        <table className="research-skills-compact">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Depth</th>
              <th scope="col">Context</th>
              <th scope="col" aria-label="Hide from this search" />
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const hidden = hiddenSet.has(skill.id)
              return (
                <tr
                  key={skill.id}
                  className={hidden ? 'research-skill-hidden' : undefined}
                  aria-disabled={hidden}
                >
                  <td className="research-skill-name">{skill.name || '(unnamed)'}</td>
                  <td className="research-skill-depth">{formatDepthLabel(skill.depth)}</td>
                  <td className="research-skill-context">{skill.context || '—'}</td>
                  <td className="research-skill-action">
                    {hasActiveThesis ? (
                      hidden ? (
                        <button
                          type="button"
                          className="research-btn research-btn-ghost"
                          onClick={() => onToggleHidden(skill.id)}
                          aria-label={`Restore ${skill.name || 'skill'} to this search`}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="research-icon-btn"
                          onClick={() => onToggleHidden(skill.id)}
                          aria-label={`Hide ${skill.name || 'skill'} from this search`}
                          title="Hide from this search"
                        >
                          <X size={14} />
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

interface SearchInstancePreferencesProps {
  identityBase: Pick<SearchProfile, 'constraints' | 'filters' | 'interviewPrefs'>
  activeThesis: SearchThesis | null
  onUpdateOverrides: (patch: Partial<SearchInstanceOverrides>) => void
  onEditThesisSignals: (target: 'lookFor' | 'avoid') => void
  onNavigateToIdentity: () => void
}

export function SearchInstancePreferences({
  identityBase,
  activeThesis,
  onUpdateOverrides,
  onEditThesisSignals,
  onNavigateToIdentity,
}: SearchInstancePreferencesProps) {
  const thesisSignalsLabelId = useId()
  const overrides = activeThesis?.searchOverrides
  const effectiveOverrides = overrides ?? {
    constraints: identityBase.constraints,
    interviewPrefs: identityBase.interviewPrefs,
    hiddenSkillIds: [],
  }
  // SearchInstanceOverrides intentionally carries no filters: migration folds
  // legacy prioritize/avoid filters into canonical thesis signals before render.
  const effectiveFilters = activeThesis
    ? {
        prioritize: activeThesis.lookFor.map((signal) => signal.label),
        avoid: activeThesis.avoid.map((signal) => signal.label),
      }
    : {
        prioritize: searchProfileFilterLabels(identityBase.filters.prioritize),
        avoid: searchProfileFilterLabels(identityBase.filters.avoid),
      }

  const companySizeLabel =
    COMPANY_SIZE_OPTIONS.find((option) => option.value === identityBase.constraints.companySize)
      ?.label ?? 'No preference'

  return (
    <section
      className="research-card research-preferences-card"
      aria-label="Search constraints and preferences"
    >
      <div className="research-card-header">
        <div>
          <h2>Constraints &amp; Preferences</h2>
          <p>
            {activeThesis
              ? 'The model inferred these from your identity for this search. Correct anything that does not fit — your identity model is unchanged.'
              : 'Showing identity defaults. Generate a thesis to enable per-search overrides.'}
          </p>
        </div>
      </div>

      <div className="research-preferences-split">
        <div className="research-preferences-base" aria-label="From identity">
          <div className="research-preferences-base-header">
            <h3 className="research-subtitle">From Identity</h3>
            <button
              type="button"
              className="research-btn research-btn-ghost"
              onClick={onNavigateToIdentity}
            >
              Edit in Identity
            </button>
          </div>
          <dl className="research-preferences-readout">
            <div>
              <dt>Compensation anchor</dt>
              <dd>
                {formatSalaryBand(identityBase.constraints.salary) || (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Preferred locations</dt>
              <dd>
                {identityBase.constraints.locations.length > 0 ? (
                  identityBase.constraints.locations.join(', ')
                ) : (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Clearance</dt>
              <dd>
                {identityBase.constraints.clearance || <span className="research-muted">—</span>}
              </dd>
            </div>
            <div>
              <dt>Preferred company size</dt>
              <dd>{companySizeLabel}</dd>
            </div>
            <div>
              <dt>Prioritize</dt>
              <dd>
                {identityBase.filters.prioritize.length > 0 ? (
                  searchProfileFilterLabels(identityBase.filters.prioritize).join(', ')
                ) : (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Avoid</dt>
              <dd>
                {identityBase.filters.avoid.length > 0 ? (
                  searchProfileFilterLabels(identityBase.filters.avoid).join(', ')
                ) : (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Interview prep advantages</dt>
              <dd>
                {identityBase.interviewPrefs.strongFit.length > 0 ? (
                  identityBase.interviewPrefs.strongFit.join(', ')
                ) : (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Interview process risks</dt>
              <dd>
                {identityBase.interviewPrefs.redFlags.length > 0 ? (
                  identityBase.interviewPrefs.redFlags.join(', ')
                ) : (
                  <span className="research-muted">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="research-preferences-overrides" aria-label="This search">
          <div className="research-preferences-overrides-header">
            <h3 className="research-subtitle">This Search</h3>
            {activeThesis ? <span className="research-pill">Inferred</span> : null}
          </div>
          <fieldset className="research-fieldset" disabled={!activeThesis}>
            <div className="research-form-grid">
              <label className="research-field">
                <span>Compensation anchor</span>
                <input
                  className="research-input"
                  value={formatSalaryBand(effectiveOverrides.constraints.salary)}
                  onChange={(event) =>
                    onUpdateOverrides({
                      constraints: {
                        ...effectiveOverrides.constraints,
                        salary: parseLegacySalaryBand(event.target.value) ?? { min: 0, max: 0 },
                      },
                    })
                  }
                  placeholder="$220k-$300k"
                />
              </label>

              <label className="research-field">
                <span>Preferred locations</span>
                <input
                  className="research-input"
                  value={joinTags(effectiveOverrides.constraints.locations)}
                  onChange={(event) =>
                    onUpdateOverrides({
                      constraints: {
                        ...effectiveOverrides.constraints,
                        locations: splitTags(event.target.value),
                      },
                    })
                  }
                  placeholder="Remote, New York, Bay Area"
                />
              </label>

              <label className="research-field">
                <span>Clearance</span>
                <input
                  className="research-input"
                  value={effectiveOverrides.constraints.clearance}
                  onChange={(event) =>
                    onUpdateOverrides({
                      constraints: {
                        ...effectiveOverrides.constraints,
                        clearance: event.target.value,
                      },
                    })
                  }
                  placeholder="None, Public Trust, TS/SCI"
                />
              </label>

              <label className="research-field">
                <span>Preferred company size</span>
                <select
                  className="research-select"
                  value={effectiveOverrides.constraints.companySize}
                  onChange={(event) =>
                    onUpdateOverrides({
                      constraints: {
                        ...effectiveOverrides.constraints,
                        companySize: event.target.value as SearchCompanySize | '',
                      },
                    })
                  }
                >
                  {COMPANY_SIZE_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div
                className="research-field research-preferences-signal-field"
                role="group"
                aria-labelledby={thesisSignalsLabelId}
              >
                <span id={thesisSignalsLabelId}>Thesis search signals</span>
                <dl className="research-preferences-readout research-preferences-signal-readout">
                  <div>
                    <dt>Look for</dt>
                    <dd>
                      {effectiveFilters.prioritize.length > 0 ? (
                        effectiveFilters.prioritize.join(', ')
                      ) : (
                        <span className="research-muted">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Avoid</dt>
                    <dd>
                      {effectiveFilters.avoid.length > 0 ? (
                        effectiveFilters.avoid.join(', ')
                      ) : (
                        <span className="research-muted">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {activeThesis ? (
                  <div
                    className="research-thesis-actions"
                    role="group"
                    aria-label="Edit thesis signals"
                  >
                    <button
                      type="button"
                      className="research-btn"
                      onClick={() => onEditThesisSignals('lookFor')}
                    >
                      Edit look-for signals
                    </button>
                    <button
                      type="button"
                      className="research-btn"
                      onClick={() => onEditThesisSignals('avoid')}
                    >
                      Edit avoid signals
                    </button>
                  </div>
                ) : (
                  <p className="research-muted">
                    Generate or select a thesis to edit look-for and avoid signals.
                  </p>
                )}
              </div>

              <label className="research-field">
                <span>Interview prep advantages</span>
                <input
                  className="research-input"
                  value={joinTags(effectiveOverrides.interviewPrefs.strongFit)}
                  onChange={(event) =>
                    onUpdateOverrides({
                      interviewPrefs: {
                        ...effectiveOverrides.interviewPrefs,
                        strongFit: splitTags(event.target.value),
                      },
                    })
                  }
                  placeholder="Distributed systems, internal platforms"
                />
              </label>

              <label className="research-field">
                <span>Interview process risks</span>
                <input
                  className="research-input"
                  value={joinTags(effectiveOverrides.interviewPrefs.redFlags)}
                  onChange={(event) =>
                    onUpdateOverrides({
                      interviewPrefs: {
                        ...effectiveOverrides.interviewPrefs,
                        redFlags: splitTags(event.target.value),
                      },
                    })
                  }
                  placeholder="Noisy on-call, unclear scope"
                />
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
