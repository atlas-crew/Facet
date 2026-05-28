import { describe, expect, it } from 'vitest'
import {
  EMPTY_ROLE_ORDER,
  hasCustomVectorOrder,
  resolveEffectiveBulletOrders,
} from '../utils/bulletOrder'

describe('bulletOrder utils', () => {
  it('uses default order as fallback when a vector does not define one', () => {
    const orders = {
      all: {
        roleA: ['b1', 'b2'],
      },
      backend: {
        roleB: ['b3', 'b4'],
      },
    }

    expect(resolveEffectiveBulletOrders(orders, 'backend')).toEqual({
      roleA: ['b1', 'b2'],
      roleB: ['b3', 'b4'],
    })
  })

  it('returns a stable empty order when no role order applies', () => {
    const first = resolveEffectiveBulletOrders({}, 'backend')
    const second = resolveEffectiveBulletOrders({}, 'backend')
    const allVectors = resolveEffectiveBulletOrders({}, 'all')

    expect(first).toBe(second)
    expect(first).toBe(allVectors)
    expect(first).toBe(EMPTY_ROLE_ORDER)
    expect(first).toEqual({})
    expect(Object.isFrozen(EMPTY_ROLE_ORDER)).toBe(true)
  })

  it('keeps default orders when a selected vector has no custom order', () => {
    const orders = { all: { roleA: ['b1', 'b2'] } }
    const result = resolveEffectiveBulletOrders(orders, 'frontend')

    expect(result).toEqual({ roleA: ['b1', 'b2'] })
    expect(result).toBe(orders.all)
    expect(result).not.toBe(EMPTY_ROLE_ORDER)
  })

  it('keeps default orders when a selected vector defines an empty custom order', () => {
    const orders = { all: { roleA: ['b1', 'b2'] }, frontend: {} }
    const result = resolveEffectiveBulletOrders(orders, 'frontend')

    expect(result).toBe(orders.all)
  })

  it('detects custom vector ordering relative to default', () => {
    const orders = {
      all: {
        roleA: ['b1', 'b2'],
      },
      backend: {
        roleA: ['b2', 'b1'],
      },
    }

    expect(hasCustomVectorOrder('backend', 'roleA', orders)).toBe(true)
    expect(hasCustomVectorOrder('backend', 'roleB', orders)).toBe(false)
    expect(hasCustomVectorOrder('all', 'roleA', orders)).toBe(false)
  })
})
