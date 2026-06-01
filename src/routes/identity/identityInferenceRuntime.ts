import { facetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/urlUtils'

export class IdentityInferenceConfigError extends Error {}

export const ensureIdentityInferenceEndpoint = (message: string) => {
  const aiEndpoint = sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl)
  if (!aiEndpoint) {
    throw new IdentityInferenceConfigError(message)
  }
  return aiEndpoint
}

