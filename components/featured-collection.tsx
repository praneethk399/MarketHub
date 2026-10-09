'use client'

import { FeaturedBookShowcase } from './featured-book-showcase'
import { useLiveCatalogue } from './use-live-catalogue'

/**
 * Wires the one shared live catalogue into the featured shelf.
 *
 * Kept separate from `FeaturedBookShowcase` so the showcase stays a pure
 * `books: Book[]` component that is trivial to test and reuse, while the data
 * boundary lives in exactly one place. This and `Catalog` call the same hook, so
 * they read the same array from the same single `/api/books` request.
 *
 * The catalogue below owns the operator-visible fallback notice, so it is not
 * repeated here — the same sentence twice on one page would be noise.
 */
export function FeaturedCollection() {
  const { books } = useLiveCatalogue()
  return <FeaturedBookShowcase books={books} />
}
