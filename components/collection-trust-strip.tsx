import { BadgeCheck, BookMarked, Library, Users } from 'lucide-react'

/**
 * A quiet value strip between the featured shelf and the catalogue.
 *
 * Every line describes a capability that actually exists in this application —
 * verified-purchase reviews, ISBN-scoped seller comparison, the reading library
 * and social shelves, and independent sellers. There are deliberately no counts,
 * ratings, delivery promises or discounts here: those would be numbers the
 * marketplace has not measured.
 */
const values = [
  { icon: BadgeCheck, title: 'Verified-purchase reviews', detail: 'Only readers who bought a title can review it.' },
  { icon: Users, title: 'Compare sellers by ISBN', detail: 'Every offer for the same edition, side by side.' },
  { icon: Library, title: 'Your reading library', detail: 'Track progress and keep private notes on any book.' },
  { icon: BookMarked, title: 'Independent booksellers', detail: 'A considered marketplace, not a single warehouse.' },
]

export function CollectionTrustStrip() {
  return <section className="value-strip" aria-label="What MarketHub provides">
    <ul>
      {values.map(({ icon: Icon, title, detail }) => <li key={title}>
        <Icon size={17} aria-hidden="true" />
        <span><strong>{title}</strong><small>{detail}</small></span>
      </li>)}
    </ul>
  </section>
}
