import assert from 'node:assert/strict'
import { test } from 'node:test'
import { books as curatedBooks } from '@/data/books'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  browseCatalogue,
  catalogueSize,
  featuredCatalogue,
  importedAsBook,
  importedById,
  importedRecords,
} from '@/services/catalogue'

/**
 * The large catalogue is the browse surface for thousands of metadata-only
 * records, so three properties are load-bearing and pinned here: pagination must
 * be **total and non-overlapping** (or titles silently disappear or repeat), the
 * order must be **deterministic** (or the same page changes between requests and
 * between server and client), and no imported record may carry a **price or stock**
 * it was never given — the whole point of the vendor-owned pricing decision.
 */

const records = importedRecords()

test('the imported catalogue loaded and is substantial', () => {
  assert.ok(records.length > 1000, `expected a large catalogue, got ${records.length}`)
  for (const record of records.slice(0, 50)) {
    assert.ok(record.id && record.title && record.author, 'every record has identity')
    assert.match(record.isbn, /^97[89]\d{10}$/, `${record.isbn} must be a valid ISBN-13`)
    assert.ok(Number.isInteger(record.coverId) && record.coverId > 0, 'every record has a cover id')
    assert.ok(record.category, 'every record has a category')
  }
})

test('imported records carry no price, no stock and no invented format', () => {
  const book = importedAsBook(records[0])

  assert.equal(book.price, null, 'price must be null until a vendor sets one')
  assert.equal(book.stock, null, 'stock must be null — Open Library states none')
  assert.equal(book.status, 'out-of-stock', 'nothing is purchasable from imported metadata')
  assert.equal(book.action, 'details', 'the card must offer details, not a doomed add-to-cart')
  assert.equal(book.sellerCount, 0)
  assert.ok(!('format' in book), 'format must be absent rather than guessed')
  assert.ok(book.cover.startsWith('https://covers.openlibrary.org/'), 'covers come from the allowed CDN')

  // And the underlying file must not have grown price/stock fields either.
  const polluted = records.filter((record) => 'price' in record || 'stock' in record)
  assert.equal(polluted.length, 0, 'the imported data file must carry no price or stock values')
})

test('paging is complete and does not repeat titles', () => {
  const pageSize = 100
  const first = browseCatalogue({ pageSize, page: 1 })
  const total = first.pageCount
  assert.ok(total > 10, 'a 10,000-title catalogue must span many pages')

  const seen = new Set<string>()
  for (let page = 1; page <= total; page += 1) {
    const current = browseCatalogue({ pageSize, page })
    for (const book of current.items) {
      assert.ok(!seen.has(book.id), `${book.id} appeared on more than one page`)
      seen.add(book.id)
    }
  }
  assert.equal(seen.size, first.matched, 'the pages together must cover every matched title')
})

test('the same request returns the same page', () => {
  const once = browseCatalogue({ page: 3, pageSize: 25 }).items.map((book) => book.id)
  const twice = browseCatalogue({ page: 3, pageSize: 25 }).items.map((book) => book.id)
  assert.deepEqual(twice, once)
})

test('page and page size are bounded', () => {
  assert.ok(browseCatalogue({ pageSize: 100_000 }).pageSize <= MAX_PAGE_SIZE, 'page size is capped')
  assert.equal(browseCatalogue({}).pageSize, DEFAULT_PAGE_SIZE, 'default page size is used')

  const overrun = browseCatalogue({ page: 999_999, pageSize: 10 })
  assert.equal(overrun.page, overrun.pageCount, 'a page past the end clamps to the last page')
  assert.ok(overrun.items.length > 0)

  const zero = browseCatalogue({ page: 0, pageSize: 0 })
  assert.equal(zero.page, 1, 'page 0 clamps to 1')
  assert.ok(zero.pageSize >= 1, 'page size 0 clamps to 1')
})

