import { ViteShell } from '@/components/vite-shell'
import { ViteBestsellers } from '@/components/vite-bestsellers'
import { books } from '@/data/books'
import { selectFeaturedBooks } from '@/components/featured-selection'

/**
 * Bestsellers, honestly: `Book` carries no sales metric, so this page presents
 * the same purchasable shelf the home page features (deterministic, tested) as
 * the editorial "shelf worth turning pages for" — without inventing sales rank.
 */
export default function BestsellersPage() {
  const shelf = selectFeaturedBooks(books, 7)
  return (
    <ViteShell>
      <ViteBestsellers shelf={shelf} />
    </ViteShell>
  )
}
