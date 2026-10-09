import { books as seededBooks, type Book } from '@/data/books'

/**
 * The one live catalogue every browse surface reads.
 *
 * The seeded `books` module constant is already identical on the server and the
 * client, so it is the server snapshot and the pre-fetch snapshot at once: the
 * shelf paints immediately, hydration matches, and `/api/books` then replaces it.
 *
 * Why a module-level store instead of a hook-local `useEffect`: the home page now
 * renders the featured showcase *and* the catalogue, and both must read the same
 * array without issuing two `/api/books` requests. The store owns the single
 * in-flight request, so any number of consumers share it.
 *
 * Stale-response guard: every load takes a monotonically increasing request id.
 * A response whose id is no longer the latest is discarded rather than published,
 * so a slow first request can never overwrite a newer one. The shared request is
 * deliberately *not* aborted on unmount — one consumer unmounting must not cancel
 * the fetch the others are still waiting for.
 */

export type CatalogueSource = 'seed' | 'mock' | 'postgresql'

export type CatalogueSnapshot = {
  books: Book[]
  source: CatalogueSource
  loading: boolean
  error: string
}

/** The same operator-visible notice the catalogue has always shown on failure. */
export const catalogueFallbackNotice =
  'The live catalogue could not be reached. Showing the locally saved shelf.'

const initialSnapshot: CatalogueSnapshot = {
  books: seededBooks,
  source: 'seed',
  loading: true,
  error: '',
}

let snapshot: CatalogueSnapshot = initialSnapshot
const listeners = new Set<() => void>()
let inflight: Promise<CatalogueSnapshot> | null = null
let latestRequest = 0

function publish(next: CatalogueSnapshot) {
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribeCatalogue(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable reference between publishes, which is what `useSyncExternalStore` needs. */
export function getCatalogueSnapshot(): CatalogueSnapshot {
  return snapshot
}

export function getServerCatalogueSnapshot(): CatalogueSnapshot {
  return initialSnapshot
}

export function loadCatalogue({ force = false }: { force?: boolean } = {}): Promise<CatalogueSnapshot> {
  if (force) inflight = null
  else if (inflight) return inflight
  else if (snapshot.source !== 'seed') return Promise.resolve(snapshot)

  const requestId = ++latestRequest
  publish({ ...snapshot, loading: true })

  inflight = (async () => {
    try {
      const response = await fetch('/api/books', { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`Book catalogue request failed (${response.status}).`)
      const payload = await response.json() as { data?: Book[]; source?: string }
      if (!Array.isArray(payload.data)) throw new Error('Book catalogue response was not valid.')
      if (requestId !== latestRequest) return snapshot
      publish({
        books: payload.data,
        source: payload.source === 'postgresql' ? 'postgresql' : 'mock',
        loading: false,
        error: '',
      })
    } catch (error) {
      console.error('[MarketHub] Unable to refresh the catalogue from the API.', error)
      // Keeping the seeded shelf is the documented fallback: browse still works.
      if (requestId === latestRequest) publish({ ...snapshot, loading: false, error: catalogueFallbackNotice })
    } finally {
      if (requestId === latestRequest) inflight = null
    }
    return snapshot
  })()

  return inflight
}

/**
 * Test-only. Restores the pre-fetch state so the single-request and
 * stale-response guarantees can be asserted in isolation.
 */
export function resetCatalogueForTests() {
  snapshot = initialSnapshot
  listeners.clear()
  inflight = null
  latestRequest = 0
}
