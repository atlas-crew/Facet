/**
 * FacetFMark — The original split-tone F letterform.
 * Used in the wordmark lockup where it doubles as the letter F in "Facet".
 */
export function FacetFMark({ size = 20 }: { size?: number }) {
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
        <clipPath id="facet-f-upper">
          <path d="M0 0 H34 V42 L0 21 Z" />
        </clipPath>
        <clipPath id="facet-f-lower">
          <path d="M0 21 L34 42 V42 H0 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#facet-f-upper)">
        <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#6cb8e8" />
      </g>
      <g clipPath="url(#facet-f-lower)">
        <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#2d6a96" />
      </g>
      <line x1="0" y1="21" x2="34" y2="42" stroke="#7ac4f0" strokeWidth="0.5" opacity="0.4" />
    </svg>
  )
}

/**
 * FacetGemMark — Shield-cut gem icon.
 *
 * Flat crown, long pavilion, clean facet geometry.
 * Two-tone blue split carries the brand identity.
 * Used as the standalone app icon (sidebar, favicon, etc.)
 */
export function FacetGemMark({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const height = size * 1.45
  const light = active ? '#6cb8e8' : '#5ba4d9'
  const dark = active ? '#2d6a96' : '#1e5a82'
  const mid = active ? '#4a94c8' : '#3d88b8'
  const highlight = active ? '#7ac4f0' : '#6cb8e8'

  return (
    <svg
      className="facet-gem-mark"
      viewBox="0 0 22 32"
      width={size}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Crown (flat top) */}
      <path d="M6 2 H16 L20 9 H2 Z" fill={light} />
      {/* Table facet highlight */}
      <path d="M8 3.5 H14 L16.5 8 H5.5 Z" fill={highlight} opacity="0.25" />
      {/* Pavilion left */}
      <path d="M2 9 L11 31 L11 9 Z" fill={dark} />
      {/* Pavilion right */}
      <path d="M20 9 L11 31 L11 9 Z" fill={mid} />
      {/* Girdle line */}
      <line x1="1.5" y1="9" x2="20.5" y2="9" stroke={highlight} strokeWidth="0.5" opacity="0.5" />
      {/* Center seam */}
      <line x1="11" y1="2" x2="11" y2="31" stroke={highlight} strokeWidth="0.35" opacity="0.25" />
    </svg>
  )
}

/**
 * FacetWordmark — Gem mark + "Facet" in Instrument Serif.
 * The serif's thin/thick stroke contrast mirrors the gem's two-tone split.
 */
export function FacetWordmark() {
  return (
    <div className="facet-lockup" role="img" aria-label="Facet">
      <FacetGemMark size={18} active />
      <span className="facet-wordmark" aria-hidden="true">
        Facet
      </span>
    </div>
  )
}
