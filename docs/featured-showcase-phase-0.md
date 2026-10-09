# Featured showcase integration — Phase 0 reconnaissance

**Date:** 2026-10-09
**Scope:** integrar a book-showcase experience into the live MarketHub collection as a first-class,
data-driven discovery surface.
**Baseline commit:** `2c29b3f` + docs commits `62e8afc`, `16e7cbc` (`main` == `origin/main`).
**Method:** static reading of the files named in the brief plus `app/layout.tsx`, `components/storefront.tsx`,
`components/hero.tsx`, `components/filter-sidebar.tsx`, `components/footer.tsx`, `public/landing-pages/`;
live inspection of the running dev server (previous phase, same tree).

**Phase 0 is a report only.** No source file has been modified. The plan in §5 is proposed, not started.

---

## 1. Architecture summary

### 1.1 Page composition

[`app/page.tsx`](../app/page.tsx) is a **server component** rendering, in order:

```
<Navbar />                 client, floating glass bar, cart popover
<Hero />                   client, pointer-parallax bookshelf figure
<WorkingVolumesSection />  ─┐ client, sandboxed iframe of a third-party HTML document
<FieldManualsSection />    ─┘
<Catalog />                client, search/filter/sort + BookCard grid  (id="catalog", anchor id="books")
<Footer />
```

[`app/layout.tsx`](../app/layout.tsx) wraps everything in `StorefrontProvider` and appends `<Toast />`, so
cart/wishlist/session state is available app-wide through `useStorefront()`.

### 1.2 Catalogue data — the single source of truth

[`data/books.ts`](../data/books.ts) exports `books: Book[]`, a **deterministic static module constant**:

- `books.base.ts` — hand-curated titles.
- `books.generated.ts` — Open Library titles imported by `scripts/fetch-books.mjs`.
- Every derived field (id, price, `originalPrice`, rating, reviews, stock, badge, format, `sellerCount`) comes
  from `stableHash(book.id)`. Nothing is random, time-dependent, or position-dependent, so the catalogue is
  byte-identical on every boot and machine. **This determinism is what makes a server-rendered, hydration-safe
  showcase possible.**

`Book` fields available for real display: `id, title, author, cover, isbn?, price, originalPrice?, rating?,
reviews?, stock, status ('in-stock' | 'out-of-stock'), badge?, category, format, sellerCount, vendorId?,
action?`. There is **no** `featured`, `bestseller`, `isStaffPick`, `rank`, or `addedAt` field — see §4.

### 1.3 The live catalog and its API

[`components/catalog.tsx`](../components/catalog.tsx) (`'use client'`) — 135 lines:

- Initialises state from the **static `books` import**, so the shelf renders immediately and server-side.
- A `useEffect` then `fetch('/api/books')` (with `AbortController`) and **replaces** the list. On failure it
  keeps the local shelf and renders a `role="status"` notice: *"The live catalogue could not be reached.
  Showing the locally saved shelf."* — the explicit fallback state already exists.
- Search (`query` state + a `markethub:search` CustomEvent listener), filters (`FilterState`), sort, and
  "buying priority" are all client-side `useState`/`useMemo` over the fetched array.
- Renders `BookCard` per book, a mobile filter drawer (`role="dialog"`, `aria-modal`), a desktop sidebar,
  accurate result counts, and a `no-results` block with a Clear-filters button.

[`app/api/books/route.ts`](../app/api/books/route.ts) — `GET` → `listProducts()`:

- mock mode (`DATABASE_URL` unset): `mockStore.books.values()`
- PostgreSQL: `prisma.book.findMany({ where: { active: true, OR: [{vendorId: null}, {vendor: {is: {status: 'APPROVED'}}}]} })`
- `export const dynamic = 'force-dynamic'`. Response shape `{ data: Book[], source: 'mock' | 'postgresql' }`.
- `POST` is admin-only with origin check and field-by-field validation.

### 1.4 Card, motion, and design system

- [`components/book-card.tsx`](../components/book-card.tsx) — `next/image` with `fill` + explicit `sizes`,
  `onError` → `.cover-fallback-art` (category + title text), `<a href={`/books/${book.id}`}>` for cover/title,
  wishlist button with `aria-pressed`, stock/rating/price row, Add-to-cart through `useStorefront()`.
