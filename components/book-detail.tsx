'use client'

import Image from 'next/image'
import { ArrowLeft, Heart, ShoppingBag, Star } from 'lucide-react'
import type { Book } from '@/data/books'
import { useStorefront } from '@/components/storefront'
import { BookSocial } from '@/components/social/book-social'
import { PassportPanel } from '@/components/social/passport-panel'
import { AiAdvisor } from '@/components/social/ai-advisor'

/**
 * Product detail page (spec §34/§35): product info → friends' reviews →
 * trusted rating → passport → seller comparison → community reviews →
 * AI advisor → existing cart/checkout actions.
 */
export function BookDetail({ book }: { book: Book }) {
  const { addToCart, toggleWishlist, wishlist } = useStorefront()
  const saved = wishlist.includes(book.id)

  return <article className="book-detail">
    <nav className="book-detail-back" aria-label="Breadcrumb">
      <a href="/#books"><ArrowLeft size={15} aria-hidden="true" /> Back to the shelf</a>
    </nav>

    <header className="book-detail-hero">
      <div className="book-detail-cover">
        <Image src={book.cover} alt={`Cover of ${book.title}`} width={260} height={380} priority />
      </div>
      <div className="book-detail-meta">
        <p className="book-detail-category">{book.category} · {book.format}</p>
        <h1>{book.title}<span className="heading-period">.</span></h1>
        <p className="book-detail-author">by {book.author}</p>
        {book.rating !== undefined && <p className="book-detail-rating"><Star size={15} aria-hidden="true" /> {book.rating} / 5 from {book.reviews ?? 0} marketplace ratings</p>}
        <p className="book-detail-price">
          {book.price === null ? 'Price information unavailable' : `₹${book.price}`}
          {book.originalPrice ? <s>₹{book.originalPrice}</s> : null}
        </p>
        <p className="book-detail-stock">{book.status === 'in-stock' ? 'In stock and ready to ship' : 'Currently out of stock'}</p>
        <div className="book-detail-actions">
          <button
            className="button"
            type="button"
            disabled={book.status !== 'in-stock' || book.price === null}
            onClick={() => addToCart(book.id, book.title)}
          >
            <ShoppingBag size={16} aria-hidden="true" /> Add to cart
          </button>
          <button className={`button button-outline ${saved ? 'is-saved' : ''}`} type="button" onClick={() => toggleWishlist(book.id, book.title)}>
            <Heart size={16} aria-hidden="true" /> {saved ? 'Saved' : 'Save for later'}
          </button>
        </div>
        <p className="social-meta">Checkout, orders and payments continue through the existing secure MarketHub cart and checkout flow.</p>
      </div>
    </header>

    <BookSocial bookId={book.id} />
    <PassportPanel bookId={book.id} />
    <AiAdvisor bookTitle={book.title} />
  </article>
}
