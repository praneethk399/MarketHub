import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

/**
 * Seller Passport (spec §15/§16) — an explainable seller score derived from
 * actual platform data only. Nothing here is invented: when there is not
 * enough data the factor (or the whole score) reports "Not enough data"
 * instead of a fabricated number (spec §53).
 *
 * SELLER SCORE FORMULA (documented weighting, spec §16):
 *
 *   Seller Score = weighted average of available factors, weights renormalised
 *
 *   customerSatisfaction  30%  avg review rating on the seller's items / 5
 *   deliveryReliability   25%  delivered / (delivered + cancelled) terminal orders
 *   ISBN data quality     15%  share of listings carrying a checksum-valid ISBN
 *   disputePerformance    15%  1 - refunded orders / all orders (refund proxy)
 *   priceCompetitiveness  15%  share of ISBN groups where the seller is at/below median
 *   returnPerformance      —   no returns are tracked in this schema, so the factor
 *                              is always reported as "Not enough data" (weight 0)
 *
 * Minimum data requirements before a factor counts:
 *   satisfaction >= 5 reviews, delivery >= 4 terminal orders,
 *   authenticity >= 3 listings, disputes >= 5 orders, price >= 1 ISBN group.
 *
 * The overall score requires at least 2 available factors, one of which must
 * be satisfaction or delivery; otherwise the passport reports "Not enough data".
 */

export const SELLER_SCORE_WEIGHTS = {
  satisfaction: 0.30,
  delivery: 0.25,
  authenticity: 0.15,
  disputes: 0.15,
  price: 0.15,
  returns: 0, // no data source in the schema — never fabricated
} as const

const MIN_REVIEWS = 5
const MIN_LISTINGS = 3
const MIN_ORDERS = 5
const MIN_TERMINAL_ORDERS = 4

export type SellerFactorInput = {
  satisfaction: { avgRating: number; count: number } | null
  delivery: { delivered: number; cancelled: number } | null
  authenticity: { complete: number; total: number } | null
  disputes: { refunded: number; total: number } | null
  price: { atOrBelowMedian: number; groups: number } | null
}

export type SellerFactor = {
  key: keyof typeof SELLER_SCORE_WEIGHTS
  label: string
  available: boolean
  value: number | null
  display: string
  weight: number
  reason: string
  dataPoints: number
}

