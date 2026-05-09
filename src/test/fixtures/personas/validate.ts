import { importProfessionalIdentity } from '../../../identity/schema'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { ResearchWorkspaceData } from '../../../persistence/contracts'
import type { ResumeData } from '../../../types'
import type { CoverLetterWorkspaceData } from '../../../types/coverLetter'
import type { DebriefSession } from '../../../types/debrief'
import type { JDAnalysis } from '../../../types/jdAnalysis'
import type { LinkedInProfileDraft } from '../../../types/linkedin'
import type { PipelineEntry, PipelineRound } from '../../../types/pipeline'
import type { PrepDeck } from '../../../types/prep'
import type { RecruiterCard } from '../../../types/recruiter'
import type { ResumeWorkspaceData } from '../../../types/resume'

export interface PersonaData {
  identity: ProfessionalIdentityV3
  resume: ResumeData
  resumeWorkspace?: ResumeWorkspaceData
  pipelineEntries: PipelineEntry[]
  prepDecks: PrepDeck[]
  jdAnalyses?: JDAnalysis[]
  coverLetters?: CoverLetterWorkspaceData
  linkedInDrafts?: LinkedInProfileDraft[]
  recruiterCards?: RecruiterCard[]
  debriefSessions?: DebriefSession[]
  research?: ResearchWorkspaceData
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
          message:
            'Duplicate bullet id — must be unique across all roles (override system resolves globally).',
        })
      }
      seen.add(bullet.id)
    }
  }
  return seen
}

const collectIdentityRoleIds = (identity: ProfessionalIdentityV3): Set<string> =>
  new Set(identity.roles.map((role) => role.id))

