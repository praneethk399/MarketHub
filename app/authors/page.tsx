import Link from 'next/link'
import { ViteShell } from '@/components/vite-shell'
import { ViteAuthors } from '@/components/vite-authors'
import { books } from '@/data/books'

export const metadata = {
  title: 'Authors | MarketHub',
  description: 'The writers behind the MarketHub catalogue, with a shelf for every voice.',
}

function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }

export default function AuthorsPage() {
  const grouped = new Map<string, { count: number; category: string; latestTitle: string }>()
  for (const book of books) {
    const entry = grouped.get(book.author)
    if (entry) entry.count += 1
    else grouped.set(book.author, { count: 1, category: book.category, latestTitle: book.title })
  }
  const authors = [...grouped.entries()]
    .map(([author, info]) => ({ author: author.trim(), ...info }))
    .sort((a, b) => a.author.localeCompare(b.author))

  return (
    <ViteShell>
      <ViteAuthors authors={authors.map((entry) => ({ ...entry, slug: slugify(entry.author), searchHref: `/search?q=${encodeURIComponent(entry.author)}` }))} />
    </ViteShell>
  )
}
