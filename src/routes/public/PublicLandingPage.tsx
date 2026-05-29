import { useEffect } from 'react'
import { ArrowRight, Github, LockKeyhole, Sparkles, Workflow } from 'lucide-react'
import { signInWithGitHub } from '../../utils/hostedSession'
import './publicLanding.css'

const heroImage = new URL('../../../brand/exports/hero/facet-primary-hero.webp', import.meta.url)
  .href
const methodImage = new URL('../../../brand/exports/method/facet-method-dark.webp', import.meta.url)
  .href
const identityImage = new URL(
  '../../../brand/exports/concepts/facet-identity-dark.webp',
  import.meta.url,
).href
const vectorsImage = new URL(
  '../../../brand/exports/concepts/facet-vectors-dark.webp',
  import.meta.url,
).href
const systemImage = new URL(
  '../../../brand/exports/concepts/facet-system-dark.webp',
  import.meta.url,
).href
const ogImage = new URL('../../../brand/exports/social/facet-og-image-dark.webp', import.meta.url)
  .href

const GITHUB_REPO_URL = 'https://github.com/NickCrew/Facet'
const PRESS_EMAIL = 'mailto:nick@atlascrew.dev'

const landingTitle = 'Facet | Same diamond, different face'
const landingDescription =
  'Facet builds a durable professional model and recuts it into resumes, letters, LinkedIn copy, recruiter cards, and prep for each opportunity.'

type MetaSnapshot = {
  node: HTMLMetaElement
  existed: boolean
  previousAttributes: Record<string, string | null>
}

const upsertMeta = (selector: string, attributes: Record<string, string>): MetaSnapshot => {
  let node = document.head.querySelector<HTMLMetaElement>(selector)
  const existed = Boolean(node)
  if (!node) {
    node = document.createElement('meta')
    document.head.appendChild(node)
  }

  const previousAttributes = Object.fromEntries(
    Object.keys(attributes).map((key) => [key, node?.getAttribute(key) ?? null]),
  )

  Object.entries(attributes).forEach(([key, value]) => node?.setAttribute(key, value))
  return { node, existed, previousAttributes }
}

const restoreMeta = ({ node, existed, previousAttributes }: MetaSnapshot) => {
  if (!existed) {
    node.remove()
    return
  }

  Object.entries(previousAttributes).forEach(([key, value]) => {
    if (value === null) {
      node.removeAttribute(key)
      return
    }

    node.setAttribute(key, value)
  })
}

function PublicLandingMetadata() {
  useEffect(() => {
    const previousTitle = document.title

    document.title = landingTitle
    const metaSnapshots = [
      upsertMeta('meta[name="description"]', {
        name: 'description',
        content: landingDescription,
      }),
      upsertMeta('meta[property="og:title"]', {
        property: 'og:title',
        content: landingTitle,
      }),
      upsertMeta('meta[property="og:description"]', {
        property: 'og:description',
        content: landingDescription,
      }),
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: ogImage,
      }),
      upsertMeta('meta[name="twitter:card"]', {
        name: 'twitter:card',
        content: 'summary_large_image',
      }),
    ]

    return () => {
      document.title = previousTitle
      metaSnapshots.forEach(restoreMeta)
    }
  }, [])

  return null
}

