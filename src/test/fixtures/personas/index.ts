export {
  mayaPatelIdentity,
  mayaPatelResume,
  mayaPatelPipelineEntries,
  mayaPatelPrepDecks,
  buildMayaPatelPersona,
} from './mayaPatel'

export {
  marcusKimIdentity,
  marcusKimResume,
  marcusKimPipelineEntries,
  marcusKimPrepDecks,
  buildMarcusKimPersona,
} from './marcusKim'

export {
  dianeOkaforIdentity,
  dianeOkaforResume,
  dianeOkaforPipelineEntries,
  dianeOkaforPrepDecks,
  buildDianeOkaforPersona,
} from './dianeOkafor'

export type { PersonaData, PersonaIssueLevel, PersonaValidationIssue } from './validate'
export { validatePersona, assertValidPersona } from './validate'

import { buildDianeOkaforPersona } from './dianeOkafor'
import { buildMarcusKimPersona } from './marcusKim'
import { buildMayaPatelPersona } from './mayaPatel'

export const buildAllPersonas = () => ({
  maya: buildMayaPatelPersona(),
  marcus: buildMarcusKimPersona(),
  diane: buildDianeOkaforPersona(),
})