- [`components/book-motion.ts`](../components/book-motion.ts) — `useCoverTilt` pointer-tilt hook (ref + handlers).
- [`components/hero.tsx`](../components/hero.tsx) — **the pattern to reuse**: a single `requestAnimationFrame`
  loop interpolating toward a pointer target and writing CSS custom properties (`--foreground-x`,
  `--book-tilt`, …), with a `window.matchMedia('(prefers-reduced-motion: reduce)')` guard and full listener
  cleanup. No animation dependency is used anywhere in the project.
- [`app/globals.css`](../app/globals.css) (1025 lines) — tokens: `--bg #0d0c0a`, `--surface #14120f`,
  `--surface-raised #1b1814`, `--border rgba(216,198,164,.16)`, `--ivory #eee8dc`, `--muted #a7a095`,
  `--subtle #80796f`, `--gold #b99258`, `--gold-bright #d8c6a4`, `--success #718c6a`, `--danger #a85f55`,
  `--serif` (Newsreader), `--sans` (Source Sans 3); `color-scheme: dark`. Three `prefers-reduced-motion`
  blocks already exist. There is no "deep blue/ink" token — the reference image's blue would be a **new**
  colour, which the brief says must still belong to the gold/ivory system.
- Accessibility baseline already present: `sr-only` labels, `.skip-link`-style patterns, `aria-label` on
  icon-only buttons, `role="status"` notices, `role="dialog"` + `aria-modal` drawer, `aria-pressed` wishlist.

### 1.5 Commerce boundary (must not be bypassed)

`useStorefront()` in [`components/storefront.tsx`](../components/storefront.tsx) is the **only** sanctioned
cart/wishlist path: signed-in users mutate via `/api/cart`, `/api/wishlist`, `/api/checkout`; guests use
`localStorage` keys `markethub-guest-cart` / `markethub-guest-wishlist` and import on sign-in. Prices, stock,
totals and eligibility are always server-derived. The showcase must call `addToCart` / `toggleWishlist` and
nothing else — no client-side price or stock arithmetic beyond display.

---

## 2. Current animated sections — how they work

[`components/landing-pages/threeui-pages.tsx`](../components/landing-pages/threeui-pages.tsx) (200 lines) exports
`WorkingVolumesSection` and `FieldManualsSection`. Each wraps a `LazyMount` (an `IntersectionObserver` that
mounts children once, `rootMargin: 300px`) around a `LandingPageFrame`:

- `<iframe src="/landing-pages/complete-shelf-v2.html" | "/landing-pages/bestsellers-book-showcase.html" loading="eager">`
  positioned `absolute inset:0`, `height: clamp(640px,100svh,960px)` (desktop) / `min(100svh,760px)` (mobile).
- On `onLoad` the parent reaches into `contentDocument` and appends a `<style id="threeui-customization">`
  generated from `PageTypographyProps` (`--serif`, `--mono`, `--accent`/`--pink`).

---

## 3. Current iframe / data-flow limitations

These are the reasons the animated area is **not** currently a book showcase and cannot be made one by
editing CSS. Ordered by how much they block the objective.

