import { Link } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, FileText, Fingerprint, Layers, ListChecks, MessageSquareQuote, Target } from 'lucide-react'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useDebriefStore } from '../../store/debriefStore'
import { useIdentityStore } from '../../store/identityStore'
import { useLinkedInStore } from '../../store/linkedinStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import { facetClientEnv } from '../../utils/facetEnv'
import './home.css'

const AI_ENABLED = Boolean(facetClientEnv.anthropicProxyUrl)

const START_OPTIONS = [
  {
    to: '/identity' as const,
    label: 'Start from Resume',
    eyebrow: 'Most common entry point',
    body: 'Upload a resume, scan it into identity.json, and deepen bullets in place.',
    accent: 'identity',
  },
  {
    to: '/match' as const,
    label: 'Start from Job Description',
    eyebrow: 'Target a role first',
    body: 'Paste a JD, score your fit, and decide what the resume needs before editing.',
    accent: 'match',
  },
  {
    to: '/build' as const,
    label: 'Open Resume Builder',
    eyebrow: 'Direct editing',
    body: 'Jump straight into vectors, components, and assembly when you already know the story.',
    accent: 'build',
  },
] as const

const WORKFLOW_STEPS = [
  {
    title: 'Identity',
    detail: 'Scan a resume or paste source material, then refine the model.',
    to: '/identity' as const,
    icon: Fingerprint,
  },
  {
    title: 'Match',
    detail: 'Compare the model against a JD and extract advantages, gaps, and positioning.',
    to: '/match' as const,
    icon: Target,
  },
  {
    title: 'Build',
    detail: 'Assemble the resume with vectors and component controls.',
    to: '/build' as const,
    icon: Layers,
  },
  {
    title: 'Outputs',
    detail: 'Generate letters, LinkedIn, and recruiter-facing material from the same source of truth.',
    to: '/letters' as const,
    icon: FileText,
  },
  {
    title: 'Debrief',
    detail: 'Capture feedback and feed winning stories back into identity.',
    to: '/debrief' as const,
    icon: MessageSquareQuote,
  },
] as const

const countPopulatedOutputs = (counts: number[]) => counts.reduce((total, value) => total + value, 0)

const getResumeRoute = ({
  hasIdentityWork,
  hasMatchWork,
  pipelineCount,
  coverLetterCount,
  linkedInCount,
  recruiterCount,
  debriefCount,
}: {
  hasIdentityWork: boolean
  hasMatchWork: boolean
  pipelineCount: number
  coverLetterCount: number
  linkedInCount: number
  recruiterCount: number
  debriefCount: number
}) => {
  if (hasIdentityWork) {
    return {
      to: '/identity' as const,
      label: 'Resume identity work',
      description: 'Continue scanning, editing, or deepening your identity model.',
    }
  }

  if (hasMatchWork) {
    return {
      to: '/match' as const,
      label: 'Resume job match',
      description: 'Continue with the current JD and scoring report.',
    }
  }

  if (pipelineCount > 0) {
    return {
      to: '/pipeline' as const,
      label: 'Resume pipeline',
      description: 'Continue tracking active opportunities and linked materials.',
    }
  }

  if (coverLetterCount > 0) {
    return {
      to: '/letters' as const,
      label: 'Resume cover letters',
      description: 'Continue editing saved cover letter drafts.',
    }
  }

  if (linkedInCount > 0) {
    return {
      to: '/linkedin' as const,
      label: 'Resume LinkedIn drafts',
      description: 'Continue editing saved LinkedIn profile drafts.',
    }
  }

  if (recruiterCount > 0) {
    return {
      to: '/recruiter' as const,
      label: 'Resume recruiter cards',
      description: 'Continue refining recruiter-facing one-pagers.',
    }
  }

  if (debriefCount > 0) {
    return {
      to: '/debrief' as const,
      label: 'Resume interview debriefs',
      description: 'Continue reviewing interview feedback and story gaps.',
    }
  }

  return null
}

