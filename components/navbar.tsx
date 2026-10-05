'use client'

import { Heart, Search, ShoppingBag, UserRound, Menu, X, ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { books } from '@/data/books'
import { Logo } from './ui'
import { useStorefront } from './storefront'

const links = [
  { label: 'Books', href: '#books', active: true },
  { label: 'Categories', href: '#categories' },
  { label: 'Bestsellers', href: '#bestsellers' },
  { label: 'Authors', href: '#authors' },
  { label: 'Vendors', href: '#vendors' }
]

export function Navbar() {
  const { cart, cartCount, wishlist } = useStorefront()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [popover, setPopover] = useState<'wishlist' | 'cart' | 'account' | null>(null)
  const savedBooks = books.filter((book) => wishlist.includes(book.id))
  const cartBooks = books.filter((book) => cart[book.id])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('markethub:search', { detail: query.trim() }))
    document.querySelector('#books')?.scrollIntoView({ behavior: 'smooth' })
  }

  return <>
    <header className="site-header">
      <div className="navbar">
        <a className="brand-link" href="#top" aria-label="MarketHub home"><Logo /></a>
        <form className="nav-search" role="search" onSubmit={search}>
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search books" placeholder="Search by title, author, ISBN, publisher..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>⌘ K</kbd>
        </form>
        <nav className="desktop-nav" aria-label="Main navigation">{links.map((link) => <a className={link.active ? 'active' : ''} href={link.href} key={link.label}>{link.label}</a>)}</nav>
        <span className="nav-divider" />
        <div className="nav-actions">
          <button className="nav-icon" type="button" aria-label={`Wishlist, ${wishlist.length} saved`} aria-expanded={popover === 'wishlist'} onClick={() => setPopover(popover === 'wishlist' ? null : 'wishlist')}><Heart size={19} /><span className="icon-count">{wishlist.length}</span></button>
          <button className="nav-icon" type="button" aria-label={`Shopping bag, ${cartCount} items`} aria-expanded={popover === 'cart'} onClick={() => setPopover(popover === 'cart' ? null : 'cart')}><ShoppingBag size={19} /><span className="cart-count" key={cartCount}>{cartCount}</span></button>
          <button className="nav-icon profile-action" type="button" aria-label="Account" aria-expanded={popover === 'account'} onClick={() => setPopover(popover === 'account' ? null : 'account')}><UserRound size={19} /></button>
        </div>
        <button className="mobile-menu-button" type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
        {popover && <div className="nav-popover" role="dialog" aria-label={popover === 'wishlist' ? 'Saved books' : popover === 'cart' ? 'Shopping bag' : 'Reader account'}><div className="popover-heading"><span>{popover === 'wishlist' ? 'Your saved shelf' : popover === 'cart' ? 'Your book bag' : 'Welcome, reader'}</span><button type="button" aria-label="Close panel" onClick={() => setPopover(null)}><X size={15} /></button></div>{popover === 'account' ? <div className="popover-empty"><span className="account-glyph"><UserRound size={19} /></span><p>Your next chapter starts with a good book.</p><button type="button" onClick={() => setPopover(null)}>Continue browsing</button></div> : <>{(popover === 'wishlist' ? savedBooks : cartBooks).length ? <div className="popover-books">{(popover === 'wishlist' ? savedBooks : cartBooks).map((book) => <div className="popover-book" key={book.id}><Image src={book.cover} width={38} height={48} alt="" /><span>{book.title}<small>{popover === 'cart' ? `${cart[book.id]} in your bag` : book.author}</small></span></div>)}</div> : <div className="popover-empty"><span className="account-glyph">{popover === 'wishlist' ? <Heart size={18} /> : <ShoppingBag size={18} />}</span><p>{popover === 'wishlist' ? 'Save the stories you want to return to.' : 'Your book bag is waiting for a story.'}</p><button type="button" onClick={() => setPopover(null)}>Continue browsing</button></div>}<div className="popover-footnote">{popover === 'cart' ? `${cartCount} book${cartCount === 1 ? '' : 's'} gathered` : `${wishlist.length} saved title${wishlist.length === 1 ? '' : 's'}`}</div></>}</div>}
      </div>
    </header>
    {mobileOpen && <div className="mobile-nav-scrim" onClick={() => setMobileOpen(false)}><nav className="mobile-nav" aria-label="Mobile navigation" onClick={(event) => event.stopPropagation()}><Logo />{links.map((link) => <a href={link.href} onClick={() => setMobileOpen(false)} key={link.label}>{link.label}<ChevronRight size={15} /></a>)}</nav></div>}
  </>
}
