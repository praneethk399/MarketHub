import type { Metadata } from 'next'
import { StorefrontProvider, Toast } from '@/components/storefront'
import './globals.css'
import './mh-vite.css'

export const metadata: Metadata = {
  title: 'Discover your next chapter | MarketHub',
  description: 'Explore books from trusted vendors, publishers and booksellers — a trusted multi-vendor bookstore for your next chapter.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StorefrontProvider>{children}<Toast /></StorefrontProvider></body></html>
}