test('search matches title, author, ISBN and category', () => {
  const sample = records[0]

  const byIsbn = browseCatalogue({ query: sample.isbn })
  assert.ok(byIsbn.matched >= 1, 'an ISBN must find its record')
  assert.ok(byIsbn.items.some((book) => book.id === sample.id))

  const byTitle = browseCatalogue({ query: sample.title.split(' ')[0] })
  assert.ok(byTitle.matched >= 1, 'a title word must find something')

  const byAuthor = browseCatalogue({ query: sample.author.split(' ').slice(-1)[0] })
  assert.ok(byAuthor.matched >= 1, 'an author surname must find something')

  const byCategory = browseCatalogue({ query: sample.category })
  assert.ok(byCategory.matched >= 1, 'a category name must find something')

  assert.equal(browseCatalogue({ query: 'zzzz-no-such-title-zzzz' }).matched, 0, 'a miss returns nothing')
  assert.equal(browseCatalogue({ query: 'zzzz-no-such-title-zzzz' }).items.length, 0)
})

test('category filtering and facets agree', () => {
  const all = browseCatalogue({ pageSize: MAX_PAGE_SIZE })
  const facetTotal = all.categories.reduce((sum, entry) => sum + entry.count, 0)
  assert.equal(facetTotal, all.matched, 'facet counts must cover exactly the matched set')
  assert.ok(all.categories.length > 5, 'a broad catalogue reports more than a handful of categories')

  const name = all.categories[0].name
  const filtered = browseCatalogue({ category: name, pageSize: MAX_PAGE_SIZE })
  assert.equal(filtered.matched, all.categories[0].count, 'the facet count must match the filtered total')
  assert.ok(filtered.items.every((book) => book.category === name), 'filtering must not leak other categories')

  const unknown = browseCatalogue({ category: 'Not A Category' })
  assert.equal(unknown.matched, 0, 'an unknown category matches nothing rather than everything')
})

test('sorting is stable and matches the requested order', () => {
  const byTitle = browseCatalogue({ sort: 'title', pageSize: MAX_PAGE_SIZE }).items.map((book) => book.title)
  assert.deepEqual(byTitle, [...byTitle].sort((a, b) => a.localeCompare(b)), 'title sort is ascending')

  const byAuthor = browseCatalogue({ sort: 'author', pageSize: MAX_PAGE_SIZE }).items.map((book) => book.author)
  assert.deepEqual(byAuthor, [...byAuthor].sort((a, b) => a.localeCompare(b)), 'author sort is ascending')

  const years = browseCatalogue({ sort: 'newest', pageSize: MAX_PAGE_SIZE })
    .items.map((book) => records.find((record) => record.id === book.id)?.firstPublishedYear ?? 0)
  assert.deepEqual(years, [...years].sort((a, b) => b - a), 'newest sorts by descending publication year')
})

test('a single record resolves by id, and unknown ids do not', () => {
  const sample = records[0]
  assert.equal(importedById(sample.id)?.id, sample.id)
  assert.equal(importedById('definitely-not-a-book-id'), undefined)
})

test('the reported size adds up', () => {
  const size = catalogueSize()
  assert.equal(size.imported, records.length)
  assert.equal(size.curated, curatedBooks.length)
  assert.equal(size.total, size.curated + size.imported)
})

test('the featured shelf is deterministic, unique and sized', () => {
  const once = featuredCatalogue().map((book) => book.id)
  const twice = featuredCatalogue().map((book) => book.id)
  assert.deepEqual(twice, once)
  assert.equal(once.length, 7)
  assert.equal(new Set(once).size, once.length, 'no duplicate books on the shelf')
  // The curated, priced titles lead; imported metadata-only records are the fallback pool.
  const priced = featuredCatalogue().filter((book) => book.price !== null)
  assert.ok(priced.length > 0, 'priced catalogue titles are preferred for the shelf')
  assert.equal(featuredCatalogue(0).length, 0)
})
