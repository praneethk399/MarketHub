'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import type { Book } from '@/data/books'
import { useStorefront } from './storefront'
import { formatShelfIndex } from './featured-selection'
import { Chapter, ViteButton, VitePageHero, ViteRating } from './vite-shell'

const money = (value: number | null) => (value === null ? 'Information unavailable' : `₹${value.toLocaleString('en-IN')}`)

export function ViteBestsellers({ shelf }: { shelf: Book[] }) {
  const { addToCart } = useStorefront()
  const fallback = shelf.length ? shelf[0].id : ''
  const [activeId, setActiveId] = useState(fallback)
  const selected = shelf.find((book) => book.id === activeId) ?? shelf[0]
  const activeIndex = shelf.findIndex((book) => book.id === selected.id)

  if (!selected) {
    return (
      <VitePageHero label="MarketHub / Bestsellers" title="Books worth turning the page for.">
        <p>The shelf is being restocked — check back shortly.</p>
      </VitePageHero>
    )
  }

  return (
    <div className="bestseller-page">
      <section className="bestseller-intro">
        <div className="container">
          <Chapter>MarketHub / Bestsellers</Chapter>
          <h1>Books worth turning the page for.</h1>
          <p>Discover the titles readers are choosing again and again — a living editorial shelf, not just another product grid.</p>
        </div>
      </section>

      <section className="bestseller-showcase">
        <div className="container bestseller-showcase-inner">
          <div className="bestseller-copy">
            <span className="book-author">{selected.author}</span>
            <h2 key={selected.id}>{selected.title}</h2>
            <p className="bestseller-category">{selected.category}{selected.format ? ` · ${selected.format}` : ''}</p>
            <div className="bestseller-info">
              <div className="bestseller-info-item"><strong><ViteRating book={selected} /></strong><span>Reader signal</span></div>
              <div className="bestseller-info-item"><strong>{money(selected.price)}</strong><span>Price</span></div>
              <div className="bestseller-info-item"><strong>{selected.stock === null ? '—' : selected.stock}</strong><span>In stock</span></div>
              <div className="bestseller-info-item"><strong>{selected.sellerCount}</strong><span>Sellers</span></div>
            </div>
            <div className="btn-row">
              <ViteButton to={`/books/${selected.id}`} variant="secondary">Open book <ArrowRight size={15} /></ViteButton>
              <ViteButton
                onClick={() => selected.status === 'in-stock' && selected.price !== null && addToCart(selected.id, selected.title)}
                variant="ghost"
                disabled={selected.status !== 'in-stock' || selected.price === null}
              ><ShoppingBag size={14} /> Add to Cart</ViteButton>
            </div>
          </div>
          <div className="bestseller-stage" aria-live="polite">
            <div className="stage-glow" />
            <div className="stage-layer three" />
            <div className="stage-layer one" />
            <div className="stage-layer two" />
            <div className="stage-cover" data-title={selected.title}>
              <Image src={selected.cover} alt="" width={380} height={540} style={{ width: '100%', height: 'auto' }} />
            </div>
          </div>
        </div>
        <div className="container bestseller-selector">
          {shelf.map((book, index) => (
            <button
              className={`selector-item ${book.id === selected.id ? 'selected' : ''}`}
              key={book.id}
              onClick={() => setActiveId(book.id)}
              aria-label={`Select ${book.title}`}
              aria-pressed={book.id === selected.id}
            >
              <div className="selector-thumb">
                <Image src={book.cover} alt="" width={72} height={104} style={{ height: 'auto' }} />
              </div>
              <span className="index">{formatShelfIndex(index, shelf.length)}</span>
              <strong>{book.title}</strong>
              <span>{book.author}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bestseller-after">
        <div className="container bestseller-after-grid">
          <div><Chapter>Why this shelf</Chapter><h3>Selection should feel like a small discovery.</h3></div>
          <div>
            <p>This shelf is chosen from the titles sellers actually have in stock and priced — a deterministic pick from the live catalogue, refreshed as inventory changes. What it never does is invent a sales rank.</p>
            <ViteButton to="/books" variant="primary">Browse every book <ArrowRight size={15} /></ViteButton>
          </div>
        </div>
      </section>
    </div>
  )
}
