export type ArtifactDomain = 'search' | 'prep' | 'cover-letter' | (string & {})

export type FeedbackRating = 'up' | 'down'

export type FeedbackApplicationState =
  | { readonly appliedToIdentity: false; readonly appliedAtVersion?: never }
  | { readonly appliedToIdentity: true; readonly appliedAtVersion: number }

export interface FeedbackBaseCore<
  TDomain extends ArtifactDomain = ArtifactDomain,
  TPayload = unknown,
> {
  id: string
  domain: TDomain
  artifactId: string
  targetId?: string
  rating: FeedbackRating
  reason?: string
  payload?: TPayload
  reflectedInArtifactId?: string
  createdAt: string
  updatedAt?: string
}

export type FeedbackBase<
  TDomain extends ArtifactDomain = ArtifactDomain,
  TPayload = unknown,
  TFields extends object = object,
> = FeedbackBaseCore<TDomain, TPayload> & FeedbackApplicationState & TFields

export interface PrepFeedbackPayload {
  skillDepth?: {
    name: string
    suggestedDepth?: string
  }
  calibration?: {
    group: string
    note: string
  }
  storyFraming?: {
    cardId: string
    note: string
  }
  interviewer?: {
    name: string
    correction: string
  }
}

export type PrepFeedbackEvent = FeedbackBase<'prep', PrepFeedbackPayload>

export interface CoverLetterFeedbackPayload {
  voice?: {
    facet: string
    note: string
  }
  positioning?: {
    aspect: string
    note: string
  }
  fact?: {
    text: string
    correction: string
  }
}

export type CoverLetterFeedbackEvent = FeedbackBase<'cover-letter', CoverLetterFeedbackPayload>

export type FeedbackEventInput<TEvent extends FeedbackBase> = TEvent extends FeedbackBase
  ? Omit<TEvent, 'id' | 'createdAt' | 'updatedAt'>
  : never

export interface FeedbackStateContract<TEvent extends FeedbackBase = FeedbackBase> {
  readonly events: readonly TEvent[]
  addEvent: (event: FeedbackEventInput<TEvent>) => TEvent
  markApplied: (id: string, identityVersion: number) => void
  markReflectedInArtifact: (ids: readonly string[], artifactId: string) => void
  getUnreflected: (domain: TEvent['domain'], currentArtifactId?: string) => TEvent[]
  getEventsForArtifact: (artifactId: string) => TEvent[]
}
