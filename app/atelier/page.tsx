import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { AshenPressSection } from '@/components/ashen-press-section'

export const metadata = {
  title: 'The Ashen Press | MarketHub',
  description: 'Ten clothbound volumes on a reflective oak shelf — an interactive Three.js art-book press.',
}

/** The Ashen Press — the ThreeUI shelf scene, kept off the home page so the storefront order stays as authored. */
export default function AtelierPage() {
  return <div className="site-shell">
    <Navbar />
    <main>
      <AshenPressSection />
    </main>
    <Footer />
  </div>
}
