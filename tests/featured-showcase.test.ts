import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { books as seededBooks, type Book } from '@/data/books'
import {
  activeIndexFor,
  announcementFor,
  featuredShelfSize,
  formatShelfIndex,
  selectFeaturedBooks,
  sideIndices,
} from '@/components/featured-selection'
import {
  catalogueFallbackNotice,
  getCatalogueSnapshot,
  loadCatalogue,
  resetCatalogueForTests,
} from '@/components/catalogue-store'

/**
 * The featured shelf is the first thing a reader sees, so its two promises are
 * load-bearing and worth pinning down: it must be *stable* (same books on the
 * server, the client and every refresh — no hydration mismatch, no reshuffle) and
 * it must be *real* (only actual purchasable catalogue records, never invented
 * rows). The shared store gets the same treatment for its one-request and
 * stale-response guarantees, which is what keeps the shelf and the grid aligned.
 */

function book(id: string, overrides: Partial<Book> = {}): Book {
  return {
    id,
    title: `Title ${id}`,
    author: `Author ${id}`,
    cover: `https://covers.openlibrary.org/b/id/1-L.jpg?default=false`,
    price: 299,
    stock: 5,
    status: 'in-stock',
    sellerCount: 2,
    category: 'Fiction',
    format: 'paperback',
    ...overrides,
  }
}

const catalogue = (count: number) => Array.from({ length: count }, (_, index) => book(`book-${index}`))

const realFetch = globalThis.fetch

beforeEach(() => {
  resetCatalogueForTests()
})

afterEach(() => {
  globalThis.fetch = realFetch
})

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response
}

/* ── Selection rule ───────────────────────────────────────────────────────── */

test('the same shelf is produced regardless of catalogue order', () => {
  const items = catalogue(40)
  const forwards = selectFeaturedBooks(items).map((entry) => entry.id)
  const backwards = selectFeaturedBooks([...items].reverse()).map((entry) => entry.id)
  // Interleaving new titles must not displace the existing ones either.
  const interleaved = selectFeaturedBooks([...items, book('newcomer')]).map((entry) => entry.id)

  assert.deepEqual(backwards, forwards)
  // A new title may enter the shelf and displace one, but it never reorders the
  // books that were already there.
  assert.deepEqual(
    interleaved.filter((id) => forwards.includes(id)),
    forwards.filter((id) => interleaved.includes(id)),
  )
})

test('selection is repeatable across calls', () => {
  const items = catalogue(25)
  const first = selectFeaturedBooks(items).map((entry) => entry.id)
  const second = selectFeaturedBooks(items).map((entry) => entry.id)
  assert.deepEqual(second, first)
})

test('only purchasable books are eligible', () => {
  const items = [
    book('sellable'),
    book('no-price', { price: null }),
    book('no-stock', { status: 'out-of-stock' }),
  ]
  assert.deepEqual(selectFeaturedBooks(items).map((entry) => entry.id), ['sellable'])
})

test('the whole collection is used when nothing is purchasable', () => {
  const items = [book('a', { price: null }), book('b', { status: 'out-of-stock' })]
  // An empty shelf would be worse than showing unavailable titles, and the panel
  // disables Add to cart on its own for those.
  assert.equal(selectFeaturedBooks(items).length, 2)
})

test('zero, one and many books are all handled', () => {
  assert.deepEqual(selectFeaturedBooks([]), [])
  assert.equal(selectFeaturedBooks([book('only')]).length, 1)
  assert.equal(selectFeaturedBooks(catalogue(50)).length, featuredShelfSize)
  assert.equal(selectFeaturedBooks(catalogue(3)).length, 3)
  assert.equal(selectFeaturedBooks(catalogue(50), 2).length, 2)
  assert.deepEqual(selectFeaturedBooks(catalogue(5), 0), [])
})

test('the live catalogue yields a full shelf of real, purchasable ids', () => {
  const shelf = selectFeaturedBooks(seededBooks)
  const ids = new Set(seededBooks.map((entry) => entry.id))

  assert.equal(shelf.length, Math.min(featuredShelfSize, seededBooks.length))
  assert.ok(shelf.length > 0, 'the real catalogue must produce a non-empty shelf')
  for (const entry of shelf) {
    assert.ok(ids.has(entry.id), `${entry.id} must be a real catalogue id`)
    assert.equal(entry.status, 'in-stock')
    assert.notEqual(entry.price, null)
  }
  assert.equal(new Set(shelf.map((entry) => entry.id)).size, shelf.length, 'no duplicate books on the shelf')
})

/* ── Active-book tracking ─────────────────────────────────────────────────── */

