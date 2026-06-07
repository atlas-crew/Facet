import { useState } from 'react'
import type { ProfessionalIdentityCore, ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, SlotShell } from './slotPrimitives'

type ContactLinkDraft = {
  rowKey: string
  id: string
  url: string
}

let contactLinkDraftKeySequence = 0

const createContactLinkDraft = (
  link: { id?: string; url?: string } = {},
): ContactLinkDraft => {
  contactLinkDraftKeySequence += 1
  return {
    rowKey: `contact-link-${contactLinkDraftKeySequence}`,
    id: link.id ?? '',
    url: link.url ?? '',
  }
}

const linkRowsFromIdentity = (identity: ProfessionalIdentityV3): ContactLinkDraft[] =>
  (identity.identity.links ?? []).map((link) => createContactLinkDraft(link))

const buildDraft = (identity: ProfessionalIdentityV3) => ({
  name: identity.identity.name,
  displayName: identity.identity.display_name ?? '',
  title: identity.identity.title ?? '',
  email: identity.identity.email ?? '',
  phone: identity.identity.phone ?? '',
  location: identity.identity.location ?? '',
  remote: Boolean(identity.identity.remote),
  links: linkRowsFromIdentity(identity),
})

const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const getUniqueLinkId = (baseId: string, usedIds: Set<string>): string => {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId)
    return baseId
  }
  let suffix = 2
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  const id = `${baseId}-${suffix}`
  usedIds.add(id)
  return id
}

const nextFallbackLinkId = (reservedIds: Set<string>, usedIds: Set<string>): string => {
  let index = 1
  while (reservedIds.has(`link-${index}`) || usedIds.has(`link-${index}`)) {
    index += 1
  }
  const id = `link-${index}`
  usedIds.add(id)
  return id
}

const normalizeLinks = (links: ContactLinkDraft[]): ProfessionalIdentityCore['links'] => {
  const usedIds = new Set<string>()
  const normalizedLinks = links
    .map((link) => ({
      id: link.id.trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.id || link.url)
  const reservedIds = new Set(normalizedLinks.map((link) => link.id).filter(Boolean))
  return normalizedLinks
    .map((link) => {
      const id = link.id
        ? getUniqueLinkId(link.id, usedIds)
        : nextFallbackLinkId(reservedIds, usedIds)
      return {
        id,
        url: link.url,
      }
    })
    .filter((link) => link.url)
}

const hasIncompleteLink = (links: ContactLinkDraft[]): boolean =>
  links.some((link) => Boolean(link.id.trim()) && !link.url.trim())

const CONTACT_EMAIL_ERROR_ID = 'contact-email-error'
const CONTACT_LINK_ERROR_ID = 'contact-link-error'

const isInvalidEmail = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function ContactBasicsInspector({ identity }: { identity: ProfessionalIdentityV3 }) {
  const updateCore = useIdentityStore((s) => s.updateCurrentIdentityCore)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => buildDraft(identity))

  const startEditing = () => {
    setDraft(buildDraft(identity))
    setEditing(true)
  }

  const updateLink = (index: number, patch: Partial<ContactLinkDraft>) => {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link,
      ),
    }))
  }

  const addLink = () => {
    setDraft((current) => ({
      ...current,
      links: [...current.links, createContactLinkDraft()],
    }))
  }

  const removeLink = (index: number) => {
    setDraft((current) => ({
      ...current,
      links: current.links.filter((_, linkIndex) => linkIndex !== index),
    }))
  }

  const linkMissingUrl = hasIncompleteLink(draft.links)
  const emailInvalid = isInvalidEmail(draft.email)
  const canSave = draft.name.trim().length > 0 && !linkMissingUrl && !emailInvalid

  const handleSave = () => {
    if (!canSave) return
    updateCore({
      name: draft.name.trim(),
      display_name: normalizeOptional(draft.displayName),
      title: normalizeOptional(draft.title),
      // Core contact strings are required by ProfessionalIdentityCore; clearing them persists ''.
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      location: draft.location.trim(),
      remote: draft.remote,
      links: normalizeLinks(draft.links),
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Contact · Editing" title="Edit contact basics">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Name</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Display Name</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.displayName}
            onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Title</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Email</span>
          <input
            className="inspector-input"
            type="email"
            value={draft.email}
            aria-describedby={emailInvalid ? CONTACT_EMAIL_ERROR_ID : undefined}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
          {emailInvalid ? (
            <span id={CONTACT_EMAIL_ERROR_ID} className="inspector-field-hint">
              Use a valid email address.
            </span>
          ) : null}
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Phone</span>
          <input
            className="inspector-input"
            type="tel"
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Location</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.location}
            onChange={(event) => setDraft({ ...draft, location: event.target.value })}
          />
        </label>
        <label className="inspector-checkbox">
          <input
            type="checkbox"
            checked={draft.remote}
            onChange={(event) => setDraft({ ...draft, remote: event.target.checked })}
          />
          <span>Available for remote roles</span>
        </label>
        <fieldset
          className="inspector-field contact-link-fieldset"
          aria-describedby={linkMissingUrl ? CONTACT_LINK_ERROR_ID : undefined}
        >
          <legend className="inspector-field-label label-tracked">Links</legend>
          <div className="contact-link-list">
            {draft.links.map((link, index) => (
              <div className="contact-link-row" key={link.rowKey}>
                <input
                  className="inspector-input"
                  type="text"
                  aria-label={`Link ${index + 1} Label`}
                  value={link.id}
                  onChange={(event) => updateLink(index, { id: event.target.value })}
                  placeholder="Label"
                />
                <input
                  className="inspector-input"
                  type="text"
                  aria-label={`Link ${index + 1} URL`}
                  value={link.url}
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className="inspector-btn"
                  aria-label={`Remove link ${index + 1}`}
                  onClick={() => removeLink(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="inspector-btn" onClick={addLink}>
            Add link
          </button>
          {linkMissingUrl ? (
            <span id={CONTACT_LINK_ERROR_ID} className="inspector-field-hint">
              Add a URL or remove the labeled link.
            </span>
          ) : null}
        </fieldset>
        <Actions>
          <button
            type="button"
            className="inspector-btn primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell
      eyebrow="Contact · Identity"
      title={identity.identity.display_name?.trim() || identity.identity.name || 'No identity yet'}
    >
      <MetaRows
        rows={[
          ['Display name', identity.identity.display_name],
          ['Title', identity.identity.title],
          ['Email', identity.identity.email],
          ['Phone', identity.identity.phone],
          ['Location', identity.identity.location],
          ['Availability', identity.identity.remote ? 'Remote' : 'On-site'],
          [
            'Links',
            (identity.identity.links ?? []).map((link) => `${link.id}: ${link.url}`).join(' · '),
          ],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit details
        </button>
      </Actions>
    </SlotShell>
  )
}
