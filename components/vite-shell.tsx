'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight, ChevronDown, ChevronRight, Check, Heart, Menu, Minus, Package,
  Plus, Search, Send, ShoppingBag, Sparkles, Star, Trash2, UserRound, X,
} from 'lucide-react'
import { useStorefront } from './storefront'
import type { Book } from '@/data/books'

/**
 * The Vite storefront's shell, wired to the live Next.js storefront.
 *
 * Presentation is the editorial "ink & paper" design from the original SPA;
 * behaviour is the production one — the real session, the server cart with its
 * quantity steppers, the wishlist, and the toast system. The header keeps the
 * existing popover cart so the bag stays one click from checkout, exactly as
 * the previous navbar did.
 */

const money = (value: number | null) => (value === null ? 'Information unavailable' : `₹${value.toLocaleString('en-IN')}`)

export function Chapter({ children }: { children: ReactNode }) {
  return <div className="chapter-label">{children}</div>
}

export function ViteBrand({ light = false }: { light?: boolean }) {
  return (
    <span className="wordmark" style={light ? { color: 'var(--ink)' } : undefined}>
      <span className="book-mark" aria-hidden="true">
        <svg viewBox="0 0 34 26" role="presentation">
          <path d="M3 4.5c5.1-1.9 9.6-.9 14 3.1 4.4-4 8.9-5 14-3.1v16.8c-5-1.8-9.6-.8-14 3.2-4.4-4-9-5-14-3.2V4.5Z" />
          <path d="M17 7.6v16.9" />
          <path d="M7.1 9.1c2.9-.4 5.9.4 8.3 2.1M26.9 9.1c-2.9-.4-5.9.4-8.3 2.1" />
        </svg>
      </span>
      MARKETHUB
    </span>
  )
}

