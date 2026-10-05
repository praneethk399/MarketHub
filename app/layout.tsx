import type { Metadata } from 'next'
import { StorefrontProvider, Toast } from '@/components/storefront'
import './globals.css'

export const metadata: Metadata = {
  title: 'Books for the curious | MarketHub',
  description: 'Discover new worlds, timeless classics, and ideas that inspire. A considered bookstore marketplace for readers.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StorefrontProvider>{children}<Toast /></StorefrontProvider></body></html>
}