| # | Limitation | Evidence | Why it blocks the objective |
|---|---|---|---|
| L1 | **The frames contain no book data.** They are third-party "ThreeUI" *landing documents*: `title="Working Volumes — Seven Tools for Making"` and `title="Field Manuals — Tools for Thought"`. `PageTypographyProps` only carries fonts/accent colour. No `Book`, id, price, stock, or `/books/[id]` href crosses the boundary. | `threeui-pages.tsx:137-160`; `ls public/landing-pages` (189 KB + 55 KB authored HTML) | "Data-driven by the same live `Book[]`" is impossible without rewriting the documents or replacing them. |
| L2 | **Provenance contract already broken.** The header requires byte-exact SHA-256 `606f200f…` / `7c1ed1ca…` and "never edit"; the shipped files hash `8f125679…` / `3e3a6375…`, self-described in-comment as "different revisions of the same documents". | `threeui-pages.tsx:1-21` | An unreviewed third-party bundle is already vendored with a failed integrity check; building a *primary* discovery surface on it propagates that risk and cannot be tested against a fixed input. |
| L3 | **The sandbox is not an isolation boundary.** `URL_FRAME_SANDBOX` includes **both** `allow-same-origin` and `allow-scripts` on **same-origin** documents, while the parent script touches `contentDocument`. It also grants unused privileges (`allow-downloads`, `allow-forms`, `allow-modals`, `allow-popups`). The browser logs a sandbox-escape warning (observed live). | `threeui-pages.tsx:61-87`; live console warning | The brief asks to "keep iframe sandboxing strict and remove unused iframe privileges". Two of the three permitted flags cannot be granted safely together, and the parent's style injection *requires* the unsafe one. |
| L4 | **Opaque to accessibility and to the app's own DOM.** An iframe is one node with a `title`; the parent cannot supply `alt` text, focus order, or headings for the shelf, and screen-reader users traverse third-party markup authored without the app's semantics. | `threeui-pages.tsx:76-92` | Fails "meaningful alt text for every cover", "proper button elements", "accessible live region", "keyboard controls" — none are implementable from the parent. |
| L5 | **No CTA, no route link, no catalog coupling.** Nothing inside the frames links to `/books/[id]`, and nothing exposes "Open book", "Browse all books", or the index/total that the reference image's lower panel requires. | `threeui-pages.tsx` (no data props) | The reference image's `04 / 07` counter, arrows and OPEN action must be authored in React over real data — they do not exist today. |
| L6 | **~2 full viewports of non-book content sit between the hero and the catalog.** Both sections are `clamp(640px,100svh,960px)` tall. | `threeui-pages.tsx:167,185` | Directly contradicts "the animated shelf/showcase must become the primary way users discover books". |
| L7 | **Weight and fan-out.** 244 KB of vendored HTML, `loading="eager"`, plus authored remote deps. The live network log from the same tree shows six `cdn.jsdelivr.net` three.js module fetches, Google Fonts, and Supabase-hosted images when these sections mount. The app CSP must therefore whitelist `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com` and a Supabase bucket. | live network log; `next.config.ts` `framedDocumentCsp` | Conflicts with "do not load unnecessary iframe documents" and "lazy-load noncritical assets"; also expands the app's CSP surface (MH-04/MH-05 in the Phase 0 baseline). |
| L8 | **No shared catalog fetch.** Only `catalog.tsx` calls `/api/books`. There is no hook, context, or cache, so a second consumer added naively duplicates the request. | `catalog.tsx:48-63` is the only `fetch('/api/books')` outside `/api` | The brief explicitly forbids duplicate `/api/books` requests; a shared boundary must be created first. |
| L9 | **Dead in-page anchors that the showcase must resolve.** `hero.tsx:83` links `#bestsellers`; `footer.tsx:8-9` links `#books`, `#categories`, `#bestsellers`, `#vendors`, `#authors`. The only ids in the tree are `id="catalog"`, `id="books"` (hidden span) and `id="top"`. So `#bestsellers`, `#categories`, `#vendors`, `#authors` currently go nowhere. | grep of `id="…"` across `components/`, `app/` | The new featured section is the natural owner of `#bestsellers`; leaving it dead while adding a section would preserve a known broken CTA. |
| L10 | `components/landing-pages/threeui.css` (1775 lines) is **orphaned** — its only mention is the comment stating it is not needed. | grep for `threeui.css` | Dead weight; deleting it is a free cleanup, but it is *not* a substitute for L1. |

**Conclusion.** The two iframe sections are decorative third-party landing pages, not a book showcase. The
brief's "critical architectural requirement" cannot be satisfied by bridging data into them without either
(a) rewriting 244 KB of unaudited third-party HTML, or (b) replacing them with native React. The brief's own
preference — "Prefer a native React/TypeScript implementation" — is therefore the only viable route for the
primary surface, and the deterministic `stableHash` catalogue (§1.2) already gives it a hydration-safe,
server-renderable data source.

---

## 4. Data-flow decision (proposed, to be documented in code)

**Showcase follows the full live collection, not the filter/search state.** Rationale: the showcase sits
*above* the catalog, which owns the filter UI; making the showcase track filters would imply the featured
shelf *is* the filtered result set while the controls are off-screen, and would fight "preserve the user's
position when catalog data refreshes". The catalog stays the authoritative filtered collection, and the
showcase's "Browse all books" action scrolls to `#catalog`.

**Featured-selection rule — real fields only, no invented data.** `Book` has no `featured`/`bestseller` field,
and the brief forbids inventing metrics. Proposed deterministic rule, computed from existing fields:

1. Consider only purchasable books: `status === 'in-stock'` and `price !== null`.
2. Rank deterministically by `stableHash('featured:' + book.id)`, which is stable per book, uniform across the
   catalogue, and independent of array order — so server and client agree and there is **no hydration
   mismatch** and **no shuffle on refresh**.
