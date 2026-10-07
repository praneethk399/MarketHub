import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { WorkingVolumesSection, FieldManualsSection } from '@/components/landing-pages/threeui-pages'
import { Catalog } from '@/components/catalog'
import { Footer } from '@/components/footer'

export default function HomePage() {
  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container"><Hero /></div>
      <WorkingVolumesSection />
      <FieldManualsSection />
      <Catalog />
    </main>
    <Footer />
  </div>
}
