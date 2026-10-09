import { ViteShell } from '@/components/vite-shell'
import { BooksShelf } from '@/components/vite-books'
import {
  browseCatalogue,
  DEFAULT_PAGE_SIZE,
  type CatalogueSort,
} from '@/services/catalogue'

export const metadata = {
  title: 'Books | MarketHub',
  description: 'Search the shelves by title, author, ISBN or category — every title that booksellers list, in one place.',
}

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string }>

const SORTS: { value: CatalogueSort; label: string }[] = [
  { value: 'catalogue', label: 'Standard shelf order' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'author', label: 'Author A–Z' },
]

function boundedPage(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : 1
}

/**
 * The practical shelf. Reads the URL like /catalogue does — search, category,
 * sort and page all live in searchParams, so deep links, back/forward and
 * sharing all behave, and the initial HTML already carries the grid.
 */
export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = (params.q ?? '').slice(0, 120)
  const category = (params.category ?? '').slice(0, 60)
  const sortParam = params.sort
  const sort: CatalogueSort = SORTS.some((entry) => entry.value === sortParam)
    ? sortParam as CatalogueSort
    : 'catalogue'
  const page = browseCatalogue({ query, category, sort, page: boundedPage(params.page), pageSize: DEFAULT_PAGE_SIZE })
  const current = { q: query, category, sort: sort === 'catalogue' ? '' : sort }

  return (
    <ViteShell>
      <BooksShelf
        page={page}
        categories={page.categories}
        sort={sort}
        query={query}
        category={category}
        sortOptions={SORTS}
        current={current}
      />
    </ViteShell>
  )
}
