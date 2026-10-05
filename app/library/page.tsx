import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { LibraryShell } from '@/components/library/library-shell'
import { readSession } from '@/services/auth'
import { getLibraryShelves } from '@/services/library.service'
import { listProducts } from '@/services/products'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My library | MarketHub',
  description: 'Your shelves, reading progress and the books waiting for you.',
}

/** My library — the reference-style reading room, scoped so the storefront is untouched. */
export default async function LibraryPage() {
  const [session, catalogue] = await Promise.all([readSession(), listProducts()])
  const library = session
    ? await getLibraryShelves(session.id)
    : { shelves: [
        { key: 'currently-reading' as const, title: 'Currently reading', books: [] },
        { key: 'next-up' as const, title: 'Next up', books: [] },
        { key: 'finished' as const, title: 'Finished', books: [] },
      ], continueReading: null, totals: { tracked: 0, owned: 0, finished: 0 } }

  return <div className="site-shell">
    <Navbar />
    <main>
      <div className="page-container">
        <LibraryShell
          user={session ? { id: session.id, name: session.name } : null}
          library={library}
          catalogue={catalogue}
        />
      </div>
    </main>
    <Footer />
  </div>
}
