'use client'

import { Heart, Search, ShoppingBag, UserRound, Menu, X, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Logo } from './ui'
import { useStorefront } from './storefront'

const links = [
  { label: 'Books', href: '/books#books', active: true },
  { label: 'Categories', href: '/books#categories' },
  { label: 'Bestsellers', href: '/books?sort=bestseller' },
  { label: 'Authors', href: '/books#books' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Community', href: '/social' },
  { label: 'My library', href: '/library' },
]

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`

export function Navbar() {
  const {
    user, ready, cartItems, cartCount, cartSubtotal, wishlistItems,
    setCartQuantity, toggleWishlist, authenticate, signOut,
  } = useStorefront()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [popover, setPopover] = useState<'wishlist' | 'cart' | 'account' | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    if (window.location.pathname !== '/' && window.location.pathname !== '/books') {
      window.location.assign(`/books?search=${encodeURIComponent(value)}#books`)
      return
    }
    window.dispatchEvent(new CustomEvent('markethub:search', { detail: value }))
    document.querySelector('#books')?.scrollIntoView({ behavior: 'smooth' })
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

  return <>
    <header className="site-header">
      <div className="navbar">
        <a className="brand-link" href="/" aria-label="MarketHub home"><Logo /></a>
        <form className="nav-search" role="search" onSubmit={search}>
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search books" placeholder="Search by title, author, ISBN, publisher..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>⌘ K</kbd>
        </form>
        <nav className="desktop-nav" aria-label="Main navigation">{links.map((link) => <a className={link.active ? 'active' : ''} href={link.href} key={link.label}>{link.label}</a>)}</nav>
        <span className="nav-divider" />
        <div className="nav-actions">
          <button className="nav-icon" type="button" aria-label={`Wishlist, ${wishlistItems.length} saved`} aria-expanded={popover === 'wishlist'} onClick={() => setPopover(popover === 'wishlist' ? null : 'wishlist')}><Heart size={19} /><span className="icon-count">{wishlistItems.length}</span></button>
          <button className="nav-icon" type="button" aria-label={`Shopping bag, ${cartCount} items`} aria-expanded={popover === 'cart'} onClick={() => setPopover(popover === 'cart' ? null : 'cart')}><ShoppingBag size={19} /><span className="cart-count" key={cartCount}>{cartCount}</span></button>
          <button className="nav-icon profile-action" type="button" aria-label={user ? `Account: ${user.name}` : 'Sign in or create account'} aria-expanded={popover === 'account'} onClick={() => setPopover(popover === 'account' ? null : 'account')}><UserRound size={19} /></button>
        </div>
        <button className="mobile-menu-button" type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>

        {popover && <div className="nav-popover" role="dialog" aria-label={popover === 'wishlist' ? 'Saved books' : popover === 'cart' ? 'Shopping bag' : 'Reader account'}>
          <div className="popover-heading">
            <span>{popover === 'wishlist' ? 'Your saved shelf' : popover === 'cart' ? 'Your book bag' : user ? `Hello, ${user.name}` : 'Reader account'}</span>
            <button type="button" aria-label="Close panel" onClick={() => { setPopover(null); setAuthError('') }}><X size={15} /></button>
          </div>

          {popover === 'account' && (user
            ? <div className="popover-empty">
                <span className="account-glyph"><UserRound size={19} /></span>
                <p>{user.email}</p>
                <div className="account-links">
                  <a href="/orders" onClick={() => setPopover(null)}>Order history <ChevronRight size={14} /></a>
                  <a href="/library" onClick={() => setPopover(null)}>My library <ChevronRight size={14} /></a>
                  <a href="/social" onClick={() => setPopover(null)}>Friends, lists &amp; privacy <ChevronRight size={14} /></a>
                </div>
                <button type="button" disabled={!ready} onClick={() => { void signOut(); setPopover(null) }}>Sign out</button>
              </div>
            : <form className="account-form" onSubmit={submitAuth}>
                <p>{authMode === 'register' ? 'Create an account to keep your bag and shelves synced.' : 'Sign in to sync your bag, saved books and reading progress.'}</p>
                {authMode === 'register' && <label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>}
                <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
                <label>Password<input name="password" type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required /></label>
                {authError && <p className="social-error" role="alert">{authError}</p>}
                <button className="button" type="submit" disabled={authBusy || !ready}>{authBusy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
                <button className="account-mode-toggle" type="button" onClick={() => { setAuthError(''); setAuthMode(authMode === 'register' ? 'login' : 'register') }}>
                  {authMode === 'register' ? 'Already have an account? Sign in' : 'New to MarketHub? Create an account'}
                </button>
              </form>)}

          {popover === 'cart' && <>
            {!ready ? <div className="popover-empty">Loading your bag…</div> : cartItems.length
              ? <>
                  <div className="popover-books">
                    {cartItems.map((item) => <div className="popover-book cart-popover-book" key={item.bookId}>
                      {item.cover && <Image src={item.cover} width={38} height={48} alt="" />}
                      <span>{item.title}<small>{item.price === null ? 'Price unavailable' : `${money(item.price)} each`}</small>
                        <span className="cart-line-controls">
                          <button type="button" aria-label={`Remove one ${item.title}`} onClick={() => void setCartQuantity(item.bookId, item.quantity - 1)}><Minus size={13} /></button>
                          <span>{item.quantity}</span>
                          <button type="button" aria-label={`Add one ${item.title}`} onClick={() => void setCartQuantity(item.bookId, item.quantity + 1)}><Plus size={13} /></button>
                          <button type="button" aria-label={`Remove ${item.title}`} onClick={() => void setCartQuantity(item.bookId, 0)}><Trash2 size={13} /></button>
                        </span>
                      </span>
                    </div>)}
                  </div>
                  <div className="popover-footnote">Subtotal · {money(cartSubtotal)}</div>
                  <a className="button cart-checkout-link" href="/checkout" onClick={() => setPopover(null)}>Review bag &amp; checkout <ChevronRight size={14} /></a>
                </>
              : <div className="popover-empty"><span className="account-glyph"><ShoppingBag size={18} /></span><p>Your book bag is waiting for a story.</p><button type="button" onClick={() => setPopover(null)}>Continue browsing</button></div>}
          </>}

          {popover === 'wishlist' && <>
            {!ready ? <div className="popover-empty">Loading your saved books…</div> : wishlistItems.length
              ? <>
                  <div className="popover-books">
                    {wishlistItems.map((item) => <div className="popover-book" key={item.id}>
                      {item.cover && <Image src={item.cover} width={38} height={48} alt="" />}
                      <span>{item.title}<small>{item.author}</small></span>
                      <button type="button" aria-label={`Remove ${item.title} from wishlist`} onClick={() => void toggleWishlist(item.id, item.title)}><Trash2 size={14} /></button>
                    </div>)}
                  </div>
                  <div className="popover-footnote">{wishlistItems.length} saved title{wishlistItems.length === 1 ? '' : 's'}</div>
                </>
              : <div className="popover-empty"><span className="account-glyph"><Heart size={18} /></span><p>Save the stories you want to return to.</p><button type="button" onClick={() => setPopover(null)}>Continue browsing</button></div>}
          </>}
        </div>}
      </div>
    </header>
    {mobileOpen && <div className="mobile-nav-scrim" onClick={() => setMobileOpen(false)}><nav className="mobile-nav" aria-label="Mobile navigation" onClick={(event) => event.stopPropagation()}><Logo />{links.map((link) => <a href={link.href} onClick={() => setMobileOpen(false)} key={link.label}>{link.label}<ChevronRight size={15} /></a>)}</nav></div>}
  </>
}
