# Public Landing Page + Auth-Aware Home Rollout Plan

## Decision

Facet should keep `/` as the canonical entry point, but render different surfaces by auth/workspace state:

- **Anonymous / signed out:** a public landing page that explains the product, uses the brand image library, and has clear sign-in / pricing / trust CTAs.
- **Authenticated with existing work:** the existing Home/Overview hub remains the operational cockpit.
- **Authenticated with an empty workspace:** the hub renders a stronger first-run state that routes users into Identity, Match, or Build without showing marketing copy.

Do **not** merge the public product explainer into the authenticated hub. `TASK-191` intentionally removed marketing/workflow-explainer copy from the authenticated overview page. Preserve that boundary.

## Why

The landing page and hub answer different questions:

- Public landing page: **What is Facet, and why should I trust it?**
- Authenticated hub: **What should I do next in my search?**

Mixing those questions creates a page that is worse at both jobs: too operational for prospects and too promotional for users trying to resume work.

## Placement

- Route: `/` remains canonical.
- Anonymous state: render a new public landing surface outside the authenticated workspace shell.
- Authenticated state: keep `src/routes/home/HomePage.tsx` as the hub.
- First-run authenticated state: improve the hub empty-state/onboarding affordances rather than redirecting users back to public marketing.

## Brand And Copy Sources

Use the brand library as the source of truth:

- `brand/CHEATSHEET.md` for locked phrases, vocabulary, colors, fonts, and trust line.
- `brand/COPY.md` for voice, banned vocabulary, and hero/copy specimens.
- `brand/BRAND.md` for visual system, asset inventory, and asset usage guidance.
- `brand/exports/hero/facet-primary-hero.webp` and the new supplied hero image as candidate hero visuals.
- `brand/exports/banners/*`, `brand/exports/concepts/*`, `brand/exports/method/*`, `brand/exports/principle/*`, `brand/exports/social/*` for public page sections and share images.
- `backlog/docs/doc-33` as historical landing-page copy context, not the implementation plan.

Locked copy spine:

- Tagline: `Same diamond · Different face`
- Hero: `A deep model of you, professionally. Recut for every opportunity.`
- Trust line: `Open-source · Your data, never ours`
- Avoid: tailor, generate, customize, AI-powered, game-changing, revolutionary, next-generation.

## Public Landing Page Shape

Recommended first version:

1. **Hero**
   - Visual: use `facet-primary-hero.webp` or the new supplied image after in-browser review.
   - Copy: locked hero phrase plus concise product explanation.
   - Primary CTA: Sign in with GitHub / Start with GitHub.
   - Secondary CTA: View source or See pricing, depending launch state.

2. **How Facet Works**
   - Explain Identity model -> Research/Pipeline/Prep -> derived outputs.
   - Use `brand/exports/method/facet-method-dark.webp` or concept cards.

3. **What You Build Once**
   - Identity model, evidence, vectors, anchor stories.
   - Make clear that resume, letter, LinkedIn, prep, and recruiter cards are recuts from the same model.

4. **Why It Is Different**
   - Persistent workspace, structured process, per-person prep, open-source trust.
   - Keep senior-engineer-specific, concrete, and non-hype.

5. **Trust / Data**
   - Open-source, data ownership, hosted vs self-host boundary, pricing/pass model if appropriate.
   - Link Privacy, Terms, GitHub, Pricing when those routes are ready.

6. **Closing CTA**
   - `Build it once. Recut forever.`
   - CTA repeats auth action.

## Authenticated Hub Shape

Preserve the current hub intent:

- Resume active work first.
- Quiet time-sensitive notifications only.
- Pipeline glance as a gateway.
- Existing start options remain: Resume import / JD import / direct builder.

Improve the **empty workspace** state separately:

- Give a first-run path with three choices: Start from Resume, Start from Job Description, Open Resume Builder.
- Keep it action-oriented and product-native, not marketing copy.
- Optionally use small brand/icon accents, not a large public landing hero.

## Implementation Sequence

1. **Route/auth split + landing shell**
   - Add a public landing component for anonymous root visits.
   - Keep authenticated root rendering the existing hub.
   - Ensure hosted auth-required state can still show sign-in without trapping users away from the public page.

2. **Brand-backed landing content**
   - Curate the hero and section visuals from `brand/exports` plus the supplied hero candidate.
   - Implement responsive public sections using real image assets and locked brand copy.
   - Avoid rendering fake text inside images as meaningful content; copy lives in HTML.

3. **Authenticated empty-hub onboarding**
   - Refine the empty/currently-new user hub state so first-run signed-in users get clear next actions.
   - Preserve TASK-191's no-marketing rule for the authenticated hub.

4. **CTA, trust, and link polish**
   - Wire sign-in CTAs, GitHub/source links, pricing/trust/privacy links, and meta/OG image choices.
   - Confirm copy against `brand/COPY.md` banned vocabulary.

5. **Test and visual verification**
   - Add route/auth-state tests for anonymous vs authenticated rendering.
   - Add hub empty-state tests.
   - Use browser screenshots for desktop/mobile landing composition and image rendering.
   - Run typecheck, focused tests, lint, build.

## Open Decisions

- Which hero wins after in-browser review: `brand/exports/hero/facet-primary-hero.webp`, the new supplied image, or a composited/edited brand export.
- Whether Pricing is ready as a public route now or should be linked later.
- Whether anonymous users should see the full AppShell chrome or a separate public chrome. Recommendation: separate public chrome.
- Whether public `/manifesto`, `/pricing`, and `/press` become follow-up pages now or stay linked only when live.

## Out Of Scope For First Slice

- Reworking the authenticated hub layout beyond empty-state onboarding.
- Building full pricing, manifesto, or press routes unless already ready.
- Editing generated brand assets by hand. If an asset must change, update brand source/render pipeline separately.
- Changing the AppShell journey taxonomy or sidebar grouping.
