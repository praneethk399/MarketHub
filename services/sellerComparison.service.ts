import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { resolveTarget, type SocialTargetType } from '@/services/social-targets'
import { getSellerPassport, getVendorPublicRow } from '@/services/sellerPassport.service'

/**
 * Transparent seller comparison (spec §18–§20).
 *
 * - Sellers are grouped only by a stable identity: ISBN. Titles are never
 *   used to group unrelated books (spec §20).
 * - Every column comes from the database (price, seller, trust score derived
 *   by sellerPassport.service). Delivery windows, warranties and return
 *   policies are shown as "Not specified" because this schema does not track
 *   them — nothing is fabricated (spec §53).
 * - Ranking is explainable: trust 60% + price position 40%, and offers
 *   without trust data are never recommended (spec §19).
 */

export const COMPARISON_WEIGHTS = { trust: 0.6, price: 0.4 } as const

export type SellerOfferDto = {
  source: 'BOOK' | 'PRODUCT'
  listingId: string
  sellerId: string
  sellerName: string
  sellerVerified: boolean
  sellerCity: string | null
  price: number | null
  pricePosition: 'LOWEST' | 'MEDIAN' | 'HIGHEST' | 'SINGLE'
  trustScore: number | null
  trustDisplay: string
  delivery: string
  warranty: string
  returns: string
  rankScore: number | null
  isCurrentTarget: boolean
}

async function vendorMeta(vendorId: string) {
  const row = await getVendorPublicRow(vendorId)
  if (row) return { id: row.id, name: row.storeName, verified: row.verified, city: row.city }
  if (!isDatabaseConfigured) {
    const vendor = mockStore.vendors.find((entry) => entry.id === vendorId)
    return vendor ? { id: vendor.id, name: vendor.storeName ?? vendor.name, verified: vendor.verified, city: vendor.city } : null
  }
  return null
}

export async function compareSellers(options: { targetType: SocialTargetType; targetId: string }) {
  const target = await resolveTarget(options.targetType, options.targetId)
  if (!target) return null

  type Candidate = { source: 'BOOK' | 'PRODUCT'; listingId: string; vendorId: string; price: number | null }
  const candidates: Candidate[] = []

  if (!target.isbn) {
    // No stable identity → never group by title (spec §20).
    if (target.vendorId) {
      candidates.push({ source: options.targetType === 'BOOK' ? 'BOOK' : 'PRODUCT', listingId: target.id, vendorId: target.vendorId, price: target.price })
    }
    const offers = await buildOffers(candidates, target.id)
    return {
      grouped: false,
      reason: 'No ISBN is available for this item, so other sellers cannot be matched reliably.',
      target: { type: target.type, id: target.id, title: target.title, isbn: null, price: target.price },
      offers,
      recommended: null,
      ranking: rankingExplanation(0),
    }
  }

  if (!isDatabaseConfigured) {
    for (const book of mockStore.books.values()) {
      if (book.isbn === target.isbn && book.vendorId) {
        candidates.push({ source: 'BOOK', listingId: book.id, vendorId: book.vendorId, price: book.price })
      }
    }
    for (const offer of mockStore.offers) {
      if (offer.isbn === target.isbn && offer.status === 'ACTIVE') {
        candidates.push({ source: 'PRODUCT', listingId: offer.id, vendorId: offer.vendorId, price: offer.price })
      }
    }
  } else {
    const [dbBooks, dbProducts] = await Promise.all([
      prisma.book.findMany({
        where: { isbn: target.isbn, active: true, OR: [{ vendorId: null }, { vendor: { status: 'APPROVED' } }] },
        select: { id: true, price: true, vendorId: true },
      }),
      prisma.product.findMany({
        where: { isbn: target.isbn, status: 'ACTIVE', vendor: { status: 'APPROVED' } },
        select: { id: true, price: true, vendorId: true },
      }),
    ])
    for (const book of dbBooks) {
      if (book.vendorId) candidates.push({ source: 'BOOK', listingId: book.id, vendorId: book.vendorId, price: book.price === null ? null : Number(book.price) })
    }
    for (const product of dbProducts) {
      candidates.push({ source: 'PRODUCT', listingId: product.id, vendorId: product.vendorId, price: Number(product.price) })
    }
  }

  // Deduplicate per seller (keep the cheapest listing per seller).
  const bySeller = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const existing = bySeller.get(candidate.vendorId)
    if (!existing || (candidate.price ?? Infinity) < (existing.price ?? Infinity)) bySeller.set(candidate.vendorId, candidate)
  }
  const unique = [...bySeller.values()]
  const offers = await buildOffers(unique, target.id)
  const grouped = offers.length >= 2

  const prices = offers.map((offer) => offer.price).filter((price): price is number => price !== null).sort((a, b) => a - b)
  for (const offer of offers) {
    if (offer.price === null || prices.length < 2) {
      offer.pricePosition = 'SINGLE'
      continue
    }
    const mid = Math.floor(prices.length / 2)
    const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2
    offer.pricePosition = offer.price === prices[0] ? 'LOWEST' : offer.price === prices[prices.length - 1] ? 'HIGHEST'
      : offer.price <= median ? 'MEDIAN' : 'HIGHEST'
  }

  const priced = offers.filter((offer) => offer.price !== null)
  const minPrice = priced.length ? Math.min(...priced.map((offer) => offer.price!)) : null
  const maxPrice = priced.length ? Math.max(...priced.map((offer) => offer.price!)) : null
  for (const offer of offers) {
    if (offer.trustScore === null) {
      offer.rankScore = null // never rank on price alone
      continue
    }
    const priceComponent = offer.price === null || minPrice === null || maxPrice === null || maxPrice === minPrice
      ? 50
      : ((maxPrice - offer.price) / (maxPrice - minPrice)) * 100
    offer.rankScore = Math.round(offer.trustScore * COMPARISON_WEIGHTS.trust + priceComponent * COMPARISON_WEIGHTS.price)
  }

  const ranked = offers.filter((offer) => offer.rankScore !== null).sort((a, b) => b.rankScore! - a.rankScore!)
  const top = grouped ? ranked[0] : undefined
  const recommended = top
    ? { sellerId: top.sellerId, sellerName: top.sellerName, reasons: recommendationReasons(top, offers) }
    : grouped
      ? null // group exists but nobody has trust data → explain rather than guess
      : undefined

  return {
    grouped,
    reason: grouped ? undefined
      : offers.length < 2 ? 'Only one seller lists this edition right now.'
        : 'Not enough trust data to recommend a seller yet.',
    target: { type: target.type, id: target.id, title: target.title, isbn: target.isbn, price: target.price },
    offers,
    recommended: recommended ?? null,
    ranking: rankingExplanation(offers.filter((offer) => offer.rankScore !== null).length),
  }
}

