'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { Book } from '@/data/books'
import { Chapter, ViteBookGrid, VitePageHero, ViteButton } from './vite-shell'

type Page = {
  items: Book[]
  page: number
  pageSize: number
  pageCount: number
  matched: number
  total: number
  categories: { name: string; count: number }[]
}

function hrefWith(current: Record<string, string>, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/catalogue?${query}` : '/catalogue'
}

export function CatalogueBrowser({
  page, sort, sortOptions, query, category, current, totals,
}: {
  page: Page
  sort: string
  sortOptions: { value: string; label: string }[]
  query: string
  category: string
  current: Record<string, string>
  totals: { imported: number; curated: number }
}) {
  const router = useRouter()
  const [input, setInput] = useState(query)
  const firstOnPage = page.matched === 0 ? 0 : (page.page - 1) * page.pageSize + 1
  const lastOnPage = Math.min(page.page * page.pageSize, page.matched)

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    router.push(hrefWith(current, { q: input.trim() || undefined, page: undefined }))
  }

  return (
    <>
      <VitePageHero label="MarketHub / The full catalogue" title="Every title we can tell you about.">
        <p className="catalogue-lede">
          {totals.imported.toLocaleString('en-IN')} titles of metadata from Open Library. Prices and stock belong to
          sellers, so a title shows a price only once a bookseller lists it. The{' '}
          {totals.curated.toLocaleString('en-IN')} curated titles on our own shelf, with prices, are{' '}
          <Link href="/books">on the storefront shelf</Link>.
        </p>
        <form className="search-bar" onSubmit={submitSearch} role="search" style={{ marginTop: 22 }}>
          <Search size={17} color="var(--gold)" aria-hidden="true" />
          <input
            className="search-input"
            aria-label="Search the catalogue"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search by title, author, ISBN or category…"
            maxLength={120}
          />
          <button className="button button-primary" type="submit">Search</button>
          {(query || category) && <Link className="catalogue-clear" href={hrefWith(current, { q: undefined, category: undefined, page: undefined })}>Clear</Link>}
        </form>
      </VitePageHero>

      <section className="container" style={{ paddingTop: 8, paddingBottom: 110 }}>
        <div className="catalogue-toolbar">
          <nav className="catalogue-sorts" aria-label="Sort the catalogue">
            {sortOptions.map((option) => (
              <Link
                key={option.value}
                href={hrefWith(current, { sort: option.value === 'catalogue' ? undefined : option.value, page: undefined })}
                className={option.value === sort ? 'is-current' : ''}
                aria-current={option.value === sort ? 'true' : undefined}
              >{option.label}</Link>
            ))}
          </nav>
        </div>

        <nav className="catalogue-categories" aria-label="Filter by category">
          <Link
            href={hrefWith(current, { category: undefined, page: undefined })}
            className={category ? '' : 'is-current'}
            aria-current={category ? undefined : 'true'}
          >All <small>{page.total.toLocaleString('en-IN')}</small></Link>
          {page.categories.slice(0, 14).map((entry) => (
            <Link
              key={entry.name}
              href={hrefWith(current, { category: entry.name, page: undefined })}
              className={category === entry.name ? 'is-current' : ''}
              aria-current={category === entry.name ? 'true' : undefined}
            >{entry.name} <small>{entry.count.toLocaleString('en-IN')}</small></Link>
          ))}
        </nav>

        <p className="catalogue-status" role="status">
          {query
            ? <>Results for <strong>“{query}”</strong>{category ? ` in ${category}` : ''} — showing {firstOnPage.toLocaleString('en-IN')}–{lastOnPage.toLocaleString('en-IN')} of {page.matched.toLocaleString('en-IN')}</>
            : <>Showing {firstOnPage.toLocaleString('en-IN')}–{lastOnPage.toLocaleString('en-IN')} of {page.matched.toLocaleString('en-IN')} titles{category ? ` in ${category}` : ''}</>}
        </p>

        {page.items.length
          ? <ViteBookGrid items={page.items} />
          : (
            <div className="empty-state">
              <h2>No titles match that search.</h2>
              <p>Try a different word, an ISBN, or clear the category filter.</p>
              <ViteButton href="/catalogue" variant="primary">Clear the catalogue search</ViteButton>
            </div>
          )}

        {page.pageCount > 1 && (
          <nav className="books-pager" aria-label="Catalogue pages">
            {page.page > 1
              ? <Link className="pager-step" href={hrefWith(current, { page: String(page.page - 1) })}>← Previous</Link>
              : <span className="pager-step is-disabled" aria-disabled="true">← Previous</span>}
            <span className="pager-count">Page {page.page.toLocaleString('en-IN')} of {page.pageCount.toLocaleString('en-IN')}</span>
            {page.page < page.pageCount
              ? <Link className="pager-step" href={hrefWith(current, { page: String(page.page + 1) })}>Next →</Link>
              : <span className="pager-step is-disabled" aria-disabled="true">Next →</span>}
          </nav>
        )}
      </section>
    </>
  )
}
