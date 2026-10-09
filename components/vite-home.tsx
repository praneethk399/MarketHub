'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Search, Store } from 'lucide-react'
import type { Book } from '@/data/books'
import { categories } from '@/data/books'
import { useStorefront } from './storefront'
import { Chapter, ViteButton, ViteRating } from './vite-shell'

/**
 * Home in the Vite storefront's editorial language, driven by the live
 * catalogue: the featured spread picks from the same deterministic shelf the
 * showcase uses server-side, and the numbers in the hero stats come from real
 * catalogue counts rather than the SPA's invented 55+/12/18.
 */

const FEATURED_IMAGE = '/images/reading-room.jpg'
const HERO_IMAGE = '/images/library-reading-room.jpg'

/* Facade sections are client components; the books arrive already chosen. */
export function ViteHome({ featured, stats }: { featured: Book; stats: { titles: number; categories: number; formats: number } }) {
  return (
    <>
      <HomeHero stats={stats} />
      <HomeFeature featured={featured} />
      <CategoryBand />
      <EditorialBand featured={featured} />
    </>
  )
}

/* ── Hero ───────────────────────────────────────────────────────────────── */

function HomeHero({ stats }: { stats: { titles: number; categories: number; formats: number } }) {
  const [query, setQuery] = useState('')
  return (
    <section className="hero" style={{ backgroundImage: `radial-gradient(circle at 72% 24%, rgba(195,164,123,.15), transparent 26%), linear-gradient(110deg, rgba(11,11,12,.98) 0%, rgba(11,11,12,.66) 44%, rgba(11,11,12,.25) 100%), url('${HERO_IMAGE}') center/cover` }}>
      <div className="container hero-content">
        <Chapter>MarketHub / Secure multi-vendor bookstore</Chapter>
        <h1>Discover your next chapter.</h1>
        <p className="hero-copy">Explore books from trusted vendors, publishers and booksellers — all in one secure marketplace.</p>
        <form className="hero-search" onSubmit={(event) => event.preventDefault()}>
          <Search size={16} aria-hidden="true" color="var(--gold)" />
          <input
            aria-label="Search the catalogue"
            placeholder="Search by title, author, ISBN, publisher…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Link className="button button-primary" href={`/books?q=${encodeURIComponent(query.trim())}`} >Search</Link>
        </form>
        <div className="btn-row" style={{ marginTop: 24 }}>
          <ViteButton to="/books" variant="primary">Explore Books <ArrowRight size={15} /></ViteButton>
          <ViteButton href="/catalogue" variant="ghost">Browse the full catalogue</ViteButton>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><strong>{stats.titles.toLocaleString('en-IN')}+</strong><span>Titles on the shelves</span></div>
          <div className="hero-stat"><strong>{stats.categories}</strong><span>Curated categories</span></div>
          <div className="hero-stat"><strong>{stats.formats}</strong><span>Editorial formats</span></div>
        </div>
      </div>
      <div className="hero-side-note">A marketplace for readers</div>
    </section>
  )
}

/* ── Featured spread ────────────────────────────────────────────────────── */

function HomeFeature({ featured }: { featured: Book }) {
  return (
    <section className="section section-dark">
      <div className="container feature-spread">
        <div className="feature-copy">
          <Chapter>Featured / A title to begin with</Chapter>
          <h2>{featured.title}</h2>
          <p>{featured.author} · {featured.category}</p>
          <div className="feature-meta">
            <div><div><ViteRating book={featured} /></div><span>Reader signal</span></div>
            <div><strong>{featured.price === null ? 'Information unavailable' : `₹${featured.price.toLocaleString('en-IN')}`}</strong><span>Seller price</span></div>
          </div>
          <ViteButton to={`/books/${featured.id}`} variant="secondary">Open the book <ArrowRight size={15} /></ViteButton>
        </div>
        <div className="feature-visual">
          <div className="feature-cover-back" />
          <div className="feature-cover-back two" />
          <div className="feature-cover">
            {/* Plain <img>: the CSS blends and inks this image; next/image's
                required wrapper would break the mix-blend-mode treatment. */}
            <img src={featured.cover || FEATURED_IMAGE} alt={`Cover of ${featured.title}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Category band ──────────────────────────────────────────────────────── */

function CategoryBand() {
  return (
    <section className="category-band">
      <div className="container">
        <div className="section-heading">
          <div><Chapter>Browse by mood</Chapter><h2>Find the shelf<br />that feels like you.</h2></div>
          <p>From first editions to late-night page turners, find a category that makes room for curiosity.</p>
        </div>
        <div className="category-grid">
          {categories.slice(1, 9).map((category, index) => (
            <Link className="category-card" key={category.name} href={`/books?category=${encodeURIComponent(category.name)}`} >
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{category.name}</strong>
              <span className="category-card-count">{category.count.toLocaleString('en-IN')} titles</span>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <ViteButton href="/catalogue" variant="text">See every category in the full catalogue <ArrowRight size={13} /></ViteButton>
        </div>
      </div>
    </section>
  )
}

/* ── Editorial band ─────────────────────────────────────────────────────── */

function EditorialBand({ featured }: { featured: Book }) {
  const { addToCart } = useStorefront()
  return (
    <section className="editorial-band">
      <div className="container editorial-grid">
        <div>
          <Chapter>For the repeat reader</Chapter>
          <h2>Books worth turning the page for.</h2>
          <p>Our bestseller shelf is not a list. It is a living spread of titles readers choose again and again — with the context to help you choose your next one.</p>
          <div className="editorial-stat"><strong>{featured.rating === undefined ? '—' : `${featured.rating.toFixed(1)} / 5`}</strong><span>Today's featured title</span></div>
          <ViteButton to="/bestsellers" variant="primary">Enter the bestseller shelf <ArrowRight size={15} /></ViteButton>
        </div>
        <div className="editorial-side">
          <div className="section-rule" />
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.8, marginTop: 22 }}>
            A quieter, more considered way to shop. Every title has a seller, a story, and a place in the wider reading life.
          </p>
          <div style={{ marginTop: 55 }}><ViteButton to="/vendors" variant="ghost">Meet the booksellers <Store size={14} /></ViteButton></div>
        </div>
      </div>
    </section>
  )
}
