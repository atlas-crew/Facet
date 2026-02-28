interface PdfPreviewProps {
  blobUrl: string | null
  loading: boolean
  error: string | null
}

export function PdfPreview({ blobUrl, loading, error }: PdfPreviewProps) {
  return (
    <div className="pdf-preview-shell" aria-live="polite">
      {blobUrl ? (
        <iframe
          key={blobUrl}
          className="pdf-preview-frame"
          src={blobUrl}
          title="Resume PDF preview"
        />
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