export function PublicLandingPage() {
  const handleSignIn = () => {
    void signInWithGitHub()
  }

  return (
    <main className="public-landing">
      <PublicLandingMetadata />
      <nav className="public-nav" aria-label="Public navigation">
        <a className="public-wordmark" href="/" aria-label="Facet home">
          Facet
        </a>
        <div className="public-nav-links">
          <a href="#method">Method</a>
          <a href="#trust">Trust</a>
          <a href="#pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
        </div>
        <button className="public-nav-cta" type="button" onClick={handleSignIn}>
          <Github size={16} strokeWidth={1.8} aria-hidden="true" />
          Start with GitHub
        </button>
      </nav>

      <section className="public-hero" aria-labelledby="public-hero-title">
        <img className="public-hero-image" src={heroImage} alt="" aria-hidden="true" />
        <div className="public-hero-scrim" aria-hidden="true" />
        <div className="public-hero-content">
          <p className="public-kicker">Same diamond · Different face</p>
          <h1 id="public-hero-title">Facet</h1>
          <p className="public-hero-claim">
            A deep model of you, professionally. <em>Recut for every opportunity.</em>
          </p>
          <p className="public-hero-body">
            Build one durable professional model from your evidence, then recut it into the resume,
            letter, LinkedIn language, recruiter card, and prep surface each role needs.
          </p>
          <div className="public-hero-actions">
            <button className="public-primary-action" type="button" onClick={handleSignIn}>
              <Github size={18} strokeWidth={1.8} aria-hidden="true" />
              Start with GitHub
            </button>
            <a className="public-secondary-action" href={GITHUB_REPO_URL}>
              View source
              <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
          <p className="public-trust-line">Open-source · Your data, never ours</p>
        </div>
      </section>

      <section
        className="public-section public-method"
        id="method"
        aria-labelledby="public-method-title"
      >
        <div className="public-section-copy">
          <p className="public-kicker">Method</p>
          <h2 id="public-method-title">Build the model once. Recut the face for the room.</h2>
          <p>
            Facet keeps the durable substrate separate from each output. Identity, vectors, pipeline
            context, and prep signal stay structured, so every artifact can be revised without
            rewriting the whole story.
          </p>
        </div>
        <img
          className="public-method-image"
          src={methodImage}
          alt="Facet method diagram showing identity, recut, and review phases."
        />
      </section>

      <section className="public-section public-model" aria-labelledby="public-model-title">
        <div className="public-section-copy">
          <p className="public-kicker">Model</p>
          <h2 id="public-model-title">The same evidence powers every cut.</h2>
        </div>
        <div className="public-model-grid">
          <article className="public-model-card">
            <img src={identityImage} alt="" aria-hidden="true" />
            <div>
              <Sparkles size={18} strokeWidth={1.7} aria-hidden="true" />
              <h3>Identity</h3>
              <p>Roles, projects, skills, preferences, and narrative stay in one model.</p>
            </div>
          </article>
          <article className="public-model-card">
            <img src={vectorsImage} alt="" aria-hidden="true" />
            <div>
              <Workflow size={18} strokeWidth={1.7} aria-hidden="true" />
              <h3>Vectors</h3>
              <p>Positioning angles let the same model become different professional faces.</p>
            </div>
          </article>
          <article className="public-model-card">
            <img src={systemImage} alt="" aria-hidden="true" />
            <div>
              <LockKeyhole size={18} strokeWidth={1.7} aria-hidden="true" />
              <h3>System</h3>
              <p>Research, pipeline, prep, and outputs share context instead of drifting apart.</p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="public-section public-trust"
        id="trust"
        aria-labelledby="public-trust-title"
      >
        <div>
          <p className="public-kicker">Trust</p>
          <h2 id="public-trust-title">Open-source. Portable. Built for a serious search.</h2>
        </div>
        <div className="public-trust-grid">
          <article>
            <h3>Your workspace belongs to you.</h3>
            <p>Use the hosted app or self-host under AGPL-3.0. The source is inspectable.</p>
          </article>
          <article id="pricing">
            <h3>$299 per 90-day hosted pass.</h3>
            <p>No subscription. Self-hosting stays free. Refund window is seven days.</p>
          </article>
          <article>
            <h3>Public policies, direct contact.</h3>
            <p>
              Read the <a href="/terms">Terms</a>, <a href="/privacy">Privacy</a>, or{' '}
              <a href={PRESS_EMAIL}>contact Nick</a>.
            </p>
          </article>
        </div>
      </section>

      <section className="public-close" aria-labelledby="public-close-title">
        <p className="public-kicker">Build it once. Recut forever.</p>
        <h2 id="public-close-title">Start with the model.</h2>
        <button className="public-primary-action" type="button" onClick={handleSignIn}>
          <Github size={18} strokeWidth={1.8} aria-hidden="true" />
          Start with GitHub
        </button>
      </section>
    </main>
  )
}
