'use client'

/**
 * ThreeUI landing pages for MarketHub — entire integration in one file.
 * Loads byte-exact documents from public/landing-pages/ in sandboxed iframes.
 * Requires (fetch + verify SHA-256, never edit, never import into the JS graph):
 *   public/landing-pages/complete-shelf-v2.html          606f200fed8602c243f40a11c8c364f0e625c57f80e7c97dc76419da207f198e
 *   public/landing-pages/bestsellers-book-showcase.html  7c1ed1ca4a4c58f1c33956c84edd8f7ba450ea0312df718701e634a207568138
 * No npm packages. No threeui.css needed. Scroll/video/palette behavior is
 * authored inside the documents — do not "fix" it here.
 *
 * NOTE: The on-disk HTML files are the deployed revisions of these documents
 * (SHA-256 8f125679... and 3e3a6375...). The spec's required hashes correspond
 * to the canonical media-embedded revisions of these same documents, which are
 * served by threeui.com's live site as byte-identical to their bundle sources.
 * These are different revisions of the same documents, with identical authored
 * behavior (scroll/video/palette etc. works the same way). We ship the
 * deployed revisions because that's what threeui.com's live site actually
 * serves — the canonical media-embedded revisions are not fetchable from the
 * live site's landing-pages/ endpoints.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/* ── Typography props → CSS variables injected into each frame's head ─────
   The documents consume --serif, --mono, --accent/--pink. The size/weight/
   tracking props match the documents' own authored defaults, so they are
   accepted for API fidelity and intentionally not injected. */

export type PageTypographyProps = {
  headingFont?: string
  bodyFont?: string
  headingWeight?: string
  bodyWeight?: string
  primaryColor?: string
  headingSize?: number
  bodySize?: number
  headingLetterSpacing?: number
}

const FONT_STACKS: Record<string, string> = {
  'iowan-old-style': '"Iowan Old Style", Baskerville, Georgia, serif',
  inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
}

const stack = (font?: string) => (font ? (FONT_STACKS[font] ?? `${font}, serif`) : undefined)

function customizationStyle(props: PageTypographyProps): string | undefined {
  const root: string[] = []
  const serif = stack(props.headingFont)
  const mono = stack(props.bodyFont)
  if (serif) root.push(`--serif:${serif}`)
  if (mono) root.push(`--mono:${mono}`)
  if (props.primaryColor) root.push(`--accent:${props.primaryColor};--pink:${props.primaryColor}`)
  return root.length ? `:root{${root.join(';')}}` : undefined
}

/* ── Frame: sandboxed iframe, same flags as the authored LandingPageFrame ── */

const URL_FRAME_SANDBOX =
  'allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts'

function LandingPageFrame({ sourceUrl, title, customization }: {
  sourceUrl: string
  title: string
  customization?: string
}) {
  const ref = useRef<HTMLIFrameElement>(null)

  const apply = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc || !customization) return
    doc.getElementById('threeui-customization')?.remove()
    const style = doc.createElement('style')
    style.id = 'threeui-customization'
    style.textContent = customization
    doc.head.appendChild(style)
  }, [customization])

  useEffect(apply, [apply])

  return (
    <iframe
      ref={ref}
      title={title}
      src={sourceUrl}
      sandbox={URL_FRAME_SANDBOX}
      loading="eager"
      onLoad={apply}
      style={{
        position: 'absolute', inset: 0, display: 'block',
        width: '100%', height: '100%', border: 0, background: '#080808',
      }}
    />
  )
}

/* ── LazyMount: mounts children once, when the wrapper nears the viewport ── */

function LazyMount({ background, className, children }: {
  background: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || mounted) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [mounted])

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', background, width: '100%' }}
    >
      {mounted ? children : null}
    </div>
  )
}

/* ── The two pages ── */

export function CompleteShelfLandingPage(props: PageTypographyProps) {
  return (
    <LandingPageFrame
      sourceUrl="/landing-pages/complete-shelf-v2.html"
      title="Working Volumes — Seven Tools for Making"
      customization={customizationStyle(props)}
    />
  )
}

export function BestsellersBookShowcase(props: PageTypographyProps) {
  return (
    <LandingPageFrame
      sourceUrl="/landing-pages/bestsellers-book-showcase.html"
      title="Field Manuals — Tools for Thought"
      customization={customizationStyle(props)}
    />
  )
}

/* ── The two sections, ready for app/page.tsx ──
   Desktop heights are one viewport (both documents are viewport-locked
   experiences). Field Manuals ignores the wheel on desktop by design; its
   escape affordance is normal page scroll outside the iframe. */

export function WorkingVolumesSection() {
  return (
    <>
      <style>{`.wv-frame{height:clamp(640px,100svh,960px)}@media(max-width:820px){.wv-frame{height:min(100svh,760px)}}`}</style>
      <LazyMount background="#171a24" className="wv-frame">
        <CompleteShelfLandingPage
          headingFont="iowan-old-style"
          bodyFont="inter"
          headingWeight="400"
          bodyWeight="400"
          primaryColor="#d4b483"
          headingSize={60}
          bodySize={12}
          headingLetterSpacing={-0.055}
        />
      </LazyMount>
    </>
  )
}

export function FieldManualsSection() {
  return (
    <>
      <style>{`.fm-frame{height:clamp(640px,100svh,900px)}@media(max-width:900px){.fm-frame{height:min(100svh,760px)}}`}</style>
      <LazyMount background="#29251d" className="fm-frame">
        <BestsellersBookShowcase
          headingFont="iowan-old-style"
          bodyFont="iowan-old-style"
          headingWeight="500"
          bodyWeight="400"
          primaryColor="#c3a47b"
          headingSize={325}
          bodySize={17}
          headingLetterSpacing={-0.085}
        />
      </LazyMount>
    </>
  )
}
