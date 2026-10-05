'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, ShieldCheck } from 'lucide-react'

type Factor = { key: string; label: string; available: boolean; value: number | null; display: string; reason: string }

type PassportDto = {
  target: { type: string; id: string; title: string; author: string; isbn: string | null; format: string | null; price: number | null }
  sellerVerification: { verified: boolean; label: string }
  authenticity: { label: string; detail: string }
  warranty: { label: string; detail: string }
  returns: { label: string; detail: string }
  delivery: { label: string; detail: string }
  priceHistory: { tracked: boolean; label: string; points: { price: number; recordedAt: string }[]; currentPrice: number | null; listPrice: number | null }
  sellerPassport: {
    vendor: { id: string; name: string; storeName: string; city: string; verified: boolean; activeSince: string }
    score: number | null
    scoreDisplay: string
    metrics: Record<string, string>
    factors: Factor[]
    reasons: string[]
    watchouts: string[]
    insufficient: string[]
  } | null
  sellerComparison: {
    grouped: boolean
    reason?: string
    offers: {
      sellerId: string; sellerName: string; sellerVerified: boolean; price: number | null
      pricePosition: string; trustDisplay: string; delivery: string; warranty: string; returns: string; isCurrentTarget: boolean
    }[]
    recommended: { sellerId: string; sellerName: string; reasons: string[] } | null
    ranking: { method: string; weights: Record<string, number>; note: string; rankedCount: number }
  } | null
}

/** Product Passport + Seller Passport + transparent seller comparison (spec §15–§20). */
export function PassportPanel({ bookId }: { bookId: string }) {
  const [passport, setPassport] = useState<PassportDto | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/books/${encodeURIComponent(bookId)}/passport`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Passport request failed (${response.status}).`)
        const payload = await response.json() as { data: PassportDto }
        setPassport(payload.data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        console.error('[MarketHub] passport unavailable', cause)
        setError('The product passport is unavailable right now.')
      })
    return () => controller.abort()
  }, [bookId])

  if (error) return <section className="social-panel" role="status"><h3>Product Passport</h3><p className="social-empty">{error}</p></section>
  if (!passport) return <section className="social-panel"><h3>Product Passport</h3><p className="social-empty">Loading seller and product history…</p></section>

  const comparison = passport.sellerComparison
  const maxPrice = passport.priceHistory.points.length ? Math.max(...passport.priceHistory.points.map((point) => point.price)) : 0

  return <section className="social-panel" aria-labelledby="product-passport">
    <h3 id="product-passport">Product Passport<span className="heading-period">.</span></h3>
    <dl className="passport-grid">
      <div><dt>Product</dt><dd>{passport.target.title}<small>{passport.target.author}</small></dd></div>
      <div><dt>ISBN</dt><dd>{passport.target.isbn ?? 'Not available'}</dd></div>
      <div><dt>Format</dt><dd>{passport.target.format ?? 'Not available'}</dd></div>
      <div><dt>Seller verification</dt><dd>{passport.sellerVerification.verified ? <><BadgeCheck size={14} aria-hidden="true" /> {passport.sellerVerification.label}</> : passport.sellerVerification.label}</dd></div>
      <div><dt>Authenticity</dt><dd>{passport.authenticity.label}<small>{passport.authenticity.detail}</small></dd></div>
      <div><dt>Warranty</dt><dd>{passport.warranty.label}<small>{passport.warranty.detail}</small></dd></div>
      <div><dt>Returns</dt><dd>{passport.returns.label}<small>{passport.returns.detail}</small></dd></div>
      <div><dt>Delivery</dt><dd>{passport.delivery.label}<small>{passport.delivery.detail}</small></dd></div>
    </dl>

    <div className="passport-price-history">
      <h4>Price history</h4>
      {passport.priceHistory.tracked
        ? <>
            <div className="price-bars" role="img" aria-label="Recorded price points">
              {passport.priceHistory.points.map((point) => (
                <span key={point.recordedAt} className="price-bar" style={{ height: `${maxPrice ? Math.max(8, (point.price / maxPrice) * 100) : 8}%` }} title={`₹${point.price} on ${new Date(point.recordedAt).toLocaleDateString('en-IN')}`} />
              ))}
            </div>
            <p className="social-meta">{passport.priceHistory.label}</p>
          </>
        : <p className="social-meta">
            Current price ₹{passport.priceHistory.currentPrice ?? '—'}
            {passport.priceHistory.listPrice ? ` · list price ₹${passport.priceHistory.listPrice}` : ''} · {passport.priceHistory.label}
          </p>}
    </div>

    {passport.sellerPassport && <div className="seller-passport">
      <h4><ShieldCheck size={16} aria-hidden="true" /> Seller Passport — {passport.sellerPassport.vendor.storeName}</h4>
      <p className="seller-score">
        <strong>{passport.sellerPassport.scoreDisplay}</strong>
        <span>{passport.sellerPassport.vendor.city} · active since {passport.sellerPassport.vendor.activeSince} · {passport.sellerPassport.vendor.verified ? 'verified seller' : 'not verified'}</span>
      </p>
      <ul className="seller-metrics">
        {passport.sellerPassport.factors.filter((factor) => factor.key !== 'returns').map((factor) => (
          <li key={factor.key}><span>{factor.label}</span><strong>{factor.display}</strong></li>
        ))}
      </ul>
      {passport.sellerPassport.reasons.length > 0 && <ul className="seller-reasons">
        {passport.sellerPassport.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}
      </ul>}
      {passport.sellerPassport.watchouts.length > 0 && <ul className="seller-watchouts">
        {passport.sellerPassport.watchouts.map((reason) => <li key={reason}>△ {reason}</li>)}
      </ul>}
      {passport.sellerPassport.insufficient.length > 0 && <p className="social-meta">
        Not enough data yet: {passport.sellerPassport.insufficient.join(', ')}. MarketHub shows “Not enough data” instead of estimated numbers.
      </p>}
    </div>}

    {comparison && <div className="seller-comparison">
      <h4>Seller comparison</h4>
      {comparison.grouped
        ? <>
            <table>
              <caption className="sr-only">Sellers offering this ISBN</caption>
              <thead><tr><th scope="col">Seller</th><th scope="col">Price</th><th scope="col">Delivery</th><th scope="col">Trust</th><th scope="col">Warranty</th><th scope="col">Returns</th></tr></thead>
              <tbody>
                {comparison.offers.map((offer) => (
                  <tr key={offer.sellerId} className={offer.isCurrentTarget ? 'comparison-current' : ''}>
                    <th scope="row">{offer.sellerName}{offer.sellerVerified ? ' ✓' : ''}</th>
                    <td>{offer.price === null ? '—' : `₹${offer.price}`} <small>{offer.pricePosition.toLowerCase()}</small></td>
                    <td>{offer.delivery}</td>
                    <td>{offer.trustDisplay}</td>
                    <td>{offer.warranty}</td>
                    <td>{offer.returns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {comparison.recommended
              ? <div className="comparison-recommendation">
                  <strong>Why {comparison.recommended.sellerName} is recommended</strong>
                  <ul>{comparison.recommended.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>
                </div>
              : <p className="social-meta">No seller in this set has enough marketplace history to be recommended, so no ranking claim is made.</p>}
            <p className="social-meta">{comparison.ranking.note}</p>
          </>
        : <p className="social-meta">{comparison.reason ?? 'Only one seller lists this edition right now.'}</p>}
    </div>}
  </section>
}