export function ViteButton({
  children, to, href, onClick, variant = 'primary', type = 'button', className = '', disabled = false,
}: {
  children: ReactNode; to?: string; href?: string; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark' | 'text'; type?: 'button' | 'submit'
  className?: string; disabled?: boolean
}) {
  const classes = `button button-${variant} ${className}`
  if (to) return <Link className={classes} href={to}>{children}</Link>
  if (href) return <a className={classes} href={href}>{children}</a>
  return <button className={classes} type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

export function ViteRating({ book }: { book: Book }) {
  return (
    <span className="rating">
      <Star size={12} fill="currentColor" />
      {' '}{book.rating === undefined ? 'Information unavailable' : book.rating.toFixed(1)}
      <span> ({(book.reviews ?? 0).toLocaleString('en-IN')})</span>
    </span>
  )
}

/* ── Header ─────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  ['Books', '/books'],
  ['Categories', '/category/fiction'],
  ['Bestsellers', '/bestsellers'],
  ['Authors', '/authors'],
  ['Vendors', '/vendors'],
] as const

type Popover = 'wishlist' | 'cart' | 'account' | null

export function ViteHeader() {
  const {
    user, ready, cartItems, cartCount, cartSubtotal, wishlistItems,
    setCartQuantity, toggleWishlist, authenticate, signOut,
  } = useStorefront()
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [popover, setPopover] = useState<Popover>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 22)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => setMenuOpen(false), [pathname])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim()) router.push(`/books?q=${encodeURIComponent(query.trim())}#grid`)
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setAuthBusy(true)
    setAuthError('')
    try {
      await authenticate(authMode, {
        name: authMode === 'register' ? String(fields.get('name') ?? '') : undefined,
        email: String(fields.get('email') ?? ''),
        password: String(fields.get('password') ?? ''),
      })
      setPopover(null)
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Could not authenticate.')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="header-inner">
          <Link href="/" aria-label="MarketHub home"><ViteBrand /></Link>
          <nav className="header-nav" aria-label="Primary navigation">
            {NAV_LINKS.map(([label, to]) => (
              <Link key={to} href={to} className={pathname.startsWith(to) ? 'active' : ''}>{label}</Link>
            ))}
          </nav>
          <form className="header-search" role="search" onSubmit={submitSearch}>
            <Search size={14} aria-hidden="true" />
            <input
              aria-label="Search books"
              placeholder="Search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <div className="header-actions">
            <button className="icon-button" type="button" aria-label={`Wishlist, ${wishlistItems.length} saved`} aria-expanded={popover === 'wishlist'} onClick={() => setPopover(popover === 'wishlist' ? null : 'wishlist')}><Heart size={16} /><span className="icon-count">{wishlistItems.length}</span></button>
            <button className="icon-button" type="button" aria-label={`Shopping bag, ${cartCount} items`} aria-expanded={popover === 'cart'} onClick={() => setPopover(popover === 'cart' ? null : 'cart')}><ShoppingBag size={16} /><span className="badge-count" key={cartCount}>{cartCount}</span></button>
            <button className="icon-button" type="button" aria-label={user ? `Account: ${user.name}` : 'Sign in or create account'} aria-expanded={popover === 'account'} onClick={() => setPopover(popover === 'account' ? null : 'account')}><UserRound size={16} /></button>
          </div>
          <div className="mobile-header-actions">
            <button className="icon-button" type="button" aria-label={`Shopping bag, ${cartCount} items`} onClick={() => setPopover('cart')}><ShoppingBag size={17} /><span className="badge-count" key={cartCount}>{cartCount}</span></button>
            <button className="mobile-menu-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          </div>

          {popover && (
            <div className="header-popover" role="dialog" aria-label={popover === 'wishlist' ? 'Saved books' : popover === 'cart' ? 'Shopping bag' : 'Reader account'}>
              <div className="header-popover-head">
                <span>{popover === 'wishlist' ? 'Saved for later' : popover === 'cart' ? 'Your book bag' : user ? `Hello, ${user.name}` : 'Reader account'}</span>
                <button type="button" aria-label="Close panel" onClick={() => { setPopover(null); setAuthError('') }}><X size={15} /></button>
              </div>

              {popover === 'account' && (user
                ? (
                  <div className="header-popover-empty">
                    <span className="account-glyph"><UserRound size={19} /></span>
                    <p>{user.email}</p>
                    <div className="account-links">
                      <Link href="/library" onClick={() => setPopover(null)}>My library <ChevronRight size={14} /></Link>
                      <Link href="/social" onClick={() => setPopover(null)}>Friends, lists &amp; privacy <ChevronRight size={14} /></Link>
                    </div>
                    <button type="button" disabled={!ready} onClick={() => { void signOut(); setPopover(null) }}>Sign out</button>
                  </div>
                )
                : (
                  <form className="account-form" onSubmit={submitAuth}>
                    <p>{authMode === 'register' ? 'Create an account to keep your bag and shelves synced.' : 'Sign in to sync your bag, saved books and reading progress.'}</p>
                    {authMode === 'register' && <label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>}
                    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
                    <label>Password<input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required /></label>
                    {authError && <p className="social-error" role="alert">{authError}</p>}
                    <button className="button" type="submit" disabled={authBusy || !ready}>{authBusy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
                    <button className="account-mode-toggle" type="button" onClick={() => { setAuthError(''); setAuthMode(authMode === 'register' ? 'login' : 'register') }}>
                      {authMode === 'register' ? 'Already have an account? Sign in' : 'New to MarketHub? Create an account'}
                    </button>
                  </form>
                ))}

              {popover === 'cart' && (
                !ready
                  ? <div className="header-popover-empty">Loading your bag…</div>
                  : cartItems.length
                    ? (
                      <>
                        <div className="header-popover-books">
                          {cartItems.map((item) => (
                            <div className="header-popover-book" key={item.bookId}>
                              {item.cover && <Image src={item.cover} width={38} height={48} alt="" />}
                              <span>
                                {item.title}
                                <small>{item.price === null ? 'Price unavailable' : `${money(item.price)} each`}</small>
                                <span className="cart-line-controls">
                                  <button type="button" aria-label={`Remove one ${item.title}`} onClick={() => void setCartQuantity(item.bookId, item.quantity - 1)}><Minus size={13} /></button>
                                  <span>{item.quantity}</span>
                                  <button type="button" aria-label={`Add one ${item.title}`} onClick={() => void setCartQuantity(item.bookId, item.quantity + 1)}><Plus size={13} /></button>
                                  <button type="button" aria-label={`Remove ${item.title}`} onClick={() => void setCartQuantity(item.bookId, 0)}><Trash2 size={13} /></button>
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="header-popover-footnote">Subtotal · {money(cartSubtotal)}</div>
                        <Link className="button cart-checkout-link" href="/library" onClick={() => setPopover(null)}>Review bag &amp; checkout <ChevronRight size={14} /></Link>
                      </>
                    )
                    : (
                      <div className="header-popover-empty">
                        <span className="account-glyph"><ShoppingBag size={18} /></span>
                        <p>Your book bag is waiting for a story.</p>
                        <button type="button" onClick={() => setPopover(null)}>Continue browsing</button>
                      </div>
                    )
              )}

              {popover === 'wishlist' && (
                !ready
                  ? <div className="header-popover-empty">Loading your saved books…</div>
                  : wishlistItems.length
                    ? (
                      <>
                        <div className="header-popover-books">
                          {wishlistItems.map((item) => (
                            <div className="header-popover-book" key={item.id}>
                              {item.cover && <Image src={item.cover} width={38} height={48} alt="" />}
                              <span>{item.title}<small>{item.author}</small></span>
                              <button type="button" aria-label={`Remove ${item.title} from wishlist`} onClick={() => void toggleWishlist(item.id, item.title)}><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                        <div className="header-popover-footnote">{wishlistItems.length} saved title{wishlistItems.length === 1 ? '' : 's'}</div>
                      </>
                    )
                    : (
                      <div className="header-popover-empty">
                        <span className="account-glyph"><Heart size={18} /></span>
                        <p>Save the stories you want to return to.</p>
                        <button type="button" onClick={() => setPopover(null)}>Continue browsing</button>
                      </div>
                    )
              )}
            </div>
          )}
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-drawer-head"><ViteBrand /><button className="icon-button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
            <nav aria-label="Mobile navigation" className="mobile-drawer-links">
              {([['Home', '/'], ...NAV_LINKS, ['My library', '/library'], ['Community', '/social'], ['Sign in', '/login'], ['The full catalogue', '/catalogue']] as [string, string][]).map(([label, to]) => (
                <Link key={to} href={to}>{label}<ChevronRight size={15} /></Link>
              ))}
            </nav>
            <p className="muted" style={{ fontSize: 11, lineHeight: 1.7 }}>A quieter way to find the books that stay with you.</p>
          </aside>
        </div>
      )}
    </>
  )
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

export function ViteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="MarketHub home"><ViteBrand /></Link>
            <p>A trusted multi-vendor bookstore for readers who want the next title to feel discovered, not merely listed.</p>
            <ViteButton to="/books" variant="ghost">Explore the catalogue <ArrowRight size={14} /></ViteButton>
          </div>
          <div className="footer-col"><h4>Shop</h4><Link href="/books">Books</Link><Link href="/bestsellers">Bestsellers</Link><Link href="/category/fiction">Categories</Link><Link href="/authors">Authors</Link></div>
          <div className="footer-col"><h4>Sell with us</h4><Link href="/vendor-applications">Become a Vendor</Link><Link href="/vendors">Vendor directory</Link></div>
          <div className="footer-col"><h4>Help</h4><Link href="/library">Orders &amp; library</Link><Link href="/social">Community</Link><Link href="/catalogue">Full catalogue</Link></div>
        </div>
        <div className="footer-bottom"><span>© 2026 MarketHub</span><span>Built for the curious.</span></div>
      </div>
    </footer>
  )
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

export function ViteToasts() {
  const { toast, dismissToast } = useStorefront()
  if (!toast) return null
  return (
    <div className="toast-stack" aria-live="polite">
      <div className="toast">
        <Check size={15} color="var(--success)" />
        {toast}
        <button className="icon-button" aria-label="Dismiss notification" onClick={dismissToast}><X size={13} /></button>
      </div>
    </div>
  )
}

/* ── AI assistant ───────────────────────────────────────────────────────── */

type AssistantMessage = { role: 'user' | 'assistant'; text: string; link?: string }

export function ViteAssistant({ answers }: { answers?: { title: string; href: string }[] }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'assistant', text: 'Tell me what you want to read. I can point you at the live catalogue.' },
  ])

  const respond = (raw: string) => {
    const prompt = raw.trim()
    if (!prompt) return
    setMessages((current) => [...current, { role: 'user', text: prompt }])
    setInput('')
    const lowered = prompt.toLowerCase()
    // Suggestion chips come from the server-rendered page, so every link they
    // offer is a real, purchasable title rather than an invented recommendation.
    window.setTimeout(() => {
      const match = answers?.find((answer) => lowered.includes(answer.title.toLowerCase().split(' ')[0]))
      setMessages((current) => [...current, {
        role: 'assistant',
        text: match
          ? `A good match for that: ${match.title}.`
          : forcedAnswer(lowered),
        link: match?.href ?? answers?.[0]?.href,
      }])
    }, 250)
  }

  const forcedAnswer = (lowered: string) => {
    if (lowered.includes('fantasy')) return 'Open the fantasy shelf — the catalogue filters it live.'
    if (lowered.includes('under')) return 'Sort the shelf by price, low to high, and the cheapest titles rise first.'
    if (lowered.includes('mystery') || lowered.includes('thriller')) return 'Use the Mystery & Thriller category on the books page.'
    return 'Try the priced shelf — everything there can be bought today.'
  }

  return (
    <div className="assistant">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-head"><strong>Book assistant</strong><button className="icon-button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={15} /></button></div>
          <div className="assistant-body">
            {messages.map((message, index) => (
              <div key={index} className={`assistant-message ${message.role === 'user' ? 'user' : ''}`}>
                {message.text}
                {message.link && (
                  <div style={{ marginTop: 8 }}>
                    <Link href={message.link} onClick={() => setOpen(false)} className="button-text">Open the shelf <ArrowRight size={12} /></Link>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="assistant-suggestions">
            {answers?.slice(0, 3).map((answer) => (
              <button key={answer.href} onClick={() => respond(answer.title)}>{answer.title}</button>
            ))}
          </div>
          <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); respond(input) }}>
            <input aria-label="Ask the book assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a book…" />
            <button aria-label="Send prompt" type="submit"><Send size={14} /></button>
          </form>
        </div>
      )}
      <button className="assistant-toggle" aria-label="Open book assistant" onClick={() => setOpen((value) => !value)}><Sparkles size={20} /></button>
    </div>
  )
}

