import {
  baseBookData,
  mockSellerCounts,
  openLibraryCover,
  type BaseBook,
  type Book,
} from './books.base'
import { generatedBooks } from './books.generated'
import { stableHash } from '@/lib/stable-hash'

export type { Book }

/**
 * The single book catalogue every service and component imports.
 *
 * Two sources are composed:
 * - `books.base.ts`       curated titles, maintained by hand.
 * - `books.generated.ts`  titles obtained from the Open Library API by
 *                         `scripts/fetch-books.mjs`.
 *
 * Nothing here is random or position-dependent: ids, prices, ratings and seller
 * counts are all derived from a stable hash of the book id, so the catalogue is
 * identical on every boot, on every machine and across mock mode and the
 * database seed.
 */

const round5 = (value: number) => Math.max(99, Math.round(value / 5) * 5)

function generatedToBase(book: (typeof generatedBooks)[number]): BaseBook {
  const hash = stableHash(book.id)
  const price = 199 + (hash % 41) * 12
  const discount = 20 + ((hash >>> 5) % 21)
  const rating = Number((4.1 + ((hash >>> 11) % 9) * 0.1).toFixed(1))
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    cover: openLibraryCover(book.coverId),
    isbn: book.isbn,
    price,
    originalPrice: round5(price / (1 - discount / 100)),
    rating,
    reviews: 120 + ((hash >>> 7) % 980),
    stock: 4 + ((hash >>> 3) % 26),
    status: 'in-stock',
    badge: hash % 11 === 0 ? 'NEW ARRIVAL' : undefined,
    category: book.category,
    format: hash % 3 === 0 ? 'hardcover' : 'paperback',
  }
}

const allBooks: BaseBook[] = [...baseBookData, ...generatedBooks.map(generatedToBase)]

export const books: Book[] = allBooks.map((book) => ({
  ...book,
  sellerCount: mockSellerCounts[book.id] ?? 1 + (stableHash(book.id) % 4),
}))

const categoryNames = [...new Set(books.map((book) => book.category))].sort((a, b) => a.localeCompare(b))

/** Category facets with real catalogue counts (never invented numbers). */
export const categories = [
  { name: 'All', count: books.length },
  ...categoryNames.map((name) => ({ name, count: books.filter((book) => book.category === name).length })),
]

/** Format facets with real catalogue counts. */
export const formats = [
  { name: 'paperback', label: 'Paperback', count: books.filter((book) => book.format === 'paperback').length },
  { name: 'hardcover', label: 'Hardcover', count: books.filter((book) => book.format === 'hardcover').length },
]
