import { books, priceHistory, sellerOffers, sellerProfiles, type Book, type SellerProfile } from './books'

export const rankingWeights = [
  { key: 'relevance', label: 'Relevance', weight: 35 },
  { key: 'trust', label: 'Seller trust', weight: 25 },
  { key: 'price', label: 'Price', weight: 20 },
  { key: 'delivery', label: 'Delivery', weight: 10 },
  { key: 'rating', label: 'Reader rating', weight: 10 }
] as const

export type RankingFactors = Record<(typeof rankingWeights)[number]['key'], number>

export function getSellerProfile(name: string) {
  return sellerProfiles.find((profile) => profile.name === name)
}

export function getSellerScore(profile: SellerProfile) {
  const returnScore = Math.max(0, 100 - profile.returnRatePct * 5)
  const disputeScore = Math.max(0, 100 - profile.disputeRatePct * 10)
  const salesScore = Math.min(100, profile.booksSold / 10)
  const tenureScore = Math.min(100, Math.max(0, new Date().getFullYear() - Number(profile.activeSince.slice(-4))) * 12)
  return Math.round(profile.authenticityPct * 0.3 + profile.onTimeDeliveryPct * 0.25 + returnScore * 0.15 + disputeScore * 0.15 + salesScore * 0.1 + tenureScore * 0.05)
}

export function getLowestBookPrice(book: Book) {
  const offers = sellerOffers[book.id] || []
  const prices = [book.price, ...offers.map((offer) => offer.price)].filter((price): price is number => price !== null)
  return prices.length ? Math.min(...prices) : Number.MAX_SAFE_INTEGER
}

function getFastestDeliveryDays(book: Book) {
  const offers = sellerOffers[book.id] || []
  return Math.min(...[
    getSellerProfile(book.vendor)?.deliveryDays ?? 5,
    ...offers.map((offer) => offer.deliveryDays)
  ])
}

function getBookSellerScore(book: Book) {
  const profile = getSellerProfile(book.vendor)
  return profile ? getSellerScore(profile) : 0
}

export function getRankingFactors(book: Book, query = ''): RankingFactors {
  const normalizedQuery = query.trim().toLowerCase()
  const searchable = `${book.title} ${book.author} ${book.category} ${book.subcategory}`.toLowerCase()
  const relevance = normalizedQuery ? (searchable.includes(normalizedQuery) ? 100 : 45) : 80
  const profile = getSellerProfile(book.vendor)
  const trust = profile ? getSellerScore(profile) : 50
  const availablePrices = books.map(getLowestBookPrice).filter(Number.isFinite)
  const lowest = Math.min(...availablePrices)
  const highest = Math.max(...availablePrices)
  const price = book.price === null ? 0 : highest === lowest ? 100 : Math.round(100 - ((getLowestBookPrice(book) - lowest) / (highest - lowest)) * 100)
  const delivery = Math.round(Math.max(0, Math.min(100, 100 - getFastestDeliveryDays(book) * 12)))
  const rating = book.rating === null ? 0 : Math.round(book.rating * 20)
  return { relevance, trust, price, delivery, rating }
}

export function getOverallRankingScore(book: Book, query = '') {
  const factors = getRankingFactors(book, query)
  return Math.round(rankingWeights.reduce((sum, factor) => sum + factors[factor.key] * factor.weight / 100, 0))
}

export type BuyingPriority = 'Lowest Price' | 'Fastest Delivery' | 'Most Trusted Seller' | 'Best Return Policy' | 'Local Seller' | 'Best Overall Value'

export const buyingPriorities: BuyingPriority[] = [
  'Lowest Price',
  'Fastest Delivery',
  'Most Trusted Seller',
  'Best Return Policy',
  'Local Seller',
  'Best Overall Value'
]

export function sortBooksForPriority(items: Book[], priority: BuyingPriority, query = '') {
  return [...items].sort((a, b) => {
    if (priority === 'Lowest Price') return getLowestBookPrice(a) - getLowestBookPrice(b)
    if (priority === 'Fastest Delivery') return getFastestDeliveryDays(a) - getFastestDeliveryDays(b)
    if (priority === 'Most Trusted Seller') return getBookSellerScore(b) - getBookSellerScore(a)
    if (priority === 'Best Return Policy') return (getSellerProfile(b.vendor)?.returnWindowDays || 0) - (getSellerProfile(a.vendor)?.returnWindowDays || 0)
    if (priority === 'Local Seller') return Number(getSellerProfile(b.vendor)?.city === 'Pune') - Number(getSellerProfile(a.vendor)?.city === 'Pune')
    return getOverallRankingScore(b, query) - getOverallRankingScore(a, query)
  })
}

export function getBookPriceHistory(book: Book) {
  return priceHistory[book.id] || []
}
