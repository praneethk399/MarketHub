'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, ChevronRight, Home, Search, ShoppingBag, Users } from 'lucide-react'
import type { Book } from '@/data/books'
import type { LibraryShelves, ShelfBook } from '@/services/library.service'

type Props = {
  user: { id: string; name: string } | null
  library: LibraryShelves
  catalogue: Book[]
}

const shelvesOrder = ['currently-reading', 'next-up', 'finished'] as const

function ShelfBookCover({ book }: { book: ShelfBook }) {
  return <a className="shelf-book" href={`/books/${book.bookId}`} title={`${book.title} — ${book.author}`}>
    <Image src={book.cover} alt={`Cover of ${book.title}`} width={96} height={144} />
    {book.status === 'CURRENTLY_READING' && <span className="shelf-progress" aria-label={`${book.progressPercentage}% read`}>
      <span style={{ width: `${book.progressPercentage}%` }} />
    </span>}
  </a>
}

function Shelf({ title, books, onFullShelf }: { title: string; books: ShelfBook[]; onFullShelf: () => void }) {
  return <section className="shelf-section">
    <div className="shelf-head">
      <h3>{title}</h3>
      {books.length > 0 && <button type="button" className="shelf-more" onClick={onFullShelf}>Full shelf <ArrowRight size={14} aria-hidden="true" /></button>}
    </div>
    {books.length
      ? <div className="shelf"><div className="shelf-books">
          {books.map((book) => <ShelfBookCover key={book.bookId} book={book} />)}
        </div><span className="shelf-plank" aria-hidden="true" /></div>
      : <p className="shelf-empty">Nothing on this shelf yet. Open any book and add it to your library.</p>}
  </section>
}

/** Readowl-style reading room: sidebar, pill tabs, search and wooden shelves. */
export function LibraryShell({ user, library, catalogue }: Props) {
  const [tab, setTab] = useState<'shelves' | 'all'>('shelves')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'currently-reading' | 'next-up' | 'finished'>('all')

  const shelves = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return shelvesOrder
      .map((key) => library.shelves.find((shelf) => shelf.key === key)!)
      .filter((shelf) => filter === 'all' || shelf.key === filter)
      .map((shelf) => ({
        ...shelf,
        books: needle
          ? shelf.books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(needle))
          : shelf.books,
      }))
  }, [library.shelves, query, filter])

  const catalogueMatches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return catalogue
    return catalogue.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(needle))
  }, [catalogue, query])

  const openFullShelf = (key: typeof shelvesOrder[number]) => {
    setTab('all')
    setFilter(key)
  }

  return <div className="library-page">
    <div className="library-frame">
      <aside className="library-sidebar">
        <a className="library-logo" href="/" aria-label="MarketHub home">
          <span className="library-logo-mark" aria-hidden="true"><BookOpen size={19} /></span>
          MarketHub
        </a>

        <nav className="library-nav" aria-label="Library navigation">
          <a href="/"><Home size={16} aria-hidden="true" /> Home</a>
          <a href="/library" aria-current="page"><BookOpen size={16} aria-hidden="true" /> My library</a>
          <a href="/books"><ShoppingBag size={16} aria-hidden="true" /> Shop</a>
          <a href="/social"><Users size={16} aria-hidden="true" /> Social</a>
        </nav>

        {library.continueReading && <div className="library-continue">
          <span className="library-continue-label">Continue reading</span>
          <a href={`/books/${library.continueReading.bookId}`} className="library-continue-book">
            <Image src={library.continueReading.cover} alt="" width={120} height={72} />
            <span>
              <strong>{library.continueReading.title}</strong>
              <small>{library.continueReading.progressPercentage}% complete</small>
            </span>
          </a>
          <span className="library-progress"><span style={{ width: `${library.continueReading.progressPercentage}%` }} /></span>
        </div>}

        <a className="library-user" href="/social">
          <span className="library-avatar" aria-hidden="true">{user ? user.name.charAt(0).toUpperCase() : '?'}</span>
          <span>{user ? user.name : 'Sign in'}</span>
          <ChevronRight size={15} aria-hidden="true" />
        </a>
      </aside>

      <div className="library-main">
        <div className="library-toolbar">
          <div className="library-tabs" role="tablist" aria-label="Library views">
            <button type="button" role="tab" aria-selected={tab === 'shelves'} onClick={() => setTab('shelves')}>Shelves</button>
            <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>All books</button>
          </div>
          <label className="library-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search your library</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search in my library" />
          </label>
        </div>

        {!user && <p className="library-notice" role="status">
          Sign in to fill these shelves — your reading progress is private until you choose to share it.
        </p>}

        {tab === 'shelves'
          ? <>
              {filter !== 'all' && <p className="library-notice">
                Showing the {filter.replace('-', ' ')} shelf · <button type="button" onClick={() => setFilter('all')}>show all shelves</button>
              </p>}
              {shelves.map((shelf) => <Shelf key={shelf.key} title={shelf.title} books={shelf.books} onFullShelf={() => openFullShelf(shelf.key)} />)}
            </>
          : <section className="shelf-section">
              <div className="shelf-head">
                <h3>{filter === 'all' ? 'All books' : `All ${filter.replace('-', ' ')} books`}</h3>
                <span className="shelf-count">{catalogueMatches.length} titles</span>
              </div>
              {catalogueMatches.length
                ? <div className="library-grid">
                    {catalogueMatches.map((book) => <a className="library-grid-book" href={`/books/${book.id}`} key={book.id}>
                      <Image src={book.cover} alt={`Cover of ${book.title}`} width={150} height={225} />
                      <strong>{book.title}</strong>
                      <small>{book.author}</small>
                      {book.price !== null && <span>₹{book.price}</span>}
                    </a>)}
                  </div>
                : <p className="shelf-empty">No titles match that search.</p>}
            </section>}
      </div>
    </div>
  </div>
}