/* ── Book card ──────────────────────────────────────────────────────────── */

export function ViteBookCard({ book }: { book: Book }) {
  const { wishlist, toggleWishlist, addToCart } = useStorefront()
  const isWishlisted = wishlist.includes(book.id)
  const discount = book.price && book.originalPrice ? Math.round((1 - book.price / book.originalPrice) * 100) : null
  const purchasable = book.status === 'in-stock' && book.price !== null
  const [imageBroken, setImageBroken] = useState(false)

  return (
    <article className="book-card">
      <Link href={`/books/${book.id}`} aria-label={`View ${book.title}`}>
        <div className="cover-shell">
          {!imageBroken && book.cover
            ? <Image src={book.cover} alt={`${book.title} cover`} fill sizes="(max-width: 820px) 50vw, (max-width: 1250px) 30vw, 22vw" onError={() => setImageBroken(true)} />
            : <div className="cover-fallback"><span>{book.category}</span><strong>{book.title}</strong></div>}
          <div className="cover-overlay" />
        </div>
      </Link>
      <div className="book-card-actions">
        <button
          className="icon-button"
          aria-label={isWishlisted ? `Remove ${book.title} from wishlist` : `Add ${book.title} to wishlist`}
          aria-pressed={isWishlisted}
          onClick={() => toggleWishlist(book.id, book.title)}
        ><Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} color={isWishlisted ? 'var(--gold)' : undefined} /></button>
        {purchasable && (
          <button className="icon-button" aria-label={`Add ${book.title} to cart`} onClick={() => addToCart(book.id, book.title)}>
            <ShoppingBag size={15} />
          </button>
        )}
      </div>
      <div className="book-card-body">
        <Link href={`/books/${book.id}`} className="book-card-title">{book.title}</Link>
        <span className="book-card-author">{book.author}</span>
        <div className="meta-row">
          <ViteRating book={book} />
          <span className={`stock ${book.status !== 'in-stock' || book.stock === null ? 'out' : ''}`}>
            {book.stock === null ? 'Stock unavailable' : book.status !== 'in-stock' ? 'Out of stock' : `${book.stock} in stock`}
          </span>
        </div>
        <div className="book-card-price-row">
          <span className="price">{money(book.price)}</span>
          {book.originalPrice ? <span className="mrp">{money(book.originalPrice)}</span> : null}
          {discount ? <span className="discount">{discount}% off</span> : null}
        </div>
      </div>
    </article>
  )
}

export function ViteBookGrid({ items, empty }: { items: Book[]; empty?: ReactNode }) {
  if (!items.length) return <>{empty ?? (
    <div className="empty-state">
      <h2>No books found.</h2>
      <p>Try a different chapter, author, or category. The shelf is always changing.</p>
      <ViteButton to="/books" variant="primary">Reset the shelf</ViteButton>
    </div>
  )}</>
  return <div className="book-grid">{items.map((book) => <ViteBookCard key={book.id} book={book} />)}</div>
}

/* ── Page shell ─────────────────────────────────────────────────────────── */

export function ViteShell({ children, noFooter = false }: { children: ReactNode; noFooter?: boolean }) {
  return (
    <div className="app" id="top">
      <ViteHeader />
      <main className="app-main">{children}</main>
      {!noFooter && <ViteFooter />}
      <ViteAssistant />
      <ViteToasts />
    </div>
  )
}

/* ── Page hero ──────────────────────────────────────────────────────────── */

export function VitePageHero({ label, title, children, className = '' }: { label: string; title: string; children?: ReactNode; className?: string }) {
  return (
    <section className={`page-hero ${className}`}>
      <div className="container">
        <Chapter>{label}</Chapter>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  )
}
