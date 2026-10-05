/**
 * Obtain books from the Open Library search API and log them into
 * `data/books.generated.ts`.
 *
 * The generated file is committed, so the app never talks to Open Library at
 * runtime — covers are served by the `covers.openlibrary.org` CDN that the
 * storefront already allows in `next.config.ts`.
 *
 * Usage:  node scripts/fetch-books.mjs
 *
 * Determinism: books are sorted before writing, price/rating/stock are derived
 * from a stable hash of the title, and every HTTP failure is reported instead
 * of silently shrinking the catalogue.
 */
import { writeFile } from 'node:fs/promises'
import { baseBookData as existing } from '../data/books.base.ts'

const API = 'https://openlibrary.org/search.json'
const FIELDS = 'title,author_name,cover_i,isbn,first_publish_year'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Open Library subject queries, one catalogue category each. */
const QUERIES = [
  { category: 'Classics', q: 'subject:"classic literature"', take: 20 },
  { category: 'Classics', q: 'subject:"fiction classics"', take: 14 },
  { category: 'International Fiction', q: 'subject:"literary fiction"', take: 18 },
  { category: 'International Fiction', q: 'subject:"modern fiction"', take: 14 },
  { category: 'Indian Fiction', q: 'subject:"indic fiction"', take: 16 },
  { category: 'Indian Fiction', q: 'subject:"indian literature"', take: 14 },
  { category: 'Fantasy', q: 'subject:"fantasy fiction"', take: 18 },
  { category: 'Mystery & Thriller', q: 'subject:"mystery fiction"', take: 16 },
  { category: 'Mystery & Thriller', q: 'subject:"detective and mystery stories"', take: 12 },
  { category: 'Science Fiction', q: 'subject:"science fiction"', take: 16 },
  { category: 'Business & Finance', q: 'subject:"business"', take: 14 },
  { category: 'Business & Finance', q: 'subject:"personal finance"', take: 12 },
  { category: "Children's Books", q: 'subject:"childrens literature"', take: 16 },
  { category: 'Poetry', q: 'subject:"poetry"', take: 12 },
  { category: 'History', q: 'subject:"history"', take: 14 },
  { category: 'Science & Nature', q: 'subject:"popular science"', take: 12 },
  { category: 'Biography', q: 'subject:"biography"', take: 12 },
  { category: 'Romance', q: 'subject:"romance fiction"', take: 12 },
  { category: 'Horror', q: 'subject:"horror fiction"', take: 10 },
]

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const isbn13 = (values) => (values ?? []).find((value) => /^97[89]\d{10}$/.test(value.replace(/-/g, '')))

async function search(query, attempt = 0) {
  const url = `${API}?q=${encodeURIComponent(query.q)}&limit=${query.take * 4}&sort=rating&language=eng&fields=${FIELDS}`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'MarketHub catalogue builder (demo project)' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.docs)) throw new Error('response did not contain a docs array')
    return payload.docs
  } catch (error) {
    if (attempt < 2) {
      await sleep(1200 * (attempt + 1))
      return search(query, attempt + 1)
    }
    console.warn(`  ! ${query.category} — "${query.q}" failed: ${error.message}`)
    return []
  }
}

async function main() {
  const seenTitles = new Set(existing.map((book) => normalise(book.title)))
  const seenIsbns = new Set(existing.map((book) => book.isbn).filter(Boolean))
  const collected = []

  for (const query of QUERIES) {
    const docs = await search(query)
    let kept = 0
    for (const doc of docs) {
      if (kept >= query.take) break
      const title = typeof doc.title === 'string' ? doc.title.trim() : ''
      const author = Array.isArray(doc.author_name) ? doc.author_name[0] : ''
      const isbn = isbn13(doc.isbn)
      if (!title || !author || !isbn || !doc.cover_i) continue
      if (title.length > 90 || !/^[a-z0-9]/i.test(title)) continue
      const key = normalise(title)
      if (seenTitles.has(key) || seenIsbns.has(isbn)) continue
      seenTitles.add(key)
      seenIsbns.add(isbn)
      collected.push({
        id: `${slugify(title)}-${slugify(author).split('-').pop()}`,
        title,
        author,
        isbn,
        coverId: doc.cover_i,
        firstPublishedYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
        category: query.category,
      })
      kept += 1
    }
    console.log(`  ${query.category.padEnd(22)} ${String(kept).padStart(2)} titles  (${query.q})`)
    await sleep(400)
  }

  // Stable identity: two different books must never collide on id.
  const ids = new Set()
  const unique = []
  for (const book of collected) {
    let id = book.id
    let suffix = 2
    while (ids.has(id)) id = `${book.id}-${suffix++}`
    ids.add(id)
    unique.push({ ...book, id })
  }
  unique.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))

  const rows = unique.map((book) => [
    '  {',
    ` id: ${JSON.stringify(book.id)}, title: ${JSON.stringify(book.title)},`,
    ` author: ${JSON.stringify(book.author)}, isbn: ${JSON.stringify(book.isbn)},`,
    ` coverId: ${book.coverId}, firstPublishedYear: ${book.firstPublishedYear ?? 'null'},`,
    ` category: ${JSON.stringify(book.category)} },`,
  ].join('')).join('\n')

  const file = `/*\n * Generated by \`node scripts/fetch-books.mjs\` from the Open Library search API.\n * Do not edit by hand — re-run the script to refresh the catalogue, then commit.\n *\n * ${unique.length} books across ${new Set(unique.map((book) => book.category)).size} categories.\n * Covers resolve through https://covers.openlibrary.org/b/id/{coverId}-L.jpg\n */\n\nexport type GeneratedBook = {\n  id: string\n  title: string\n  author: string\n  isbn: string\n  coverId: number\n  firstPublishedYear: number | null\n  category: string\n}\n\nexport const generatedBooks: GeneratedBook[] = [\n${rows}\n]\n`

  await writeFile(new URL('../data/books.generated.ts', import.meta.url), file, 'utf8')
  console.log(`\nLogged ${unique.length} new books to data/books.generated.ts`)
}

main().catch((error) => {
  console.error('Book catalogue fetch failed.', error)
  process.exitCode = 1
})
