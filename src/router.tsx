import { lazy } from 'react'
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { BuildPage } from './routes/build/BuildPage'
import { PipelinePage } from './routes/pipeline/PipelinePage'
import { RecruiterPage } from './routes/recruiter/RecruiterPage'

const LazyHomePage = lazy(() => import('./routes/home/HomePage').then((m) => ({ default: m.HomePage })))
// AI-dependent routes — lazy-loaded so they code-split into separate chunks
const LazyIdentityPage = lazy(() => import('./routes/identity/IdentityPage').then((m) => ({ default: m.IdentityPage })))
const LazyIdentityEnrichmentPage = lazy(() =>
  import('./routes/identity/IdentityEnrichmentPage').then((m) => ({ default: m.IdentityEnrichmentPage })),
)
const LazyIdentityEnrichmentSkillPage = lazy(() =>
  import('./routes/identity/IdentityEnrichmentSkillPage').then((m) => ({
    default: m.IdentityEnrichmentSkillPage,
  })),
)
const LazyMatchPage = lazy(() => import('./routes/match/MatchPage').then((m) => ({ default: m.MatchPage })))
const LazyResearchPage = lazy(() => import('./routes/research/ResearchPage').then((m) => ({ default: m.ResearchPage })))
const LazyPrepPage = lazy(() => import('./routes/prep/PrepPage').then((m) => ({ default: m.PrepPage })))
const LazyLettersPage = lazy(() => import('./routes/letters/LettersPage').then((m) => ({ default: m.LettersPage })))
const LazyLinkedInPage = lazy(() => import('./routes/linkedin/LinkedInPage').then((m) => ({ default: m.LinkedInPage })))
const LazyDebriefPage = lazy(() => import('./routes/debrief/DebriefPage').then((m) => ({ default: m.DebriefPage })))
const LazyAccountPage = lazy(() => import('./routes/account/AccountPage').then((m) => ({ default: m.AccountPage })))
const LazyTermsPage = lazy(() => import('./routes/legal/TermsPage').then((m) => ({ default: m.TermsPage })))
const LazyPrivacyPage = lazy(() => import('./routes/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const LazyHelpPage = lazy(() => import('./routes/help/HelpPage').then((m) => ({ default: m.HelpPage })))

const rootRoute = createRootRoute({
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LazyHomePage,
})

const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/build',
  component: BuildPage,
})

const identityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/identity',
  component: LazyIdentityPage,
})

const identityEnrichmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/identity/enrich',
  component: LazyIdentityEnrichmentPage,
})

const identityEnrichmentSkillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/identity/enrich/$groupId/$skillName',
  component: LazyIdentityEnrichmentSkillPage,
})

const matchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/match',
  component: LazyMatchPage,
})

const pipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pipeline',
  component: PipelinePage,
})

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/research',
  component: LazyResearchPage,
})

const prepRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prep',
  component: LazyPrepPage,
  validateSearch: (search: Record<string, unknown>) => ({
    vector: (search.vector as string) ?? '',
    skills: (search.skills as string) ?? '',
    q: (search.q as string) ?? '',
  }),
})

const lettersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/letters',
  component: LazyLettersPage,
})

const linkedInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/linkedin',
  component: LazyLinkedInPage,
})

const recruiterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recruiter',
  component: RecruiterPage,
})

const debriefRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/debrief',
  component: LazyDebriefPage,
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: LazyAccountPage,
})

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: LazyTermsPage,
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: LazyPrivacyPage,
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: LazyHelpPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  buildRoute,
  identityRoute,
  identityEnrichmentRoute,
  identityEnrichmentSkillRoute,
  matchRoute,
  pipelineRoute,
  researchRoute,
  prepRoute,
  lettersRoute,
  linkedInRoute,
  recruiterRoute,
  debriefRoute,
  accountRoute,
  termsRoute,
  privacyRoute,
  helpRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
