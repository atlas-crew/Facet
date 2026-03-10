import { useEffect, useRef, useState } from 'react'

let mermaidPromise: Promise<typeof import('mermaid')> | null = null
let renderCount = 0

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        fontFamily: 'var(--font-sans)',
      })
      return mod
    })
  }
  return mermaidPromise
}

export function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${++renderCount}`

    getMermaid()
      .then(async (mod) => {
        if (cancelled || !containerRef.current) return

        // Re-initialize with current theme each render
        const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default'
        mod.default.initialize({ startOnLoad: false, theme, fontFamily: 'var(--font-sans)' })

        const { svg } = await mod.default.render(id, code)
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => { cancelled = true }
  }, [code])

  return (
    <div className="mermaid-container">
      {status === 'loading' && <div className="mermaid-loading">Loading diagram…</div>}
      {status === 'error' && <div className="mermaid-error">Failed to render diagram</div>}
      <div ref={containerRef} style={{ display: status === 'ready' ? 'block' : 'none' }} />
    </div>
  )
}
