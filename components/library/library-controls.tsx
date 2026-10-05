'use client'

import { useState } from 'react'
import { BookOpenCheck, Bookmark, Check } from 'lucide-react'

/**
 * Add a book to the viewer's shelves from the product page. Writes go through
 * the authenticated reading-progress endpoint; progress stays private unless
 * the reader opts into sharing.
 */
export function LibraryControls({ bookId }: { bookId: string }) {
  const [status, setStatus] = useState<'NOT_STARTED' | 'CURRENTLY_READING' | 'FINISHED' | null>(null)
  const [visibility, setVisibility] = useState<'PRIVATE' | 'FRIENDS' | 'PUBLIC'>('PRIVATE')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (nextStatus: 'NOT_STARTED' | 'CURRENTLY_READING' | 'FINISHED') => {
    setSaving(true)
    setMessage('')
    try {
      const progress = nextStatus === 'FINISHED' ? 100 : nextStatus === 'NOT_STARTED' ? 0 : 10
      const response = await fetch('/api/reading-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'BOOK', targetId: bookId, status: nextStatus, progressPercentage: progress, visibility }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string | { message?: string } }
      if (!response.ok) {
        const error = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(error ?? 'Could not update your shelves.')
      }
      setStatus(nextStatus)
      setMessage(nextStatus === 'FINISHED' ? 'Moved to Finished.' : nextStatus === 'CURRENTLY_READING' ? 'Added to Currently reading.' : 'Added to Next up.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not update your shelves.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="library-controls">
    <span className="library-controls-label">My library</span>
    <div className="library-controls-actions">
      <button type="button" disabled={saving} onClick={() => void save('NOT_STARTED')} aria-pressed={status === 'NOT_STARTED'}>
        <Bookmark size={15} aria-hidden="true" /> {status === 'NOT_STARTED' ? <Check size={14} aria-hidden="true" /> : null} Next up
      </button>
      <button type="button" disabled={saving} onClick={() => void save('CURRENTLY_READING')} aria-pressed={status === 'CURRENTLY_READING'}>
        <BookOpenCheck size={15} aria-hidden="true" /> {status === 'CURRENTLY_READING' ? <Check size={14} aria-hidden="true" /> : null} Reading
      </button>
      <button type="button" disabled={saving} onClick={() => void save('FINISHED')} aria-pressed={status === 'FINISHED'}>
        <Check size={15} aria-hidden="true" /> Finished
      </button>
    </div>
    <label className="library-controls-visibility">
      <span>Who can see this?</span>
      <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
        <option value="PRIVATE">Only me</option>
        <option value="FRIENDS">Friends</option>
        <option value="PUBLIC">Public</option>
      </select>
    </label>
    {message && <p className="social-meta" role="status">{message} <a href="/library">Open my library</a></p>}
  </div>
}
