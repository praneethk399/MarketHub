import { stableHash } from '@/lib/stable-hash'
import type { Book } from '@/data/books'

/**
 * How the featured shelf is chosen — the documented rule for the animated
 * showcase, kept pure so it can be tested without a DOM.
 *
 * `Book` has no `featured` / `bestseller` / `rank` / `addedAt` field, and this
 * feature must not invent one or fabricate a metric. So the shelf is a
 * deterministic sample of the real, purchasable catalogue:
 *
 *   1. Only books that can actually be bought are eligible — `status` is
 *      'in-stock' and `price` is not null. If nothing is purchasable the whole
 *      collection is used rather than showing an empty shelf.
 *   2. Eligibility is ranked by `stableHash('featured:' + id)`. The id is hashed
 *      rather than its position, so the window is stable per book and uniform
 *      across the catalogue: identical on the server and the client (no hydration
 *      mismatch), identical on every boot and machine, and unchanged when the API
 *      returns the catalogue in a different order or with new titles inserted.
 *   3. Ties fall back to id order so the result is total and reproducible.
 *
 * Swapping in an editorial rule later (for example top-rated in-stock titles
 * first) is a change to `featuredRank` alone; nothing else depends on the rule.
 */

export const featuredShelfSize = 7

export function featuredRank(book: Book): number {
  return stableHash(`featured:${book.id}`)
}

export function selectFeaturedBooks(all: Book[], limit: number = featuredShelfSize): Book[] {
  const purchasable = all.filter((book) => book.status === 'in-stock' && book.price !== null)
  const pool = purchasable.length > 0 ? purchasable : all
  return [...pool]
    .sort((a, b) => featuredRank(a) - featuredRank(b) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
}

/** The middle of the shelf, so the focused cover has books on both sides. */
export function centredIndex(total: number): number {
  return total <= 0 ? -1 : Math.floor((total - 1) / 2)
}

/**
 * Resolves the active book from its id rather than its index. A catalogue refresh
 * that inserts or removes titles therefore keeps the reader on the same book, so
 * the shelf never jumps out from under them.
 *
 * Before any choice has been made — and if the chosen book is genuinely gone — the
 * shelf opens in the middle rather than at the first position. That is a pure
 * function of the shelf length, so the server and client still agree exactly, and
 * it is what gives the opening composition its focused centre rather than a cover
 * pinned to the left edge with every other book stacked off to one side.
 */
export function activeIndexFor(featured: Book[], activeId: string | null): number {
  if (featured.length === 0) return -1
  if (!activeId) return centredIndex(featured.length)
  const index = featured.findIndex((book) => book.id === activeId)
  return index >= 0 ? index : centredIndex(featured.length)
}

/** Shelf positions either side of the focused book, nearest first, clipped to the ends. */
export function sideIndices(activeIndex: number, total: number, span = 2): number[] {
  const indices: number[] = []
  for (let distance = 1; distance <= span; distance += 1) {
    const before = activeIndex - distance
    const after = activeIndex + distance
    if (before >= 0) indices.push(before)
    if (after < total) indices.push(after)
  }
  return indices.sort((a, b) => Math.abs(a - activeIndex) - Math.abs(b - activeIndex))
}

/** `04 / 07` as it appears in the caption panel. */
export function formatShelfIndex(activeIndex: number, total: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(activeIndex + 1)} / ${pad(total)}`
}

/** One concise sentence for the polite live region — not a running commentary. */
export function announcementFor(book: Book, activeIndex: number, total: number): string {
  return `${formatShelfIndex(activeIndex, total)} — ${book.title} by ${book.author}.`
}
