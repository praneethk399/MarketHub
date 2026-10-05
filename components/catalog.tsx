'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { books, type Book } from '@/data/books'
import { BookCard } from './book-card'
import { FilterSidebar, filterBooks, type FilterState } from './filter-sidebar'

type Priority = '' | 'price' | 'trust' | 'stock' | 'value'

const priorities: { value: Priority; label: string }[] = [
  { value: '', label: 'Standard shelf order' },
  { value: 'price', label: 'Lowest Price' },
  { value: 'trust', label: 'Top Rated Marketplace' },
  { value: 'stock', label: 'Most In Stock' },
  { value: 'value', label: 'Best Overall Value' }
]

/**
 * Shelf ordering uses real catalogue data only (price, marketplace rating,
 * stock). Delivery windows, return policies and seller trust scores are not
 * guessed on the shelf — they come from the Seller Passport on each product
 * and seller page, so no fabricated trust numbers appear here (spec §52/§53).
 */
function sortByPriority(items: Book[], priority: Priority) {
  if (!priority) return items
  const price = (book: Book) => book.price ?? Number.MAX_SAFE_INTEGER
  const rating = (book: Book) => book.rating ?? 0
  const stock = (book: Book) => book.stock ?? 0
  const value = (book: Book) => rating(book) * 20 - price(book) * 0.02
  const score: Record<Exclude<Priority, ''>, (book: Book) => number> = { price, trust: rating, stock, value }
  if (priority === 'price') return [...items].sort((a, b) => price(a) - price(b))
  return [...items].sort((a, b) => score[priority](b) - score[priority](a))
}

function SortSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="select-shell"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select><ChevronDown size={14} /></label>
}

export function Catalog() {
  const sectionRef = useRef<HTMLElement>(null)
  const [filters, setFilters] = useState<FilterState>({ category: 'All', inStockOnly: false, formats: [] })
  const [priority, setPriority] = useState<Priority>('')
  const [sort, setSort] = useState('Bestseller')
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [catalogBooks, setCatalogBooks] = useState(books)
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/books', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Book catalogue request failed (${response.status}).`)
        const payload = await response.json() as { data?: Book[] }
        if (!Array.isArray(payload.data)) throw new Error('Book catalogue response was not valid.')
        setCatalogBooks(payload.data)
        setCatalogError('')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('[MarketHub] Unable to refresh the catalogue from the API.', error)
        setCatalogError('The live catalogue could not be reached. Showing the locally saved shelf.')
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onSearch = (event: Event) => {
      const custom = event as CustomEvent<string>
      setQuery(custom.detail)
    }
    window.addEventListener('markethub:search', onSearch)
    return () => window.removeEventListener('markethub:search', onSearch)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      section.classList.add('catalog-entered')
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add('catalog-entered')
        observer.disconnect()
      }
    }, { threshold: 0.06 })
    observer.observe(section)

    return () => observer.disconnect()
  }, [])

  const result = useMemo(() => {
    const searched = catalogBooks.filter((book) => !query || `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase()))
    let filtered = filterBooks(searched, filters)
    filtered = sortByPriority(filtered, priority)
    if (!priority && sort === 'Price: low to high') filtered = [...filtered].sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER))
    if (!priority && sort === 'Top rated') filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    return filtered
  }, [catalogBooks, filters, priority, query, sort])

  const setFilter = (next: FilterState) => {
    setFilters(next)
    if (drawerOpen) setDrawerOpen(false)
  }

  return <section className="catalog-section" id="books" ref={sectionRef}>
    <div className="catalog-layout">
      <div className="desktop-filters"><FilterSidebar filters={filters} onChange={setFilter} /></div>
      <div className="catalog-main">
        <div className="catalog-heading-row">
          <div><h2>All books<span className="heading-period">.</span></h2><p className="catalog-count">{catalogBooks.length.toLocaleString('en-IN')} titles <span>·</span> A considered collection of fiction, classics, literature and new voices.</p></div>
          <SortSelect label="Sort books" value={sort} onChange={setSort} options={['Bestseller', 'Newest arrivals', 'Top rated', 'Price: low to high']} />
        </div>
        <div className="catalog-controls">
          <div className="priority-label"><div><strong>Buying priority</strong><small>Choose how books are ordered</small></div></div>
          <SortSelect label="Choose a buying priority" value={priorities.find((item) => item.value === priority)?.label || priorities[0].label} onChange={(value) => setPriority(priorities.find((item) => item.label === value)?.value || '')} options={priorities.map((item) => item.label)} />
          <p>{priority ? `${priorities.find((item) => item.value === priority)?.label} · results reordered for you` : 'Sort locally by the priority you choose.'}</p>
          <button className="mobile-filter-trigger" type="button" onClick={() => setDrawerOpen(true)}><SlidersHorizontal size={15} /> Filters <span>{filters.category !== 'All' || filters.inStockOnly || filters.formats.length ? '•' : ''}</span></button>
        </div>
        <div className="results-toolbar"><span>{query ? <>Results for <strong>“{query}”</strong></> : <>Showing <strong>{result.length}</strong> considered {result.length === 1 ? 'title' : 'titles'}</>}</span><div className="toolbar-note"><span className="availability-dot" /> In-stock titles ship with care</div></div>
        {catalogError && <p role="status" className="catalog-api-notice">{catalogError}</p>}
        {result.length ? <div className="book-grid">{result.map((book) => <BookCard key={book.id} book={book} />)}</div> : <div className="no-results"><h3>No books on this shelf just yet.</h3><p>Try another title, category, or format. There are plenty more stories to find.</p><button className="button button-outline" type="button" onClick={() => { setQuery(''); setFilter({ category: 'All', inStockOnly: false, formats: [] }) }}>Clear filters</button></div>}
        <div className="catalog-endnote"><span /> A fine book is a friend that never lets you down. <span /></div>
      </div>
    </div>
    {drawerOpen && <div className="filter-drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}><div className="filter-drawer" role="dialog" aria-modal="true" aria-label="Filter books" onClick={(event) => event.stopPropagation()}><FilterSidebar filters={filters} onChange={setFilters} onClose={() => setDrawerOpen(false)} /></div></div>}
  </section>
}
