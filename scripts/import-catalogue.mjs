/**
 * Import a large catalogue from the Open Library search API into
 * `data/catalogue.imported.json`.
 *
 * This is the Option 3 ingest: Open Library is the source of *metadata only* —
 * title, author, ISBN and a cover id. It has no prices and no stock, so imported
 * records carry neither. A title becomes purchasable only when a vendor lists it
 * with a real price and inventory, which is why every record here is written with
 * `price: null` and no stock: nothing in this file is invented.
 *
 * Usage:
 *   node scripts/import-catalogue.mjs --target 10000
 *   node scripts/import-catalogue.mjs --target 10000 --fresh
 *
 * Design notes:
 * - Server-side only. The output is read by `services/catalogue.ts`; it must never
 *   be imported by a client component, or thousands of records land in the browser
 *   bundle. `services/catalogue.ts` enforces that with a runtime guard.
 * - No timestamps are written, so re-running against unchanged upstream data
 *   produces an identical file and a clean diff.
 * - Additive by default: an existing file is loaded first and the run tops it up,
 *   so a slow or interrupted import can be resumed without losing progress.
 * - Deterministic: records are de-duplicated by ISBN and by normalised title, then
 *   sorted by category and title before writing.
 * - Polite: a fixed low concurrency, a delay between requests, and a descriptive
 *   User-Agent. Every failure is retried and then reported — the catalogue is never
 *   silently shrunk.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { baseBookData as curated } from '../data/books.base.ts'

const API = 'https://openlibrary.org/search.json'
const FIELDS = 'title,author_name,cover_i,isbn,first_publish_year'
const USER_AGENT = 'MarketHub catalogue importer (demo project; contact: repository owner)'
const PAGE_SIZE = 100
const CONCURRENCY = 3
const REQUEST_DELAY_MS = 250

/** Category → Open Library subject queries. Each subject is paged up to `pages`. */
const SUBJECTS = [
  { category: 'Classics', q: 'subject:"classic literature"', pages: 8 },
  { category: 'Classics', q: 'subject:"fiction classics"', pages: 6 },
  { category: 'Classics', q: 'subject:"english literature"', pages: 6 },
  { category: 'International Fiction', q: 'subject:"literary fiction"', pages: 8 },
  { category: 'International Fiction', q: 'subject:"modern fiction"', pages: 6 },
  { category: 'International Fiction', q: 'subject:"american fiction"', pages: 6 },
  { category: 'International Fiction', q: 'subject:"translations"', pages: 6 },
  { category: 'Indian Fiction', q: 'subject:"indic fiction"', pages: 8 },
  { category: 'Indian Fiction', q: 'subject:"indian literature"', pages: 8 },
  { category: 'Indian Fiction', q: 'subject:"hindi fiction"', pages: 4 },
  { category: 'Fantasy', q: 'subject:"fantasy fiction"', pages: 8 },
  { category: 'Fantasy', q: 'subject:"fantasy"', pages: 6 },
  { category: 'Fantasy', q: 'subject:"magic"', pages: 4 },
  { category: 'Mystery & Thriller', q: 'subject:"mystery fiction"', pages: 8 },
  { category: 'Mystery & Thriller', q: 'subject:"detective and mystery stories"', pages: 8 },
  { category: 'Mystery & Thriller', q: 'subject:"thriller"', pages: 6 },
  { category: 'Science Fiction', q: 'subject:"science fiction"', pages: 8 },
  { category: 'Science Fiction', q: 'subject:"space opera"', pages: 4 },
  { category: 'Science Fiction', q: 'subject:"dystopia"', pages: 4 },
  { category: 'Romance', q: 'subject:"romance fiction"', pages: 8 },
  { category: 'Romance', q: 'subject:"love stories"', pages: 6 },
  { category: 'Horror', q: 'subject:"horror fiction"', pages: 8 },
  { category: 'Horror', q: 'subject:"ghost stories"', pages: 4 },
  { category: 'Business & Finance', q: 'subject:"business"', pages: 6 },
  { category: 'Business & Finance', q: 'subject:"personal finance"', pages: 6 },
  { category: 'Business & Finance', q: 'subject:"management"', pages: 6 },
  { category: 'Business & Finance', q: 'subject:"marketing"', pages: 6 },
  { category: 'Science & Nature', q: 'subject:"popular science"', pages: 6 },
  { category: 'Science & Nature', q: 'subject:"physics"', pages: 6 },
  { category: 'Science & Nature', q: 'subject:"biology"', pages: 6 },
  { category: 'Science & Nature', q: 'subject:"mathematics"', pages: 6 },
  { category: 'Science & Nature', q: 'subject:"astronomy"', pages: 4 },
  { category: 'Philosophy', q: 'subject:"philosophy"', pages: 8 },
  { category: 'Philosophy', q: 'subject:"ethics"', pages: 4 },
  { category: 'Psychology', q: 'subject:"psychology"', pages: 8 },
  { category: 'Psychology', q: 'subject:"self-help"', pages: 6 },
  { category: 'History', q: 'subject:"history"', pages: 8 },
  { category: 'History', q: 'subject:"world war"', pages: 6 },
  { category: 'History', q: 'subject:"ancient history"', pages: 4 },
  { category: 'Biography', q: 'subject:"biography"', pages: 8 },
  { category: 'Biography', q: 'subject:"memoir"', pages: 6 },
  { category: 'Poetry', q: 'subject:"poetry"', pages: 8 },
  { category: 'Poetry', q: 'subject:"american poetry"', pages: 4 },
  { category: 'Drama', q: 'subject:"drama"', pages: 6 },
  { category: 'Drama', q: 'subject:"shakespeare"', pages: 4 },
  { category: "Children's Books", q: 'subject:"childrens literature"', pages: 8 },
  { category: "Children's Books", q: 'subject:"juvenile fiction"', pages: 8 },
  { category: "Children's Books", q: 'subject:"picture books"', pages: 4 },
  { category: 'Cooking', q: 'subject:"cooking"', pages: 6 },
  { category: 'Cooking', q: 'subject:"cookbooks"', pages: 4 },
  { category: 'Travel', q: 'subject:"travel"', pages: 6 },
  { category: 'Travel', q: 'subject:"voyages and travels"', pages: 4 },
  { category: 'Art & Design', q: 'subject:"art"', pages: 6 },
  { category: 'Art & Design', q: 'subject:"design"', pages: 4 },
  { category: 'Technology', q: 'subject:"computer science"', pages: 6 },
  { category: 'Technology', q: 'subject:"programming"', pages: 6 },
  { category: 'Technology', q: 'subject:"artificial intelligence"', pages: 4 },
  { category: 'Religion & Spirituality', q: 'subject:"religion"', pages: 6 },
  { category: 'Religion & Spirituality', q: 'subject:"spirituality"', pages: 4 },
]

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

