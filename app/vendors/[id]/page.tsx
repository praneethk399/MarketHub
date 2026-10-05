import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { getVendor } from '@/services/vendors'
import { getSellerPassport } from '@/services/sellerPassport.service'

export const dynamic = 'force-dynamic'

/** Vendor page with the Seller Passport (spec §36) — derived metrics only. */
export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [vendor, passport] = await Promise.all([getVendor(id), getSellerPassport(id)])
  if (!vendor) notFound()
  const listings = vendor as { books?: { id: string; title: string }[]; products?: { id: string; title: string }[] }

  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container vendor-page">
        <header className="vendor-header">
          <h1>{vendor.storeName ?? vendor.name}<span className="heading-period">.</span></h1>
          <p>{vendor.city}{vendor.verified ? ' · identity-verified seller' : ' · not verified'} · active since {new Date(vendor.activeSince).getFullYear()}</p>
        </header>

        {passport ? <section className="social-panel" aria-labelledby="seller-passport">
          <h3 id="seller-passport">Seller Passport<span className="heading-period">.</span></h3>
          <p className="seller-score">
            <strong>{passport.scoreDisplay}</strong>
            <span>Derived from this seller&apos;s real orders, reviews and listings. Weights are documented in the code.</span>
          </p>
          <ul className="seller-metrics">
            {passport.factors.map((factor) => (
              <li key={factor.key}><span>{factor.label}</span><strong>{factor.display}</strong></li>
            ))}
          </ul>
          {passport.reasons.length > 0 && <ul className="seller-reasons">
            {passport.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}
          </ul>}
          {passport.watchouts.length > 0 && <ul className="seller-watchouts">
            {passport.watchouts.map((reason) => <li key={reason}>△ {reason}</li>)}
          </ul>}
          <p className="social-meta">
            Not enough data yet: {passport.insufficient.join(', ')}. Fabricated trust numbers are never shown.
          </p>
        </section> : <section className="social-panel"><h3>Seller Passport</h3><p className="social-empty">Not enough data to build a passport for this seller yet.</p></section>}

        <section className="social-panel">
          <h3>Products from this seller<span className="heading-period">.</span></h3>
          {listings.books?.length || listings.products?.length
            ? <ul className="vendor-products">
                {listings.books?.map((book) => <li key={book.id}><a href={`/books/${book.id}`}>{book.title}</a></li>)}
                {listings.products?.map((product) => <li key={product.id}>{product.title}</li>)}
              </ul>
            : <p className="social-empty">This seller has no published listings right now.</p>}
        </section>
      </div>
    </main>
    <Footer />
  </div>
}
