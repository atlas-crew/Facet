/**
 * Fictional source-material samples for development and dev-only testing
 * of the identity extraction pipeline. Each variant exercises a distinct
 * input shape so the LLM-driven `generateIdentityDraft` can be compared
 * across realistic-but-unrelated inputs.
 *
 * Names, companies, and details are deliberately fictional. None of these
 * resemble any real person.
 */

export interface SourceMaterialSample {
  id: string
  label: string
  /** One-line summary of what this variant stresses about extraction. */
  description: string
  /** The raw input text exactly as it would be pasted into the textarea. */
  text: string
}

const cleanStructuredResume = `LIA SCHOENBERG
lia.schoenberg@example.com | (555) 010-2734 | Brooklyn, NY
linkedin.com/in/lia-schoenberg | github.com/liaschoenberg

SUMMARY
Platform engineer with 8 years building internal developer tooling and
deployment infrastructure for product engineering teams of 30 to 200.
Most fluent in Kubernetes, Go, and CI/CD systems. Drawn to teams where
the platform's success is measured by what other engineers can ship.

EXPERIENCE
Senior Platform Engineer | Northstar Cloud | Mar 2022 – Present
• Led the migration of CI/CD from Jenkins to a GitHub Actions monorepo,
  cutting median deploy time from 47 minutes to 9 and eliminating ~60% of
  pipeline-flake-related on-call pages.
• Designed and shipped a self-service preview-environment system using
  namespace-per-PR isolation; adoption reached 85% of product teams within
  two quarters.
• Owned migration of secrets management from per-app Hashicorp Vault to a
  centralized SSO-bound secret broker; reduced credential rotation toil
  from quarterly all-hands events to opt-in self-service.

Platform Engineer | Helios Security | Jul 2018 – Feb 2022
• Built the company's first Kubernetes-based runtime for security agents,
  replacing a legacy ECS deployment that caused weekly stability incidents.
• Wrote the internal SDK product engineers used to integrate with security
  pipelines; reduced typical integration time from 2 weeks to 1 day.
• Owned the on-call rotation for the platform team for 18 months;
  authored the runbooks the team still uses.

SKILLS
Languages: Go, TypeScript, Python
Infrastructure: Kubernetes, Terraform, AWS, GitHub Actions
Observability: Datadog, OpenTelemetry, Honeycomb

EDUCATION
B.S. Computer Science, University of Vermont, 2018
`

const narrativeLinkedInBio = `I'm a backend engineer who has spent the last decade quietly making
other engineers faster, mostly by removing friction nobody wanted to
admit was there. I started out at Velocity Labs in 2015 building
internal tools — the kind of work nobody asks for but everyone uses —
and that is where I learned my actual taste: the platform's job is to
make the easy thing the right thing, not the other way around.

After three years at Velocity I joined a small team at Coralreef
Fintech that was rebuilding their payment-processing platform. I ran
the migration off a legacy SOAP-based system to a gRPC mesh over the
course of about 18 months, which is the most stressful and best work
I have done. We brought median p99 latency from 1.2s to under 200ms
and cut the active-incident rate by something like 70%. The thing I
am proudest of is that almost none of that work was visible from the
outside. Product teams just shipped faster.

For the last two years I have been at Northstar Cloud as a staff
platform engineer, owning the developer-experience track. The work I
care most about right now is building tooling that makes LLM-assisted
code review actually trustworthy in regulated environments — most of
what is out there breaks the moment it touches PHI or anything
resembling a compliance perimeter.

My background outside engineering: I studied music composition at
Oberlin before falling into software writing scripting tools for a
synthesizer manufacturer in 2014. The pattern of "make the platform
invisible so the artist can focus" is genuinely the through-line of
my career.
`

const messyMultiRoleResume = `JORDAN PARKER
jordan.parker@example.com  •  Denver, CO  •  github.com/jparker-dev

PROFESSIONAL EXPERIENCE

Helios Security (acquired by Contoso Networks, Feb 2025)
Senior Platform Engineer  Jan 2022 – Feb 2025
- Built the unified sensor management CLI used by ~40 deployment
  engineers, consolidating four legacy tools into one. Adopted by all
  customer-facing teams within 6mo of release.
- Designed the kernel-level telemetry pipeline that processes ~50K
  events/sec at p99 latency under 500ms. Required a custom backpressure
  scheme because off-the-shelf tools could not maintain ordering
  guarantees during rule reloads.

Contoso Networks (acquired Helios Security, Feb 2025)
Senior Platform Engineer  Feb 2025 - Present
* Continuing the Helios platform work post-acquisition; ported the
  runtime to Contoso's Kubernetes-based delivery system.
* Wrote the internal RFC for unifying the two companies' detection-rule
  formats; led the consolidation effort across 3 engineering pods.

Velocity Labs · Aug 2019 — Dec 2021
Backend Engineer
• Diagnosed and fixed a kernel-level connection-table exhaustion bug
  that was capping ingestion at ~200K RPS. Built a distributed
  load-testing framework from scratch to reproduce the failure mode
  under realistic conditions; brought the system to ~850K RPS sustained.
• Owned the v2 -> v3 migration of the public ingestion API. Wrote the
  compatibility shim that ran both versions in parallel for 4 months.

SKILLS  ·  Languages: Rust, Go, Python  ·  Infra: Kubernetes, eBPF, AWS

EDUCATION  ·  B.S. Electrical Engineering, Colorado School of Mines, 2019
`

