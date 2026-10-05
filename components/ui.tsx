import { Star } from 'lucide-react'
import type { ReactNode } from 'react'

export function Logo() {
  return <span className="logo-lockup"><span className="logo-mark" aria-hidden="true"><span /></span><span>MARKETHUB</span></span>
}

export function Rating({ value, reviews }: { value?: number; reviews?: number }) {
  if (value === undefined) return <span className="rating-empty">Not yet rated</span>
  return <span className="rating"><Star size={13} fill="currentColor" strokeWidth={1.5} /><strong>{value.toFixed(1)}</strong><span>({(reviews || 0).toLocaleString('en-IN')})</span></span>
}

export function Badge({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'new' | 'muted' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>
}
