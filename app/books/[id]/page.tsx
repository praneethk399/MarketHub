import { notFound } from 'next/navigation'
import { ViteShell } from '@/components/vite-shell'
import { ViteBookDetail } from '@/components/vite-book-detail'
import { getProduct } from '@/services/products'

export const dynamic = 'force-dynamic'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getProduct(id)
  if (!book) notFound()
  return (
    <ViteShell>
      <ViteBookDetail book={book} />
    </ViteShell>
  )
}