function rankingExplanation(rankedCount: number) {
  return {
    method: 'trust-price',
    weights: COMPARISON_WEIGHTS,
    rankedCount,
    note: 'Recommended sellers are ranked with 60% seller trust score and 40% price position. '
      + 'Sellers without trust data are never auto-recommended.',
  }
}

function recommendationReasons(offer: SellerOfferDto, all: SellerOfferDto[]) {
  const reasons: string[] = []
  if (offer.trustScore !== null && offer.trustScore >= 85) reasons.push(`Strong seller trust score (${offer.trustScore}/100)`)
  else if (offer.trustScore !== null) reasons.push(`Seller trust score ${offer.trustScore}/100`)
  if (offer.pricePosition === 'LOWEST') reasons.push('Lowest price among listed sellers')
  else if (offer.pricePosition === 'MEDIAN') reasons.push('Competitive mid-range price')
  if (offer.sellerVerified) reasons.push('Identity-verified seller')
  const withoutTrust = all.filter((entry) => entry.trustScore === null).length
  if (withoutTrust) reasons.push(`${withoutTrust} seller${withoutTrust > 1 ? 's' : ''} lack trust data and were not auto-recommended`)
  return reasons
}

async function buildOffers(candidates: { source: 'BOOK' | 'PRODUCT'; listingId: string; vendorId: string; price: number | null }[], currentListingId: string): Promise<SellerOfferDto[]> {
  const offers: SellerOfferDto[] = []
  const passportCache = new Map<string, { score: number | null }>()
  for (const candidate of candidates) {
    const seller = await vendorMeta(candidate.vendorId)
    if (!seller) continue // suspended/unknown vendors are never listed
    if (!passportCache.has(candidate.vendorId)) {
      const passport = await getSellerPassport(candidate.vendorId)
      passportCache.set(candidate.vendorId, { score: passport?.score ?? null })
    }
    const trustScore = passportCache.get(candidate.vendorId)!.score
    offers.push({
      source: candidate.source,
      listingId: candidate.listingId,
      sellerId: seller.id,
      sellerName: seller.name,
      sellerVerified: seller.verified,
      sellerCity: seller.city,
      price: candidate.price,
      pricePosition: 'SINGLE',
      trustScore,
      trustDisplay: trustScore === null ? 'Not enough data' : `${trustScore}/100`,
      delivery: 'Not specified',
      warranty: 'Not specified',
      returns: 'Not specified',
      rankScore: null,
      isCurrentTarget: candidate.listingId === currentListingId,
    })
  }
  return offers.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
}