export function HomePage() {
  const sourceMaterial = useIdentityStore((state) => state.sourceMaterial)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const draft = useIdentityStore((state) => state.draft)
  const scanResult = useIdentityStore((state) => state.scanResult)
  const currentReport = useMatchStore((state) => state.currentReport)
  const jobDescription = useMatchStore((state) => state.jobDescription)
  const pipelineCount = usePipelineStore((state) => state.entries.length)
  const coverLetterCount = useCoverLetterStore((state) => state.templates.length)
  const linkedInCount = useLinkedInStore((state) => state.drafts.length)
  const recruiterCount = useRecruiterStore((state) => state.cards.length)
  const debriefCount = useDebriefStore((state) => state.sessions.length)

  const hasIdentityWork = Boolean(
    sourceMaterial.trim() ||
      currentIdentity ||
      draft ||
      scanResult,
  )
  const hasMatchWork = Boolean(currentReport || jobDescription.trim())
  const outputCount = countPopulatedOutputs([
    coverLetterCount,
    linkedInCount,
    recruiterCount,
    debriefCount,
  ])

  const resumeRoute = getResumeRoute({
    hasIdentityWork,
    hasMatchWork,
    pipelineCount,
    coverLetterCount,
    linkedInCount,
    recruiterCount,
    debriefCount,
  })

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">Resume operating system</p>
          <h2>A place to start. A place to resume.</h2>
          <p className="home-lede">
            Facet turns resumes, job descriptions, and interview feedback into one connected
            workflow. Start with the artifact you already have.
          </p>
          <div className="home-hero-actions">
            {resumeRoute ? (
              <Link className="home-btn home-btn-primary" to={resumeRoute.to}>
                Resume Where You Left Off
                <ArrowRight size={16} strokeWidth={1.75} />
              </Link>
            ) : null}
            <Link className="home-btn home-btn-secondary" to="/identity">
              Start from Resume
            </Link>
          </div>
          {resumeRoute ? <p className="home-resume-copy">{resumeRoute.description}</p> : null}
          {!AI_ENABLED ? (
            <p className="home-ai-note">
              AI-assisted routes are available when <code>VITE_ANTHROPIC_PROXY_URL</code> is configured.
            </p>
          ) : null}
        </div>

        <div className="home-signal-panel" aria-label="Workspace summary">
          <div className="home-signal-card">
            <span className="home-signal-label">Identity</span>
            <strong>
              {scanResult
                ? `${scanResult.counts.deepenedBullets}/${scanResult.counts.bullets} bullets deepened`
                : currentIdentity
                  ? `${currentIdentity.roles.length} roles modeled`
                  : 'Add your resume to begin'}
            </strong>
            <p>
              {scanResult
                ? `${scanResult.fileName} scanned locally`
                : sourceMaterial.trim()
                  ? 'Source material saved and ready to process'
                  : 'Upload a resume or paste source material to build your identity model'}
            </p>
          </div>
          <div className="home-signal-card">
            <span className="home-signal-label">Match</span>
            <strong>
              {currentReport
                ? `${Math.round(currentReport.matchScore * 100)}% fit score`
                : jobDescription.trim()
                  ? 'JD loaded'
                  : 'Paste a JD to start scoring'}
            </strong>
            <p>
              {currentReport
                ? `${currentReport.role} at ${currentReport.company}`
                : 'Compare your identity model against a target job description'}
            </p>
          </div>
          <div className="home-signal-card">
            <span className="home-signal-label">Pipeline</span>
            <strong>{pipelineCount}</strong>
            <p>{pipelineCount === 1 ? 'Active opportunity tracked' : 'Active opportunities tracked'}</p>
          </div>
          <div className="home-signal-card">
            <span className="home-signal-label">Outputs</span>
            <strong>{outputCount}</strong>
            <p>Letters, LinkedIn drafts, recruiter cards, and debrief sessions saved</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <p className="home-eyebrow">Workflow</p>
          <h3>The full loop, in order.</h3>
        </div>
        <div className="home-flow">
          {WORKFLOW_STEPS.map(({ title, detail, to, icon: Icon }) => (
            <Link key={title} className="home-flow-step" to={to}>
              <div className="home-flow-icon">
                <Icon size={18} strokeWidth={1.6} />
              </div>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <p className="home-eyebrow">Entry points</p>
          <h3>Choose the artifact you have right now.</h3>
        </div>
        <div className="home-cta-grid">
          {START_OPTIONS.map((option) => (
            <Link
              key={option.to}
              className={`home-cta-card home-cta-card-${option.accent}`}
              to={option.to}
            >
              <span className="home-cta-eyebrow">{option.eyebrow}</span>
              <strong>{option.label}</strong>
              <p>{option.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <p className="home-eyebrow">What ships from here</p>
          <h3>One source of truth, multiple downstream outputs.</h3>
        </div>
        <div className="home-output-grid">
          <Link className="home-output-card" to="/letters">
            <FileText size={18} strokeWidth={1.6} />
            <div>
              <strong>Cover letters</strong>
              <p>Generate targeted drafts from identity and match context.</p>
            </div>
          </Link>
          <Link className="home-output-card" to="/linkedin">
            <ListChecks size={18} strokeWidth={1.6} />
            <div>
              <strong>LinkedIn profile</strong>
              <p>Convert the same signals into headline, about, and role summaries.</p>
            </div>
          </Link>
          <Link className="home-output-card" to="/recruiter">
            <BadgeCheck size={18} strokeWidth={1.6} />
            <div>
              <strong>Recruiter card</strong>
              <p>Produce a short recruiter-facing overview without rewriting the whole resume.</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
