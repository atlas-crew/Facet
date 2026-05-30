# Sample Data and Fixtures

Facet has several kinds of sample data. They look similar in the tree, but they are meant for different jobs:

| Lane                     | Used by                                                   | Where it lives                                                           | How to use it                                                                                                  |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| In-app sample data       | Product walkthroughs and manual QA                        | `src/store/defaultData.ts`, `src/routes/pipeline/samplePipelineData.ts`  | Click the relevant **Load Sample Data** action in the running app.                                             |
| Dev-only source samples  | Identity extraction smoke tests during local development  | `src/routes/identity/sampleSourceMaterial.ts`                            | Run the dev server, open Identity Workbench, switch to paste mode, and pick a sample from **Load dev sample**. |
| Golden workspace fixture | Cross-workspace contract tests, hosted mocks, local demos | `src/test/fixtures/goldenWorkspace.ts`, `src/dev/goldenDemoWorkspace.ts` | Import the builder or loader from tests and dev-only utilities.                                                |
| Small test fixtures      | Focused Vitest and Playwright coverage                    | `src/test/fixtures/`, `tests/hosted/fixtures.ts`, `tests/fixtures/`      | Import them from tests or builders; they are not product import files.                                         |

All sample data must stay fictional. Do not add real candidates, real job-search targets, private compensation notes, secrets, or customer data.

## In-App Samples

### Build

The Build empty state has **Load Sample Data**. It loads `defaultResumeData` from `src/store/defaultData.ts` through `resumeStore.resetToDefaults()`.

Use it when you want a complete resume workspace with vectors, roles, bullets, skill groups, theme defaults, and page-budget behavior already populated.

Important behavior:

- The action is visible when the Build workspace is empty.
- It writes to the local persisted resume store.
- It replaces the active resume content with the default sample resume and records an undo entry.
- It is not the same as importing a JSON export. Product import expects an exported JSON document, not a TypeScript fixture module.

### Pipeline

The Pipeline empty state has **Load Sample Data**. It imports `samplePipelineData` from `src/routes/pipeline/samplePipelineData.ts`.

Use it when you want several fictional job opportunities with statuses, history, response data, and notes for exploring Pipeline workflows.
The entries include fictional job descriptions and source URLs so JD analysis, resume generation handoff checks, and prep-launch guardrails can be exercised from the sample pipeline.

Important behavior:

- The action replaces the current Pipeline entry list with the sample entries through
  `pipelineStore.importEntries()`.
- The sample entries persist in browser storage like normal pipeline entries.
- You can export the resulting pipeline as JSON from the Pipeline workspace.

### Identity

Identity has a dev-only **Load dev sample** dropdown in the Workbench's **Source Intake** card. It is backed by `SOURCE_MATERIAL_SAMPLES` in `src/routes/identity/sampleSourceMaterial.ts`.

Use it to paste realistic source material into the Identity extraction flow without keeping real resumes in the repo.

Important behavior:

- `/identity` opens the Identity Map. Click **Import from resume** or **Start from a resume** to open `/identity/import`.
- The Source Intake card defaults to upload mode. Click **Paste Source Text** to reveal the sample dropdown.
- The dropdown appears only under `import.meta.env.DEV`, so it is hidden in production builds.
- Selecting a sample only fills the source-material textarea.
- Running extraction after that still follows the normal AI/proxy path.
- The samples intentionally cover different input shapes: clean resume, narrative bio, messy acquisition history, sparse junior resume, and career-changer narrative.

## Test Fixtures

### Golden Workspace Fixture

`src/test/fixtures/goldenWorkspace.ts` exports `buildMayaPatelGoldenWorkspace()`, the
canonical connected fixture for cross-workspace tests. It composes Maya Patel's fictional
Identity model, Research run/result, Pipeline entry, JDAnalysis, generated resume,
cover-letter draft/snapshot, Prep deck/cards, LinkedIn draft, recruiter card, and
Debrief session into one `FacetWorkspaceSnapshot` plus an explicit Identity payload.

Use it when a test needs to prove the product still works as a connected system. Do not
use it for small unit tests where a compact object builder is enough.

Important behavior:

- Identity is stored outside `FacetWorkspaceSnapshot`, so the golden builder returns
  `identity`, `identityStorageEnvelope`, and `hydrateIntoStores()` separately.
- Hosted Playwright mocks can serve the golden snapshot by passing it to
  `installHostedApiMocks()`.
- The dev-only demo loader lives in `src/dev/goldenDemoWorkspace.ts` and imports the
  golden fixture dynamically. It remains available to tests and development utilities,
  but it is not exposed through the removed legacy backup dialog.
- The dev demo path deliberately uses replace semantics for the active local workspace;
  Build and Pipeline route-local **Load Sample Data** actions keep their route-specific
  behavior.

