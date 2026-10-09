'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import type { Book } from '@/data/books'
import { Chapter, ViteBookGrid, VitePageHero, ViteButton } from './vite-shell'

/**
 * The shelf client. The page arrives already paged; this component owns the
 * interactive bits the URL can express — the search box (typed, then submitted
 * to the URL), the category rail and the sort selector. Pills inside filter
 * groups would mean one client render per keystroke over 10,000 titles; the
 * URL is the state, so nothing is kept in memory that the address bar doesn't
 * already hold.
 */

type Page = {
  items: Book[]
  page: number
  pageSize: number
  pageCount: number
  matched: number
  total: number
  categories: { name: string; count: number }[]
}

type SortOption = { value: string; label: string }

function hrefWith(current: Record<string, string>, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/books?${query}` : '/books'
}

export function BooksShelf({
  page, categories, sort, query, category, sortOptions, current,
}: {
  page: Page
  categories: { name: string; count: number }[]
  sort: string
  query: string
  category: string
  sortOptions: SortOption[]
  current: Record<string, string>
}) {
  const router = useRouter()
  const [input, setInput] = useState(query)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const firstOnPage = page.matched === 0 ? 0 : (page.page - 1) * page.pageSize + 1
  const lastOnPage = Math.min(page.page * page.pageSize, page.matched)

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    router.push(hrefWith(current, { q: input.trim() || undefined, page: undefined }) + '#grid')
  }

  const empty = (
    <div className="empty-state">
      <h2>No titles match that search.</h2>
      <p>Try another word, an ISBN, or clear the category filter.</p>
      <ViteButton href={hrefWith(current, { q: undefined, category: undefined, page: undefined })} variant="primary">Reset the shelf</ViteButton>
    </div>
  )

  return (
    <>
      <VitePageHero className="page-hero-light" label="MarketHub / Books" title="A practical shelf for every kind of reader.">
        <form className="search-bar" onSubmit={submitSearch} role="search">
          <Search size={17} color="var(--gold)" aria-hidden="true" />
          <input
            className="search-input"
            aria-label="Search books"
            placeholder="Search by title, author, ISBN…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={120}
          />
          <button className="button button-primary" type="submit">Search</button>
        </form>
      </VitePageHero>

      <section className="container books-page-shell" id="grid">
        <div className="filter-mobile-row">
          <ViteButton variant="ghost" onClick={() => setDrawerOpen((v) => !v)}><SlidersHorizontal size={14} /> Filters</ViteButton>
        </div>
        <div className="shop-layout">
          <aside className={`filter-panel ${drawerOpen ? 'show-mobile' : ''}`}>
            <div className="filter-group">
              <h4>Category</h4>
              {categories.slice(0, 10).map((entry) => (
                <Link
                  key={entry.name}
                  href={hrefWith(current, { category: entry.name === category ? undefined : entry.name, page: undefined })}
                  className={`filter-option ${entry.name === category ? 'is-current' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span>{entry.name}</span>
                  <small>{entry.count.toLocaleString('en-IN')}</small>
                </Link>
              ))}
              <Link href={hrefWith(current, { category: undefined, page: undefined })} className="filter-option" onClick={() => setDrawerOpen(false)}><span>All categories</span></Link>
            </div>
            <ViteButton variant="ghost" onClick={() => { setInput(''); router.push('/books') }}>Reset filters</ViteButton>
          </aside>

          <div className="shop-main">
            <div className="shop-toolbar">
              <div>
                <strong>{category || 'All books'}</strong>
                <span style={{ marginLeft: 10 }}>
                  {page.matched.toLocaleString('en-IN')} titles in this view
                </span>
              </div>
              <div className="sort-shell">
                <label className="sr-only" htmlFor="books-sort">Sort books</label>
                <select
                  id="books-sort"
                  className="sort-select"
                  value={sort}
                  onChange={(event) => router.push(hrefWith(current, { sort: event.target.value === 'catalogue' ? undefined : event.target.value, page: undefined }) + '#grid')}
                >
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <p className="shop-status" role="status">
              {query
                ? <>Results for <strong>“{query}”</strong>{category ? ` in ${category}` : ''} — showing {firstOnPage.toLocaleString('en-IN')}–{lastOnPage.toLocaleString('en-IN')} of {page.matched.toLocaleString('en-IN')}</>
                : <>Showing {firstOnPage.toLocaleString('en-IN')}–{lastOnPage.toLocaleString('en-IN')} of {page.matched.toLocaleString('en-IN')} titles</>}
            </p>

            <ViteBookGrid items={page.items} empty={empty} />

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
            <p className="books-catalogue-note">
              The shelves go deeper than this page —{' '}
              <Link href="/catalogue">browse the full 10,000-title catalogue</Link>.
            </p>
          </div>
        </div>
      </section>

      {drawerOpen && (
        <div className="filter-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="filter-drawer" role="dialog" aria-modal="true" aria-label="Filter books" onClick={(event) => event.stopPropagation()}>
            <div className="filter-drawer-head">
              <span>Filters</span>
              <button className="icon-button" aria-label="Close filters" onClick={() => setDrawerOpen(false)}><X size={16} /></button>
            </div>
            <div className="filter-group">
              <h4>Category</h4>
              {categories.slice(0, 10).map((entry) => (
                <Link
                  key={entry.name}
                  href={hrefWith(current, { category: entry.name === category ? undefined : entry.name, page: undefined })}
                  className={`filter-option ${entry.name === category ? 'is-current' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span>{entry.name}</span>
                  <small>{entry.count.toLocaleString('en-IN')}</small>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
