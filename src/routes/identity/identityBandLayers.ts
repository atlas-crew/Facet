import type { BandLayer } from './IdentityBand'

export const getIdentityBandSelector = (layer: BandLayer) => `[data-layer="${layer}"]`

