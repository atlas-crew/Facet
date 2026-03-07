import { useEffect } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Layers, ListChecks, BookOpen, Moon, Sun, Monitor } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { FacetMark } from './FacetWordmark'

const CURRENT_YEAR = new Date().getFullYear()

const NAV_ITEMS = [
  { to: '/build' as const, icon: Layers, label: 'Build' },
  { to: '/pipeline' as const, icon: ListChecks, label: 'Pipeline' },
  { to: '/prep' as const, icon: BookOpen, label: 'Prep' },
] as const

export function AppShell() {
  const { appearance, setAppearance } = useUiStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  // ── Global appearance management ──────────────────────────
  useEffect(() => {
    const root = document.documentElement
    if (appearance === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = (event: MediaQueryListEvent | { matches: boolean }) => {
        root.setAttribute('data-theme', event.matches ? 'dark' : 'light')
      }
      updateTheme(mediaQuery)
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
    root.setAttribute('data-theme', appearance)
  }, [appearance])

  const cycleAppearance = () =>
    setAppearance(
      appearance === 'system' ? 'light' : appearance === 'light' ? 'dark' : 'system',
    )

  return (
    <div className="app-root">
      <nav className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <Link to="/build" className="sidebar-brand" aria-label="Facet home">
            <FacetMark size={22} />
          </Link>
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`sidebar-nav-item ${currentPath.startsWith(to) ? 'active' : ''}`}
              title={label}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="sidebar-nav-label">{label}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button
            className="sidebar-nav-item"
            type="button"
            onClick={cycleAppearance}
            aria-label={`Theme: ${appearance}`}
            title={`Theme: ${appearance}`}
          >
            {appearance === 'dark' ? (
              <Moon size={18} strokeWidth={1.5} />
            ) : appearance === 'light' ? (
              <Sun size={18} strokeWidth={1.5} />
            ) : (
              <Monitor size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      <div className="app-content-column">
        <div className="app-main">
          <Outlet />
        </div>

        <footer className="app-footer">
          <span>&copy; {CURRENT_YEAR} Nicholas Crew Ferguson</span>
          <nav className="app-footer-links" aria-label="Footer links">
            <a href="https://github.com/NickCrew/Facet" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/NickCrew/Facet/issues" target="_blank" rel="noopener noreferrer">
              Report an Issue
            </a>
          </nav>
        </footer>
      </div>
    </div>
  )
}