Run the golden checks after changing cross-workspace contracts or the Maya fixture:

```bash
npx vitest run src/test/fixtures/goldenWorkspace.test.ts src/test/fixtures/personas/validate.test.ts src/test/fixtures/personas/validate.negative.test.ts
npx vitest run src/test/goldenDemoWorkspace.test.ts
VITE_FACET_DEPLOYMENT_MODE=hosted npx playwright test tests/hosted/golden-workspace.spec.ts --project=hosted
npm run typecheck -- --pretty false
```

Maintenance rule: update the golden fixture when a workspace relationship changes, such
as Pipeline-owned JDAnalysis IDs, resume/letter/prep links, Research promotion context,
or Debrief identity references. Keep unit fixtures minimal and local to the behavior
under test.

### Identity Fixture

`src/test/fixtures/identityFixture.ts` exports a minimal valid `ProfessionalIdentityV3` plus `cloneIdentityFixture()`.

Use it when a test needs a compact identity model and the details do not matter.

```ts
import { cloneIdentityFixture } from './fixtures/identityFixture'

const identity = cloneIdentityFixture()
identity.identity.name = 'Test Candidate'
```

Prefer the clone helper so tests do not mutate the shared object.

### Persona Fixtures

`src/test/fixtures/personas/` contains richer personas:

- `mayaPatel`
- `marcusKim`
- `dianeOkafor`

Each persona can include identity, resume data, pipeline entries, and prep decks. Use these when the relationship between workspaces matters.

```ts
import { buildMayaPatelPersona } from './fixtures/personas'

const persona = buildMayaPatelPersona()
```

Run the integrity check after editing persona fixtures:

```bash
just test-file src/test/fixtures/personas/validate.test.ts
```

The validator enforces hard integrity errors and prints drift warnings for review. Warnings do not fail the test because some cross-artifact drift may be intentional.

### Workspace Snapshot Fixture

`src/test/fixtures/workspaceSnapshot.ts` builds hosted persistence snapshots for coordinator, import/export, and remote backend tests.

Use `buildWorkspaceSnapshot()` for normal hosted workspace payloads and `buildForgedWorkspaceSnapshot()` when testing server-side metadata rewriting or rejection of client-owned metadata.

Hosted Playwright fixtures in `tests/hosted/fixtures.ts` wrap this snapshot builder with route mocks for account context, workspace directories, entitlements, and persistence responses.

### Resume Scanner Fixtures

Resume scanner coverage uses both synthetic text-item builders and a PDF fixture:

- `src/test/fixtures/resume-scanner/builders.ts`
- `src/test/fixtures/resume-scanner/corpus.ts`
- `tests/fixtures/identity-scanner-unicode.pdf`

Run the focused scanner checks when changing parser behavior:

```bash
just test-file src/test/resumeScannerAcceptance.test.ts
just test-file src/test/resumeScannerPdf.test.ts
```

## Adding New Sample Data

Choose the lane before adding files:

| Need                                                          | Add it to                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A user should click it in the running app                     | Route or store sample data, with UI copy and persistence behavior documented. |
| A developer should test AI extraction input shapes            | `src/routes/identity/sampleSourceMaterial.ts`.                                |
| A contract test needs connected workspace state across routes | `src/test/fixtures/goldenWorkspace.ts`.                                       |
| A unit test needs stable objects                              | `src/test/fixtures/` with builders or clone helpers.                          |
| A hosted browser test needs mocked API responses              | `tests/hosted/fixtures.ts`.                                                   |

Checklist for new fixtures:

- Keep all people, companies, emails, phone numbers, URLs, compensation, and timelines fictional.
- Prefer builders and clone helpers over exporting mutable singleton objects.
- Validate schema-heavy fixtures with focused tests.
- Add the smallest fixture that proves the behavior.
- Do not rely on app import dialogs to load TypeScript fixtures; export JSON from the app if you need a product-level import artifact.

## Quick Local Workflow

```bash
pnpm install
just dev
```

Then use:

- Build empty state -> **Load Sample Data** for the default resume.
- Pipeline empty state -> **Load Sample Data** for job-search entries.
- Identity Map -> **Import from resume** or **Start from a resume** -> **Paste Source Text** -> **Load dev sample** for dev-only extraction inputs.
- Import `loadGoldenDemoWorkspace()` in a local dev utility or focused test when you need the connected golden workspace.

For fixture validation:

```bash
just test-file src/test/fixtures/personas/validate.test.ts
just test-file src/test/resumeScannerAcceptance.test.ts
just test-file src/test/resumeScannerPdf.test.ts
npx vitest run src/test/fixtures/goldenWorkspace.test.ts src/test/goldenDemoWorkspace.test.ts
```
