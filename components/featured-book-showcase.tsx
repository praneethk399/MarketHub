'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Heart, ShoppingBag } from 'lucide-react'
import type { Book } from '@/data/books'
import { activeIndexFor, announcementFor, featuredShelfSize, formatShelfIndex, selectFeaturedBooks, sideIndices } from './featured-selection'
import { useStorefront } from './storefront'
import { Rating } from './ui'

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`

/**
 * The featured shelf that opens the home page.
 *
 * It renders the live catalogue passed in as `books` — the same array the
 * catalogue below reads — so nothing on this shelf is a static mockup: every
 * cover, price, rating, stock state and "open" link comes from a real `Book`,
 * and every link resolves to `/books/[id]`.
 *
 * Cost and disclosure rules it follows:
 * - Money, stock and cart effects are never computed here; "Add to cart" and the
 *   wishlist go through the storefront API, which is the only server-enforced path.
 * - The caption is assembled from real fields only. `Book` carries no synopsis, so
 *   there is no invented blurb — just category, format, offers, rating and stock.
 * - No autoplay, and wheel/swipe is deliberately *not* hijacked: a phone reader
 *   scrolling past this section must keep normal page scrolling. Keyboard arrows
 *   only act once focus is already inside the region.
 */
export function FeaturedBookShowcase({ books, notice = '' }: { books: Book[]; notice?: string }) {
  const { wishlist, toggleWishlist, addToCart } = useStorefront()
  const featured = useMemo(() => selectFeaturedBooks(books), [books])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [failedCovers, setFailedCovers] = useState<readonly string[]>([])
  const [adding, setAdding] = useState(false)

  const activeIndex = activeIndexFor(featured, activeId)
  const active = activeIndex >= 0 ? featured[activeIndex] : null

  const shelfRef = useRef<HTMLDivElement>(null)

  const focusBook = useCallback((book: Book) => setActiveId(book.id), [])
  const step = useCallback((direction: -1 | 1) => {
    setActiveId((current) => {
      const index = activeIndexFor(featured, current)
      const next = Math.min(featured.length - 1, Math.max(0, index + direction))
      return featured[next]?.id ?? current
    })
  }, [featured])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
    // Every other key, including ArrowUp/ArrowDown, is left to the browser so the
    // page keeps scrolling normally while focus sits in this region.
  }

  /* Restrained pointer parallax, the same rAF + custom-property idiom the hero
     uses. Mouse only, and skipped entirely under prefers-reduced-motion. */
  useEffect(() => {
    const node = shelfRef.current
    if (!node || typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const render = () => {
      currentX += (targetX - currentX) * 0.08
      currentY += (targetY - currentY) * 0.08
      node.style.setProperty('--shelf-x', `${currentX}px`)
      node.style.setProperty('--shelf-y', `${currentY}px`)
      if (Math.abs(targetX - currentX) > 0.04 || Math.abs(targetY - currentY) > 0.04) {
        frame = window.requestAnimationFrame(render)
      } else {
        currentX = targetX
        currentY = targetY
        frame = 0
      }
    }

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const bounds = node.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 14
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8
      if (!frame) frame = window.requestAnimationFrame(render)
    }

    const settle = () => {
      targetX = 0
      targetY = 0
      if (!frame) frame = window.requestAnimationFrame(render)
    }

    node.addEventListener('pointermove', move)
    node.addEventListener('pointerleave', settle)
    return () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerleave', settle)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const cover = (book: Book, sizes: string, priority = false) => {
    const failed = failedCovers.includes(book.id)
    return <span className={`featured-cover${failed ? ' cover-failed' : ''}`}>
      {!failed && <Image
        src={book.cover}
        alt={`Cover artwork for ${book.title}`}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setFailedCovers((current) => current.includes(book.id) ? current : [...current, book.id])}
      />}
      {failed && <span className="cover-fallback-art"><small>{book.category}</small><strong>{book.title}</strong></span>}
    </span>
  }

  if (!active) {
    return <section className="featured-showcase" id="bestsellers" aria-labelledby="featured-heading">
      <div className="featured-heading-row">
        <h2 id="featured-heading">Featured this week<span className="heading-period">.</span></h2>
      </div>
      <div className="featured-empty">
        <h3>No books on this shelf just yet.</h3>
        <p>The collection is loading, or nothing is available to feature right now.</p>
        <a className="button button-outline" href="#catalog">Browse the collection</a>
      </div>
      {notice && <p role="status" className="featured-notice">{notice}</p>}
    </section>
  }

  const saved = wishlist.includes(active.id)
  const purchasable = active.status === 'in-stock' && active.price !== null
  const sides = sideIndices(activeIndex, featured.length)
  const openHref = `/books/${encodeURIComponent(active.id)}`

  const add = async () => {
    if (adding) return
    setAdding(true)
    try {
      await addToCart(active.id, active.title)
    } finally {
      setAdding(false)
    }
  }

  return <section
    className="featured-showcase"
    id="bestsellers"
    aria-labelledby="featured-heading"
    onKeyDown={onKeyDown}
  >
    <div className="featured-heading-row">
      <h2 id="featured-heading">Featured this week<span className="heading-period">.</span></h2>
      <p className="featured-hint">
        Taken from the live collection. Use the arrows, or the left and right arrow keys once focus is here.
      </p>
    </div>

    <div className="featured-stage">
      <div className="featured-shelf" ref={shelfRef}>
        {sides.map((index) => {
          const book = featured[index]
          const distance = Math.abs(index - activeIndex)
          return <button
            key={book.id}
            type="button"
            className="featured-side"
            style={{ '--distance': distance, '--dir': index < activeIndex ? -1 : 1 } as CSSProperties}
            aria-label={`Feature ${book.title} by ${book.author}`}
            onClick={() => focusBook(book)}
          >
            {cover(book, '(max-width: 580px) 18vw, (max-width: 900px) 16vw, 150px')}
          </button>
        })}

        <div className="featured-focus">
          <a className="featured-focus-cover" href={openHref} aria-label={`Open ${active.title}`}>
            {cover(active, '(max-width: 580px) 52vw, (max-width: 900px) 40vw, 340px', true)}
          </a>
        </div>
      </div>

      <div className="featured-panel">
        <div className="featured-panel-lead">
          <span className="featured-index" aria-hidden="true">{formatShelfIndex(activeIndex, featured.length)}</span>
          <div>
            <div className="featured-meta">
              <span>{active.category}</span>
              {active.format && <>
                <span aria-hidden="true">·</span>
                <span>{active.format}</span>
              </>}
              {active.badge && <span className="featured-badge">{active.badge}</span>}
            </div>
            <h3 className="featured-title"><a href={openHref}>{active.title}</a></h3>
            <p className="featured-author">{active.author}</p>
          </div>
        </div>

        <div className="featured-facts">
          {active.price !== null
            ? <span className="featured-price">{money(active.price)}{active.originalPrice && <del>{money(active.originalPrice)}</del>}</span>
            : <span className="price-unavailable">Price unavailable</span>}
          <Rating value={active.rating} reviews={active.reviews} />
          <span className={`stock-label ${purchasable ? '' : 'stock-empty'}`}><span />{purchasable ? `${active.stock} in stock` : 'Stock unavailable'}</span>
          <span className="featured-offers">{active.sellerCount} {active.sellerCount === 1 ? 'seller' : 'sellers'}</span>
        </div>

        <div className="featured-actions">
          <a className="button button-primary featured-open" href={openHref}>Open book <ArrowRight size={14} aria-hidden="true" /></a>
          <button className="button button-outline" type="button" disabled={!purchasable || adding} onClick={() => void add()}>
            <ShoppingBag size={14} aria-hidden="true" />
            {adding ? 'Adding…' : purchasable ? 'Add to cart' : 'Unavailable'}
          </button>
          <button
            className={`button button-outline featured-wishlist${saved ? ' is-saved' : ''}`}
            type="button"
            aria-pressed={saved}
            aria-label={saved ? `Remove ${active.title} from wishlist` : `Save ${active.title} to wishlist`}
            onClick={() => void toggleWishlist(active.id, active.title)}
          >
            <Heart size={14} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="featured-controls">
          <button className="featured-step" type="button" aria-label="Previous featured book" disabled={activeIndex === 0} onClick={() => step(-1)}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <ol className="featured-progress" aria-label="Featured books">
            {featured.map((book, index) => <li key={book.id}>
              <button
                type="button"
                className={index === activeIndex ? 'is-current' : ''}
                aria-label={`Feature ${book.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => focusBook(book)}
              />
            </li>)}
          </ol>
          <button className="featured-step" type="button" aria-label="Next featured book" disabled={activeIndex === featured.length - 1} onClick={() => step(1)}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          <a className="featured-browse" href="#catalog">Browse all books</a>
        </div>
      </div>
    </div>

    <p className="sr-only" aria-live="polite">{announcementFor(active, activeIndex, featured.length)}</p>
    {notice && <p role="status" className="featured-notice">{notice}</p>}
  </section>
}

export { featuredShelfSize }