export type SellerScoreResult = {
  score: number | null
  factors: SellerFactor[]
  reasons: string[]
  watchouts: string[]
  insufficient: string[]
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function hasValidIsbn(isbn: string | null) {
  if (!isbn) return false
  const value = isbn.replace(/[-\s]/g, '').toUpperCase()
  if (/^\d{13}$/.test(value)) {
    const sum = [...value].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
    return sum % 10 === 0
  }
  if (/^\d{9}[\dX]$/.test(value)) {
    const sum = [...value].reduce((total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0)
    return sum % 11 === 0
  }
  return false
}

export function computeSellerScore(input: SellerFactorInput): SellerScoreResult {
  const factors: SellerFactor[] = []

  const satisfactionValue = input.satisfaction && input.satisfaction.count >= MIN_REVIEWS
    ? (input.satisfaction.avgRating / 5) * 100
    : null
  factors.push({
    key: 'satisfaction', label: 'Customer satisfaction', available: satisfactionValue !== null,
    value: satisfactionValue === null ? null : round(satisfactionValue),
    display: satisfactionValue === null ? 'Not enough data'
      : `${round(satisfactionValue)}% (${round(input.satisfaction!.avgRating)}/5 from ${input.satisfaction!.count} reviews)`,
    weight: SELLER_SCORE_WEIGHTS.satisfaction,
    reason: satisfactionValue === null
      ? `Needs at least ${MIN_REVIEWS} customer reviews.`
      : 'Average rating across verified reviews on this seller’s items.',
    dataPoints: input.satisfaction?.count ?? 0,
  })

  const terminal = input.delivery ? input.delivery.delivered + input.delivery.cancelled : 0
  const deliveryValue = input.delivery && terminal >= MIN_TERMINAL_ORDERS
    ? (input.delivery.delivered / terminal) * 100
    : null
  factors.push({
    key: 'delivery', label: 'Delivery reliability', available: deliveryValue !== null,
    value: deliveryValue === null ? null : round(deliveryValue),
    display: deliveryValue === null ? 'Not enough data' : `${round(deliveryValue)}% of settled orders delivered`,
    weight: SELLER_SCORE_WEIGHTS.delivery,
    reason: deliveryValue === null
      ? `Needs at least ${MIN_TERMINAL_ORDERS} settled (delivered or cancelled) orders.`
      : 'Share of settled orders that ended delivered instead of cancelled.',
    dataPoints: terminal,
  })

  const authenticityValue = input.authenticity && input.authenticity.total >= MIN_LISTINGS
    ? (input.authenticity.complete / input.authenticity.total) * 100
    : null
  factors.push({
    key: 'authenticity', label: 'ISBN data quality', available: authenticityValue !== null,
    value: authenticityValue === null ? null : round(authenticityValue),
    display: authenticityValue === null ? 'Not enough data'
      : `${round(authenticityValue)}% of listings have a checksum-valid ISBN`,
    weight: SELLER_SCORE_WEIGHTS.authenticity,
    reason: authenticityValue === null
      ? `Needs at least ${MIN_LISTINGS} active listings.`
      : 'Share of active listings with a checksum-valid ISBN-10 or ISBN-13; this is not proof of physical-item authenticity.',
    dataPoints: input.authenticity?.total ?? 0,
  })

  const disputeValue = input.disputes && input.disputes.total >= MIN_ORDERS
    ? (1 - input.disputes.refunded / input.disputes.total) * 100
    : null
  factors.push({
    key: 'disputes', label: 'Dispute performance', available: disputeValue !== null,
    value: disputeValue === null ? null : round(disputeValue),
    display: disputeValue === null ? 'Not enough data'
      : `${round(disputeValue)}% of orders completed without refund`,
    weight: SELLER_SCORE_WEIGHTS.disputes,
    reason: disputeValue === null
      ? `Needs at least ${MIN_ORDERS} orders.`
      : 'Refunded (disputed/cancelled) orders as a share of all orders.',
    dataPoints: input.disputes?.total ?? 0,
  })

  const priceValue = input.price && input.price.groups >= 1
    ? (input.price.atOrBelowMedian / input.price.groups) * 100
    : null
  factors.push({
    key: 'price', label: 'Price competitiveness', available: priceValue !== null,
    value: priceValue === null ? null : round(priceValue),
    display: priceValue === null ? 'Not enough data'
      : `${round(priceValue)}% of comparable ISBN groups at or below median price`,
    weight: SELLER_SCORE_WEIGHTS.price,
    reason: priceValue === null
      ? 'Needs at least one ISBN where other sellers list the same edition.'
      : 'How often this seller is priced at or below the median for the same ISBN.',
    dataPoints: input.price?.groups ?? 0,
  })

  factors.push({
    key: 'returns', label: 'Return performance', available: false, value: null,
    display: 'Not enough data', weight: 0,
    reason: 'Returns are not tracked on this platform yet, so no number is shown.',
    dataPoints: 0,
  })

  const usable = factors.filter((factor) => factor.available && factor.weight > 0)
  const coreAvailable = usable.some((factor) => factor.key === 'satisfaction' || factor.key === 'delivery')
  const score = usable.length >= 2 && coreAvailable
    ? round(usable.reduce((sum, factor) => sum + factor.value! * factor.weight, 0)
      / usable.reduce((sum, factor) => sum + factor.weight, 0))
    : null

  const labelFor = (value: number) => (value >= 85 ? 'Strong' : value >= 70 ? 'Solid' : 'Needs attention')
  const reasons = usable
    .filter((factor) => factor.value! >= 70)
    .map((factor) => `${labelFor(factor.value!)} ${factor.label.toLowerCase()}: ${factor.display}`)
  const watchouts = usable
    .filter((factor) => factor.value! < 70)
    .map((factor) => `Needs attention ${factor.label.toLowerCase()}: ${factor.display}`)

  return {
    score,
    factors,
    reasons,
    watchouts,
    insufficient: factors.filter((factor) => !factor.available).map((factor) => factor.label),
  }
}

type RawMetrics = SellerFactorInput

function metricsFromRows(options: {
  books: { id: string; isbn: string | null; active?: boolean }[]
  products: { id: string; isbn: string | null; price: number }[]
  reviews: { rating: number }[]
  orders: { status: string; refunded: boolean }[]
  priceGroups: { prices: number[]; vendorPrices: number[] }[]
}): RawMetrics {
  const { books, products, reviews, orders, priceGroups } = options

  const satisfaction = reviews.length
    ? { avgRating: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length, count: reviews.length }
    : null

  const delivered = orders.filter((order) => order.status === 'DELIVERED').length
  const cancelled = orders.filter((order) => order.status === 'CANCELLED').length
  const delivery = orders.length ? { delivered, cancelled } : null

  const listings = [...books, ...products]
  const authenticity = listings.length
    ? { complete: listings.filter((listing) => hasValidIsbn(listing.isbn)).length, total: listings.length }
    : null

  const refunded = orders.filter((order) => order.refunded).length
  const disputes = orders.length ? { refunded, total: orders.length } : null

  const comparable = priceGroups.filter((group) => group.prices.length >= 2)
  const price = comparable.length
    ? {
        atOrBelowMedian: comparable.filter((group) => {
          const sorted = [...group.prices].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
          return group.vendorPrices.some((value) => value <= median)
        }).length,
        groups: comparable.length,
      }
    : null

  return { satisfaction, delivery, authenticity, disputes, price }
}

/** ISBN groups (>=2 distinct sellers) that this vendor participates in. */
async function priceGroupsFor(vendorBooks: { isbn: string | null; price: number | null; vendorId: string | null }[], vendorId: string) {
  const isbns = [...new Set(vendorBooks.map((book) => book.isbn).filter((isbn): isbn is string => Boolean(isbn)))]
  if (!isbns.length) return []
  if (!isDatabaseConfigured) {
    const groups: { prices: number[]; vendorPrices: number[] }[] = []
    for (const isbn of isbns) {
      const prices: number[] = []
      const vendorPrices: number[] = []
      for (const book of mockStore.books.values()) {
        if (book.isbn === isbn && book.price !== null && book.vendorId) {
          prices.push(book.price)
          if (book.vendorId === vendorId) vendorPrices.push(book.price)
        }
      }
      for (const offer of mockStore.offers) {
        if (offer.isbn === isbn && offer.status === 'ACTIVE') {
          prices.push(offer.price)
          if (offer.vendorId === vendorId) vendorPrices.push(offer.price)
        }
      }
      if (vendorPrices.length) groups.push({ prices, vendorPrices })
    }
    return groups
  }
  const [dbBooks, dbProducts] = await Promise.all([
    prisma.book.findMany({
      where: { isbn: { in: isbns }, active: true },
      select: { isbn: true, price: true, vendorId: true },
    }),
    prisma.product.findMany({
      where: { isbn: { in: isbns }, status: 'ACTIVE', vendor: { status: 'APPROVED' } },
      select: { isbn: true, price: true, vendorId: true },
    }),
  ])
  const groups = new Map<string, { prices: number[]; vendorPrices: number[] }>()
  const push = (isbn: string | null, price: number | null, rowVendorId: string | null) => {
    if (!isbn || price === null) return
    const group = groups.get(isbn) ?? { prices: [], vendorPrices: [] }
    group.prices.push(price)
    if (rowVendorId === vendorId) group.vendorPrices.push(price)
    groups.set(isbn, group)
  }
  for (const book of dbBooks) push(book.isbn, book.price, book.vendorId)
  for (const product of dbProducts) push(product.isbn, Number(product.price), product.vendorId)
  return [...groups.values()].filter((group) => group.vendorPrices.length > 0)
}

export async function getVendorPublicRow(vendorId: string) {
  if (!isDatabaseConfigured) {
    const vendor = mockStore.vendors.find((entry) => entry.id === vendorId)
    if (!vendor || (vendor.status && vendor.status !== 'APPROVED')) return null
    return {
      id: vendor.id, name: vendor.name, storeName: vendor.storeName ?? vendor.name, slug: vendor.slug ?? vendor.id,
      city: vendor.city, verified: vendor.verified, activeSince: vendor.activeSince,
    }
  }
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, status: 'APPROVED' },
    select: { id: true, name: true, storeName: true, slug: true, city: true, verified: true, activeSince: true },
  })
  if (!vendor) return null
  return {
    id: vendor.id, name: vendor.name, storeName: vendor.storeName ?? vendor.name, slug: vendor.slug ?? vendor.id,
    city: vendor.city, verified: vendor.verified, activeSince: vendor.activeSince.toISOString(),
  }
}

