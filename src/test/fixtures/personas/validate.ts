import { importProfessionalIdentity } from '../../../identity/schema'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { ResumeData } from '../../../types'
import type { PipelineEntry, PipelineRound } from '../../../types/pipeline'
import type { PrepDeck } from '../../../types/prep'

export interface PersonaData {
  identity: ProfessionalIdentityV3
  resume: ResumeData
  pipelineEntries: PipelineEntry[]
  prepDecks: PrepDeck[]
}

export type PersonaIssueLevel = 'error' | 'warning'

export interface PersonaValidationIssue {
  level: PersonaIssueLevel
  path: string
  message: string
}

const HEADER_DRIFT_FIELDS = ['name', 'email', 'phone', 'location'] as const

const collectVectorRefs = (
  resumeVectorIds: Set<string>,
  vectors: Record<string, unknown>,
  path: string,
  issues: PersonaValidationIssue[],
): void => {
  for (const vid of Object.keys(vectors)) {
    if (!resumeVectorIds.has(vid)) {
      issues.push({
        level: 'error',
        path,
        message: `References unknown vector "${vid}". Known: ${[...resumeVectorIds].join(', ') || '(none)'}`,
      })
    }
  }
}

const collectIdentityBulletIds = (
  identity: ProfessionalIdentityV3,
  issues: PersonaValidationIssue[],
): Set<string> => {
  const seen = new Set<string>()
  for (const role of identity.roles) {
    for (const bullet of role.bullets) {
      if (seen.has(bullet.id)) {
        issues.push({
          level: 'error',
          path: `identity.roles[${role.id}].bullets[${bullet.id}]`,
          message: 'Duplicate bullet id — must be unique across all roles (override system resolves globally).',
        })
      }
      seen.add(bullet.id)
    }
  }
  return seen
}

const indexPipelineRounds = (
  entries: PipelineEntry[],
  issues: PersonaValidationIssue[],
): Map<string, { round: PipelineRound; entryId: string }> => {
  const roundIndex = new Map<string, { round: PipelineRound; entryId: string }>()
  for (const entry of entries) {
    const seenRoundIds = new Set<string>()
    for (const round of entry.interviewRounds ?? []) {
      if (seenRoundIds.has(round.id)) {
        issues.push({
          level: 'error',
          path: `pipeline[${entry.id}].interviewRounds[${round.id}]`,
          message: 'Duplicate round id within entry.',
        })
      }
      seenRoundIds.add(round.id)

      if (roundIndex.has(round.id)) {
        issues.push({
          level: 'warning',
          path: `pipeline[${entry.id}].interviewRounds[${round.id}]`,
          message: `Round id collides with another entry's round (id "${round.id}" not globally unique). Round IDs are typically unique workspace-wide.`,
        })
      } else {
        roundIndex.set(round.id, { round, entryId: entry.id })
      }

      const seenInterviewerIds = new Set<string>()
      for (const interviewer of round.interviewers) {
        if (seenInterviewerIds.has(interviewer.id)) {
          issues.push({
            level: 'error',
            path: `pipeline[${entry.id}].rounds[${round.id}].interviewers[${interviewer.id}]`,
            message: 'Duplicate interviewer id within round.',
          })
        }
        seenInterviewerIds.add(interviewer.id)
      }
    }
  }
  return roundIndex
}

