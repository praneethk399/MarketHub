'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type StorefrontContextValue = {
  cart: Record<string, number>
  cartCount: number
  wishlist: string[]
  toast: string
  addToCart: (id: string, title: string) => void
  toggleWishlist: (id: string, title: string) => void
  dismissToast: () => void
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null)

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({ 'secret-garden': 1, hobbit: 1 })
  const [wishlist, setWishlist] = useState<string[]>(['song-achilles', 'immortals'])
  const [toast, setToast] = useState('')

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const value = useMemo(() => ({
    cart,
    cartCount: Object.values(cart).reduce((total, quantity) => total + quantity, 0),
    wishlist,
    toast,
    addToCart: (id: string, title: string) => {
      setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }))
      showToast(`${title} added to your bag`)
    },
    toggleWishlist: (id: string, title: string) => {
      setWishlist((current) => {
        const saved = current.includes(id)
        showToast(saved ? `${title} removed from saved books` : `${title} saved to your wishlist`)
        return saved ? current.filter((item) => item !== id) : [...current, id]
      })
    },
    dismissToast: () => setToast('')
  }), [cart, wishlist, toast])

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