export async function computeSellerMetrics(vendorId: string): Promise<{ raw: RawMetrics; result: SellerScoreResult } | null> {
  const vendor = await getVendorPublicRow(vendorId)
  if (!vendor) return null

  if (!isDatabaseConfigured) {
    const books = [...mockStore.books.values()]
      .filter((book) => book.vendorId === vendorId)
      .map((book) => ({ id: book.id, isbn: book.isbn ?? null, active: book.status !== 'out-of-stock' }))
    const bookIds = new Set(books.map((book) => book.id))
    const products = mockStore.offers
      .filter((offer) => offer.vendorId === vendorId && offer.status === 'ACTIVE')
      .map((offer) => ({ id: offer.id, isbn: offer.isbn, price: offer.price }))
    const reviews = mockStore.reviews
      .filter((review) => review.verified && bookIds.has(review.bookId ?? review.productId))
    const orders = mockStore.orders
      .filter((order) => order.items.some((item) => bookIds.has(item.bookId)))
      .map((order) => ({ status: order.status, refunded: order.payment?.status === 'REFUNDED' }))
    const priceGroups = await priceGroupsFor(
      [...mockStore.books.values()].filter((book) => book.vendorId === vendorId)
        .map((book) => ({ isbn: book.isbn ?? null, price: book.price, vendorId: book.vendorId ?? null })),
      vendorId,
    )
    return { raw: metricsFromRows({ books, products, reviews, orders, priceGroups }), result: computeSellerScore(metricsFromRows({ books, products, reviews, orders, priceGroups })) }
  }

  const [dbBooks, dbProducts] = await Promise.all([
    prisma.book.findMany({ where: { vendorId, active: true }, select: { id: true, isbn: true, price: true, vendorId: true } }),
    prisma.product.findMany({
      where: { vendorId, status: 'ACTIVE' },
      select: { id: true, isbn: true, price: true },
    }),
  ])
  const bookIds = dbBooks.map((book) => book.id)
  const productIds = dbProducts.map((product) => product.id)

  const [reviews, orderItems] = await Promise.all([
    prisma.review.findMany({
      where: { verified: true, OR: [{ bookId: { in: bookIds } }, { productId: { in: productIds } }] },
      select: { rating: true },
    }),
    prisma.orderItem.findMany({
      where: { OR: [{ vendorId: vendorId }, { bookId: { in: bookIds } }, { productId: { in: productIds } }] },
      select: { order: { select: { id: true, status: true, payment: { select: { status: true } } } } },
    }),
  ])
  const orders = [...new Map(orderItems.map((item) => [item.order.id, {
    status: item.order.status,
    refunded: item.order.payment?.status === 'REFUNDED',
  }])).values()]
  const priceGroups = await priceGroupsFor(
    dbBooks.map((book) => ({ isbn: book.isbn, price: book.price, vendorId: book.vendorId })),
    vendorId,
  )
  const raw = metricsFromRows({
    books: dbBooks.map((book) => ({ id: book.id, isbn: book.isbn, price: Number(book.price) })),
    products: dbProducts.map((product) => ({ id: product.id, isbn: product.isbn, price: Number(product.price) })),
    reviews, orders, priceGroups,
  })
  return { raw, result: computeSellerScore(raw) }
}

