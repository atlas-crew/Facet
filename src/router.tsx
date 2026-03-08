import { createRouter, createRootRoute, createRoute, redirect } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { BuildPage } from './routes/build/BuildPage'
import { PipelinePage } from './routes/pipeline/PipelinePage'
import { PrepPage } from './routes/prep/PrepPage'

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

const routeTree = rootRoute.addChildren([indexRoute, buildRoute, pipelineRoute, prepRoute])

export const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
