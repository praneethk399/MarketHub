import { ViteShell } from '@/components/vite-shell'
import { ViteCategoryPage } from '@/components/vite-category'
import { browseCatalogue } from '@/services/catalogue'

export const dynamic = 'force-dynamic'

type Params = Promise<{ category: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { category } = await params
  return { title: `${decodeURIComponent(category.replace(/-/g, ' '))} | MarketHub` }
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { category } = await params
  const decoded = decodeURIComponent(category.replace(/-/g, ' '))
  // The slug is a courtesy; the actual match is by real category name, and
  // unknown slugs resolve to an empty result state rather than a redirect.
  const match = browseCatalogue({ category: decoded, pageSize: 48 })
  const exact = match.matched > 0
  const page = exact ? match : browseCatalogue({ pageSize: 12 })

  return (
    <ViteShell>
      <ViteCategoryPage
        label={exact ? decoded : 'MarketHub'}
        title={exact ? decoded : 'That shelf is being built.'}
        intro={exact
          ? `${match.matched.toLocaleString('en-IN')} titles gathered for this shelf.`
          : 'We could not find that exact category — here is a place to start instead.'}
        items={page.items}
      />
    </ViteShell>
  )
}
