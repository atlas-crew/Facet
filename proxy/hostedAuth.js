import { readFile } from 'node:fs/promises'
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from 'jose'
import { PersistenceAuthError } from './persistenceApi.js'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getAuthorizationToken(req) {
  const header = req.headers.authorization
  if (typeof header !== 'string') {
    return null
  }

  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function normalizeWorkspaceMembership(value) {
  if (!isRecord(value)) {
    return null
  }

  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId.trim() : ''
  const role = value.role === 'owner' ? 'owner' : null
  if (!workspaceId || !role) {
    return null
  }

  return {
    workspaceId,
    role,
    isDefault: value.isDefault === true,
  }
}

function normalizeHostedActorRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId = typeof value.tenantId === 'string' ? value.tenantId.trim() : ''
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : ''
  const userId = typeof value.userId === 'string' ? value.userId.trim() : ''
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : ''
  const workspaces = Array.isArray(value.workspaces)
    ? value.workspaces.map(normalizeWorkspaceMembership).filter(Boolean)
    : []

  if (!tenantId || !accountId || !userId || !email || workspaces.length === 0) {
    return null
  }

  return {
    tenantId,
    accountId,
    userId,
    email,
    workspaces,
  }
}

function normalizeHostedDirectory(value) {
  if (!isRecord(value) || !Array.isArray(value.actors)) {
    throw new Error('Hosted membership file must contain an "actors" array.')
  }

  return value.actors.map(normalizeHostedActorRecord).filter(Boolean)
}

export function createInMemoryHostedMembershipStore(actorRecords = []) {
  const actors = actorRecords.map(normalizeHostedActorRecord).filter(Boolean)

  return {
    async getActor(userId) {
      return actors.find((actor) => actor.userId === userId) ?? null
    },
  }
}

export function createFileHostedMembershipStore(filePath) {
  if (!filePath) {
    throw new Error('Hosted auth requires HOSTED_MEMBERSHIP_FILE.')
  }

  return {
    async getActor(userId) {
      const raw = await readFile(filePath, 'utf8')
      const actors = normalizeHostedDirectory(JSON.parse(raw))
      return actors.find((actor) => actor.userId === userId) ?? null
    },
  }
}

function resolveJwkSet({ jwksUrl, jwks }) {
  if (jwksUrl) {
    return createRemoteJWKSet(new URL(jwksUrl))
  }
  if (jwks) {
    return createLocalJWKSet(jwks)
  }

  throw new Error('Hosted auth requires SUPABASE_JWKS_URL or an explicit jwks test fixture.')
}

export function createHostedSessionActorResolver(options) {
  const issuer = typeof options.issuer === 'string' && options.issuer.trim()
    ? options.issuer.trim()
    : null
  const audience = typeof options.audience === 'string' && options.audience.trim()
    ? options.audience.trim()
    : null

  if (!issuer) {
    throw new Error('Hosted auth requires SUPABASE_JWT_ISSUER.')
  }
  if (!audience) {
    throw new Error('Hosted auth requires SUPABASE_JWT_AUDIENCE.')
  }

  const membershipStore = options.membershipStore
  if (!membershipStore || typeof membershipStore.getActor !== 'function') {
    throw new Error('Hosted auth requires a membershipStore with getActor().')
  }

  const jwkSet = resolveJwkSet(options)

  return async (req) => {
    const token = getAuthorizationToken(req)
    if (!token) {
      throw new PersistenceAuthError(401, 'Missing hosted session token.')
    }

    let payload
    try {
      ;({ payload } = await jwtVerify(token, jwkSet, {
        issuer,
        audience,
      }))
    } catch {
      throw new PersistenceAuthError(401, 'Missing or invalid hosted session token.')
    }

    const userId = typeof payload.sub === 'string' ? payload.sub.trim() : ''
    if (!userId) {
      throw new PersistenceAuthError(401, 'Hosted session token is missing subject identity.')
    }

    const actor = await membershipStore.getActor(userId)
    if (!actor) {
      throw new PersistenceAuthError(403, 'Hosted user is not provisioned for Facet.')
    }

    const tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (tokenEmail && tokenEmail !== actor.email) {
      throw new PersistenceAuthError(403, 'Hosted session token does not match the provisioned Facet user.')
    }

    return {
      tenantId: actor.tenantId,
      userId: actor.userId,
      workspaces: actor.workspaces.map((workspace) => workspace.workspaceId),
      accountId: actor.accountId,
      email: actor.email,
      authMode: 'hosted',
    }
  }
}
