import { ArrowUpRight } from 'lucide-react'
import { Logo } from './ui'

export function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand"><a href="#top" aria-label="MarketHub home"><Logo /></a><p>A considered marketplace for the books you love, the stories you haven’t found yet, and the independent booksellers who bring them together.</p><span className="footer-motto">For the love of the written word.</span></div>
      <div className="footer-column"><h2>Discover</h2><a href="#books">The bookshelves</a><a href="#categories">Browse by category</a><a href="#bestsellers">Bestsellers</a></div>
      <div className="footer-column"><h2>Our marketplace</h2><a href="#vendors">Meet our sellers</a><a href="#authors">Authors & stories</a></div>
      <div className="footer-note"><span>EST. MMXIX</span><p>“A room without books is like a body without a soul.”</p><ArrowUpRight size={17} /></div>
    </div>
    <div className="footer-bottom"><span>© 2026 MarketHub. Made for readers, everywhere.</span><span>THE ART OF FINDING YOUR NEXT CHAPTER.</span></div>
  </footer>
}
