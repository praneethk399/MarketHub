'use client'

import Link from 'next/link'
import { ArrowUpRight, ShieldCheck, Store } from 'lucide-react'
import { Chapter, VitePageHero } from './vite-shell'

type VendorCard = {
  id: string
  name: string
  city: string | null
  verified: boolean
  booksSold: number | null
}

export function ViteVendors({ vendors }: { vendors: VendorCard[] }) {
  return (
    <>
      <VitePageHero label="MarketHub / Vendors" title="Meet the booksellers.">
        <p>Many vendors, one trusted reading room. Explore the independent stores behind the catalogue.</p>
      </VitePageHero>
      <section className="container section" style={{ paddingTop: 20 }}>
        {vendors.length ? (
          <div className="vendor-grid">
            {vendors.map((vendor, index) => (
              <Link className="vendor-card" href={`/vendors/${vendor.id}`} key={vendor.id}>
                <div>
                  <span className="eyebrow">Store {String(index + 1).padStart(2, '0')}</span>
                  <h3>{vendor.name}</h3>
                  <p className="vendor-card-meta">
                    {vendor.city ?? 'Independent'} ·{' '}
                    {vendor.verified
                      ? <>verified seller <ShieldCheck size={12} color="var(--gold)" aria-hidden="true" /></>
                      : 'independently listed'}
                    {vendor.booksSold !== null ? <> · {vendor.booksSold.toLocaleString('en-IN')} sold</> : null}
                  </p>
                </div>
                <div className="vendor-card-footer">
                  <span><Store size={13} aria-hidden="true" /> Visit the store</span>
                  <ArrowUpRight size={14} color="var(--gold)" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No sellers onboarded yet.</h2>
            <p>The vendor roster fills as independent booksellers join the marketplace.</p>
          </div>
        )}
      </section>
    </>
  )
}
