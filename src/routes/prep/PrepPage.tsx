import { BookOpen } from 'lucide-react'

export function PrepPage() {
  return (
    <div className="route-placeholder">
      <div className="route-placeholder-content">
        <BookOpen size={48} strokeWidth={1} />
        <h1>Interview Prep</h1>
        <p>Searchable cliff notes — coming soon.</p>
        <p className="route-placeholder-hint">
          Vector-tagged reference cards for every story, project, and number you need
          to recall in interviews.
        </p>
      </div>
    </div>
  )
}
