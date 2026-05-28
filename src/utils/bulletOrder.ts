import type { VectorSelection } from '../types'

export type RoleOrder = Record<string, string[]>
export type VectorBulletOrders = Record<string, RoleOrder>

// Shared immutable sentinel for memo dependencies; callers must treat empty order maps as read-only.
export const EMPTY_ROLE_ORDER: RoleOrder = Object.freeze({})

export const resolveEffectiveBulletOrders = (
  bulletOrders: VectorBulletOrders,
  selectedVector: VectorSelection,
): RoleOrder => {
  const defaultOrders = bulletOrders.all ?? EMPTY_ROLE_ORDER
  if (selectedVector === 'all') {
    return defaultOrders
  }

  const vectorOrders = bulletOrders[selectedVector] ?? EMPTY_ROLE_ORDER
  if (vectorOrders === EMPTY_ROLE_ORDER || Object.keys(vectorOrders).length === 0) {
    return defaultOrders
  }

  const roleIds = new Set([...Object.keys(defaultOrders), ...Object.keys(vectorOrders)])
  const next: RoleOrder = {}

  for (const roleId of roleIds) {
    const order = vectorOrders[roleId] ?? defaultOrders[roleId]
    if (order) {
      next[roleId] = order
    }
  }

  return next
}

export const hasCustomVectorOrder = (
  selectedVector: VectorSelection,
  roleId: string,
  bulletOrders: VectorBulletOrders,
): boolean => {
  if (selectedVector === 'all') {
    return false
  }

  const vectorOrder = bulletOrders[selectedVector]?.[roleId]
  if (!vectorOrder) {
    return false
  }

  const defaultOrder = bulletOrders.all?.[roleId]
  if (!defaultOrder) {
    return true
  }

  if (defaultOrder.length !== vectorOrder.length) {
    return true
  }

  for (const [index, id] of vectorOrder.entries()) {
    if (defaultOrder[index] !== id) {
      return true
    }
  }

  return false
}
