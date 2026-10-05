import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { Catalog } from '@/components/catalog'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container"><Hero /></div>
      <Catalog />
    </main>
    <Footer />
  </div>
}
