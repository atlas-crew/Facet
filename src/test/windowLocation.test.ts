import { describe, expect, it, vi } from 'vitest'
import { reloadPage } from '../utils/windowLocation'

describe('windowLocation', () => {
  it('invokes reload on the provided location reference', () => {
    const reload = vi.fn()

    reloadPage({ reload })

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
