import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { FeaturedCollection } from '@/components/featured-collection'
import { CollectionTrustStrip } from '@/components/collection-trust-strip'
import { Catalog } from '@/components/catalog'
import { Footer } from '@/components/footer'

/**
 * The shelf is the way in, the catalogue is the way through it.
 *
 * The featured section owns `#bestsellers` (the anchor the hero and footer have
 * always linked to), sits directly under the hero, and is backed by the same live
 * catalogue the grid below renders — not a decorative frame and not a second
 * dataset. The catalogue keeps search, filters, sorting, stock, wishlist and the
 * full book detail routes.
 */
export default function HomePage() {
  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container"><Hero /></div>
      <FeaturedCollection />
      <CollectionTrustStrip />
      <Catalog />
    </main>
    <Footer />
  </div>
}
