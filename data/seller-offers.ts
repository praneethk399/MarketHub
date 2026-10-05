import { stableHash } from '@/lib/stable-hash'

/**
 * Competing marketplace listings for one book, grouped by ISBN.
 *
 * The storefront advertises how many sellers carry a title (`sellerCount`), so
 * every title with more than one seller must be backed by real rows — otherwise
 * seller comparison would claim "only one seller lists this edition" for books
 * the shelf says three sellers stock.
 *
 * The same builder feeds mock mode (`lib/mock-store.ts`) and the database seed
 * (`prisma/seed.ts`), so both modes expose identical offers.
 */

export type ComparisonOffer = {
  id: string
  isbn: string
  title: string
  vendorId: string
  price: number
  format: string
}

/** Book shape this builder needs — satisfied by `Book` from `data/books.ts`. */
export type OfferSourceBook = {
  id: string
  title: string
  isbn?: string
  price: number | null
  format: string
  vendorId?: string | null
  sellerCount: number
}

/**
 * Hand-written offers. These pin the demo comparison prices compared in the
 * test suite, so they always win over generated offers for the same ISBN.
 */
const curatedOffers: ComparisonOffer[] = [
  { id: 'offer-secret-garden-old-town', isbn: '9780141182186', title: 'The Secret Garden', vendorId: 'old-town-books', price: 285, format: 'paperback' },
  { id: 'offer-secret-garden-chapter-house', isbn: '9780141182186', title: 'The Secret Garden', vendorId: 'chapter-house', price: 315, format: 'paperback' },
  { id: 'offer-hobbit-old-town', isbn: '9780261103283', title: 'The Hobbit', vendorId: 'old-town-books', price: 385, format: 'paperback' },
  { id: 'offer-atomic-habits-paper-ink', isbn: '9780735211292', title: 'Atomic Habits', vendorId: 'paper-and-ink', price: 529, format: 'paperback' },
  { id: 'offer-atomic-habits-chapter-house', isbn: '9780735211292', title: 'Atomic Habits', vendorId: 'chapter-house', price: 559, format: 'paperback' },
]

const round5 = (value: number) => Math.max(49, Math.round(value / 5) * 5)

/**
 * Only ISBN-identified books can be compared, and a seller's own listing is
 * never duplicated: the catalogue row already represents it.
 */
export function buildComparisonOffers(catalogue: OfferSourceBook[], vendorIds: string[]): ComparisonOffer[] {
  const vendors = vendorIds.filter((id) => Boolean(id))
  const curatedIsbns = new Set(curatedOffers.map((offer) => offer.isbn))
  const offers = curatedOffers.filter((offer) => vendors.includes(offer.vendorId))

  for (const book of catalogue) {
    if (!book.isbn || book.price === null || !book.vendorId) continue
    if (curatedIsbns.has(book.isbn)) continue
    // A seller appears once per ISBN: at most (vendors - 1) competing listings.
    const competing = Math.min(Math.max(book.sellerCount - 1, 0), Math.max(vendors.length - 1, 0))
    let added = 0
    for (const vendorId of vendors) {
      if (added >= competing) break
      if (vendorId === book.vendorId) continue
      const hash = stableHash(`${book.id}:${vendorId}`)
      // Deterministic -6%..+12% spread so one seller is cheapest, another pricier.
      const jitter = -0.06 + (hash % 19) / 100
      offers.push({
        id: `offer-${book.id}-${vendorId}`,
        isbn: book.isbn,
        title: book.title,
        vendorId,
        price: round5(book.price * (1 + jitter)),
        format: book.format,
      })
      added += 1
    }
  }

  return offers
}
