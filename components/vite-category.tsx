'use client'

import type { Book } from '@/data/books'
import { ViteBookGrid, VitePageHero } from './vite-shell'

export function ViteCategoryPage({ label, title, intro, items }: { label: string; title: string; intro: string; items: Book[] }) {
  return (
    <>
      <VitePageHero label={`MarketHub / Category / ${label}`} title={title}><p>{intro}</p></VitePageHero>
      <section className="container section" style={{ paddingTop: 20 }}>
        <ViteBookGrid items={items} />
      </section>
    </>
  )
}
