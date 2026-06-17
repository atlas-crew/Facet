// Barrel for the Facet UI primitive layer (src/components/ui/).
//
// Presentational primitives shared across workspaces live here. They are
// token-styled and prop-driven — see ./README.md for the authoring rules and
// docs/architecture/decisions/adr-0011-extract-ui-primitive-layer.md for why
// this layer exists.
//
// Each primitive re-exports from this file so callers import from one place:
//
//   import { Button } from '../../components/ui'
//
// Primitives land in their own issues (Button #68, SectionLabel #69,
// StatusBadge #70).
export { Button, IconButton } from './Button'
export type { ButtonProps, IconButtonProps, ButtonVariant, ButtonSize } from './Button'
export { SectionLabel } from './SectionLabel'
export type { SectionLabelProps, SectionLabelTone } from './SectionLabel'
