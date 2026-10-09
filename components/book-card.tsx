'use client'

import Image from 'next/image'
import { ArrowUpRight, Heart } from 'lucide-react'
import { useState } from 'react'
import type { Book } from '@/data/books'
import { useCoverTilt } from './book-motion'
import { useStorefront } from './storefront'
import { Badge, Rating } from './ui'

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
const pageLayerBooks = new Set(['secret-garden', 'song-achilles', 'great-gatsby', 'pride-prejudice'])

export function BookCard({ book }: { book: Book }) {
  const { wishlist, toggleWishlist, addToCart } = useStorefront()
  const tilt = useCoverTilt<HTMLDivElement>()
  const [imageFailed, setImageFailed] = useState(false)
  const [notified, setNotified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const saved = wishlist.includes(book.id)
  const discount = book.price && book.originalPrice ? Math.round((1 - book.price / book.originalPrice) * 100) : null

  const notify = () => {
    setNotified(true)
    window.setTimeout(() => setNotified(false), 1800)
  }
  const add = () => {
    if (loading) return
    setLoading(true)
    window.setTimeout(() => {
      addToCart(book.id, book.title)
      setLoading(false)
    }, 220)
  }

  return <article className="book-card">
    <div className={`book-art ${pageLayerBooks.has(book.id) ? 'book-page-featured' : ''}`} ref={tilt.ref} onPointerMove={tilt.track} onPointerLeave={tilt.settle}>
      <a className={`book-cover ${imageFailed ? 'cover-failed' : ''}`} href={`/books/${book.id}`} aria-label={`View ${book.title}`}>
        {!imageFailed && <Image src={book.cover} alt={`Cover artwork for ${book.title}`} fill sizes="(max-width: 580px) 46vw, (max-width: 900px) 30vw, (max-width: 1250px) 24vw, 19vw" onError={() => setImageFailed(true)} />}
        {imageFailed && <span className="cover-fallback-art"><small>{book.category}</small><strong>{book.title}</strong></span>}
        <span className="cover-shade" />
        <span className="cover-sheen" aria-hidden="true" />
        <span className="cover-spine" aria-hidden="true" />
      </a>
      {book.badge && (/^\d+% OFF$/.test(book.badge) || book.badge === 'NEW EDITION') && <Badge tone={book.badge === 'NEW EDITION' ? 'new' : 'gold'}>{book.badge}</Badge>}
      <button className={`wishlist-button ${saved ? 'is-saved' : ''}`} type="button" aria-label={saved ? `Remove ${book.title} from wishlist` : `Add ${book.title} to wishlist`} aria-pressed={saved} onClick={() => toggleWishlist(book.id, book.title)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} strokeWidth={1.65} /></button>
    </div>
    <div className="book-card-body">
      <div className="book-card-title-row"><a className="book-title" id={`book-${book.id}`} href={`/books/${book.id}`}>{book.title}</a><a className="book-open-link" href={`/books/${book.id}`} aria-label={`View ${book.title} details`}><ArrowUpRight size={15} /></a></div>
      <p className="book-author">{book.author}</p>
      <div className="book-rating-row"><Rating value={book.rating} reviews={book.reviews} /><span className={`stock-label ${book.status === 'out-of-stock' ? 'stock-empty' : ''}`}><span />{book.status === 'in-stock' ? `${book.stock} in stock` : 'Stock unavailable'}</span></div>
      <div className="book-price-row">{book.price !== null ? <><strong>{money(book.price)}</strong>{book.originalPrice && <><del>{money(book.originalPrice)}</del>{discount && <span className="discount-label">{discount}% off</span>}</>}</> : <span className="price-unavailable">Price unavailable</span>}</div>
      {detailsOpen && <div className="book-extra-details"><strong>{book.author}</strong><span>{book.category}{book.format ? ` · ${book.format}` : ''}</span></div>}
      <a className="book-social-link" href={`/books/${encodeURIComponent(book.id)}`}>Community &amp; seller details <ArrowUpRight size={13} /></a>
      <button className={`card-cta ${book.status === 'out-of-stock' ? 'card-cta-outline' : ''}`} type="button" disabled={loading || (notified && book.action === 'notify')} onClick={book.action === 'notify' ? notify : book.action === 'details' ? () => setDetailsOpen((open) => !open) : add}>
        {loading ? <><span className="button-spinner" /> Adding…</> : notified && book.action === 'notify' ? 'We’ll keep you posted' : book.action === 'notify' ? <>Notify me <ArrowUpRight size={13} /></> : book.action === 'details' ? <>{detailsOpen ? 'Hide details' : 'View details'} <ArrowUpRight size={13} /></> : <>Add to cart <ArrowUpRight size={13} /></>}
      </button>
    </div>
  </article>
}
