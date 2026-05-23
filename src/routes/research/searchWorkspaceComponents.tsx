import type { SearchAssumption } from '../../types/search'

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
