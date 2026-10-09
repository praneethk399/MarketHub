# Featured showcase — implementation note

**Date:** 2026-10-09
**Plan and reconnaissance:** [`docs/featured-showcase-phase-0.md`](./featured-showcase-phase-0.md)
**Scope:** the animated book-showcase experience, rebuilt natively and wired to the live catalogue.

## What shipped

The two sandboxed iframes of third-party ThreeUI landing documents are gone. The animated shelf is now a
React component rendering the same live `Book[]` the catalogue below renders, and the home page is:

```
Navbar → Featured this week (live books) → value strip → Catalogue (search/filter/sort) → Footer
```

| File | Change |
|---|---|
| `components/featured-selection.ts` | **new** — the pure selection, indexing and announcement rules. |
| `components/catalogue-store.ts` | **new** — one shared `/api/books` request with a stale-response guard. |
| `components/use-live-catalogue.ts` | **new** — `useSyncExternalStore` binding; seeded snapshot server-side. |
| `components/featured-book-showcase.tsx` | **new** — the shelf, caption panel, controls and states. |
| `components/featured-collection.tsx` | **new** — the client wrapper that supplies the live catalogue. |
| `components/collection-trust-strip.tsx` | **new** — four statements about capabilities that exist. |
| `components/catalog.tsx` | consumes the shared hook; filters, sort, search, counts and the fallback notice are unchanged. |
| `app/page.tsx` | recomposed around the shelf; the shelf owns `#bestsellers`. |
| `components/footer.tsx` | the four dead in-page anchors now resolve to `#bestsellers`, `#books` and real routes. |
| `app/globals.css` | showcase and value-strip styles, one ink-blue token pair, reduced-motion rules; orphaned ThreeUI frame CSS removed. |
| `next.config.ts` | the `/landing-pages/:path*` header rule is gone; the framed-document policy is now scoped to `/shaders` only. |
| `components/landing-pages/*`, `public/landing-pages/*` | **deleted** (two components, 1775 lines of CSS, 244 KB of vendored HTML). |
| `tests/featured-showcase.test.ts` | **new** — 15 tests over the selection rules and the shared store. |

## The rule used to select featured books

`Book` has no `featured`/`bestseller`/`rank`/`addedAt` field and nothing was invented, so the shelf is a
deterministic sample of the real catalogue (`components/featured-selection.ts`):

1. Eligible books are those that can actually be bought — `status === 'in-stock'` and `price !== null`. If
   nothing is purchasable the whole collection is used rather than showing an empty shelf.
2. Eligible books are ranked by `stableHash('featured:' + book.id)`, ties broken by id. The **id** is hashed,
   not the position, so the window is stable per book and uniform across the catalogue: identical on the
   server and the client (no hydration mismatch), identical on every boot and machine, and unchanged when the
   API returns the collection in a different order or with titles inserted.
3. A fixed window of 7 is taken, matching the `04 / 07` index in the caption panel.

The shelf reflects the **full live collection, not the filter state** — the catalogue below owns filtering, and
making the shelf track it would imply the featured set is the search result while the controls are off screen.
`Browse all books` scrolls to `#catalog`.

## Behaviour and states

- **Zero / one / many** books are all handled; zero shows a named empty state with a link to the catalogue.
- **Position is preserved** across a catalogue refresh because the active book is tracked by **id**, not index.
  It falls back to the middle of the shelf only when the chosen book is genuinely gone, so the opening
  composition has covers on both sides instead of one pinned to the left edge.
- **Images**: `next/image` inside a fixed `2 / 3` aspect-ratio frame, so the shelf never shifts while covers
  load; an `onError` fallback paints the title and category in place of the cover.
- **Controls**: previous/next are real `<button>`s, **disabled at the ends** (no silent looping), 44 px square;
  the progress marks are 34 × 44 targets around a hairline. Wheel/swipe is deliberately *not* hijacked so a
  phone reader keeps normal page scrolling, and the pointer parallax is mouse-only.
