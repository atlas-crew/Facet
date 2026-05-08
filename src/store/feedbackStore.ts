import type {
  ArtifactDomain,
  FeedbackBase,
  FeedbackEventInput,
  FeedbackStateContract,
} from '../types/feedback'
import { createId } from '../utils/idUtils'

interface FeedbackCollectionOptions {
  createEventId?: () => string
  now?: () => string
}

export const createFeedbackCollection = <TEvent extends FeedbackBase>(
  initialEvents: readonly TEvent[] = [],
  options: FeedbackCollectionOptions = {},
): FeedbackStateContract<TEvent> => {
  let events = [...initialEvents]
  const createEventId = options.createEventId ?? (() => createId('fbe'))
  const now = options.now ?? (() => new Date().toISOString())
  const snapshotEvents = (items: readonly TEvent[]) =>
    items.map((event) => ({ ...event }) as TEvent)

  const contract: FeedbackStateContract<TEvent> = {
    get events() {
      return snapshotEvents(events)
    },

    addEvent(input: FeedbackEventInput<TEvent>) {
      const timestamp = now()
      const event = {
        ...input,
        id: createEventId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      } as unknown as TEvent
      events = [...events, event]
      return event
    },

    markApplied(id, identityVersion) {
      const timestamp = now()
      events = events.map((event) =>
        event.id === id
          ? ({
              ...event,
              appliedToIdentity: true,
              appliedAtVersion: identityVersion,
              updatedAt: timestamp,
            } as TEvent)
          : event,
      )
    },

    markReflectedInArtifact(ids, artifactId) {
      const idSet = new Set(ids)
      const timestamp = now()
      events = events.map((event) =>
        idSet.has(event.id) && event.reflectedInArtifactId === undefined
          ? ({ ...event, reflectedInArtifactId: artifactId, updatedAt: timestamp } as TEvent)
          : event,
      )
    },

    getUnreflected(domain: ArtifactDomain, currentArtifactId?: string) {
      return snapshotEvents(
        events.filter(
          (event) =>
            event.domain === domain &&
            event.appliedToIdentity &&
            (currentArtifactId === undefined || event.reflectedInArtifactId !== currentArtifactId),
        ),
      )
    },

    getEventsForArtifact(artifactId) {
      return snapshotEvents(events.filter((event) => event.artifactId === artifactId))
    },
  }

  return contract
}
