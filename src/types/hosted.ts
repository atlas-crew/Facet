export const FACET_AI_FEATURE_KEYS = [
  'build.bullet-reframe',
  'identity.extract',
  'identity.deepen',
  'identity.skill-group-naming',
  'identity.deepen_project',
  'match.jd-analysis',
  'pipeline.t3.interviewer',
  'research.deep-search',
  'research.profile-inference',
  'research.search',
  'research.thesis',
  'prep.generate',
  'letters.generate',
  'linkedin.generate',
  'debrief.generate',
] as const

export type FacetAiFeatureKey = (typeof FACET_AI_FEATURE_KEYS)[number]

export const FACET_PAID_AI_FEATURES = [...FACET_AI_FEATURE_KEYS] as const

export type FacetDeploymentMode = 'hosted' | 'self-hosted'

export type FacetWorkspaceRole = 'owner'

export type FacetPlanId = 'free' | 'ai-pro'

export type FacetEntitlementStatus = 'inactive' | 'paid' | 'active' | 'expired' | 'refunded'

export interface FacetTenantAccount {
  tenantId: string
  accountId: string
  deploymentMode: FacetDeploymentMode
  defaultWorkspaceId: string | null
}

export interface FacetUserIdentity {
  userId: string
  tenantId: string
  email: string
}

export interface FacetWorkspaceMembership {
  workspaceId: string
  role: FacetWorkspaceRole
  isDefault: boolean
}

export interface FacetHostedWorkspaceSummary extends FacetWorkspaceMembership {
  name: string
  revision: number
  updatedAt: string
}

export interface FacetBillingCustomer {
  provider: 'stripe'
  customerId: string
}

export interface FacetBillingPassHistoryEntry {
  provider: 'stripe'
  paymentIntentId: string
  planId: Exclude<FacetPlanId, 'free'>
  status: 'paid' | 'active' | 'expired' | 'refunded'
  purchasedAt: string
  activatedAt: string | null
  expiresAt: string | null
}

export interface FacetBillingPass extends FacetBillingPassHistoryEntry {
  history?: FacetBillingPassHistoryEntry[]
}

export interface FacetEntitlement {
  planId: FacetPlanId
  status: FacetEntitlementStatus
  source: 'stripe'
  features: FacetAiFeatureKey[]
  effectiveThrough: string | null
}

export interface FacetHostedAccountContext {
  deploymentMode: 'hosted'
  account: FacetTenantAccount
  actor: FacetUserIdentity
  memberships: FacetWorkspaceMembership[]
  billingCustomer: FacetBillingCustomer | null
  billingPass: FacetBillingPass | null
  entitlement: FacetEntitlement | null
}

export interface FacetHostedAccountContextResponse {
  context: FacetHostedAccountContext
}

export interface FacetBillingCustomerLinkResponse {
  billingCustomer: FacetBillingCustomer
}

export interface FacetBillingCheckoutSessionResponse {
  sessionId: string
  url: string
  billingCustomer: FacetBillingCustomer
}

export interface FacetHostedActorPayload {
  tenantId: string
  userId: string
  workspaceIds: string[]
}

export interface FacetHostedWorkspaceDirectoryResponse {
  workspaces: FacetHostedWorkspaceSummary[]
  actor?: FacetHostedActorPayload
}

export interface FacetHostedWorkspaceMutationResponse {
  workspace: FacetHostedWorkspaceSummary
  actor?: FacetHostedActorPayload
}

export interface FacetHostedWorkspaceDeleteResponse {
  deletedWorkspaceId: string
  defaultWorkspaceId: string | null
  actor?: FacetHostedActorPayload
}

export interface FacetSelfHostedAiConfig {
  proxyConfigured: boolean
  managedBy: 'operator'
}

export interface FacetHostedAccessContext {
  deploymentMode: 'hosted'
  account: FacetTenantAccount
  actor: FacetUserIdentity
  memberships: FacetWorkspaceMembership[]
  billingCustomer: FacetBillingCustomer | null
  billingPass: FacetBillingPass | null
  entitlement: FacetEntitlement | null
}

export interface FacetSelfHostedAccessContext {
  deploymentMode: 'self-hosted'
  selfHostedAi: FacetSelfHostedAiConfig
}

export type FacetAiAccessContext = FacetHostedAccessContext | FacetSelfHostedAccessContext

export type FacetAiAccessSource = 'none' | 'hosted-entitlement' | 'self-hosted-operator'

export type FacetAiAccessDenialReason =
  | 'upgrade_required'
  | 'access_expired'
  | 'billing_issue'
  | 'self_hosted_proxy_unavailable'

export interface FacetAiAccessDecision {
  allowed: boolean
  source: FacetAiAccessSource
  reason: FacetAiAccessDenialReason | null
}
