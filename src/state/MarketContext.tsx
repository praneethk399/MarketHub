import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { books } from '../data/books'

type Toast = { id: number; message: string; tone?: 'success' | 'info' }
type MarketContextValue = {
  cart: Record<string, number>
  wishlist: string[]
  toasts: Toast[]
  isDemoUser: boolean
  cartCount: number
  cartItems: typeof books
  toggleWishlist: (id: string) => void
  addToCart: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  showToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  setDemoUser: (value: boolean) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({ immortals: 1, 'midnight-library': 1 })
  const [wishlist, setWishlist] = useState<string[]>(['hobbit', 'palace-of-illusions'])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isDemoUser, setDemoUser] = useState(false)

  const showToast = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500)
  }
  const toggleWishlist = (id: string) => {
    setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    showToast(wishlist.includes(id) ? 'Removed from your wishlist' : 'Saved to your wishlist')
  }
  const addToCart = (id: string) => {
    setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }))
    showToast('Added to cart')
  }
  const updateQuantity = (id: string, quantity: number) => setCart((current) => quantity > 0 ? ({ ...current, [id]: quantity }) : Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
  const removeFromCart = (id: string) => {
    setCart((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
    showToast('Removed from cart', 'info')
  }
  const clearCart = () => setCart({})

  const cartItems = useMemo(() => books.filter((book) => cart[book.id]), [cart])
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const value = useMemo(() => ({ cart, wishlist, toasts, isDemoUser, cartCount, cartItems, toggleWishlist, addToCart, updateQuantity, removeFromCart, clearCart, showToast, dismissToast: (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), setDemoUser }), [cart, wishlist, toasts, isDemoUser, cartCount, cartItems])
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const context = useContext(MarketContext)
  if (!context) throw new Error('useMarket must be used within MarketProvider')
  return context
}
