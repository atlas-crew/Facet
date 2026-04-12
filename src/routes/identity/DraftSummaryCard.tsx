import type {
  IdentityChangeLogEntry,
  IdentityExtractionDraft,
} from "../../types/identity";

interface DraftSummaryCardProps {
  draft: IdentityExtractionDraft | null;
  changelog: IdentityChangeLogEntry[];
}

export function DraftSummaryCard({ draft, changelog }: DraftSummaryCardProps) {
  const statusLabel = changelog.length
    ? `${changelog.length} builder event(s) recorded`
    : draft?.summary
      ? "Draft summary available"
      : "No builder events yet";

  return (
    <section className="identity-card identity-card-secondary">
      <div className="identity-card-header">
        <div>
          <h2>What Changed</h2>
          <p>
            Track what the draft generator produced and what the builder
            actually recorded while you refine the identity model.
          </p>
          <p className="identity-section-status">{statusLabel}</p>
        </div>
      </div>

      <div className="identity-summary-block">
        <h3>Draft Summary</h3>
        <p>{draft?.summary ?? "No draft summary yet."}</p>
        {draft?.followUpQuestions.length ? (
          <ul className="identity-question-list">
            {draft.followUpQuestions.map((question, index) => (
              <li key={index + ":" + question}>{question}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="identity-summary-block">
        <h3>Changelog</h3>
        {changelog.length ? (
          <div className="identity-changelog">
            {changelog.map((entry) => (
              <article className="identity-log-entry" key={entry.id}>
                <div className="identity-log-header">
                  <strong>{entry.summary}</strong>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                {entry.details.map((detail, index) => (
                  <p key={index + ":" + detail}>{detail}</p>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p className="identity-muted">No builder events yet.</p>
        )}
      </div>
    </section>
  );
}
