import { useCallback } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { MermaidBlock } from './MermaidBlock'
import './help.css'

// ── Raw markdown imports ────────────────────────
import gettingStartedMd from '../../../docs/user-guides/getting-started.md?raw'
import vectorsMd from '../../../docs/user-guides/vectors.md?raw'
import componentsMd from '../../../docs/user-guides/components.md?raw'
import prioritiesMd from '../../../docs/user-guides/priorities-and-overrides.md?raw'
import textVariantsMd from '../../../docs/user-guides/text-variants.md?raw'
import previewExportMd from '../../../docs/user-guides/preview-and-export.md?raw'
import pageBudgetMd from '../../../docs/user-guides/page-budget.md?raw'
import bulletOrderingMd from '../../../docs/user-guides/bullet-ordering.md?raw'
import presetsMd from '../../../docs/user-guides/presets.md?raw'
import designThemesMd from '../../../docs/user-guides/design-and-themes.md?raw'

// ── Guide registry (NAVIGATOR.md reading order) ─
const GUIDES = [
  { slug: 'getting-started', title: 'Getting Started', file: gettingStartedMd },
  { slug: 'vectors', title: 'Vectors', file: vectorsMd },
  { slug: 'components', title: 'Components', file: componentsMd },
  { slug: 'priorities-and-overrides', title: 'Priorities & Overrides', file: prioritiesMd },
  { slug: 'text-variants', title: 'Text Variants', file: textVariantsMd },
  { slug: 'preview-and-export', title: 'Preview & Export', file: previewExportMd },
  { slug: 'page-budget', title: 'Page Budget', file: pageBudgetMd },
  { slug: 'bullet-ordering', title: 'Bullet Ordering', file: bulletOrderingMd },
  { slug: 'presets', title: 'Presets', file: presetsMd },
  { slug: 'design-and-themes', title: 'Design & Themes', file: designThemesMd },
] as const

// Map doc filenames to slugs for link rewriting
const FILENAME_TO_SLUG = new Map(
  GUIDES.map((g) => [`${g.slug}.md`, g.slug]),
)

// ── Custom markdown components ──────────────────
function makeComponents(onNavigate: (slug: string) => void): Components {
  return {
    // Render mermaid code blocks as diagrams
    code({ className, children, ...props }) {
      const match = /language-mermaid/.exec(className || '')
      if (match) {
        return <MermaidBlock code={String(children).trim()} />
      }

      // If inside a <pre>, render as-is (block code)
      // react-markdown wraps block code in <pre><code>
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },

    // Rewrite relative doc links to in-app navigation
    a({ href, children, ...props }) {
      if (href) {
        // Handle relative .md links → in-app guide navigation
        const mdMatch = href.match(/^(?:\.\/)?([a-z-]+\.md)(?:#.*)?$/)
        if (mdMatch) {
          const slug = FILENAME_TO_SLUG.get(mdMatch[1])
          if (slug) {
            return (
              <a
                href={`/help?guide=${slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate(slug)
                }}
                {...props}
              >
                {children}
              </a>
            )
          }
        }
      }

      // External links open in new tab
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      )
    },

    // Strip screenshot placeholder images
    img() {
      return null
    },
  }
}

// ── HelpPage Component ──────────────────────────
export function HelpPage() {
  const routerState = useRouterState()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(routerState.location.searchStr)
  const activeSlug = searchParams.get('guide') || 'getting-started'
  const activeGuide = GUIDES.find((g) => g.slug === activeSlug) ?? GUIDES[0]

  const handleNavigate = useCallback(
    (slug: string) => {
      navigate({ to: `/help?guide=${slug}` as '/help' })
      // Scroll content area to top
      document.querySelector('.help-content')?.scrollTo(0, 0)
    },
    [navigate],
  )

  const components = makeComponents(handleNavigate)

  return (
    <div className="help-layout">
      <aside className="help-toc">
        <div className="help-toc-header">
          <h2>User Guides</h2>
        </div>
        <nav className="help-toc-list" aria-label="Guide navigation">
          {GUIDES.map((guide) => (
            <button
              key={guide.slug}
              className={`help-toc-item ${guide.slug === activeGuide.slug ? 'active' : ''}`}
              onClick={() => handleNavigate(guide.slug)}
              type="button"
            >
              {guide.title}
            </button>
          ))}
        </nav>
      </aside>

      <main className="help-content">
        <article className="help-prose">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {activeGuide.file}
          </Markdown>
        </article>
      </main>
    </div>
  )
}
