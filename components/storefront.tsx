'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { books } from '@/data/books'

export type StorefrontUser = {
  id: string
  name: string
  email: string
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN'
}

export type CartLine = {
  bookId: string
  title: string
  author: string
  cover: string
  price: number | null
  quantity: number
  lineTotal: number | null
}

export type SavedBook = { id: string; title: string; author: string; cover: string }

type CartPayload = { items: CartLine[]; subtotal: number }
type ApiEnvelope<T> = { data?: T; error?: string | { message?: string }; user?: StorefrontUser | null }

type StorefrontContextValue = {
  user: StorefrontUser | null
  ready: boolean
  cart: Record<string, number>
  cartItems: CartLine[]
  cartCount: number
  cartSubtotal: number
  wishlist: string[]
  wishlistItems: SavedBook[]
  toast: string
  addToCart: (id: string, title: string) => Promise<void>
  setCartQuantity: (id: string, quantity: number) => Promise<void>
  toggleWishlist: (id: string, title: string) => Promise<void>
  authenticate: (action: 'login' | 'register', values: { name?: string; email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  placeOrder: () => Promise<{ id: string; orderNumber?: string }>
  dismissToast: () => void
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null)
const guestCartKey = 'markethub-guest-cart'
const guestWishlistKey = 'markethub-guest-wishlist'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
    throw new Error(message ?? `Request failed (${response.status}).`)
  }
  return (payload.data ?? payload) as T
}

function normalizeCart(payload: CartPayload): CartLine[] {
  return payload.items.map((item) => ({
    ...item,
    author: item.author ?? '',
    cover: item.cover ?? '',
  }))
}

function normalizeSaved(items: Array<{
  id: string
  title: string
  author?: string
  images?: { url: string }[]
}>): SavedBook[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author ?? '',
    cover: item.images?.[0]?.url ?? books.find((book) => book.id === item.id)?.cover ?? '',
  }))
}

function readGuestCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(guestCartKey)
    const stored = raw ? JSON.parse(raw) as Record<string, number> : {}
    return Object.entries(stored).flatMap(([id, quantity]) => {
      const book = books.find((entry) => entry.id === id)
      if (!book || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return []
      return [{
        bookId: id, title: book.title, author: book.author, cover: book.cover,
        price: book.price, quantity, lineTotal: book.price === null ? null : book.price * quantity,
      }]
    })
  } catch {
    localStorage.removeItem(guestCartKey)
    return []
  }
}