test('the active book survives a refresh that reorders the shelf', () => {
  const shelf = [book('a'), book('b'), book('c')]
  assert.equal(activeIndexFor(shelf, 'c'), 2)
  assert.equal(activeIndexFor([book('c'), book('a'), book('b')], 'c'), 0)
})

test('the shelf opens centred and only moves when the chosen book is gone', () => {
  const shelf = [book('a'), book('b'), book('c'), book('d'), book('e')]
  // No choice yet: the middle of the shelf, so the focus has books on both sides.
  assert.equal(activeIndexFor(shelf, null), 2)
  assert.equal(activeIndexFor([book('only')], null), 0)
  assert.equal(activeIndexFor([], null), -1)
  // A book that is no longer on the shelf falls back to the same centred position.
  assert.equal(activeIndexFor(shelf, 'removed'), 2)
  assert.equal(activeIndexFor([], 'a'), -1)
})

test('neighbouring shelf positions are clipped to the ends and never repeat the focus', () => {
  assert.deepEqual(sideIndices(0, 7), [1, 2])
  assert.deepEqual(sideIndices(6, 7), [5, 4])
  assert.deepEqual(sideIndices(3, 7), [2, 4, 1, 5])
  assert.deepEqual(sideIndices(0, 2), [1])
  assert.deepEqual(sideIndices(0, 1), [])

  for (let index = 0; index < 7; index += 1) {
    const sides = sideIndices(index, 7)
    assert.equal(new Set(sides).size, sides.length, 'no duplicate positions')
    assert.ok(sides.every((entry) => entry >= 0 && entry < 7 && entry !== index))
  }
})

test('the caption index and announcement read from real numbers', () => {
  assert.equal(formatShelfIndex(0, 7), '01 / 07')
  assert.equal(formatShelfIndex(3, 7), '04 / 07')
  const announcement = announcementFor(book('meluha', { title: 'The Immortals of Meluha', author: 'Amish Tripathi' }), 3, 7)
  assert.match(announcement, /^04 \/ 07 — The Immortals of Meluha by Amish Tripathi\.$/)
})

/* ── Shared catalogue store ───────────────────────────────────────────────── */

test('the featured shelf and the catalogue share one request', async () => {
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return jsonResponse({ data: [book('live')], source: 'mock' })
  }) as typeof fetch

  // Two consumers mounting together must not fetch twice.
  await Promise.all([loadCatalogue(), loadCatalogue()])
  assert.equal(calls, 1)

  // And a third consumer mounting later reads the loaded catalogue, not the API.
  await loadCatalogue()
  assert.equal(calls, 1)
  assert.deepEqual(getCatalogueSnapshot().books.map((entry) => entry.id), ['live'])
  assert.equal(getCatalogueSnapshot().source, 'mock')
  assert.equal(getCatalogueSnapshot().error, '')
})

test('a failed request keeps the local shelf and reports the documented notice', async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch

    await loadCatalogue()

    const snapshot = getCatalogueSnapshot()
    assert.equal(snapshot.error, catalogueFallbackNotice)
    assert.equal(snapshot.books.length, seededBooks.length, 'browse must still work from the saved shelf')
    assert.equal(snapshot.loading, false)
  } finally {
    console.error = originalError
  }
})

test('a rejected response is treated as a failure, not as an empty catalogue', async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    globalThis.fetch = (async () => jsonResponse({ data: null }, false)) as typeof fetch

    await loadCatalogue()

    assert.equal(getCatalogueSnapshot().error, catalogueFallbackNotice)
    assert.equal(getCatalogueSnapshot().books.length, seededBooks.length)
  } finally {
    console.error = originalError
  }
})

test('a slower earlier response cannot overwrite a newer one', async () => {
  let calls = 0
  let releaseFirst: () => void = () => {}

  globalThis.fetch = (async () => {
    calls += 1
    if (calls === 1) {
      await new Promise<void>((resolve) => { releaseFirst = resolve })
      return jsonResponse({ data: [book('stale')], source: 'mock' })
    }
    return jsonResponse({ data: [book('fresh')], source: 'mock' })
  }) as typeof fetch

  const first = loadCatalogue()
  const second = loadCatalogue({ force: true })
  await second
  releaseFirst()
  await first

  assert.deepEqual(getCatalogueSnapshot().books.map((entry) => entry.id), ['fresh'])
})

test('refresh reports the load in flight and settles on the new collection', async () => {
  let payload: Book[] = [book('first')]
  globalThis.fetch = (async () => jsonResponse({ data: payload, source: 'mock' })) as typeof fetch

  await loadCatalogue()
  assert.deepEqual(getCatalogueSnapshot().books.map((entry) => entry.id), ['first'])

  payload = [book('second')]
  await loadCatalogue({ force: true })
  assert.deepEqual(getCatalogueSnapshot().books.map((entry) => entry.id), ['second'])
})
