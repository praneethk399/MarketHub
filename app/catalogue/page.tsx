import { ViteShell } from '@/components/vite-shell'
import { CatalogueBrowser } from '@/components/vite-catalogue'
import {
  browseCatalogue,
  catalogueSize,
  DEFAULT_PAGE_SIZE,
  type CatalogueSort,
} from '@/services/catalogue'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'The full catalogue | MarketHub',
  description: 'Search thousands of titles by name, author, ISBN or category, and open any book to see who sells it.',
}

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string }>

const SORTS: { value: CatalogueSort; label: string }[] = [
  { value: 'catalogue', label: 'Catalogue order' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'author', label: 'Author A–Z' },
  { value: 'newest', label: 'Newest first' },
]

function boundedPage(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : 1
}

/**
 * The full catalogue, now in the editorial skin. The URL contract is unchanged —
 * q, category, sort, page — because every existing link, test and bookmark
 * points at these exact paths.
 */
export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = (params.q ?? '').slice(0, 120)
  const category = (params.category ?? '').slice(0, 60)
  const sortParam = params.sort
  const sort: CatalogueSort = SORTS.some((entry) => entry.value === sortParam)
    ? sortParam as CatalogueSort
    : 'catalogue'

  const page = browseCatalogue({ query, category, sort, page: boundedPage(params.page), pageSize: DEFAULT_PAGE_SIZE })
  const totals = catalogueSize()
  const current = { q: query, category, sort: sort === 'catalogue' ? '' : sort }

  return (
    <ViteShell>
      <CatalogueBrowser
        page={page}
        sort={sort}
        sortOptions={SORTS}
        query={query}
        category={category}
        current={current}
        totals={totals}
      />
    </ViteShell>
  )
}