function readGuestWishlist(): string[] {
  try {
    const raw = localStorage.getItem(guestWishlistKey)
    const stored = raw ? JSON.parse(raw) as unknown : []
    if (!Array.isArray(stored)) throw new Error('Invalid saved shelf.')
    return stored.filter((id): id is string => typeof id === 'string' && books.some((book) => book.id === id))
  } catch {
    localStorage.removeItem(guestWishlistKey)
    return []
  }
}

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StorefrontUser | null>(null)
  const [ready, setReady] = useState(false)
  const [cartItems, setCartItems] = useState<CartLine[]>([])
  const [wishlistItems, setWishlistItems] = useState<SavedBook[]>([])
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4000)
  }, [])

  const refreshCommerce = useCallback(async () => {
    const [cartPayload, savedPayload] = await Promise.all([
      api<CartPayload>('/api/cart'),
      api<Array<{ id: string; title: string; author?: string; images?: { url: string }[] }>>('/api/wishlist'),
    ])
    setCartItems(normalizeCart(cartPayload))
    setWishlistItems(normalizeSaved(savedPayload))
  }, [])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        const session = await api<{ user: StorefrontUser | null }>('/api/auth')
        if (!active) return
        if (session.user) {
          setUser(session.user)
          const [cartPayload, savedPayload] = await Promise.all([
            api<CartPayload>('/api/cart'),
            api<Array<{ id: string; title: string; author?: string; images?: { url: string }[] }>>('/api/wishlist'),
          ])
          if (!active) return
          setCartItems(normalizeCart(cartPayload))
          setWishlistItems(normalizeSaved(savedPayload))
        } else {
          setCartItems(readGuestCart())
          setWishlistItems(readGuestWishlist().map((id) => {
            const book = books.find((entry) => entry.id === id)!
            return { id, title: book.title, author: book.author, cover: book.cover }
          }))
        }
      } catch (cause) {
        if (active) showToast(cause instanceof Error ? cause.message : 'Could not load your account data.')
      } finally {
        if (active) setReady(true)
      }
    }
    void initialize()
    return () => { active = false }
  }, [showToast])

  useEffect(() => {
    if (!ready || user) return
    const quantities = Object.fromEntries(cartItems.map((item) => [item.bookId, item.quantity]))
    localStorage.setItem(guestCartKey, JSON.stringify(quantities))
    localStorage.setItem(guestWishlistKey, JSON.stringify(wishlistItems.map((item) => item.id)))
  }, [cartItems, ready, user, wishlistItems])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const addToCart = useCallback(async (id: string, title: string) => {
    try {
      if (user) {
        const cartPayload = await api<CartPayload>('/api/cart', {
          method: 'POST', body: JSON.stringify({ bookId: id, quantity: 1 }),
        })
        setCartItems(normalizeCart(cartPayload))
      } else {
        const book = books.find((entry) => entry.id === id)
        if (!book) throw new Error('This book is not available in the local catalogue.')
        setCartItems((current) => {
          const existing = current.find((item) => item.bookId === id)
          if (existing && existing.quantity >= 100) {
            showToast('The maximum quantity for this book is 100.')
            return current
          }
          if (book.stock !== null && book.stock !== undefined && (existing?.quantity ?? 0) >= book.stock) {
            showToast('There is not enough stock for this book.')
            return current
          }
          return existing
            ? current.map((item) => item.bookId === id ? { ...item, quantity: item.quantity + 1, lineTotal: book.price === null ? null : book.price * (item.quantity + 1) } : item)
            : [...current, { bookId: id, title, author: book.author, cover: book.cover, price: book.price, quantity: 1, lineTotal: book.price }]
        })
      }
      showToast(`${title} added to your bag`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not add the book to your bag.')
    }
  }, [showToast, user])

  const setCartQuantity = useCallback(async (id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
      showToast('Quantity must be a whole number between 0 and 100.')
      return
    }
    const existing = cartItems.find((item) => item.bookId === id)
    if (!existing) return
    try {
      if (user) {
        const cartPayload = quantity === 0
          ? await api<CartPayload>(`/api/cart/${encodeURIComponent(id)}`, { method: 'DELETE' })
          : await api<CartPayload>(`/api/cart/${encodeURIComponent(id)}`, {
              method: 'PATCH', body: JSON.stringify({ quantity }),
            })
        setCartItems(normalizeCart(cartPayload))
      } else if (quantity === 0) {
        setCartItems((current) => current.filter((item) => item.bookId !== id))
      } else {
        const book = books.find((entry) => entry.id === id)
        if (book?.stock !== null && book?.stock !== undefined && quantity > book.stock) {
          throw new Error('Requested quantity exceeds available stock.')
        }
        setCartItems((current) => current.map((item) => item.bookId === id
          ? { ...item, quantity, lineTotal: item.price === null ? null : item.price * quantity }
          : item))
      }
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not update your bag.')
    }
  }, [cartItems, showToast, user])

  const toggleWishlist = useCallback(async (id: string, title: string) => {
    const saved = wishlistItems.some((item) => item.id === id)
    try {
      if (user) {
        const path = `/api/wishlist/${encodeURIComponent(id)}`
        await api(path, { method: saved ? 'DELETE' : 'POST' })
        const savedPayload = await api<Array<{ id: string; title: string; author?: string; images?: { url: string }[] }>>('/api/wishlist')
        setWishlistItems(normalizeSaved(savedPayload))
      } else {
        const book = books.find((entry) => entry.id === id)
        if (!book) throw new Error('This book is not available in the local catalogue.')
        setWishlistItems((current) => saved
          ? current.filter((item) => item.id !== id)
          : [...current, { id, title, author: book.author, cover: book.cover }])
      }
      showToast(saved ? `${title} removed from saved books` : `${title} saved to your wishlist`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not update your wishlist.')
    }
  }, [showToast, user, wishlistItems])

  const authenticate = useCallback(async (action: 'login' | 'register', values: { name?: string; email: string; password: string }) => {
    const guestCart = user ? [] : cartItems
    const guestWishlist = user ? [] : wishlistItems
    const session = await api<{ user: StorefrontUser }>('/api/auth', {
      method: 'POST', body: JSON.stringify({ action, ...values }),
    })
    setUser(session.user)

    const failedImports: string[] = []
    for (const item of guestCart) {
      try {
        await api('/api/cart', {
          method: 'POST', body: JSON.stringify({ bookId: item.bookId, quantity: item.quantity }),
        })
      } catch {
        failedImports.push(item.title)
      }
    }
    for (const item of guestWishlist) {
      try {
        await api(`/api/wishlist/${encodeURIComponent(item.id)}`, { method: 'POST' })
      } catch {
        failedImports.push(item.title)
      }
    }
    await refreshCommerce()
    localStorage.removeItem(guestCartKey)
    localStorage.removeItem(guestWishlistKey)
    showToast(failedImports.length
      ? `Signed in, but could not sync: ${failedImports.join(', ')}. You can add them again.`
      : action === 'register' ? 'Your account is ready.' : `Welcome back, ${session.user.name}.`)
  }, [cartItems, refreshCommerce, showToast, user, wishlistItems])

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth', { method: 'DELETE' })
      setUser(null)
      setCartItems([])
      setWishlistItems([])
      localStorage.removeItem(guestCartKey)
      localStorage.removeItem(guestWishlistKey)
      showToast('You have signed out.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not sign out.')
    }
  }, [showToast])

  const placeOrder = useCallback(async () => {
    if (!user) throw new Error('Sign in to complete checkout.')
    const result = await api<{ id: string; orderNumber?: string }>('/api/checkout', { method: 'POST' })
    await refreshCommerce()
    showToast('Your order has been placed.')
    return result
  }, [refreshCommerce, showToast, user])

  const cart = useMemo(() => Object.fromEntries(cartItems.map((item) => [item.bookId, item.quantity])), [cartItems])
  const cartCount = useMemo(() => cartItems.reduce((total, item) => total + item.quantity, 0), [cartItems])
  const cartSubtotal = useMemo(() => cartItems.reduce((total, item) => total + (item.lineTotal ?? 0), 0), [cartItems])
  const wishlist = useMemo(() => wishlistItems.map((item) => item.id), [wishlistItems])
  const value = useMemo(() => ({
    user, ready, cart, cartItems, cartCount, cartSubtotal, wishlist, wishlistItems, toast,
    addToCart, setCartQuantity, toggleWishlist, authenticate, signOut, placeOrder,
    dismissToast: () => setToast(''),
  }), [user, ready, cart, cartItems, cartCount, cartSubtotal, wishlist, wishlistItems, toast,
    addToCart, setCartQuantity, toggleWishlist, authenticate, signOut, placeOrder])

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>
}

export function useStorefront() {
  const context = useContext(StorefrontContext)
  if (!context) throw new Error('useStorefront must be used within StorefrontProvider')
  return context
}

export function Toast() {
  const { toast, dismissToast } = useStorefront()
  if (!toast) return null
  return <div className="toast" role="status" aria-live="polite"><span className="toast-check">✓</span>{toast}<button type="button" aria-label="Dismiss notification" onClick={dismissToast}>×</button></div>
}
