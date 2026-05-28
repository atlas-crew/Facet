// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { VirtualizedList } from '../components/VirtualizedList'

const originalResizeObserver = globalThis.ResizeObserver

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  globalThis.ResizeObserver = originalResizeObserver
})

const items = Array.from({ length: 20 }, (_, index) => ({
  id: `item-${index + 1}`,
  label: `Item ${index + 1}`,
}))

describe('VirtualizedList', () => {
  it('renders a flat list when virtualization is disabled', () => {
    render(
      <VirtualizedList
        items={items}
        enabled={false}
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={40}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    expect(screen.getByText('Item 1')).toBeDefined()
    expect(screen.getByText('Item 20')).toBeDefined()
  })

  it('keeps forced keys mounted even when they are outside the visible window', () => {
    render(
      <VirtualizedList
        items={items}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={40}
        overscan={0}
        forceVisibleKeys={['item-20']}
        renderPlaceholder={(item) => <div data-testid={`placeholder-${item.id}`} />}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    expect(screen.getByText('Item 1')).toBeDefined()
    expect(screen.queryByText('Item 10')).toBeNull()
    expect(screen.getByText('Item 20')).toBeDefined()
    expect(screen.getByTestId('placeholder-item-10')).toBeDefined()
  })

  it('marks visible rows with virtualized list accessibility metadata', () => {
    render(
      <VirtualizedList
        items={items.slice(0, 3)}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={40}
        overscan={0}
        ariaLabel="Virtualized test list"
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    expect(screen.getByRole('list', { name: 'Virtualized test list' })).toBeDefined()
    const listItems = screen.getAllByRole('listitem')
    expect(listItems[0].getAttribute('aria-setsize')).toBe('3')
    expect(listItems[0].getAttribute('aria-posinset')).toBe('1')
    expect(listItems[1].getAttribute('aria-posinset')).toBe('2')
  })

  it('uses measured row heights to update spacer size', async () => {
    const resizeCallbacks: ResizeObserverCallback[] = []
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback)
      }

      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    let firstItemHeight = 80

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const height = this.dataset.virtualizedItem === 'item-1' ? firstItemHeight : 20
      return {
        x: 0,
        y: 0,
        width: 200,
        height,
        top: 0,
        left: 0,
        right: 200,
        bottom: height,
        toJSON: () => ({}),
      } as DOMRect
    })

    render(
      <VirtualizedList
        items={items.slice(0, 3)}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={120}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    await waitFor(() => {
      expect(document.querySelector<HTMLElement>('.virtualized-list-spacer')?.style.height).toBe(
        '120px',
      )
    })

    firstItemHeight = 100
    act(() => {
      for (const callback of resizeCallbacks) {
        callback([], {} as ResizeObserver)
      }
    })

    await waitFor(() => {
      expect(document.querySelector<HTMLElement>('.virtualized-list-spacer')?.style.height).toBe(
        '140px',
      )
    })
  })

  it('renders without ResizeObserver support', () => {
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver

    expect(() =>
      render(
        <VirtualizedList
          items={items.slice(0, 2)}
          enabled
          itemKey={(item) => item.id}
          estimateSize={20}
          viewportHeight={40}
          renderItem={(item) => <div>{item.label}</div>}
        />,
      ),
    ).not.toThrow()
  })

  it('disconnects row observers on unmount', () => {
    const disconnect = vi.fn()
    class MockResizeObserver {
      observe = vi.fn()
      disconnect = disconnect
      unobserve = vi.fn()
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

    const { unmount } = render(
      <VirtualizedList
        items={items.slice(0, 2)}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={40}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('renders an empty virtualized list without rows', () => {
    render(
      <VirtualizedList
        items={[] as Array<{ id: string; label: string }>}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={40}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    expect(document.querySelectorAll('[data-virtualized-item]')).toHaveLength(0)
    expect(document.querySelector<HTMLElement>('.virtualized-list-spacer')?.style.height).toBe(
      '0px',
    )
  })

  it('includes gaps between measured rows in the spacer height', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          width: 200,
          height: 20,
          top: 0,
          left: 0,
          right: 200,
          bottom: 20,
          toJSON: () => ({}),
        }) as DOMRect,
    )

    render(
      <VirtualizedList
        items={items.slice(0, 3)}
        enabled
        itemKey={(item) => item.id}
        estimateSize={20}
        viewportHeight={100}
        gap={10}
        renderItem={(item) => <div>{item.label}</div>}
      />,
    )

    await waitFor(() => {
      expect(document.querySelector<HTMLElement>('.virtualized-list-spacer')?.style.height).toBe(
        '80px',
      )
    })
  })
})
