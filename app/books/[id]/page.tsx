import { notFound } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { BookDetail } from '@/components/book-detail'
import { getProduct } from '@/services/products'

export const dynamic = 'force-dynamic'

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getProduct(id)
  if (!book) notFound()
  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container"><BookDetail book={book} /></div>
    </main>
    <Footer />
  </div>
}