- **Reduced motion**: the global rule plus `.featured-shelf { transform: none }` and transition removal; the
  parallax effect returns early when `prefers-reduced-motion: reduce` matches.
- **Accessibility**: `<section aria-labelledby>` region, real heading, `alt` text per cover, `aria-label`ed
  icon buttons, `aria-pressed` on wishlist, `aria-current` on the progress mark, `:focus-visible` rings, and one
  polite live region announcing `04 / 07 — Title by Author.` per change. Arrow keys act only once focus is
  already inside the region, and focus is never trapped.
- **Commerce**: `Add to cart` is disabled unless in stock with a price, and both it and the wishlist go through
  `useStorefront()` — the only server-enforced path. No price, stock or total is computed on the client.

## Verification performed

| Check | Result |
|---|---|
| `corepack pnpm typecheck` | **exit 0**, no diagnostics. |
| `corepack pnpm test` | **exit 0** — 39 pass / 0 fail (24 pre-existing + 15 new). |
| `corepack pnpm build` | **exit 0** — `Compiled successfully in 3.5s`, TypeScript 1.4 s, 12 static pages; **zero** errors and warnings. |
| Live browser, `/` | Shelf renders with real covers (`English, August`, ₹583 / ₹835, ★ 4.7, 9 in stock, 2 sellers), `04 / 07`, 7 progress marks, 4 neighbouring covers. |
| One request | Exactly **one** `GET /api/books` in the browser network log with both the shelf and the grid mounted (also asserted in tests). |
| Prev/next + boundaries | Click and arrow keys move the active book; `01 / 07` disables previous, `07 / 07` disables next; exactly one current mark; `Open book` href matches the active id (`/books/great-gatsby-fitzgerald`, …). |
| Keyboard | `ArrowRight`/`ArrowLeft` handled and `preventDefault`ed only for the horizontal keys; `focusIsInsideShowcase` true; live region reads `06 / 07 — Nesnesitelná lehkost bytí by Milan Kundera.` |
| Add to cart / wishlist | Guest cart and wishlist update correctly (`{"english-august-chatterjee":2}`, `aria-pressed="true"`, navbar wishlist count 1). |
| 320 / 375 / 1280 px | No horizontal overflow (`document.scrollWidth === window.innerWidth`); panel and value strip reflow to one column; side covers clipped by the stage as intended. |
| Page routes | `/`, `/books`, `/social`, `/library`, `/atelier` all **200**; `/books` still renders its book grid. |
| Removed files | `/landing-pages/*.html` now **404**; `/shaders/ashen-press/sources/ashen-press.html` still **200** with the framed-document CSP and `X-Frame-Options: SAMEORIGIN` applied. |
| Console | Clean — no errors or warnings. The two `<Image fill>` height warnings and the iframe sandbox warning from the previous home page are gone with the iframes. |

## Known limitations

1. **No E2E or accessibility tooling exists in the repository**, so the keyboard and responsive checks above
   were performed manually against the running dev server, not by an automated suite. Nothing here replaces an
   axe/Lighthouse pass, which has not been run.
2. **The reduced-motion runtime branch was not exercised.** The rules ship in the stylesheet (verified by
   reading the CSSOM) and the parallax guard is code-reviewed, but this browser exposes no reduced-motion
   emulation to force `matchMedia('(prefers-reduced-motion: reduce)').matches`.
3. **Pre-existing, not introduced here:** no toast ever appears after `Add to cart` or wishlist changes —
   reproduced identically on the unchanged catalogue `BookCard`, while the underlying cart/wishlist state does
   update. The storefront's `Toast` presentation is therefore broken independently of this feature and was left
   alone rather than silently changed.
4. **`/checkout` and `/orders` still 404 in this checkout** (baseline MH-18). Pages for them were reported as
   added elsewhere, but those commits (`2d881da`, `155efeb`) **do not exist in this repository** and the files
   are absent from this working tree, so the cart CTA remains a dead end here.
5. The ink-blue surface is a new pair of local custom properties on the shelf, not a global palette change; the
   rest of the site keeps the warm gold/ivory tokens.
