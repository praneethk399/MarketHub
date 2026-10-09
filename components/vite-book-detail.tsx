'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Heart, ShoppingBag, Star } from 'lucide-react'
import type { Book } from '@/data/books'
import { useStorefront } from './storefront'
import { BookSocial } from './social/book-social'
import { PassportPanel } from './social/passport-panel'
import { AiAdvisor } from './social/ai-advisor'
import { LibraryControls } from './library/library-controls'
import { Chapter, ViteButton, ViteRating } from './vite-shell'

/**
 * Book detail in the Vite editorial look. Everything below the hero — friends'
 * reviews, passport, seller comparison, community, AI advisor, library controls —
 * is the existing production surface, unchanged in behaviour, restyled only by
 * the scoped design tokens.
 */

const money = (value: number | null) => (value === null ? 'Information unavailable' : `₹${value.toLocaleString('en-IN')}`)

export function ViteBookDetail({ book }: { book: Book }) {
  const { addToCart, toggleWishlist, wishlist } = useStorefront()
  const saved = wishlist.includes(book.id)
  const discount = book.price && book.originalPrice ? Math.round((1 - book.price / book.originalPrice) * 100) : null
  const purchasable = book.status === 'in-stock' && book.price !== null
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <article className="book-detail-page">
      <section className="container detail-layout">
        <div className="detail-gallery">
          <div className="detail-cover">
            <Image src={book.cover} alt={`Cover of ${book.title}`} width={420} height={580} priority style={{ width: '100%', height: 'auto' }} />
          </div>
        </div>
        <div className="detail-copy">
          <nav className="detail-back" aria-label="Breadcrumb">
            <Link href="/books"><ArrowLeft size={14} aria-hidden="true" /> Back to the shelf</Link>
          </nav>
          <span className="eyebrow">{book.category}{book.format ? ` · ${book.format}` : ''}</span>
          <h1>{book.title}</h1>
          <span className="author">by {book.author}</span>
          <div style={{ marginTop: 16 }}><ViteRating book={book} /></div>

          <div className="detail-price-row">
            <span className="price">{money(book.price)}</span>
            {book.originalPrice ? <span className="mrp">{money(book.originalPrice)}</span> : null}
            {discount ? <span className="discount">{discount}% off</span> : null}
          </div>
          <p className="detail-stock">
            {book.status === 'in-stock'
              ? book.stock === null ? 'Stock information unavailable' : `${book.stock} in stock — ready to ship`
              : 'Currently out of stock'}
          </p>

          <div className="btn-row">
            <ViteButton
              onClick={() => purchasable && addToCart(book.id, book.title)}
              variant="primary"
              disabled={!purchasable}
            ><ShoppingBag size={14} /> {book.price === null ? 'Price unavailable' : 'Add to Cart'}</ViteButton>
            <ViteButton onClick={() => void toggleWishlist(book.id, book.title)} variant="ghost">
              <Heart size={15} fill={saved ? 'currentColor' : 'none'} color={saved ? 'var(--gold)' : undefined} />
              {saved ? 'Saved' : 'Save for later'}
            </ViteButton>
          </div>

          <div style={{ marginTop: 22 }}><LibraryControls bookId={book.id} /></div>

          <div className="detail-info">
            <button className="detail-info-toggle" type="button" aria-expanded={infoOpen} onClick={() => setInfoOpen((open) => !open)}>
              Book information {infoOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {infoOpen && (
              <dl className="info-list">
                <div><dt>ISBN</dt><dd>{book.isbn ?? 'Information unavailable'}</dd></div>
                <div><dt>Format</dt><dd>{book.format ?? 'Information unavailable'}</dd></div>
                <div><dt>Category</dt><dd>{book.category}</dd></div>
                <div><dt>Sellers listing this title</dt><dd>{book.sellerCount}</dd></div>
              </dl>
            )}
          </div>

          <p className="social-meta">Prices and stock come from the sellers listing this edition — never estimated.</p>
        </div>
      </section>

      <BookSocial bookId={book.id} />
      <PassportPanel bookId={book.id} />
      <AiAdvisor bookTitle={book.title} />
    </article>
  )
}
