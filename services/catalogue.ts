import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { books as curatedBooks, type Book } from '@/data/books'
import { openLibraryCover } from '@/data/books.base'
import { featuredRank } from '@/components/featured-selection'
import { stableHash } from '@/lib/stable-hash'

/**
 * The large catalogue, served a page at a time.
 *
 * Option 3 ingest: `scripts/import-catalogue.mjs` writes metadata-only records
 * from Open Library into `data/catalogue.imported.json`. Open Library has no
 * prices and no stock, and this service invents neither. An imported title is
 * therefore mapped with `price: null`, no stock, `status: 'out-of-stock'` and
 * `action: 'details'`, so the storefront shows "Price unavailable", offers no
 * Add-to-cart, and links to the detail page instead. A title becomes buyable only
 * when a vendor lists it with a real price and inventory — the PostgreSQL
 * `Product`/`Inventory` path, which is unchanged.
 *
 * This module is **server-only on purpose**. Ten thousand records must never reach
 * a client bundle, which is why the data is read from disk at runtime rather than
 * imported as a module, and why `assertServerOnly()` runs at load.
 *
 * The catalogue is paginated and searched **here**, not in the browser: the
 * previous design shipped the whole collection and filtered it in memory, which
 * does not survive 10,000 records.
 */

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('services/catalogue.ts is server-only; do not import it from a client component.')
  }
}

export type CatalogueRecord = {
  id: string
  title: string
  author: string
  isbn: string
  coverId: number
  firstPublishedYear: number | null
  category: string
}

export type CatalogueSort = 'catalogue' | 'title' | 'author' | 'newest'

export type CatalogueQuery = {
  query?: string
  category?: string
  sort?: CatalogueSort
  page?: number
  pageSize?: number
}

export type CataloguePage = {
  items: Book[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  matched: number
  categories: { name: string; count: number }[]
  sort: CatalogueSort
  source: 'imported'
}

export const MAX_PAGE_SIZE = 60
export const DEFAULT_PAGE_SIZE = 48

let cachedImported: CatalogueRecord[] | null = null

/** Loads the imported records once per process. Deliberately not a module import. */
export function importedRecords(): CatalogueRecord[] {
  assertServerOnly()
  if (cachedImported) return cachedImported
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'catalogue.imported.json'), 'utf8')
    const parsed = JSON.parse(raw) as { books?: CatalogueRecord[] }
    cachedImported = Array.isArray(parsed.books) ? parsed.books : []
  } catch (error) {
    console.error('[MarketHub] Imported catalogue is unavailable.', error)
    cachedImported = []
  }
  return cachedImported
}

/**
 * Maps an imported record to the storefront's `Book` shape **without inventing
 * anything**: no price, no stock, no rating, no seller count and no format (Open
 * Library does not carry one). `action: 'details'` is what keeps the card honest —
 * it offers "View details" rather than an Add-to-cart that could not succeed.
 */
export function importedAsBook(record: CatalogueRecord): Book {
  return {
    id: record.id,
    title: record.title,
    author: record.author,
    cover: openLibraryCover(record.coverId),
    isbn: record.isbn,
    price: null,
    stock: null,
    status: 'out-of-stock',
    sellerCount: 0,
    category: record.category,
    action: 'details',
  }
}

/** O(1) lookup for the book detail route, so a 10,000-record scan is not per request. */
let idIndex: Map<string, CatalogueRecord> | null = null

export function importedById(id: string): CatalogueRecord | undefined {
  if (!idIndex) idIndex = new Map(importedRecords().map((record) => [record.id, record]))
  return idIndex.get(id)
}

export function catalogueSize(): { curated: number; imported: number; total: number } {
  const imported = importedRecords().length
  return { curated: curatedBooks.length, imported, total: curatedBooks.length + imported }
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function matches(record: CatalogueRecord, needle: string) {
  return normalise(record.title).includes(needle)
    || normalise(record.author).includes(needle)
    || record.isbn.includes(needle)
    || normalise(record.category).includes(needle)
}

/**
 * Deterministic order for the default sort. `stableHash` keys the record's id, so
 * the same request returns the same page on every process, on every machine and
 * in any order the underlying data happens to be stored in.
 */
const catalogueRank = (record: CatalogueRecord) => stableHash(`catalogue:${record.id}`)

function compare(sort: CatalogueSort) {
  return (a: CatalogueRecord, b: CatalogueRecord) => {
    if (sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    if (sort === 'author') return a.author.localeCompare(b.author) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    if (sort === 'newest') {
      const year = (b.firstPublishedYear ?? 0) - (a.firstPublishedYear ?? 0)
      return year || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    }
    return catalogueRank(a) - catalogueRank(b) || a.id.localeCompare(b.id)
  }
}

/** A page of the imported catalogue, with the facets the browse UI needs. */
export function browseCatalogue(input: CatalogueQuery = {}): CataloguePage {
  const sort: CatalogueSort = input.sort ?? 'catalogue'
  const pageSize = Math.min(Math.max(1, Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
  const all = importedRecords()

  const needle = input.query ? normalise(input.query) : ''
  const filtered = all.filter((record) => (
    (!needle || matches(record, needle))
    && (!input.category || input.category === 'All' || record.category === input.category)
  ))

  const matched = filtered.length
  const pageCount = Math.max(1, Math.ceil(matched / pageSize))
  const page = Math.min(Math.max(1, Math.trunc(input.page ?? 1)), pageCount)
  const start = (page - 1) * pageSize

  const selected = [...filtered].sort(compare(sort)).slice(start, start + pageSize)

  /* Facets are counted over the query-filtered set but not over the category
     filter, so a reader can always see and switch between categories. */
  const counts = new Map<string, number>()
  for (const record of all) {
    if (needle && !matches(record, needle)) continue
    counts.set(record.category, (counts.get(record.category) ?? 0) + 1)
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    items: selected.map(importedAsBook),
    total: all.length,
    page,
    pageSize,
    pageCount,
    matched,
    categories,
    sort,
    source: 'imported',
  }
}

/**
 * The featured shelf, chosen server-side so the browser never needs the whole
 * collection. Uses the same documented rule as the client component: purchasable
 * titles first (there are none among imported records, which is why the stored
 * catalogue's curated titles lead), ranked by a stable hash of the id.
 */
export function featuredCatalogue(limit = 7): Book[] {
  const purchasable = curatedBooks.filter((book) => book.status === 'in-stock' && book.price !== null)
  const pool = purchasable.length > 0 ? purchasable : [...curatedBooks, ...importedRecords().map(importedAsBook)]
  return [...pool]
    .sort((a, b) => featuredRank(a) - featuredRank(b) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
}
