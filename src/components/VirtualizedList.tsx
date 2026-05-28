import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

interface VirtualizedListProps<T> {
  items: T[]
  enabled: boolean
  itemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  renderPlaceholder?: (item: T, index: number) => ReactNode
  estimateSize: number
  viewportHeight: number
  className?: string
  virtualClassName?: string
  itemClassName?: string
  gap?: number
  overscan?: number
  ariaLabel?: string
  testId?: string
  forceVisibleKeys?: readonly string[]
}

const EMPTY_FORCE_VISIBLE_KEYS: readonly string[] = Object.freeze([])

interface RowMetric {
  index: number
  key: string
  start: number
  size: number
}

interface MeasuredRowProps {
  rowKey: string
  className?: string
  style: CSSProperties
  ariaSetSize?: number
  ariaPosInSet?: number
  role?: string
  onSize: (key: string, size: number) => void
  children: ReactNode
}

function MeasuredRow({
  rowKey,
  className,
  style,
  ariaSetSize,
  ariaPosInSet,
  role,
  onSize,
  children,
}: MeasuredRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = rowRef.current
    if (!node) return

    const measure = () => {
      const nextSize = Math.ceil(node.getBoundingClientRect().height)
      if (nextSize > 0) {
        onSize(rowKey, nextSize)
      }
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(measure)
    observer.observe(node)

    return () => observer.disconnect()
  }, [onSize, rowKey])

  return (
    <div
      ref={rowRef}
      className={className}
      style={style}
      data-virtualized-item={rowKey}
      role={role}
      aria-setsize={ariaSetSize}
      aria-posinset={ariaPosInSet}
    >
      {children}
    </div>
  )
}

export function VirtualizedList<T>({
  items,
  enabled,
  itemKey,
  renderItem,
  renderPlaceholder,
  estimateSize,
  viewportHeight,
  className,
  virtualClassName,
  itemClassName,
  gap = 0,
  overscan = 4,
  ariaLabel,
  testId,
  forceVisibleKeys = EMPTY_FORCE_VISIBLE_KEYS,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, number>>({})

  const handleSize = useCallback((key: string, size: number) => {
    setMeasuredSizes((current) => {
      if (current[key] === size) return current
      return { ...current, [key]: size }
    })
  }, [])

  const metrics = useMemo(() => {
    const rows: RowMetric[] = []
    const totalSize = items.reduce((start, item, index) => {
      const key = itemKey(item, index)
      const measuredSize = measuredSizes[key]
      const size = measuredSize ?? estimateSize
      const row: RowMetric = {
        index,
        key,
        start,
        size: index === items.length - 1 ? size : size + gap,
      }
      rows.push(row)
      return start + row.size
    }, 0)

    return { rows, totalSize }
  }, [estimateSize, gap, itemKey, items, measuredSizes])

  const visibleRows = useMemo(() => {
    if (metrics.rows.length === 0) return []

    const viewportBottom = scrollTop + viewportHeight
    const firstVisible = metrics.rows.findIndex((row) => row.start + row.size >= scrollTop)
    const startIndex = Math.max(
      0,
      (firstVisible === -1 ? metrics.rows.length - 1 : firstVisible) - overscan,
    )

    let endIndex = startIndex
    while (endIndex < metrics.rows.length && metrics.rows[endIndex].start <= viewportBottom) {
      endIndex += 1
    }

    return metrics.rows.slice(startIndex, Math.min(metrics.rows.length, endIndex + overscan))
  }, [metrics.rows, overscan, scrollTop, viewportHeight])

  const visibleKeys = useMemo(() => new Set(visibleRows.map((row) => row.key)), [visibleRows])
  const forcedVisibleKeys = useMemo(() => new Set(forceVisibleKeys), [forceVisibleKeys])
  const rowsToRender = renderPlaceholder ? metrics.rows : visibleRows

  if (!enabled) {
    return (
      <div className={className} data-testid={testId} data-virtualized="false">
        {items.map((item, index) => renderItem(item, index))}
      </div>
    )
  }

  return (
    <div
      className={['virtualized-list', virtualClassName].filter(Boolean).join(' ')}
      data-testid={testId}
      data-virtualized="true"
      aria-label={ariaLabel}
      role={ariaLabel ? 'list' : undefined}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{
        height: Math.min(metrics.totalSize, viewportHeight),
        maxHeight: `min(${viewportHeight}px, calc(100vh - 220px))`,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      <div
        className="virtualized-list-spacer"
        role="presentation"
        style={{ height: metrics.totalSize, position: 'relative' }}
      >
        {rowsToRender.map((row) => {
          const isVisible = visibleKeys.has(row.key) || forcedVisibleKeys.has(row.key)
          const rowStyle: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`,
          }

          if (!isVisible && renderPlaceholder) {
            // Keep lightweight sortable placeholders mounted so dnd-kit retains
            // long-distance drop targets without rendering every full card.
            return (
              <div
                key={row.key}
                className={['virtualized-list-row', itemClassName].filter(Boolean).join(' ')}
                style={{ ...rowStyle, height: row.size }}
                aria-hidden="true"
                data-virtualized-placeholder={row.key}
              >
                {renderPlaceholder(items[row.index], row.index)}
              </div>
            )
          }

          return (
            <MeasuredRow
              key={row.key}
              rowKey={row.key}
              className={['virtualized-list-row', itemClassName].filter(Boolean).join(' ')}
              onSize={handleSize}
              role={ariaLabel ? 'listitem' : undefined}
              ariaSetSize={ariaLabel ? items.length : undefined}
              ariaPosInSet={ariaLabel ? row.index + 1 : undefined}
              style={rowStyle}
            >
              {renderItem(items[row.index], row.index)}
            </MeasuredRow>
          )
        })}
      </div>
    </div>
  )
}