export const validatePersona = (persona: PersonaData): PersonaValidationIssue[] => {
  const issues: PersonaValidationIssue[] = []

  try {
    const { warnings } = importProfessionalIdentity(persona.identity)
    for (const w of warnings) {
      issues.push({ level: 'warning', path: 'identity', message: w })
    }
  } catch (e) {
    issues.push({
      level: 'error',
      path: 'identity',
      message: `Runtime parser rejected identity: ${e instanceof Error ? e.message : String(e)}`,
    })
  }

  for (const field of HEADER_DRIFT_FIELDS) {
    const idVal = persona.identity.identity[field]
    const resVal = persona.resume.meta[field]
    if (idVal !== resVal) {
      issues.push({
        level: 'warning',
        path: `resume.meta.${field}`,
        message: `Differs from identity.identity.${field} ("${resVal}" vs "${idVal}"). Drift may be intentional.`,
      })
    }
  }

  collectIdentityBulletIds(persona.identity, issues)

  const resumeVectorIds = new Set(persona.resume.vectors.map((v) => v.id))

  for (const tl of persona.resume.target_lines) {
    collectVectorRefs(resumeVectorIds, tl.vectors, `resume.target_lines[${tl.id}].vectors`, issues)
  }
  for (const profile of persona.resume.profiles) {
    collectVectorRefs(resumeVectorIds, profile.vectors, `resume.profiles[${profile.id}].vectors`, issues)
    if (profile.variants) {
      collectVectorRefs(resumeVectorIds, profile.variants, `resume.profiles[${profile.id}].variants`, issues)
    }
  }
  for (const sg of persona.resume.skill_groups) {
    if (sg.vectors) {
      collectVectorRefs(resumeVectorIds, sg.vectors, `resume.skill_groups[${sg.id}].vectors`, issues)
    }
  }
  for (const role of persona.resume.roles) {
    collectVectorRefs(resumeVectorIds, role.vectors, `resume.roles[${role.id}].vectors`, issues)
    const seenBulletIds = new Set<string>()
    for (const bullet of role.bullets) {
      if (seenBulletIds.has(bullet.id)) {
        issues.push({
          level: 'error',
          path: `resume.roles[${role.id}].bullets[${bullet.id}]`,
          message: 'Duplicate bullet id within role.',
        })
      }
      seenBulletIds.add(bullet.id)
      collectVectorRefs(
        resumeVectorIds,
        bullet.vectors,
        `resume.roles[${role.id}].bullets[${bullet.id}].vectors`,
        issues,
      )
    }
  }
  for (const project of persona.resume.projects) {
    collectVectorRefs(resumeVectorIds, project.vectors, `resume.projects[${project.id}].vectors`, issues)
  }
  for (const edu of persona.resume.education) {
    collectVectorRefs(resumeVectorIds, edu.vectors, `resume.education[${edu.id}].vectors`, issues)
  }

  const entryById = new Map(persona.pipelineEntries.map((e) => [e.id, e]))
  for (const entry of persona.pipelineEntries) {
    if (entry.vectorId !== null && !resumeVectorIds.has(entry.vectorId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].vectorId`,
        message: `References unknown vector "${entry.vectorId}".`,
      })
    }
  }

  const roundIndex = indexPipelineRounds(persona.pipelineEntries, issues)

  const deckById = new Map(persona.prepDecks.map((d) => [d.id, d]))

  for (const deck of persona.prepDecks) {
    if (deck.pipelineEntryId && !entryById.has(deck.pipelineEntryId)) {
      issues.push({
        level: 'error',
        path: `prep[${deck.id}].pipelineEntryId`,
        message: `References unknown pipeline entry "${deck.pipelineEntryId}".`,
      })
    }

    if (deck.vectorId && !resumeVectorIds.has(deck.vectorId)) {
      issues.push({
        level: 'error',
        path: `prep[${deck.id}].vectorId`,
        message: `References unknown vector "${deck.vectorId}".`,
      })
    }

    if (deck.pipelineRoundId) {
      const linked = roundIndex.get(deck.pipelineRoundId)
      if (!linked) {
        issues.push({
          level: 'error',
          path: `prep[${deck.id}].pipelineRoundId`,
          message: `References unknown round "${deck.pipelineRoundId}".`,
        })
      } else {
        if (deck.pipelineEntryId && linked.entryId !== deck.pipelineEntryId) {
          issues.push({
            level: 'error',
            path: `prep[${deck.id}].pipelineRoundId`,
            message: `Round "${deck.pipelineRoundId}" belongs to entry "${linked.entryId}" but deck claims pipelineEntryId="${deck.pipelineEntryId}".`,
          })
        }

        if (linked.round.prepDeckId && linked.round.prepDeckId !== deck.id) {
          issues.push({
            level: 'warning',
            path: `pipeline.rounds[${deck.pipelineRoundId}].prepDeckId`,
            message: `Round links to deck "${linked.round.prepDeckId}" but deck "${deck.id}" also claims this round.`,
          })
        }

        const roundInterviewerIds = new Set(linked.round.interviewers.map((i) => i.id))
        for (const di of deck.interviewers ?? []) {
          if (!roundInterviewerIds.has(di.id)) {
            issues.push({
              level: 'warning',
              path: `prep[${deck.id}].interviewers[${di.id}]`,
              message: `Interviewer not present in linked round "${deck.pipelineRoundId}". Deck-only interviewers are unusual when a round is set.`,
            })
          }
        }
      }
    }

    const deckInterviewerIds = new Set((deck.interviewers ?? []).map((i) => i.id))
    const cardIdsInDeck = new Set<string>()
    for (const card of deck.cards) {
      if (cardIdsInDeck.has(card.id)) {
        issues.push({
          level: 'error',
          path: `prep[${deck.id}].cards[${card.id}]`,
          message: 'Duplicate card id within deck.',
        })
      }
      cardIdsInDeck.add(card.id)

      if (card.deckId && card.deckId !== deck.id) {
        issues.push({
          level: 'error',
          path: `prep[${deck.id}].cards[${card.id}].deckId`,
          message: `Card claims deckId="${card.deckId}" but is contained in deck "${deck.id}".`,
        })
      }

      if (
        card.pipelineEntryId &&
        deck.pipelineEntryId &&
        card.pipelineEntryId !== deck.pipelineEntryId
      ) {
        issues.push({
          level: 'warning',
          path: `prep[${deck.id}].cards[${card.id}].pipelineEntryId`,
          message: `Card pipelineEntryId="${card.pipelineEntryId}" differs from deck pipelineEntryId="${deck.pipelineEntryId}".`,
        })
      }

      if (card.vectorId && !resumeVectorIds.has(card.vectorId)) {
        issues.push({
          level: 'error',
          path: `prep[${deck.id}].cards[${card.id}].vectorId`,
          message: `References unknown vector "${card.vectorId}".`,
        })
      }

      for (const intId of card.interviewerIds ?? []) {
        if (!deckInterviewerIds.has(intId)) {
          issues.push({
            level: 'error',
            path: `prep[${deck.id}].cards[${card.id}].interviewerIds`,
            message: `References interviewer "${intId}" not present in deck.interviewers.`,
          })
        }
      }

      if (deck.pipelineRoundId && card.perRoundState) {
        const linked = roundIndex.get(deck.pipelineRoundId)
        if (linked) {
          const entry = entryById.get(linked.entryId)
          const totalRounds = entry?.interviewRounds?.length ?? 0
          for (const prs of card.perRoundState) {
            if (prs.round < 1 || prs.round > totalRounds) {
              issues.push({
                level: 'warning',
                path: `prep[${deck.id}].cards[${card.id}].perRoundState[${prs.round}]`,
                message: `Round number ${prs.round} is outside the entry's round count (1..${totalRounds}).`,
              })
            }
          }
        }
      }
    }

    for (const studyKey of Object.keys(deck.studyProgress ?? {})) {
      if (!cardIdsInDeck.has(studyKey)) {
        issues.push({
          level: 'error',
          path: `prep[${deck.id}].studyProgress[${studyKey}]`,
          message: 'Key does not match any card id in this deck.',
        })
      }
    }
  }

  for (const [, { round, entryId }] of roundIndex) {
    if (round.prepDeckId && !deckById.has(round.prepDeckId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entryId}].rounds[${round.id}].prepDeckId`,
        message: `References unknown deck "${round.prepDeckId}".`,
      })
    }
  }

  return issues
}

export const assertValidPersona = (persona: PersonaData, label?: string): void => {
  const errors = validatePersona(persona).filter((i) => i.level === 'error')
  if (errors.length > 0) {
    const prefix = label ? `[${label}] ` : ''
    const detail = errors.map((i) => `  ${i.path}: ${i.message}`).join('\n')
    throw new Error(`${prefix}Persona has ${errors.length} integrity error(s):\n${detail}`)
  }
}
