import { ViteShell } from '@/components/vite-shell'
import { ViteHome } from '@/components/vite-home'
import { books, formats } from '@/data/books'
import { selectFeaturedBooks } from '@/components/featured-selection'

/**
 * The storefront arrives through the ported editorial design. The featured
 * spread is the same deterministic selection the old showcase used (tested in
 * featured-showcase.test.ts), so the shelf's contract carries over; the hero
 * stats are real catalogue counts, not the SPA's invented 55+/12/18.
 */
export default function HomePage() {
  const [featured] = selectFeaturedBooks(books, 1)
  const stats = {
    titles: books.length,
    categories: [...new Set(books.map((book) => book.category))].length,
    formats: formats.length,
  }
  return (
    <ViteShell>
      <ViteHome featured={featured} stats={stats} />
    </ViteShell>
  )
}
