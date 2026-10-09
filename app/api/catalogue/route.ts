import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  browseCatalogue,
  catalogueSize,
  type CatalogueSort,
} from '@/services/catalogue'

export const dynamic = 'force-dynamic'

const SORTS: readonly CatalogueSort[] = ['catalogue', 'title', 'author', 'newest']

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (value === null || !Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(min, Math.trunc(parsed)), max)
}

/**
 * A page of the large catalogue. Read-only and public, like `/api/books`.
 *
 * This is deliberately separate from `/api/books`: that endpoint is the curated
 * storefront shelf and is unchanged, while this one is paginated because the
 * catalogues it serves run to ten thousand records and must never be returned in
 * one response. Page size is capped at `MAX_PAGE_SIZE` and every parameter is
 * bounded, so a caller cannot ask for the whole table.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const sortParam = params.get('sort')
    const sort = sortParam && SORTS.includes(sortParam as CatalogueSort) ? sortParam as CatalogueSort : 'catalogue'

    const page = browseCatalogue({
      query: (params.get('q') ?? '').slice(0, 120).trim(),
      category: (params.get('category') ?? '').slice(0, 60).trim(),
      sort,
      page: boundedInteger(params.get('page'), 1, 1, 100_000),
      pageSize: boundedInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    })

    return NextResponse.json({
      success: true,
      data: page.items,
      total: page.total,
      matched: page.matched,
      page: page.page,
      pageSize: page.pageSize,
      pageCount: page.pageCount,
      categories: page.categories,
      sort: page.sort,
      catalogue: catalogueSize(),
    })
  } catch (error) {
    return apiError(error, 'Unable to load the catalogue.')
  }
}