export type SellerPassportDto = {
  vendor: NonNullable<Awaited<ReturnType<typeof getVendorPublicRow>>>
  score: number | null
  scoreDisplay: string
  metrics: {
    authenticity: string
    onTimeDelivery: string
    returnRate: string
    disputeRate: string
    customerSatisfaction: string
    priceCompetitiveness: string
    activeSince: string
  }
  factors: SellerFactor[]
  reasons: string[]
  watchouts: string[]
  insufficient: string[]
  formula: { weights: typeof SELLER_SCORE_WEIGHTS; expression: string }
}

export async function getSellerPassport(vendorId: string): Promise<SellerPassportDto | null> {
  const vendor = await getVendorPublicRow(vendorId)
  if (!vendor) return null
  const computed = await computeSellerMetrics(vendorId)
  if (!computed) return null
  const { result } = computed
  const byKey = new Map(result.factors.map((factor) => [factor.key, factor]))
  const display = (key: keyof typeof SELLER_SCORE_WEIGHTS) => byKey.get(key)?.display ?? 'Not enough data'

  return {
    vendor,
    score: result.score,
    scoreDisplay: result.score === null ? 'Not enough data' : `${result.score}/100`,
    metrics: {
      authenticity: display('authenticity'),
      onTimeDelivery: display('delivery'),
      returnRate: display('returns'),
      disputeRate: display('disputes'),
      customerSatisfaction: display('satisfaction'),
      priceCompetitiveness: display('price'),
      activeSince: new Date(vendor.activeSince).getFullYear().toString(),
    },
    factors: result.factors,
    reasons: result.reasons,
    watchouts: result.watchouts,
    insufficient: result.insufficient,
    formula: {
      weights: SELLER_SCORE_WEIGHTS,
      expression: 'Seller Score = Σ(factor × weight) / Σ(available weights), documented in services/sellerPassport.service.ts',
    },
  }
}
