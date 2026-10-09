'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import type { Book } from '@/data/books'
import { Chapter, ViteBookGrid, VitePageHero, ViteButton } from './vite-shell'

/** Search, in the editorial look, over the paginated catalogue. */
export function ViteSearchResults({ query, matched, items, total }: { query: string; matched: number; items: Book[]; total: number }) {
  const router = useRouter()
  const [input, setInput] = useState(query)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    router.push(input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : '/search')
  }

  return (
    <>
      <VitePageHero label="MarketHub / Search" title={query ? `Results for “${query}”` : 'Search the whole shelf.'}>
        <form className="search-bar" onSubmit={submit} role="search">
          <Search size={17} color="var(--gold)" aria-hidden="true" />
          <input
            autoFocus
            aria-label="Search the catalogue"
            className="search-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Try an author, a title, or an ISBN…"
            maxLength={120}
          />
          <ViteButton type="submit" variant="primary">Search</ViteButton>
        </form>
      </VitePageHero>
      <section className="container section" style={{ paddingTop: 10 }}>
        <div className="section-heading">
          <div>
            <Chapter>{query ? `Search / ${matched.toLocaleString('en-IN')} matches of ${total.toLocaleString('en-IN')}` : 'The whole catalogue is one box away.'}</Chapter>
            <h2>{matched ? 'A few good places to begin.' : 'Nothing on this shelf yet.'}</h2>
          </div>
        </div>
        <ViteBookGrid items={items} />
        {matched > items.length && (
          <p className="search-more-note">
            Showing the first {items.length} — <a href={`/books?q=${encodeURIComponent(query)}`}>open the shelf view for the rest</a>.
          </p>
        )}
      </section>
    </>
  )
}
