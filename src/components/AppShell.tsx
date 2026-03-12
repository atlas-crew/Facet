import { useEffect, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Layers, ListChecks, Search, BookOpen, FileText, HelpCircle, Moon, Sun, Monitor } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { getPersistenceRuntime, usePersistenceRuntimeStore } from '../persistence/runtime'
import { FacetGemMark } from './FacetWordmark'
import { WorkspaceBackupDialog } from './WorkspaceBackupDialog'

const CURRENT_YEAR = new Date().getFullYear()

const NAV_ITEMS = [
  { to: '/build' as const, icon: Layers, label: 'Build' },
  { to: '/pipeline' as const, icon: ListChecks, label: 'Pipeline' },
  { to: '/research' as const, icon: Search, label: 'Research' },
  { to: '/prep' as const, icon: BookOpen, label: 'Prep' },
  { to: '/letters' as const, icon: FileText, label: 'Letters' },
] as const

export function AppShell() {
  const { appearance, setAppearance } = useUiStore()
  const persistenceState = usePersistenceRuntimeStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [backupOpen, setBackupOpen] = useState(false)

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

  useEffect(() => {
    void getPersistenceRuntime().start().catch((error) => {
      console.error('[persistence-runtime]', error)
    })
  }, [])

  const cycleAppearance = () =>
    setAppearance(
      appearance === 'system' ? 'light' : appearance === 'light' ? 'dark' : 'system',
    )

  const syncLabelByPhase: Partial<Record<typeof persistenceState.status.phase, string>> = {
    saving: 'Saving',
    saved: 'Saved',
    error: 'Sync error',
    offline: 'Offline',
  }
  const syncLabel =
    syncLabelByPhase[persistenceState.status.phase] ??
    (persistenceState.hydrated ? 'Ready' : 'Starting')

  return (
    <div className="app-root">
      <nav className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <Link to="/build" className="sidebar-brand" aria-label="Facet home">
            <FacetGemMark size={22} />
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
          <Link
            to="/help"
            className={`sidebar-nav-item ${currentPath.startsWith('/help') ? 'active' : ''}`}
            title="Help"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
          </Link>
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
          {persistenceState.hydrated ? (
            <Outlet />
          ) : (
            <div role="status" aria-live="polite">
              Loading workspace...
            </div>
          )}
        </div>

        <footer className="app-footer">
          <span>&copy; {CURRENT_YEAR} Nicholas Crew Ferguson</span>
          <span
            role="status"
            aria-live="polite"
            title={persistenceState.status.lastSavedAt ?? undefined}
          >
            Sync: {syncLabel}
          </span>
          <nav className="app-footer-links" aria-label="Footer links">
            <button type="button" className="app-footer-link-button" onClick={() => setBackupOpen(true)}>
              Backup
            </button>
            <Link to="/help">Docs</Link>
            <a href="https://github.com/NickCrew/Facet" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/NickCrew/Facet/issues" target="_blank" rel="noopener noreferrer">
              Report an Issue
            </a>
          </nav>
        </footer>
      </div>

      <WorkspaceBackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}