3. Take a fixed window (target 7, matching the reference image's `04 / 07`) and cycle it so the active book
   never disappears when the window shifts.

This must be written down in the component docblock and covered by a test asserting the same ids in a
different input order. If a real editorial rule is later preferred (e.g. top-rated in-stock with
`badge === 'NEW ARRIVAL'` first), it is a one-function change and the same test shape applies.

---

## 5. Prioritized implementation plan

Each phase is independently reviewable, ends green on `typecheck` / `test` / `build`, and adds its own tests.
No phase weakens an existing control.

**Phase A — shared catalog boundary (prerequisite for everything).**
1. Extract the fetch/fallback logic from `catalog.tsx` into one shared client hook (e.g.
   `useLiveCatalogue()`) that returns `{ books, source, loading, error, refresh }`, keeps the static `books`
   import as the zero-flash initial value, aborts on unmount, and ignores stale responses (guard with a
   request counter/`AbortController`) so a slow first response cannot overwrite a newer one.
2. Refactor `Catalog` to consume the hook. **Behaviour must not change**: same fallback notice, same counts,
   same filters. Ship with a test proving one `/api/books` request is issued for a page that renders both
   `Catalog` and the showcase (regression guard for L8).

**Phase B — native featured showcase over live data.**
3. Add `components/featured-book-showcase.tsx` (`'use client'`), taking `books: Book[]` plus the selection
   rule from §4. Zero/one/many handled explicitly; focused book + side books; `04 / 07` index; previous/next
   with correct boundary semantics; real title, author, category, price, rating, stock, badge; `Open book` →
   `/books/${id}`; `Add to cart` only when in stock; wishlist via `useStorefront()`; `Browse all books` →
   `#catalog`.
4. Motion: CSS `transform`/`opacity` only, reusing the `hero.tsx` rAF + custom-property pattern (no new
   dependency), gated on `prefers-reduced-motion`, no autoplay, no scroll-jacking.
5. Accessibility: `<section aria-label="Featured books">`, real `<button>` controls with labels, `alt` text
   per cover, `aria-live="polite"` announcing the active book once per change, Tab/Shift+Tab/Enter/Space/
   arrows, no focus trap, visible focus rings, and a 44 px minimum target on touch.
6. Image integrity: `next/image` with explicit `sizes` and a stable aspect-ratio wrapper so the shelf does
   not shift while covers load; reuse the existing `cover-fallback-art` pattern for `onError`.

**Phase C — home-page recomposition.**
7. `app/page.tsx` → `Navbar → FeaturedBookShowcase → trust/value strip → Catalog → Footer`, and resolve L9 by
   giving the featured section `id="bestsellers"` (or repointing the hero/footer links).
8. Decide and execute the fate of the two iframe sections (see §7). Phase C removes them from the home page;
   whether they are deleted outright or relocated is the user's call.

**Phase D — visual finish.**
9. Deep blue/ink atmospheric background derived from existing tokens (new blue token added *to* the palette,
   not a second theme), shelf depth/parallax restrained, lower caption/control panel, progress indicators,
   responsive at 320/375/768/1024/1280/wide, navbar non-overlap, sufficient contrast on the new surface,
   `contain`/promotion hygiene to avoid whole-page repaints.

**Phase E — state polish.**
10. Skeleton on first paint, refresh state, empty collection, no-results, cover loading/error fallbacks,
    disabled (or documented looping) boundary controls, tooltips on icon-only controls, no navigation when
    a control inside a card is clicked.

**Phase F — verification and documentation.**
11. Tests: empty/one/many render, next/prev + boundaries, keyboard nav, every featured href matches a real
    `Book.id`, add-to-cart and wishlist use the storefront path, image fallback, loading/error/empty states,
    reduced-motion branch, deterministic selection stability under reordering, single `/api/books` request.
12. If E2E/a11y tooling is absent, use the lightest compatible option or **document the manual checks that
    were actually performed** — no invented passes. Final report: changed files, commands + results, the
    documented selection rule, and remaining iframe/dependency decisions.

---

## 6. Exact files expected to change

| File | New / Modified | Expected change |
|---|---|---|
| `components/use-live-catalogue.ts` | **new** | Shared client hook: fetch once, abort, stale-response guard, explicit fallback + error state. |
| `components/featured-book-showcase.tsx` | **new** | The native React showcase (data-driven, accessible, reduced-motion aware). |
| `components/book-shelf-motion.ts` (name TBD) | **new, optional** | rAF/parallax helpers if `hero.tsx`'s inline pattern is not cleanly extractable. |
| `components/catalog.tsx` | modified | Consume the shared hook; no behavioural change to filters/sort/search/counts. |
| `app/page.tsx` | modified | Reorder to Navbar → showcase → trust strip → Catalog → Footer; drop the two iframe sections. |
| `app/globals.css` | modified | Showcase styles + one new blue/ink token in the existing `:root` block; reduced-motion rules. |
| `components/hero.tsx` | modified | Repoint `#bestsellers` (or the showcase adopts that id). |
| `components/footer.tsx` | modified | Repair the dead `#categories` / `#vendors` / `#authors` anchors (L9). |
| `components/landing-pages/threeui-pages.tsx` | modified or deleted | Remove the sections from the home page; delete if the user confirms. |
| `components/landing-pages/threeui.css` | deleted (proposed) | Orphaned, 1775 lines (L10). |
| `public/landing-pages/*.html` | deleted (proposed, **needs confirmation**) | 244 KB of unaudited third-party documents — only if the sections are removed. |
| `tests/featured-showcase.test.ts` | **new** | Selection determinism, id/link integrity, boundary logic, single-fetch guard. |
| `next.config.ts` | modified **only if** iframes remain | Tighten the framed-document CSP and drop the sandbox's unused privileges. |

Explicitly **not** changing: `data/books.ts` / `books.base.ts` / `books.generated.ts` (no invented fields),
`app/api/books/route.ts`, `lib/authorization.ts`, `lib/request-security.ts`, `lib/rate-limit.ts`,
`components/book-card.tsx` (reused as-is), `components/storefront.tsx`, and every commerce/authorization rule.

---

## 7. Decisions that need the user

1. **Fate of the two iframe sections.** The objective requires the animated shelf to *become* the primary
   discovery surface, which means the two decorative full-viewport iframes leave the home page. Whether they
   are deleted from the repo, or kept somewhere secondary (e.g. an `/atelier`-style route, joining the
   existing Ashen Press experience), changes the file list and the CSP work.
2. **Colour direction.** The reference image is deep blue/ink; the product palette is warm gold/ivory on near
   black. Adding a restrained ink-blue surface token is proposed, but a fully blue hero would be a visible
   brand shift worth confirming.

---

## 8. Baseline results (this tree, before any change)

| Command | Exit | Result |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | **0** | Lockfile passes supply-chain policies; resolution skipped; `Done in 34ms using pnpm v12.9.1`. |
| `corepack pnpm typecheck` | **0** | `tsc --noEmit`, no diagnostics. |
| `corepack pnpm test` | **0** | `tests 24`, `pass 24`, `fail 0`, `duration_ms 621`. Single file `tests/social-security.test.ts`. |
| `corepack pnpm build` | **0** | `✓ Compiled successfully in 2.5s`; TypeScript finished in 715 ms; 12 static pages generated in 502 ms. Routes unchanged. Zero errors/warnings in the log. |

**Existing failures before modification: none.** All four gates are green, so every phase above starts from a
known-good baseline and any new failure is attributable to the change that introduced it.

**Known pre-existing issues carried in from the Phase 0 production baseline** (not caused by this feature, and
not to be silently fixed as part of it) — see [`docs/phase-0-baseline.md`](./phase-0-baseline.md):
MH-18 (`/checkout` and `/orders` are 404 — the cart CTA is a dead end, which affects "Add to cart" verifying
end-to-end), MH-04 (`'unsafe-inline'` in `script-src`), MH-05 (the sandbox flags in L3), MH-02 (test coverage),
and the missing `not-found`/`error`/`loading` files.

---

## 9. Test and tooling gaps for this feature

- **No E2E or accessibility tooling exists** in the repo (no Playwright/Puppeteer/axe; `pnpm test` is
  `node --test`). Phase F must either add the lightest compatible option or document the manual keyboard and
  a11y checks actually performed — the brief forbids reporting unrun checks as passes.
- The existing suite is unit-level and social/privacy-focused, so component tests will need a DOM environment
  decision (the lightest option compatible with `node --test` + `tsx`, or a documented rationale for staying
  at pure-function tests over the selection/link logic plus manual UI verification).
