import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Download, Sparkles } from "lucide-react";
import { AiActivityIndicator } from "../../components/AiActivityIndicator";
import type {
  ProfessionalIdentityV3,
  ProfessionalMatchingAvoid,
  ProfessionalMatchingPriority,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
} from "../../identity/schema";
import { useIdentityStore } from "../../store/identityStore";
import { createId } from "../../utils/idUtils";
import {
  generateAwarenessFromIdentity,
  generateSearchVectorsFromIdentity,
} from "../../utils/identityParametersGeneration";
import { deriveStrategyAutofill } from "../../utils/strategyEditorAutofill";

type StrategyTab = "preferences" | "vectors" | "awareness" | "parameters";

const STRATEGY_TABS: StrategyTab[] = [
  "preferences",
  "vectors",
  "awareness",
  "parameters",
];

const splitList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const joinList = (value: string[] | undefined) => (value ?? []).join(", ");

const normalizeAccuracyValue = (value: string): string | string[] => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.includes(",")) {
    return splitList(normalized);
  }

  return normalized;
};

const formatAccuracyValue = (value: string | string[]) =>
  Array.isArray(value) ? value.join(", ") : value;

const downloadText = (
  filename: string,
  content: string,
  mimeType = "text/plain",
) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const renderSearchBriefHtml = (identity: ProfessionalIdentityV3) => {
  const escape = (value: string | undefined | null) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const renderList = (items: string[]) =>
    items.length > 0
      ? `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`
      : "<p>None yet.</p>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Facet Search Brief</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; line-height: 1.6; color: #111827; }
      h1, h2, h3 { margin-bottom: 8px; }
      section { margin-bottom: 24px; }
      .muted { color: #4b5563; }
      ul { padding-left: 20px; }
      .pill { display: inline-block; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 999px; margin-left: 8px; font-size: 12px; color: #4b5563; }
    </style>
  </head>
  <body>
    <h1>${escape(identity.identity.display_name ?? identity.identity.name)} Search Brief</h1>
    <p class="muted">${escape(identity.identity.thesis)}</p>

    <section>
      <h2>Hard Constraints</h2>
      <p><strong>Compensation:</strong> ${escape(identity.preferences.compensation.notes ?? "See priorities below.")}</p>
      <p><strong>Work model:</strong> ${escape(identity.preferences.work_model.preference)}</p>
      <p><strong>Title flexibility:</strong> ${escape(joinList(identity.preferences.constraints?.title_flexibility) || "None set")}</p>
      <p><strong>Clearance:</strong> ${escape(identity.preferences.constraints?.clearance?.status ?? "Not specified")}</p>
      <p><strong>Education:</strong> ${escape(identity.preferences.constraints?.education?.highest ?? "Not specified")}</p>
    </section>

    <section>
      <h2>Matching Filters</h2>
      <h3>Prioritize</h3>
      ${renderList(identity.preferences.matching.prioritize.map((item) => `${item.label}: ${item.description}`))}
      <h3>Avoid</h3>
      ${renderList(identity.preferences.matching.avoid.map((item) => `${item.label}: ${item.description}`))}
    </section>

    <section>
      <h2>Interview Process Criteria</h2>
      <p><strong>Accepted formats:</strong> ${escape(joinList(identity.preferences.interview_process?.accepted_formats) || "Not specified")}</p>
      <p><strong>Strong-fit signals:</strong> ${escape(joinList(identity.preferences.interview_process?.strong_fit_signals) || "Not specified")}</p>
      <p><strong>Red flags:</strong> ${escape(joinList(identity.preferences.interview_process?.red_flags) || "Not specified")}</p>
      <p><strong>Max rounds:</strong> ${escape(String(identity.preferences.interview_process?.max_rounds ?? "Not specified"))}</p>
      <p><strong>On-site:</strong> ${escape(identity.preferences.interview_process?.onsite_preferences ?? "Not specified")}</p>
    </section>

    <section>
      <h2>Skill Inventory</h2>
      ${renderList(identity.skills.groups.flatMap((group) => group.items.map((item) => `${group.label}: ${item.name} (${item.depth ?? "working"})`)))}
    </section>

    <section>
      <h2>Targeting Angles</h2>
      ${renderList((identity.search_vectors ?? []).map((vector) => `${vector.title}: ${vector.thesis}${vector.needs_review ? " [needs review]" : ""}`))}
    </section>

    <section>
      <h2>Work History</h2>
      ${renderList(identity.roles.map((role) => `${role.title} @ ${role.company} (${role.dates})`))}
    </section>

    <section>
      <h2>Open Questions</h2>
      ${renderList((identity.awareness?.open_questions ?? []).map((question) => `${question.topic}: ${question.action}${question.needs_review ? " [needs review]" : ""}`))}
    </section>

    <section>
      <h2>Correction Rules</h2>
      ${renderList(
        Object.entries(identity.generator_rules.accuracy ?? {}).map(
          ([key, value]) =>
            `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
        ),
      )}
    </section>
  </body>
</html>`;
};

const DelimitedInput = ({
  value,
  onCommit,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string[] | undefined;
  onCommit: (nextValue: string[]) => void;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
}) => {
  const [draft, setDraft] = useState(joinList(value));

  useEffect(() => {
    setDraft(joinList(value));
  }, [value]);

  return (
    <input
      className={className}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(splitList(draft))}
    />
  );
};

const DelimitedTextarea = ({
  value,
  onCommit,
  className,
  rows,
  placeholder,
  ariaLabel,
}: {
  value: string[] | undefined;
  onCommit: (nextValue: string[]) => void;
  className: string;
  rows: number;
  placeholder?: string;
  ariaLabel?: string;
}) => {
  const [draft, setDraft] = useState(joinList(value));

  useEffect(() => {
    setDraft(joinList(value));
  }, [value]);

  return (
    <textarea
      className={className}
      rows={rows}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(splitList(draft))}
    />
  );
};

const StrategyExamples = ({
  summary,
  items,
}: {
  summary: string;
  items: string[];
}) => (
  <details className="identity-field-examples">
    <summary>{summary}</summary>
    <ul className="identity-example-list">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  </details>
);

const AccuracyRuleRow = ({
  ruleKey,
  value,
  onCommit,
  onRemove,
}: {
  ruleKey: string;
  value: string | string[];
  onCommit: (currentKey: string, nextKey: string, nextValue: string) => void;
  onRemove: (currentKey: string) => void;
}) => {
  const [keyDraft, setKeyDraft] = useState(() => ruleKey);
  const [valueDraft, setValueDraft] = useState(() =>
    formatAccuracyValue(value),
  );

  const commit = () => onCommit(ruleKey, keyDraft, valueDraft);

  return (
    <div className="identity-inline-grid">
      <input
        className="identity-input"
        aria-label="Accuracy rule key"
        value={keyDraft}
        onChange={(event) => setKeyDraft(event.target.value)}
        onBlur={commit}
      />
      <input
        className="identity-input"
        aria-label="Accuracy rule value"
        value={valueDraft}
        onChange={(event) => setValueDraft(event.target.value)}
        onBlur={commit}
      />
      <button
        className="identity-btn"
        type="button"
        aria-label={`Remove accuracy rule: ${ruleKey}`}
        onClick={() => onRemove(ruleKey)}
      >
        Remove
      </button>
    </div>
  );
};

interface IdentityStrategyWorkbenchProps {
  aiEndpoint: string;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

export function IdentityStrategyWorkbench({
  aiEndpoint,
  onError,
  onNotice,
}: IdentityStrategyWorkbenchProps) {
  const currentIdentity = useIdentityStore((state) => state.currentIdentity);
  const updateCurrentCompensation = useIdentityStore(
    (state) => state.updateCurrentCompensation,
  );
  const updateCurrentWorkModel = useIdentityStore(
    (state) => state.updateCurrentWorkModel,
  );
  const updateCurrentConstraints = useIdentityStore(
    (state) => state.updateCurrentConstraints,
  );
  const updateCurrentMatching = useIdentityStore(
    (state) => state.updateCurrentMatching,
  );
  const updateCurrentInterviewProcess = useIdentityStore(
    (state) => state.updateCurrentInterviewProcess,
  );
  const updateCurrentSearchVectors = useIdentityStore(
    (state) => state.updateCurrentSearchVectors,
  );
  const updateCurrentAwarenessQuestions = useIdentityStore(
    (state) => state.updateCurrentAwarenessQuestions,
  );
  const updateCurrentAccuracyRules = useIdentityStore(
    (state) => state.updateCurrentAccuracyRules,
  );
  const [activeTab, setActiveTab] = useState<StrategyTab>("preferences");
  const [isGeneratingVectors, setIsGeneratingVectors] = useState(false);
  const [isGeneratingAwareness, setIsGeneratingAwareness] = useState(false);
  const autofilledIdentityKeysRef = useRef(new Set<string>());
  const tabRefs = useRef<Record<StrategyTab, HTMLButtonElement | null>>({
    preferences: null,
    vectors: null,
    awareness: null,
    parameters: null,
  });

  const needsReviewCounts = useMemo(() => {
    if (!currentIdentity) {
      return { vectors: 0, awareness: 0, total: 0 };
    }

    const vectors = (currentIdentity.search_vectors ?? []).filter(
      (vector) => vector.needs_review,
    ).length;
    const awareness = (currentIdentity.awareness?.open_questions ?? []).filter(
      (item) => item.needs_review,
    ).length;
    return {
      vectors,
      awareness,
      total: vectors + awareness,
    };
  }, [currentIdentity]);

  const strategyIdentityKey = useMemo(() => {
    if (!currentIdentity) {
      return null;
    }

    return [
      currentIdentity.identity.email,
      currentIdentity.identity.name,
      currentIdentity.roles.map((role) => role.id).join("|"),
      currentIdentity.skills.groups
        .map((group) => `${group.id}:${group.items.length}`)
        .join("|"),
    ].join("::");
  }, [currentIdentity]);

  const applyAutofill = useCallback(
    (identity: ProfessionalIdentityV3, announce: boolean) => {
      const suggestions = deriveStrategyAutofill(identity);
      if (suggestions.changedFields.length === 0) {
        if (announce) {
          onNotice("No empty strategy fields needed suggestions.");
        }
        return false;
      }

      onError(null);
      if (suggestions.compensation) {
        updateCurrentCompensation(suggestions.compensation);
      }
      if (suggestions.workModel) {
        updateCurrentWorkModel(suggestions.workModel);
      }
      if (suggestions.constraints) {
        updateCurrentConstraints(suggestions.constraints);
      }
      if (suggestions.matching) {
        updateCurrentMatching(suggestions.matching);
      }
      if (suggestions.interviewProcess) {
        updateCurrentInterviewProcess(suggestions.interviewProcess);
      }

      if (announce) {
        const count = suggestions.changedFields.length;
        onNotice(
          `Filled ${count} empty strategy field${count === 1 ? "" : "s"} from the current identity. Review and edit anything that does not fit.`,
        );
      }

      return true;
    },
    [
      onError,
      onNotice,
      updateCurrentCompensation,
      updateCurrentConstraints,
      updateCurrentInterviewProcess,
      updateCurrentMatching,
      updateCurrentWorkModel,
    ],
  );

  useEffect(() => {
    if (!currentIdentity || !strategyIdentityKey) {
      return;
    }
    if (autofilledIdentityKeysRef.current.has(strategyIdentityKey)) {
      return;
    }

    applyAutofill(currentIdentity, false);
    autofilledIdentityKeysRef.current.add(strategyIdentityKey);
  }, [applyAutofill, currentIdentity, strategyIdentityKey]);

  if (!currentIdentity) {
    return null;
  }

  const constraints = currentIdentity.preferences.constraints ?? {};
  const compensation = currentIdentity.preferences.compensation;
  const workModel = currentIdentity.preferences.work_model;
  const interviewProcess = currentIdentity.preferences.interview_process ?? {
    accepted_formats: [],
    strong_fit_signals: [],
    red_flags: [],
  };
  const searchVectors = currentIdentity.search_vectors ?? [];
  const awarenessQuestions = currentIdentity.awareness?.open_questions ?? [];
  const accuracyEntries = Object.entries(
    currentIdentity.generator_rules.accuracy ?? {},
  );

  const patchVector = (
    vectorId: string,
    patch: Partial<ProfessionalSearchVector>,
  ) => {
    updateCurrentSearchVectors(
      searchVectors.map((vector) =>
        vector.id === vectorId
          ? {
              ...vector,
              ...patch,
              needs_review:
                patch.needs_review !== undefined
                  ? patch.needs_review
                  : vector.needs_review,
            }
          : vector,
      ),
    );
  };

  const patchAwareness = (
    questionId: string,
    patch: Partial<ProfessionalOpenQuestion>,
  ) => {
    updateCurrentAwarenessQuestions(
      awarenessQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              ...patch,
              needs_review:
                patch.needs_review !== undefined
                  ? patch.needs_review
                  : question.needs_review,
            }
          : question,
      ),
    );
  };

  const commitAccuracyRule = (
    currentKey: string,
    nextKey: string,
    nextValue: string,
  ) => {
    const next = Object.fromEntries(accuracyEntries);
    const normalizedKey = nextKey.trim() || currentKey;
    if (normalizedKey !== currentKey && normalizedKey in next) {
      onError(`Accuracy rule "${normalizedKey}" already exists.`);
      return;
    }
    onError(null);
    delete next[currentKey];
    next[normalizedKey] = normalizeAccuracyValue(nextValue);
    updateCurrentAccuracyRules(next);
  };

  const removeAccuracyRule = (currentKey: string) => {
    onError(null);
    const next = Object.fromEntries(accuracyEntries);
    delete next[currentKey];
    updateCurrentAccuracyRules(Object.keys(next).length ? next : undefined);
  };

  const moveTab = (direction: number) => {
    const currentIndex = STRATEGY_TABS.indexOf(activeTab);
    const nextIndex =
      (currentIndex + direction + STRATEGY_TABS.length) % STRATEGY_TABS.length;
    const nextTab = STRATEGY_TABS[nextIndex] ?? activeTab;
    setActiveTab(nextTab);
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTab(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTab(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      const nextTab = STRATEGY_TABS[0] ?? activeTab;
      setActiveTab(nextTab);
      requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
    } else if (event.key === "End") {
      event.preventDefault();
      const nextTab = STRATEGY_TABS[STRATEGY_TABS.length - 1] ?? activeTab;
      setActiveTab(nextTab);
      requestAnimationFrame(() => tabRefs.current[nextTab]?.focus());
    }
  };

  const ensureEndpoint = () => {
    if (!aiEndpoint) {
      throw new Error(
        "Identity generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.",
      );
    }
  };

  const handleGenerateVectors = async () => {
    try {
      ensureEndpoint();
      onError(null);
      onNotice(null);
      setIsGeneratingVectors(true);
      const generated = await generateSearchVectorsFromIdentity(
        currentIdentity,
        aiEndpoint,
      );
      const freshVectors =
        useIdentityStore.getState().currentIdentity?.search_vectors ?? [];
      const accepted = freshVectors.filter((vector) => !vector.needs_review);
      updateCurrentSearchVectors([...accepted, ...generated]);
      setActiveTab("vectors");
      onNotice(
        `Suggested ${generated.length} search angle(s) from the current identity model.`,
      );
    } catch (error) {
      onNotice(null);
      onError(
        error instanceof Error
          ? error.message
          : "Search angle generation failed.",
      );
    } finally {
      setIsGeneratingVectors(false);
    }
  };

  const handleGenerateAwareness = async () => {
    try {
      ensureEndpoint();
      onError(null);
      onNotice(null);
      setIsGeneratingAwareness(true);
      const generated = await generateAwarenessFromIdentity(
        currentIdentity,
        aiEndpoint,
      );
      const freshQuestions =
        useIdentityStore.getState().currentIdentity?.awareness
          ?.open_questions ?? [];
      const accepted = freshQuestions.filter(
        (question) => !question.needs_review,
      );
      updateCurrentAwarenessQuestions([...accepted, ...generated]);
      setActiveTab("awareness");
      onNotice(
        `Found ${generated.length} open question(s) from the current identity model.`,
      );
    } catch (error) {
      onNotice(null);
      onError(
        error instanceof Error
          ? error.message
          : "Open question generation failed.",
      );
    } finally {
      setIsGeneratingAwareness(false);
    }
  };

  const handleExportParameters = () => {
    downloadText(
      "search-brief.html",
      renderSearchBriefHtml(currentIdentity),
      "text/html",
    );
    onError(null);
    onNotice("Exported the current search brief as HTML.");
  };

  return (
    <section className="identity-card identity-strategy-workbench">
      <div className="identity-card-header">
        <div>
          <h2>Strategy</h2>
          <p>
            Shape search preferences, targeting angles, and open questions
            directly from the current identity model. Empty fields are
            prefilled when Facet can infer a sensible starting point.
          </p>
        </div>
        <div className="identity-chip-row">
          <span className="identity-pill">
            Needs review: {needsReviewCounts.total}
          </span>
          <button
            className="identity-btn"
            type="button"
            onClick={() => applyAutofill(currentIdentity, true)}
          >
            Fill Empty Fields
          </button>
          <button
            className="identity-btn ai-working-button"
            type="button"
            onClick={handleGenerateVectors}
            disabled={isGeneratingVectors}
            aria-busy={isGeneratingVectors}
          >
            <Sparkles size={16} />
            {isGeneratingVectors
              ? "Suggesting Search Angles…"
              : "Suggest Search Angles"}
          </button>
          <AiActivityIndicator
            active={isGeneratingVectors}
            label="AI is drafting search angles from the identity model."
          />
          <button
            className="identity-btn ai-working-button"
            type="button"
            onClick={handleGenerateAwareness}
            disabled={isGeneratingAwareness}
            aria-busy={isGeneratingAwareness}
          >
            <Sparkles size={16} />
            {isGeneratingAwareness
              ? "Finding Open Questions…"
              : "Find Open Questions"}
          </button>
          <AiActivityIndicator
            active={isGeneratingAwareness}
            label="AI is surfacing open questions from the identity model."
          />
          <button
            className="identity-btn identity-btn-primary"
            type="button"
            onClick={handleExportParameters}
          >
            <Download size={16} />
            Export Search Brief
          </button>
        </div>
      </div>

      <div
        className="identity-tabs"
        role="tablist"
        aria-label="Identity strategy sections"
      >
        {STRATEGY_TABS.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element;
            }}
            id={`identity-strategy-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`identity-strategy-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`identity-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
          >
            {tab === "vectors"
              ? `Targeting Angles (${needsReviewCounts.vectors})`
              : tab === "awareness"
                ? `Open Questions (${needsReviewCounts.awareness})`
                : tab === "parameters"
                  ? "Search Brief"
                  : "Search Preferences"}
          </button>
        ))}
      </div>

      <div
        id={`identity-strategy-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`identity-strategy-tab-${activeTab}`}
      >
        {activeTab === "preferences" ? (
          <div className="identity-strategy-grid">
            <section
              className="identity-strategy-section"
              style={{ gridColumn: "1 / -1" }}
            >
              <h3>Start with suggestions, then tighten them</h3>
              <p>
                This editor is meant to be opinionated. Facet fills empty
                fields from the current identity when it can, then you refine
                the parts that matter most before anything flows downstream.
              </p>
              <StrategyExamples
                summary="What strong strategy inputs usually include"
                items={[
                  "A concrete work-model stance, not just 'open to anything'.",
                  "A few prioritize filters that describe the kind of role you want more of.",
                  "A few avoid filters that describe the tradeoffs or loops you do not want to repeat.",
                  "Interview criteria that tell recruiters how to evaluate fit before the loop gets expensive.",
                ]}
              />
            </section>
            <section className="identity-strategy-section">
              <h3>Constraints</h3>
              <p className="identity-field-help">
                Use this section for search boundaries and negotiation anchors.
                These fields should tell recruiters where to focus, not describe
                every nice-to-have.
              </p>
              <div className="identity-form-grid">
                <label className="identity-field">
                  <span className="identity-label">Compensation floor</span>
                  <input
                    className="identity-input"
                    type="number"
                    min="0"
                    value={compensation.base_floor ?? ""}
                    placeholder="Example: 210000"
                    onChange={(event) =>
                      updateCurrentCompensation({
                        ...compensation,
                        base_floor: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Compensation target</span>
                  <input
                    className="identity-input"
                    type="number"
                    min="0"
                    value={compensation.base_target ?? ""}
                    placeholder="Example: 235000"
                    onChange={(event) =>
                      updateCurrentCompensation({
                        ...compensation,
                        base_target: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Compensation notes</span>
                  <input
                    className="identity-input"
                    value={compensation.notes ?? ""}
                    placeholder="Example: Remote-first staff roles in the 200s."
                    onChange={(event) =>
                      updateCurrentCompensation({
                        ...compensation,
                        notes: event.target.value,
                      })
                    }
                  />
                  <span className="identity-field-help">
                    Use this for recruiter-facing framing: what range you are
                    anchoring to, what part of the package matters most, and how
                    flexible you are.
                  </span>
                </label>
                <label className="identity-field">
                  <span className="identity-label">Work model</span>
                  <input
                    className="identity-input"
                    value={workModel.preference}
                    placeholder="Example: remote-first"
                    onChange={(event) =>
                      updateCurrentWorkModel({
                        ...workModel,
                        preference: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Work model flexibility</span>
                  <input
                    className="identity-input"
                    value={workModel.flexibility ?? ""}
                    placeholder="Example: Hybrid is fine for unusually strong scope."
                    onChange={(event) =>
                      updateCurrentWorkModel({
                        ...workModel,
                        flexibility: event.target.value,
                      })
                    }
                  />
                  <span className="identity-field-help">
                    Explain what exceptions you will actually consider so people
                    do not assume your preference is absolute.
                  </span>
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Title flexibility</span>
                  <DelimitedInput
                    className="identity-input"
                    value={constraints.title_flexibility}
                    placeholder="Example: Platform Engineer, Infrastructure Engineer"
                    onCommit={(nextValue) =>
                      updateCurrentConstraints({
                        ...constraints,
                        title_flexibility: nextValue,
                      })
                    }
                  />
                  <span className="identity-field-help">
                    List adjacent titles you would genuinely take so search and
                    recruiter screens do not stay too narrow.
                  </span>
                </label>
                <label className="identity-field">
                  <span className="identity-label">Clearance status</span>
                  <input
                    className="identity-input"
                    value={constraints.clearance?.status ?? ""}
                    placeholder="Example: active secret"
                    onChange={(event) =>
                      updateCurrentConstraints({
                        ...constraints,
                        clearance: {
                          ...constraints.clearance,
                          status: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Education highest</span>
                  <input
                    className="identity-input"
                    value={constraints.education?.highest ?? ""}
                    placeholder="Example: Bachelor's"
                    onChange={(event) =>
                      updateCurrentConstraints({
                        ...constraints,
                        education: {
                          ...constraints.education,
                          highest: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <StrategyExamples
                summary="Examples for constraints and boundaries"
                items={[
                  "Comp notes: 'Target staff-level platform roles in the low-to-mid 200s base range; total scope matters more than title inflation.'",
                  "Work model flexibility: 'Remote-first; hybrid is fine when the team has a clear in-person cadence and the scope is exceptional.'",
                  "Title flexibility: 'Platform Engineer, Infrastructure Engineer, Staff Platform Engineer'.",
                ]}
              />
            </section>

            <section className="identity-strategy-section">
              <h3>Matching Filters</h3>
              <p className="identity-field-help">
                Prioritize filters tell Facet what to lean toward. Avoid filters
                describe the compromises, role shapes, or hiring patterns that
                should trigger caution.
              </p>
              <div className="identity-stack">
                {currentIdentity.preferences.matching.prioritize.map((item) => (
                  <div key={item.id} className="identity-inline-grid">
                    <input
                      className="identity-input"
                      aria-label="Prioritize rule label"
                      placeholder="Example: Platform scope"
                      value={item.label}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          prioritize:
                            currentIdentity.preferences.matching.prioritize.map(
                              (entry) =>
                                entry.id === item.id
                                  ? { ...entry, label: event.target.value }
                                  : entry,
                            ),
                        })
                      }
                    />
                    <input
                      className="identity-input"
                      aria-label="Prioritize rule description"
                      placeholder="Example: Prioritize roles where platform, developer experience, or infrastructure foundations are central."
                      value={item.description}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          prioritize:
                            currentIdentity.preferences.matching.prioritize.map(
                              (entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      description: event.target.value,
                                    }
                                  : entry,
                            ),
                        })
                      }
                    />
                    <select
                      className="identity-input"
                      aria-label="Prioritize rule weight"
                      value={item.weight}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          prioritize:
                            currentIdentity.preferences.matching.prioritize.map(
                              (entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      weight: event.target
                                        .value as ProfessionalMatchingPriority["weight"],
                                    }
                                  : entry,
                            ),
                        })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button
                      className="identity-btn"
                      type="button"
                      aria-label={`Remove prioritize rule: ${item.label || "untitled"}`}
                      onClick={() =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          prioritize:
                            currentIdentity.preferences.matching.prioritize.filter(
                              (entry) => entry.id !== item.id,
                            ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() =>
                    updateCurrentMatching({
                      ...currentIdentity.preferences.matching,
                      prioritize: [
                        ...currentIdentity.preferences.matching.prioritize,
                        {
                          id: createId("match-priority"),
                          label: "",
                          description: "",
                          weight: "medium",
                        },
                      ],
                    })
                  }
                >
                  Add Prioritize Rule
                </button>

                {currentIdentity.preferences.matching.avoid.map((item) => (
                  <div key={item.id} className="identity-inline-grid">
                    <input
                      className="identity-input"
                      aria-label="Avoid rule label"
                      placeholder="Example: Trivia-heavy screens"
                      value={item.label}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          avoid: currentIdentity.preferences.matching.avoid.map(
                            (entry) =>
                              entry.id === item.id
                                ? { ...entry, label: event.target.value }
                                : entry,
                          ),
                        })
                      }
                    />
                    <input
                      className="identity-input"
                      aria-label="Avoid rule description"
                      placeholder="Example: Avoid loops that reward puzzles or trivia over real engineering judgment."
                      value={item.description}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          avoid: currentIdentity.preferences.matching.avoid.map(
                            (entry) =>
                              entry.id === item.id
                                ? { ...entry, description: event.target.value }
                                : entry,
                          ),
                        })
                      }
                    />
                    <select
                      className="identity-input"
                      aria-label="Avoid rule severity"
                      value={item.severity}
                      onChange={(event) =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          avoid: currentIdentity.preferences.matching.avoid.map(
                            (entry) =>
                              entry.id === item.id
                                ? {
                                    ...entry,
                                    severity: event.target
                                      .value as ProfessionalMatchingAvoid["severity"],
                                  }
                                : entry,
                          ),
                        })
                      }
                    >
                      <option value="hard">Hard</option>
                      <option value="soft">Soft</option>
                    </select>
                    <button
                      className="identity-btn"
                      type="button"
                      aria-label={`Remove avoid rule: ${item.label || "untitled"}`}
                      onClick={() =>
                        updateCurrentMatching({
                          ...currentIdentity.preferences.matching,
                          avoid:
                            currentIdentity.preferences.matching.avoid.filter(
                              (entry) => entry.id !== item.id,
                            ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() =>
                    updateCurrentMatching({
                      ...currentIdentity.preferences.matching,
                      avoid: [
                        ...currentIdentity.preferences.matching.avoid,
                        {
                          id: createId("match-avoid"),
                          label: "",
                          description: "",
                          severity: "soft",
                        },
                      ],
                    })
                  }
                >
                  Add Avoid Rule
                </button>
              </div>
              <StrategyExamples
                summary="Examples for prioritize and avoid filters"
                items={[
                  "Prioritize: 'Platform scope' - 'Prioritize roles where internal platforms, delivery systems, or developer experience are central.'",
                  "Prioritize: 'Hands-on delivery' - 'Prioritize roles that still expect direct implementation and measurable execution.'",
                  "Avoid: 'On-site heavy roles' - 'Avoid roles that depend on constant in-office presence without a strong reason.'",
                  "Avoid: 'Trivia-heavy screens' - 'Avoid interview loops that over-index on puzzles or whiteboard recall.'",
                ]}
              />
            </section>

            <section className="identity-strategy-section">
              <h3>Interview Process Criteria</h3>
              <p className="identity-field-help">
                Give recruiters and hiring managers a sharper definition of a
                healthy loop. This section works best when it names the
                evaluation formats you want and the signals that prove a team
                understands your strengths.
              </p>
              <div className="identity-form-grid">
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Accepted formats</span>
                  <DelimitedInput
                    className="identity-input"
                    value={interviewProcess.accepted_formats}
                    placeholder="Example: experience walkthrough, system design discussion, architecture deep dive"
                    onCommit={(nextValue) =>
                      updateCurrentInterviewProcess({
                        ...interviewProcess,
                        accepted_formats: nextValue,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Strong-fit signals</span>
                  <DelimitedInput
                    className="identity-input"
                    value={interviewProcess.strong_fit_signals}
                    placeholder="Example: the team wants architecture tradeoffs, detailed execution stories, and systems thinking"
                    onCommit={(nextValue) =>
                      updateCurrentInterviewProcess({
                        ...interviewProcess,
                        strong_fit_signals: nextValue,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Red flags</span>
                  <DelimitedInput
                    className="identity-input"
                    value={interviewProcess.red_flags}
                    placeholder="Example: trivia-heavy screens, vague role ownership, no room for deep technical discussion"
                    onCommit={(nextValue) =>
                      updateCurrentInterviewProcess({
                        ...interviewProcess,
                        red_flags: nextValue,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Max rounds</span>
                  <input
                    className="identity-input"
                    type="number"
                    min="0"
                    value={interviewProcess.max_rounds ?? ""}
                    placeholder="Example: 5"
                    onChange={(event) =>
                      updateCurrentInterviewProcess({
                        ...interviewProcess,
                        max_rounds: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">On-site preference</span>
                  <input
                    className="identity-input"
                    value={interviewProcess.onsite_preferences ?? ""}
                    placeholder="Example: Keep on-sites late and purposeful."
                    onChange={(event) =>
                      updateCurrentInterviewProcess({
                        ...interviewProcess,
                        onsite_preferences: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <StrategyExamples
                summary="Examples for interview process criteria"
                items={[
                  "Accepted formats: 'experience walkthrough, system design discussion, architecture deep dive'.",
                  "Strong-fit signals: 'The team wants architecture tradeoffs, impact stories, and practical problem solving.'",
                  "Red flags: 'The loop rewards trivia, hides the real collaboration model, or never gets into the actual work.'",
                  "On-site preference: 'Keep on-sites late in the loop and make them clearly worth the trip.'",
                ]}
              />
            </section>

            <section className="identity-strategy-section">
              <h3>Correction-aware Rules</h3>
              <p className="identity-field-help">
                Use accuracy rules to pin facts that should stay stable when
                Facet regenerates angles, summaries, or downstream search
                materials.
              </p>
              <div className="identity-stack">
                {accuracyEntries.map(([key, value]) => (
                  <AccuracyRuleRow
                    key={`${key}:${formatAccuracyValue(value)}`}
                    ruleKey={key}
                    value={value}
                    onCommit={commitAccuracyRule}
                    onRemove={removeAccuracyRule}
                  />
                ))}
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() => {
                    const next = Object.fromEntries(accuracyEntries);
                    next[createId("accuracy")] = "";
                    updateCurrentAccuracyRules(next);
                  }}
                >
                  Add Accuracy Rule
                </button>
              </div>
              <StrategyExamples
                summary="Examples for accuracy rules"
                items={[
                  "preferred-title: Platform Engineer",
                  "avoid-company-name: Do not rewrite A10 Networks as a generic networking company",
                  "location: Tampa, FL and remote-first",
                ]}
              />
            </section>
          </div>
        ) : null}

        {activeTab === "vectors" ? (
          <div className="identity-stack">
            <section className="identity-strategy-section">
              <h3>Build a few useful search angles</h3>
              <p className="identity-field-help">
                A targeting angle is a recruiter-facing narrative about where
                you fit best. Good angles combine a job family, a point of view,
                and evidence from the identity model.
              </p>
              <StrategyExamples
                summary="What strong targeting angles usually include"
                items={[
                  "A crisp title such as 'Platform modernization programs' or 'Developer-experience infrastructure'.",
                  "A thesis that explains why you fit that lane, not just what keywords you have.",
                  "Target roles and keywords that make the angle searchable.",
                  "Evidence that proves the angle is grounded in real work history.",
                ]}
              />
            </section>
            {searchVectors.length === 0 ? (
              <p className="identity-muted">
                No targeting angles yet. Start with Suggest Search Angles, then
                tighten the generated titles, thesis, and evidence.
              </p>
            ) : null}
            {searchVectors.map((vector) => (
              <section key={vector.id} className="identity-strategy-section">
                <div className="identity-card-header">
                  <div>
                    <h3>
                      {vector.title || "Untitled angle"}
                      {vector.needs_review ? (
                        <span className="identity-pill">Needs review</span>
                      ) : null}
                    </h3>
                    <p>{vector.subtitle ?? vector.thesis}</p>
                  </div>
                  <div className="identity-chip-row">
                    {vector.needs_review ? (
                      <button
                        className="identity-btn"
                        type="button"
                        onClick={() =>
                          patchVector(vector.id, { needs_review: false })
                        }
                      >
                        Mark reviewed
                      </button>
                    ) : null}
                    <button
                      className="identity-btn"
                      type="button"
                      aria-label={`Remove targeting angle: ${vector.title || "untitled"}`}
                      onClick={() =>
                        updateCurrentSearchVectors(
                          searchVectors.filter(
                            (entry) => entry.id !== vector.id,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="identity-form-grid">
                  <label className="identity-field">
                    <span className="identity-label">Title</span>
                    <input
                      className="identity-input"
                      value={vector.title}
                      placeholder="Example: Platform modernization programs"
                      onChange={(event) =>
                        patchVector(vector.id, { title: event.target.value })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Priority</span>
                    <select
                      className="identity-input"
                      value={vector.priority}
                      onChange={(event) =>
                        patchVector(vector.id, {
                          priority: event.target
                            .value as ProfessionalSearchVector["priority"],
                        })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Subtitle</span>
                    <input
                      className="identity-input"
                      value={vector.subtitle ?? ""}
                      placeholder="Example: Platform work that unlocks product delivery"
                      onChange={(event) =>
                        patchVector(vector.id, { subtitle: event.target.value })
                      }
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Thesis</span>
                    <textarea
                      className="identity-textarea"
                      rows={3}
                      value={vector.thesis}
                      placeholder="Example: Turn infrastructure tradeoffs into delivery momentum."
                      onChange={(event) =>
                        patchVector(vector.id, { thesis: event.target.value })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Target roles</span>
                    <DelimitedInput
                      className="identity-input"
                      value={vector.target_roles}
                      placeholder="Example: Platform Engineer, Staff Platform Engineer"
                      onCommit={(nextValue) =>
                        patchVector(vector.id, { target_roles: nextValue })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Primary keywords</span>
                    <DelimitedInput
                      className="identity-input"
                      value={vector.keywords.primary}
                      placeholder="Example: platform engineering, kubernetes, developer experience"
                      onCommit={(nextValue) =>
                        patchVector(vector.id, {
                          keywords: { ...vector.keywords, primary: nextValue },
                        })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Secondary keywords</span>
                    <DelimitedInput
                      className="identity-input"
                      value={vector.keywords.secondary}
                      placeholder="Example: reliability, internal tools, release engineering"
                      onCommit={(nextValue) =>
                        patchVector(vector.id, {
                          keywords: {
                            ...vector.keywords,
                            secondary: nextValue,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Supporting skills</span>
                    <DelimitedInput
                      className="identity-input"
                      value={vector.supporting_skills}
                      placeholder="Example: Kubernetes, Terraform, CI/CD"
                      onCommit={(nextValue) =>
                        patchVector(vector.id, { supporting_skills: nextValue })
                      }
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Evidence</span>
                    <DelimitedTextarea
                      className="identity-textarea"
                      rows={3}
                      value={vector.evidence}
                      placeholder="Example: Ported 12 services to Kubernetes and unlocked on-prem delivery for customer environments"
                      onCommit={(nextValue) =>
                        patchVector(vector.id, { evidence: nextValue })
                      }
                    />
                  </label>
                </div>
              </section>
            ))}
            <button
              className="identity-btn"
              type="button"
              onClick={() =>
                updateCurrentSearchVectors([
                  ...searchVectors,
                  {
                    id: createId("svec"),
                    title: "",
                    priority: "medium",
                    thesis: "",
                    target_roles: [],
                    keywords: { primary: [], secondary: [] },
                  },
                ])
              }
            >
              Add Targeting Angle
            </button>
          </div>
        ) : null}

        {activeTab === "awareness" ? (
          <div className="identity-stack">
            <section className="identity-strategy-section">
              <h3>Name the open questions before they become surprises</h3>
              <p className="identity-field-help">
                Open questions are the uncertainties you want to keep visible
                during search and recruiter screens. They should point to a real
                risk, missing signal, or calibration item.
              </p>
              <StrategyExamples
                summary="Examples of useful open questions"
                items={[
                  "Comp calibration: 'Are staff-level ranges actually aligned with the scope they describe?'",
                  "Work-model reality: 'Does remote-first still mean remote-first after the recruiter screen?'",
                  "Interview fit: 'Will the loop make room for architecture tradeoffs and execution stories, or mostly trivia?'",
                  "Role scope: 'Is this actually platform ownership, or just operational support under a platform title?'",
                ]}
              />
            </section>
            {awarenessQuestions.length === 0 ? (
              <p className="identity-muted">
                No open questions yet. Start with Find Open Questions, then
                tighten the topic, action, and evidence so each item is worth
                following up on.
              </p>
            ) : null}
            {awarenessQuestions.map((question) => (
              <section key={question.id} className="identity-strategy-section">
                <div className="identity-card-header">
                  <div>
                    <h3>
                      {question.topic || "Untitled open question"}
                      {question.needs_review ? (
                        <span className="identity-pill">Needs review</span>
                      ) : null}
                    </h3>
                    <p>{question.description}</p>
                  </div>
                  <div className="identity-chip-row">
                    {question.needs_review ? (
                      <button
                        className="identity-btn"
                        type="button"
                        onClick={() =>
                          patchAwareness(question.id, { needs_review: false })
                        }
                      >
                        Mark reviewed
                      </button>
                    ) : null}
                    <button
                      className="identity-btn"
                      type="button"
                      aria-label={`Remove open question: ${question.topic || "untitled"}`}
                      onClick={() =>
                        updateCurrentAwarenessQuestions(
                          awarenessQuestions.filter(
                            (entry) => entry.id !== question.id,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="identity-form-grid">
                  <label className="identity-field">
                    <span className="identity-label">Topic</span>
                    <input
                      className="identity-input"
                      value={question.topic}
                      placeholder="Example: Work-model calibration"
                      onChange={(event) =>
                        patchAwareness(question.id, {
                          topic: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Severity</span>
                    <select
                      className="identity-input"
                      value={question.severity ?? "medium"}
                      onChange={(event) =>
                        patchAwareness(question.id, {
                          severity: event.target.value as NonNullable<
                            ProfessionalOpenQuestion["severity"]
                          >,
                        })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Description</span>
                    <textarea
                      className="identity-textarea"
                      rows={3}
                      value={question.description}
                      placeholder="Example: Remote-first roles still hide heavy in-person expectations."
                      onChange={(event) =>
                        patchAwareness(question.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Action</span>
                    <textarea
                      className="identity-textarea"
                      rows={2}
                      value={question.action}
                      placeholder="Example: Ask the recruiter how often the core team is together in person and what actually requires it."
                      onChange={(event) =>
                        patchAwareness(question.id, {
                          action: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Evidence</span>
                    <DelimitedTextarea
                      className="identity-textarea"
                      rows={3}
                      value={question.evidence}
                      placeholder="Example: Current preference is remote-first and prior loops have drifted toward hybrid late in the process"
                      onCommit={(nextValue) =>
                        patchAwareness(question.id, { evidence: nextValue })
                      }
                    />
                  </label>
                </div>
              </section>
            ))}
            <button
              className="identity-btn"
              type="button"
              onClick={() =>
                updateCurrentAwarenessQuestions([
                  ...awarenessQuestions,
                  {
                    id: createId("oq"),
                    topic: "",
                    description: "",
                    action: "",
                    severity: "medium",
                  },
                ])
              }
            >
              Add Open Question
            </button>
          </div>
        ) : null}

        {activeTab === "parameters" ? (
          <div className="identity-strategy-grid">
            <section
              className="identity-strategy-section"
              style={{ gridColumn: "1 / -1" }}
            >
              <h3>Use this as the outbound brief</h3>
              <p>
                The search brief is the condensed version of the strategy editor.
                Once the preferences, angles, and open questions look right, this
                is the view to export or hand to someone else.
              </p>
            </section>
            <section className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>Hard Constraints</h3>
                  <p>Compensation, work model, and concrete deal-breakers.</p>
                </div>
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() => setActiveTab("preferences")}
                >
                  Edit
                </button>
              </div>
              <ul className="identity-list">
                <li>
                  Compensation priorities:{" "}
                  {currentIdentity.preferences.compensation.priorities.length}
                </li>
                <li>
                  Work model:{" "}
                  {currentIdentity.preferences.work_model.preference}
                </li>
                <li>
                  Title flexibility:{" "}
                  {joinList(constraints.title_flexibility) || "None set"}
                </li>
              </ul>
            </section>

            <section className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>Targeting Angles</h3>
                  <p>Search angles derived from the same identity model.</p>
                </div>
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() => setActiveTab("vectors")}
                >
                  Edit
                </button>
              </div>
              <ul className="identity-list">
                {searchVectors.length === 0 ? (
                  <li>No targeting angles yet.</li>
                ) : null}
                {searchVectors.map((vector) => (
                  <li key={vector.id}>
                    {vector.title}: {vector.thesis}
                    {vector.needs_review ? " [needs review]" : ""}
                  </li>
                ))}
              </ul>
            </section>

            <section className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>Work History & Inventory</h3>
                  <p>
                    Recent roles, projects, and skills that anchor the strategy.
                  </p>
                </div>
              </div>
              <ul className="identity-list">
                {currentIdentity.roles.map((role) => (
                  <li key={role.id}>
                    {role.title} @ {role.company} ({role.dates})
                  </li>
                ))}
              </ul>
            </section>

            <section className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>Open Questions</h3>
                  <p>
                    The prompts and awareness items that still need
                    follow-through.
                  </p>
                </div>
                <button
                  className="identity-btn"
                  type="button"
                  onClick={() => setActiveTab("awareness")}
                >
                  Edit
                </button>
              </div>
              <ul className="identity-list">
                {awarenessQuestions.length === 0 ? (
                  <li>No open questions yet.</li>
                ) : null}
                {awarenessQuestions.map((question) => (
                  <li key={question.id}>
                    {question.topic}: {question.action}
                    {question.needs_review ? " [needs review]" : ""}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
