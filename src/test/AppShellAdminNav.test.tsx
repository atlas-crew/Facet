// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { usePersistenceRuntimeStore } from '../persistence/runtime'
import { useHostedAppStore } from '../store/hostedAppStore'
import { useUiStore } from '../store/uiStore'

const routerMocks = vi.hoisted(() => ({
  currentPath: '/build',
}))

const adminMocks = vi.hoisted(() => ({
  isAdmin: false,
}))

const runtimeMocks = vi.hoisted(() => ({
  getPersistenceRuntimeStart: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="app-shell-outlet">Editor</div>,
  useRouterState: () => ({
    location: {
      pathname: routerMocks.currentPath,
    },
  }),
}))

vi.mock('../hooks/useIsAdmin', () => ({
  useIsAdmin: () => adminMocks.isAdmin,
}))

vi.mock('../persistence/runtime', async () => {
  const actual =
    await vi.importActual<typeof import('../persistence/runtime')>('../persistence/runtime')

  return {
    ...actual,
    getPersistenceRuntime: () => ({
      start: runtimeMocks.getPersistenceRuntimeStart,
    }),
  }
})

vi.mock('../components/FacetWordmark', () => ({
  FacetWordmark: () => <span>Facet</span>,
}))

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof globalThis.ResizeObserver
}

function setPersistenceHydration() {
  usePersistenceRuntimeStore.setState({
    hydrated: true,
    usingLegacyMigration: false,
    status: {
      phase: 'ready',
      backend: 'localStorage',
      activeWorkspaceId: 'facet-local-workspace',
      lastHydratedAt: '2026-03-14T12:00:00.000Z',
      lastSavedAt: '2026-03-14T12:00:00.000Z',
      lastError: null,
    },
  })
}

describe('AppShell admin navigation', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
    routerMocks.currentPath = '/build'
    adminMocks.isAdmin = false
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      mutationState: null,
      endpoint: 'https://facet.example',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
    useUiStore.setState({ appearance: 'light' })
    setPersistenceHydration()
  })

  afterEach(() => {
    cleanup()
  })

  it('hides the admin sidebar entry for non-admin sessions', () => {
    render(<AppShell />)

    const sidebarNav = document.querySelector('.sidebar-nav') as HTMLElement
    expect(within(sidebarNav).queryByRole('link', { name: /^Admin$/i })).toBeNull()
  })

  it('shows the admin sidebar entry and route context for admin sessions', () => {
    adminMocks.isAdmin = true
    routerMocks.currentPath = '/admin'

    render(<AppShell />)

    const sidebarNav = document.querySelector('.sidebar-nav') as HTMLElement
    expect(within(sidebarNav).getByRole('link', { name: /^Admin$/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeTruthy()
    expect(document.querySelector('.app-topbar-eyebrow')?.textContent).toBe('Platform Admin')
  })
})
