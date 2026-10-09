import { ViteShell } from '@/components/vite-shell'
import { ViteVendors } from '@/components/vite-vendors'
import { listVendors } from '@/services/vendors'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Vendors | MarketHub',
  description: 'Meet the independent booksellers behind the MarketHub catalogue.',
}

export default async function VendorsPage() {
  const vendors = await listVendors()
  return (
    <ViteShell>
      <ViteVendors vendors={vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.storeName ?? vendor.name,
        city: vendor.city ?? null,
        verified: vendor.verified,
        booksSold: vendor.booksSold ?? null,
      }))} />
    </ViteShell>
  )
}
