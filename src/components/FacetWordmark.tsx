export function FacetMark({ size = 20 }: { size?: number }) {
  const height = size * 1.25
  return (
    <svg
      className="facet-mark"
      viewBox="0 0 34 42"
      width={size}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="facet-mark-upper">
          <path d="M0 0 H34 V42 L0 21 Z" />
        </clipPath>
        <clipPath id="facet-mark-lower">
          <path d="M0 21 L34 42 V42 H0 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#facet-mark-upper)">
        <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#6cb8e8" />
      </g>
      <g clipPath="url(#facet-mark-lower)">
        <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#2d6a96" />
      </g>
      <line x1="0" y1="21" x2="34" y2="42" stroke="#7ac4f0" strokeWidth="0.5" opacity="0.4" />
    </svg>
  )
}

export function FacetWordmark() {
  return (
    <div className="facet-lockup" role="img" aria-label="Facet">
      <FacetMark />
      <span className="facet-wordmark" aria-hidden="true">
        acet
      </span>
    </div>
  )
}
