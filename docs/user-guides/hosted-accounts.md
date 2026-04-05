# Hosted Accounts

This guide covers the hosted Facet beta flow: signing in, creating or migrating
workspaces, understanding AI upgrades, and recovering from common hosted errors.

## Who This Is For

Use this guide if you are using the hosted Facet beta rather than running Facet
locally in self-hosted mode.

## What Hosted Accounts Include

Hosted Facet gives you:
- a hosted account tied to your sign-in
- hosted workspaces
- hosted persistence and sync
- local backup and restore options

Hosted sync is included on the free hosted plan. You do not need AI Pro to keep
your workspace saved in the hosted beta.

## First-Time Setup

1. Sign in to your hosted Facet account.
2. Wait for the hosted bootstrap flow to load your account context and workspace list.
3. If you do not have a hosted workspace yet, choose one of these options:
   - **Create Empty Workspace**
   - **Import Local Workspace**
4. Open the workspace you want to use.

If the app shows **Hosted sign-in required**, refresh the session and sign in again.

## Moving From Local To Hosted

Facet supports a non-destructive local-to-hosted migration path.

Recommended flow:
1. Open the hosted workspace dialog.
2. Choose **Create From Local Data** or **Import Local Workspace**.
3. Let Facet create the hosted workspace first.
4. Wait for the migration import to finish before switching workspaces.
5. Open **Backup** if you want a local snapshot before or after migration.

Notes:
- migration imports your current local workspace into a new hosted workspace
- hosted persistence becomes the authoritative save path after the hosted workspace opens
- local backup or export remains available as a fallback

## AI Features And Upgrades

Hosted AI is the only part of Wave 1 that requires the paid `ai-pro` plan.

AI-gated features include:
- job-description analysis
- bullet reframing
- match analysis
- research profile inference
- AI-assisted job search
- prep generation
- cover-letter generation
- LinkedIn generation
- debrief generation

If a hosted AI feature is unavailable:
- **Upgrade required** means your current hosted plan does not include that AI feature
- **Billing issue** means your subscription exists but needs billing attention

Hosted persistence, workspaces, and backups should continue to work even when AI is unavailable.

## Common Recovery Paths

### Hosted session expired

Symptom:
- the app shows **Hosted session expired**

What to do:
- click **Refresh Session**
- sign in again if prompted

### Hosted sync is offline

Symptom:
- the app shows **Hosted sync is offline**

What to do:
- verify your network connection
- retry the hosted workspace
- use **Backup Workspace** if you want a local copy before retrying

### Hosted billing state unavailable

Symptom:
- the app shows **Hosted billing state unavailable**

What to do:
- click **Refresh Billing State**
- if the error persists, contact the beta support channel

### Hosted upgrade required

Symptom:
- the app shows **Hosted upgrade required** on an AI action

What to do:
- move to the AI Pro upgrade flow
- continue using non-AI hosted editing and sync features if you do not need the paid AI feature yet

### Hosted billing issue

Symptom:
- the app shows **Hosted billing issue** on an AI action

What to do:
- refresh billing state
- update the subscription or payment method through the beta billing flow

## Known Limits In Wave 1

Current hosted beta limits:
- one human user per hosted tenant is the expected model
- shared or collaborative hosted workspaces are out of scope
- hosted AI depends on the current AI Pro entitlement and billing state
- self-hosted operator AI and hosted billing are separate models; hosted BYOK is not supported

## When To Use Backup

Use **Backup Workspace** when:
- you want a local snapshot before a migration
- hosted sync is offline and you want a safe copy before retrying
- support asks for a snapshot to help reproduce a problem

## Related Docs

- [Getting Started](getting-started.md)
- [Preview and Export](preview-and-export.md)
- [Documentation Navigator](../NAVIGATOR.md)
