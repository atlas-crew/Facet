import { lazy } from 'react'
import { createRouter, createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { BuildPage } from './routes/build/BuildPage'
import { PipelinePage } from './routes/pipeline/PipelinePage'
import { PrepPage } from './routes/prep/PrepPage'
import { LettersPage } from './routes/letters/LettersPage'

const LazyHelpPage = lazy(() => import('./routes/help/HelpPage').then((m) => ({ default: m.HelpPage })))

const rootRoute = createRootRoute({
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/build' })
  },
})

const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/build',
  component: BuildPage,
})

const pipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pipeline',
  component: PipelinePage,
})

const prepRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prep',
  component: PrepPage,
  validateSearch: (search: Record<string, unknown>) => ({
    vector: (search.vector as string) ?? '',
    skills: (search.skills as string) ?? '',
    q: (search.q as string) ?? '',
  }),
})

const lettersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/letters',
  component: LettersPage,
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: LazyHelpPage,
})

const routeTree = rootRoute.addChildren([indexRoute, buildRoute, pipelineRoute, prepRoute, lettersRoute, helpRoute])

export const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