const collectDuplicateIds = (
  ids: string[],
  path: string,
  issues: PersonaValidationIssue[],
): Set<string> => {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({
        level: 'error',
        path: `${path}[${id}]`,
        message: 'Duplicate id.',
      })
    }
    seen.add(id)
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

  const identityRoleIds = collectIdentityRoleIds(persona.identity)
  const identityBulletIds = collectIdentityBulletIds(persona.identity, issues)

  const resumeVectorIds = new Set(persona.resume.vectors.map((v) => v.id))

  for (const tl of persona.resume.target_lines) {
    collectVectorRefs(resumeVectorIds, tl.vectors, `resume.target_lines[${tl.id}].vectors`, issues)
  }
  for (const profile of persona.resume.profiles) {
    collectVectorRefs(
      resumeVectorIds,
      profile.vectors,
      `resume.profiles[${profile.id}].vectors`,
      issues,
    )
    if (profile.variants) {
      collectVectorRefs(
        resumeVectorIds,
        profile.variants,
        `resume.profiles[${profile.id}].variants`,
        issues,
      )
    }
  }
  for (const sg of persona.resume.skill_groups) {
    if (sg.vectors) {
      collectVectorRefs(
        resumeVectorIds,
        sg.vectors,
        `resume.skill_groups[${sg.id}].vectors`,
        issues,
      )
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
    collectVectorRefs(
      resumeVectorIds,
      project.vectors,
      `resume.projects[${project.id}].vectors`,
      issues,
    )
  }
  for (const edu of persona.resume.education) {
    collectVectorRefs(resumeVectorIds, edu.vectors, `resume.education[${edu.id}].vectors`, issues)
  }

  const entryById = new Map(persona.pipelineEntries.map((e) => [e.id, e]))
  const resumeById = new Map((persona.resumeWorkspace?.resumes ?? []).map((r) => [r.id, r]))
  const resumeSnapshotById = new Map(
    (persona.resumeWorkspace?.snapshots ?? []).map((s) => [s.id, s]),
  )
  const jdAnalysisById = new Map((persona.jdAnalyses ?? []).map((a) => [a.id, a]))
  const coverLetterById = new Map((persona.coverLetters?.letters ?? []).map((l) => [l.id, l]))
  const coverLetterSnapshotById = new Map(
    (persona.coverLetters?.snapshots ?? []).map((s) => [s.id, s]),
  )

  collectDuplicateIds(
    persona.pipelineEntries.map((e) => e.id),
    'pipeline',
    issues,
  )
  collectDuplicateIds(
    persona.resumeWorkspace?.resumes.map((r) => r.id) ?? [],
    'resumeWorkspace.resumes',
    issues,
  )
  collectDuplicateIds(
    persona.resumeWorkspace?.snapshots.map((s) => s.id) ?? [],
    'resumeWorkspace.snapshots',
    issues,
  )
  collectDuplicateIds(persona.jdAnalyses?.map((a) => a.id) ?? [], 'jdAnalysis', issues)
  collectDuplicateIds(
    persona.coverLetters?.letters.map((l) => l.id) ?? [],
    'coverLetters.letters',
    issues,
  )
  collectDuplicateIds(
    persona.coverLetters?.snapshots.map((s) => s.id) ?? [],
    'coverLetters.snapshots',
    issues,
  )
  collectDuplicateIds(persona.linkedInDrafts?.map((d) => d.id) ?? [], 'linkedin.drafts', issues)
  collectDuplicateIds(persona.recruiterCards?.map((c) => c.id) ?? [], 'recruiter.cards', issues)
  collectDuplicateIds(persona.debriefSessions?.map((s) => s.id) ?? [], 'debrief.sessions', issues)
  collectDuplicateIds(
    persona.research?.requests.map((r) => r.id) ?? [],
    'research.requests',
    issues,
  )
  collectDuplicateIds(persona.research?.runs.map((r) => r.id) ?? [], 'research.runs', issues)
  collectDuplicateIds(persona.research?.theses?.map((t) => t.id) ?? [], 'research.theses', issues)

  for (const entry of persona.pipelineEntries) {
    if (entry.vectorId !== null && !resumeVectorIds.has(entry.vectorId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].vectorId`,
        message: `References unknown vector "${entry.vectorId}".`,
      })
    }

    if (entry.jdAnalysisId && !jdAnalysisById.has(entry.jdAnalysisId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].jdAnalysisId`,
        message: `References unknown JD analysis "${entry.jdAnalysisId}".`,
      })
    }

    if (entry.coverLetterId && !coverLetterById.has(entry.coverLetterId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].coverLetterId`,
        message: `References unknown cover letter "${entry.coverLetterId}".`,
      })
    }

    if (entry.coverLetterSnapshotId && !coverLetterSnapshotById.has(entry.coverLetterSnapshotId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].coverLetterSnapshotId`,
        message: `References unknown cover letter snapshot "${entry.coverLetterSnapshotId}".`,
      })
    }

    if (entry.resumeId && persona.resumeWorkspace && !resumeById.has(entry.resumeId)) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].resumeId`,
        message: `References unknown resume "${entry.resumeId}".`,
      })
    }

    if (
      entry.resumeSnapshotId &&
      persona.resumeWorkspace &&
      !resumeSnapshotById.has(entry.resumeSnapshotId)
    ) {
      issues.push({
        level: 'error',
        path: `pipeline[${entry.id}].resumeSnapshotId`,
        message: `References unknown resume snapshot "${entry.resumeSnapshotId}".`,
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

  for (const analysis of persona.jdAnalyses ?? []) {
    const requirementIds = new Set(analysis.requirements.map((requirement) => requirement.id))
    const entry = entryById.get(analysis.pipelineEntryId)
    if (!entry) {
      issues.push({
        level: 'error',
        path: `jdAnalysis[${analysis.id}].pipelineEntryId`,
        message: `References unknown pipeline entry "${analysis.pipelineEntryId}".`,
      })
    } else if (entry.jdAnalysisId && entry.jdAnalysisId !== analysis.id) {
      issues.push({
        level: 'error',
        path: `jdAnalysis[${analysis.id}].pipelineEntryId`,
        message: `Entry "${entry.id}" links to JD analysis "${entry.jdAnalysisId}" instead.`,
      })
    }

    if (analysis.primaryVectorId && !resumeVectorIds.has(analysis.primaryVectorId)) {
      issues.push({
        level: 'error',
        path: `jdAnalysis[${analysis.id}].primaryVectorId`,
        message: `References unknown vector "${analysis.primaryVectorId}".`,
      })
    }

    for (const vector of analysis.matchedVectors) {
      if (!resumeVectorIds.has(vector.vectorId)) {
        issues.push({
          level: 'error',
          path: `jdAnalysis[${analysis.id}].matchedVectors[${vector.vectorId}]`,
          message: `References unknown vector "${vector.vectorId}".`,
        })
      }
    }

    const validateRequirementRefs = (ids: string[], path: string) => {
      for (const id of ids) {
        if (!requirementIds.has(id)) {
          issues.push({
            level: 'error',
            path,
            message: `References unknown JD requirement "${id}".`,
          })
        }
      }
    }

    validateRequirementRefs(
      analysis.matchedRequirementIds,
      `jdAnalysis[${analysis.id}].matchedRequirementIds`,
    )
    for (const advantage of analysis.advantages) {
      validateRequirementRefs(
        advantage.requirementIds,
        `jdAnalysis[${analysis.id}].advantages[${advantage.id}].requirementIds`,
      )
    }
    for (const hypothesis of analysis.advantageHypotheses) {
      validateRequirementRefs(
        hypothesis.requirementIds,
        `jdAnalysis[${analysis.id}].advantageHypotheses[${hypothesis.id}].requirementIds`,
      )
    }
    for (const gap of analysis.gaps) {
      validateRequirementRefs(
        [gap.requirementId],
        `jdAnalysis[${analysis.id}].gaps[${gap.requirementId}]`,
      )
    }
    for (const [group, assets] of Object.entries(analysis.evidenceMapping)) {
      for (const asset of assets) {
        validateRequirementRefs(
          asset.matchedRequirementIds,
          `jdAnalysis[${analysis.id}].evidenceMapping.${group}[${asset.id}].matchedRequirementIds`,
        )
      }
    }
  }

  for (const letter of persona.coverLetters?.letters ?? []) {
    if (!entryById.has(letter.pipelineEntryId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.letters[${letter.id}].pipelineEntryId`,
        message: `References unknown pipeline entry "${letter.pipelineEntryId}".`,
      })
    }
    if (persona.resumeWorkspace && !resumeById.has(letter.sourceResumeId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.letters[${letter.id}].sourceResumeId`,
        message: `References unknown resume "${letter.sourceResumeId}".`,
      })
    }
  }

  for (const snapshot of persona.coverLetters?.snapshots ?? []) {
    if (!entryById.has(snapshot.pipelineEntryId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.snapshots[${snapshot.id}].pipelineEntryId`,
        message: `References unknown pipeline entry "${snapshot.pipelineEntryId}".`,
      })
    }
    if (!coverLetterById.has(snapshot.sourceLetterId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.snapshots[${snapshot.id}].sourceLetterId`,
        message: `References unknown cover letter "${snapshot.sourceLetterId}".`,
      })
    }
    if (persona.resumeWorkspace && !resumeById.has(snapshot.sourceResumeId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.snapshots[${snapshot.id}].sourceResumeId`,
        message: `References unknown resume "${snapshot.sourceResumeId}".`,
      })
    }
    if (persona.resumeWorkspace && !resumeSnapshotById.has(snapshot.sourceResumeSnapshotId)) {
      issues.push({
        level: 'error',
        path: `coverLetters.snapshots[${snapshot.id}].sourceResumeSnapshotId`,
        message: `References unknown resume snapshot "${snapshot.sourceResumeSnapshotId}".`,
      })
    }
  }

  for (const session of persona.debriefSessions ?? []) {
    if (session.pipelineEntryId && !entryById.has(session.pipelineEntryId)) {
      issues.push({
        level: 'error',
        path: `debrief.sessions[${session.id}].pipelineEntryId`,
        message: `References unknown pipeline entry "${session.pipelineEntryId}".`,
      })
    }

    for (const story of session.storiesTold) {
      if (!identityRoleIds.has(story.roleId)) {
        issues.push({
          level: 'error',
          path: `debrief.sessions[${session.id}].storiesTold[${story.id}].roleId`,
          message: `References unknown identity role "${story.roleId}".`,
        })
      }
      if (!identityBulletIds.has(story.bulletId)) {
        issues.push({
          level: 'error',
          path: `debrief.sessions[${session.id}].storiesTold[${story.id}].bulletId`,
          message: `References unknown identity bullet "${story.bulletId}".`,
        })
      }
    }

    for (const pattern of [
      ...session.anchorStories,
      ...session.recurringGaps,
      ...session.bestFitCompanyTypes,
    ]) {
      if (pattern.roleId && !identityRoleIds.has(pattern.roleId)) {
        issues.push({
          level: 'error',
          path: `debrief.sessions[${session.id}].patterns[${pattern.id}].roleId`,
          message: `References unknown identity role "${pattern.roleId}".`,
        })
      }
      if (pattern.bulletId && !identityBulletIds.has(pattern.bulletId)) {
        issues.push({
          level: 'error',
          path: `debrief.sessions[${session.id}].patterns[${pattern.id}].bulletId`,
          message: `References unknown identity bullet "${pattern.bulletId}".`,
        })
      }
    }
  }

  if (persona.research) {
    const thesisById = new Map((persona.research.theses ?? []).map((t) => [t.id, t]))
    const requestById = new Map(persona.research.requests.map((r) => [r.id, r]))
    if (persona.research.activeThesisId && !thesisById.has(persona.research.activeThesisId)) {
      issues.push({
        level: 'error',
        path: 'research.activeThesisId',
        message: `References unknown thesis "${persona.research.activeThesisId}".`,
      })
    }

    for (const run of persona.research.runs) {
      if (!requestById.has(run.requestId)) {
        issues.push({
          level: 'error',
          path: `research.runs[${run.id}].requestId`,
          message: `References unknown search request "${run.requestId}".`,
        })
      }
      if (run.thesisId && !thesisById.has(run.thesisId)) {
        issues.push({
          level: 'error',
          path: `research.runs[${run.id}].thesisId`,
          message: `References unknown thesis "${run.thesisId}".`,
        })
      }
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
