'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Chapter, VitePageHero } from './vite-shell'

/** Portraits the publisher has actually supplied as local assets. There is no
    portrait registry for the long tail of the catalogue, and this page does not
    invent one — every other card is a typographic monogram instead. */
const PORTRAITS: Record<string, string> = {
  'Amish Tripathi': '/images/amish-tripathi-portrait.jpg',
  'Chetan Bhagat': '/images/authors/chetan-bhagat.jpg',
  'Ruskin Bond': '/images/authors/ruskin-bond.jpg',
  'Ravinder Singh': '/images/authors/ravinder-singh.jpg',
  'Durjoy Datta': '/images/authors/durjoy-datta.jpg',
  'Devdutt Pattanaik': '/images/authors/devdutt-pattanaik.png',
  'Ashwin Sanghi': '/images/authors/ashwin-sanghi.jpg',
}

export function ViteAuthors({ authors }: {
  authors: { author: string; slug: string; count: number; category: string; latestTitle: string; searchHref: string }[]
}) {
  return (
    <>
      <VitePageHero label="MarketHub / Authors" title="Follow the voices behind the books.">
        <p>A considered index of the writers shaping this catalogue, with a shelf for every voice.</p>
      </VitePageHero>
      <section className="container section" style={{ paddingTop: 20 }}>
        <div className="author-grid">
          {authors.map((entry) => {
            const portrait = PORTRAITS[entry.author]
            const initials = entry.author.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')
            return (
              <Link
                className="author-card"
                key={entry.author}
                href={entry.searchHref}
                style={portrait
                  ? { backgroundImage: `linear-gradient(145deg, rgba(11,11,12,.18), rgba(11,11,12,.96)), url(${portrait})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined}
              >
                {!portrait && <span className="author-mono" aria-hidden="true">{initials}</span>}
                <div>
                  <span className="eyebrow">{entry.category}</span>
                  <h3>{entry.author}</h3>
                  <p>{entry.count} book{entry.count !== 1 ? 's' : ''} in the catalogue</p>
                </div>
                <div className="author-card-footer">
                  <span>{entry.latestTitle}</span>
                  <ArrowUpRight size={14} color="var(--gold)" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}