const sparseJuniorResume = `ALEX DEAN
alex.dean@example.com | Portland, OR

EXPERIENCE

Backend Engineer · Coralreef Fintech · Aug 2024 – Present
• Built features in the customer-facing payments API alongside a senior
  engineer.
• Helped debug production issues during on-call rotation.
• Wrote unit tests and integration tests for new endpoints.

EDUCATION
B.S. Computer Science, Portland State University, 2024
GPA: 3.7

SKILLS
TypeScript, Node.js, PostgreSQL, Git
`

const seniorBackendResume = `PRIYA NAND
priya.nand@example.com | (555) 010-8842 | Austin, TX
linkedin.com/in/priya-nand | github.com/priyanand-systems

SUMMARY
Senior backend engineer with 12 years building distributed services,
data platforms, and reliability programs for product organizations
scaling from early revenue to multi-region operations. Strongest in
Go, Python, PostgreSQL, Kafka, and AWS. Known for turning ambiguous
platform problems into boring, well-owned systems.

EXPERIENCE
Senior Backend Engineer | Meridian Ledger | Apr 2021 – Present
• Led the redesign of the ledger posting service from synchronous
  writes to an event-sourced pipeline, increasing sustained posting
  throughput from 1.8K to 14K transactions/sec while preserving
  auditability and exactly-once reconciliation semantics.
• Built the service ownership model for 27 backend services: SLOs,
  runbooks, escalation policies, dependency maps, and quarterly
  reliability reviews. Critical incident volume dropped 42% over
  three quarters.
• Designed the migration plan from a single-region PostgreSQL cluster
  to active-passive regional failover. Ran two full production
  failover exercises with less than 7 minutes of write downtime.
• Mentored six mid-level engineers through design reviews, incident
  analysis, and promotion packets; three were promoted within 18 months.

Backend Engineer | OrbitWorks | Jun 2016 – Mar 2021
• Owned the billing orchestration service used by every product line,
  processing ~$80M in annualized subscription volume with idempotent
  retries, dead-letter recovery, and backfill tooling.
• Replaced a nightly batch fulfillment workflow with streaming
  workers backed by Kafka, reducing customer-visible entitlement
  delays from hours to under 90 seconds.
• Introduced contract testing for partner APIs after a breaking
  schema change caused a two-day incident; prevented five later
  regressions before deploy.

Software Engineer | Blue Anvil Analytics | Aug 2012 – May 2016
• Built Python ingestion services for high-volume customer telemetry,
  including schema normalization, deduplication, and replay tooling.
• Partnered with data science to productionize scoring jobs that
  moved from notebooks to scheduled, observable pipelines.

SKILLS
Languages: Go, Python, TypeScript, SQL
Data: PostgreSQL, Kafka, Redis, Snowflake
Infrastructure: AWS, Terraform, Kubernetes, Docker
Practices: Event sourcing, SLOs, incident response, design reviews

EDUCATION
B.S. Computer Science, University of Texas at Austin, 2012
`