const isbn13 = (values) => (values ?? []).find((value) => /^97[89]\d{10}$/.test(String(value).replace(/-/g, '')))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(url, attempt = 0) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.docs)) throw new Error('response did not contain a docs array')
    return payload.docs
  } catch (error) {
    if (attempt < 3) {
      await sleep(1000 * (attempt + 1))
      return request(url, attempt + 1)
    }
    console.warn(`  ! failed after retries: ${error.message} — ${url.slice(0, 90)}…`)
    failures.push(url)
    return []
  }
}

const failures = []

/** Runs `worker` over `items` with a fixed concurrency. */
async function inPool(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
      await sleep(REQUEST_DELAY_MS)
    }
  })
  await Promise.all(runners)
  return results
}

function parseArgs(argv) {
  const args = { target: 5000, fresh: false }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--target') args.target = Number(argv[index + 1]) || args.target
    if (argv[index] === '--fresh') args.fresh = true
  }
  return args
}

async function loadExisting(fresh) {
  if (fresh) return []
  try {
    const raw = await readFile(new URL('../data/catalogue.imported.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.books) ? parsed.books : []
  } catch {
    return []
  }
}

async function main() {
  const { target, fresh } = parseArgs(process.argv.slice(2))
  const existing = await loadExisting(fresh)

  const seenIsbn = new Set()
  const seenTitles = new Set()
  const seenIds = new Set()

  for (const book of curated) {
    if (book.isbn) seenIsbn.add(book.isbn)
    seenTitles.add(normalise(book.title))
    seenIds.add(book.id)
  }
  for (const book of existing) {
    seenIsbn.add(book.isbn)
    seenTitles.add(normalise(book.title))
    seenIds.add(book.id)
  }

  console.log(`Importing from Open Library — target ${target.toLocaleString('en-IN')} titles`)
  console.log(`Starting from ${existing.length.toLocaleString('en-IN')} already imported\n`)

  const accept = (doc, category) => {
    const title = typeof doc.title === 'string' ? doc.title.trim() : ''
    const author = Array.isArray(doc.author_name) ? String(doc.author_name[0] ?? '').trim() : ''
    const isbn = isbn13(doc.isbn)
    if (!title || !author || !isbn || !doc.cover_i) return null
    if (title.length > 90 || !/^[a-z0-9]/i.test(title)) return null
    const key = normalise(title)
    if (seenTitles.has(key) || seenIsbn.has(isbn)) return null

    let id = `${slugify(title)}-${slugify(author).split('-').pop()}`
    let suffix = 2
    while (seenIds.has(id)) id = `${slugify(title)}-${slugify(author).split('-').pop()}-${suffix++}`

    seenTitles.add(key)
    seenIsbn.add(isbn)
    seenIds.add(id)
    return {
      id,
      title,
      author,
      isbn,
      coverId: doc.cover_i,
      firstPublishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
      category,
    }
  }

  /* Every subject gets the same quota so the catalogue ends up evenly spread
     across its categories. An earlier version stopped as soon as the global
     target was reached, which filled the first nine categories and never reached
     children's books, science, history or biography at all.

     The quota is derived from what is still *needed*, not from the total, so
     re-running to top up an almost-complete catalogue does not ask every subject
     for a full share only to throw most of it away in the trim below. */
  const remaining = Math.max(0, target - existing.length)
  if (remaining === 0) {
    console.log(`Already at ${existing.length.toLocaleString('en-IN')} titles; nothing to do.`)
    return
  }
  const quota = Math.max(1, Math.ceil(remaining / SUBJECTS.length))
  console.log(`Need ${remaining.toLocaleString('en-IN')} more; quota ${quota} per subject across ${SUBJECTS.length} subjects\n`)

  const batches = await inPool(SUBJECTS, async (subject) => {
    const kept = []
    for (let page = 0; page < subject.pages; page += 1) {
      if (kept.length >= quota) break
      const url = `${API}?q=${encodeURIComponent(subject.q)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
        + `&sort=rating&language=eng&fields=${FIELDS}`
      const docs = await request(url)
      for (const doc of docs) {
        if (kept.length >= quota) break
        const record = accept(doc, subject.category)
        if (record) kept.push(record)
      }
      await sleep(REQUEST_DELAY_MS)
    }
    console.log(`  ${subject.category.padEnd(24)} ${String(kept.length).padStart(4)} / ${quota}  (${subject.q})`)
    return kept
  })

  let collected = [...existing, ...batches.flat()]

  /* Keep the promised size exactly: if the quota overallocated, drop surplus from
     the largest categories so breadth survives rather than losing whole subjects. */
  if (collected.length > target) {
    const byCategory = new Map()
    for (const book of collected) {
      if (!byCategory.has(book.category)) byCategory.set(book.category, [])
      byCategory.get(book.category).push(book)
    }
    const ordered = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)
    const surplus = collected.length - target
    const dropped = []
    for (const [, group] of ordered) {
      if (dropped.length >= surplus) break
      const removable = Math.min(group.length - 1, surplus - dropped.length)
      for (let index = 0; index < removable; index += 1) dropped.push(group.pop())
    }
    if (dropped.length) {
      const gone = new Set(dropped.map((book) => book.id))
      collected = collected.filter((book) => !gone.has(book.id))
      console.log(`\nTrimmed ${dropped.length} surplus titles to reach exactly ${target.toLocaleString('en-IN')}`)
    }
  }

  collected.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))

  const file = JSON.stringify({ source: 'openlibrary', count: collected.length, books: collected }, null, 0)
  await writeFile(new URL('../data/catalogue.imported.json', import.meta.url), `${file}\n`, 'utf8')

  const byCategory = new Map()
  for (const book of collected) byCategory.set(book.category, (byCategory.get(book.category) ?? 0) + 1)

  console.log(`\nWrote ${collected.length.toLocaleString('en-IN')} titles across ${byCategory.size} categories`)
  for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(24)} ${String(count).padStart(5)}`)
  }
  console.log(`ISBN coverage       ${new Set(collected.map((b) => b.isbn)).size.toLocaleString('en-IN')} distinct`)
  console.log(`Cover coverage      ${collected.filter((b) => b.coverId).length.toLocaleString('en-IN')} with a cover id`)
  console.log(`Records carry no price and no stock — pricing is vendor-owned.`)
  if (failures.length) {
    console.log(`\n${failures.length} request(s) failed after retries; the catalogue was topped up, not shrunk.`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Catalogue import failed.', error)
  process.exitCode = 1
})
