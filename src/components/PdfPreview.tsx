interface PdfPreviewProps {
  blobUrl: string | null
  loading: boolean
  error: string | null
}

export function PdfPreview({ blobUrl, loading, error }: PdfPreviewProps) {
  const isStale = !!error && !!blobUrl

  return (
    <div className={`pdf-preview-shell ${isStale ? 'is-stale' : ''}`} aria-live="polite">
      {blobUrl ? (
        <div className="pdf-preview-buffer-container">
          <iframe
            key={blobUrl}
            className="pdf-preview-frame"
            src={blobUrl}
            title="Resume PDF preview"
          />
          {isStale && (
            <div className="pdf-preview-stale-overlay" aria-hidden="true">
              <span>Showing last successful render</span>
            </div>
          )}
        </div>
      ) : (
        <div className="pdf-preview-placeholder">PDF preview will appear here.</div>
      )}
      {loading ? <div className="pdf-preview-status">Rendering PDF…</div> : null}
      {error ? (
        <div className="pdf-preview-status error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}
