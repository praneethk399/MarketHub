import { ViteShell } from '@/components/vite-shell'
import { ViteSearchResults } from '@/components/vite-search'
import { browseCatalogue } from '@/services/catalogue'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Search | MarketHub',
}

type SearchParams = Promise<{ q?: string }>

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = (params.q ?? '').slice(0, 120)
  const page = browseCatalogue({ query, pageSize: 48 })
  return (
    <ViteShell>
      <ViteSearchResults query={query} matched={page.matched} items={page.items} total={page.total} />
    </ViteShell>
  )
}