const staffInfrastructureResume = `MATEO RIVAS
mateo.rivas@example.com | Seattle, WA | linkedin.com/in/mateo-rivas

STAFF SOFTWARE ENGINEER - INFRASTRUCTURE AND DEVELOPER EXPERIENCE

I build the connective tissue that lets product teams ship safely:
deployment systems, observability strategy, platform APIs, and the
social contracts that keep them usable after launch.

EXPERIENCE

Staff Software Engineer | Kiteframe Systems | Jan 2022 – Present
Scope: technical lead for the 11-person Infrastructure Enablement group
supporting 140 product engineers across payments, messaging, and data
workflows.

- Drove the two-year migration from hand-managed Kubernetes manifests to
  a paved-road deployment platform with service templates, policy checks,
  and automated rollback. Weekly deploys grew from ~280 to ~1,900 while
  change-failure rate fell from 18% to 6%.
- Created the architecture review process for cross-service changes:
  lightweight RFCs, dependency-risk scoring, and explicit owner handoffs.
  Reduced review cycle time from a median of 12 days to 4 without
  dropping reliability checks.
- Designed the internal control plane API used by product teams to
  provision queues, secrets, service identities, and dashboards from a
  single declarative spec.
- Led the post-incident program after a multi-region outage. Rebuilt the
  escalation path, added synthetic dependency checks, and moved the
  company from incident writeups to tracked remediation plans.

Senior Platform Engineer | Harbor Relay | Sep 2017 – Dec 2021
- Built the first company-wide observability baseline: OpenTelemetry
  tracing, golden-signal dashboards, and log correlation across 60+
  services.
- Reworked CI for a 900-package monorepo, reducing median validation
  time from 52 minutes to 11 through test partitioning, remote caching,
  and ownership-aware change detection.
- Partnered with security engineering to move service-to-service auth
  from shared tokens to workload identity with gradual rollout and
  compatibility shims.

Software Engineer | North Pier Robotics | Jul 2013 – Aug 2017
- Developed Python and C++ services for fleet telemetry ingestion,
  command dispatch, and operator-facing diagnostics.
- Built simulation replay tooling that let engineers reproduce field
  failures from sensor logs instead of relying on manual bug reports.

TECHNICAL DEPTH
Kubernetes, Go, Python, TypeScript, Terraform, OpenTelemetry, Buildkite,
PostgreSQL, Redis, Linux, distributed tracing, CI/CD architecture,
developer platforms, reliability programs

LEADERSHIP
Staff-level design reviews, mentorship, incident leadership, platform
roadmapping, cross-functional planning with security and product teams

EDUCATION
B.S. Computer Engineering, University of Washington
`

const careerChangerNarrative = `For sixteen years before I wrote a line of production code, I was a
labor and delivery nurse — eight at a teaching hospital in Boston,
eight at a county hospital in Oakland. I left clinical practice in
2019 because I had been spending my off-hours building scheduling
tools for our nurse-manager team in Python, and one of my friends
pointed out I had basically taught myself the job already.

My first engineering role was at Velocity Labs — backend on a
healthcare analytics product. I think they hired me because I was
the only candidate who had actually used the kind of EHR systems
they were trying to interface with, but I had to scramble for a
year to get to where my CS-trained coworkers started.

I moved to Coralreef in 2022 to work on patient-facing tools for
community clinics. Two years there, mostly on access-control and
consent-flow code, which is the part of healthtech I find most
interesting — the intersection where the law and the architecture
and the human user all have to agree on what is about to happen.

The through-line of my career, both halves: I work on systems where
the person on the other side of the screen is in a vulnerable
position, and the consequences of getting the design wrong are not
theoretical. I think that is an unusual perspective in software and
I lean into it.

Right now I am looking for a senior backend role at a healthtech or
healthcare-adjacent company where the technical problems are real
and the team takes the user side of the work seriously. I do not
want to leave healthcare, but I do not want to be a single-domain
engineer either.
`

export const SOURCE_MATERIAL_SAMPLES: SourceMaterialSample[] = [
  {
    id: 'clean-structured-resume',
    label: 'Clean structured resume',
    description:
      'Standard sections, dates aligned, bullets with concrete impact and metrics. Baseline for "is the extractor working at all?"',
    text: cleanStructuredResume,
  },
  {
    id: 'narrative-linkedin-bio',
    label: 'Narrative LinkedIn bio',
    description:
      'First-person prose with no headings; roles must be inferred from sentences. Stresses thesis/origin/elaboration extraction over chronology.',
    text: narrativeLinkedInBio,
  },
  {
    id: 'messy-multi-role-resume',
    label: 'Messy multi-role resume',
    description:
      'Acquisition with overlapping companies on the same dates, mixed bullet markers, inconsistent date formats, inline skills/education. Stresses the structural parser.',
    text: messyMultiRoleResume,
  },
  {
    id: 'sparse-junior-resume',
    label: 'Sparse junior-engineer resume',
    description:
      'One short role, no measurable outcomes, generic verbs. Tests whether the extractor hallucinates impact when the source has none.',
    text: sparseJuniorResume,
  },
  {
    id: 'senior-backend-resume',
    label: 'Senior backend resume',
    description:
      'Senior engineer with multi-role backend ownership, reliability work, mentoring, and concrete system metrics. Good primary sample for senior-engineer extraction.',
    text: seniorBackendResume,
  },
  {
    id: 'staff-infrastructure-resume',
    label: 'Staff infrastructure resume',
    description:
      'Staff/principal-style infrastructure resume with scope, platform strategy, architecture process, and cross-team leadership signals.',
    text: staffInfrastructureResume,
  },
  {
    id: 'career-changer-narrative',
    label: 'Career-changer narrative',
    description:
      'Long arc with non-engineering origin. The thesis and origin fields are the most semantically loaded; chronology is a secondary signal.',
    text: careerChangerNarrative,
  },
]
