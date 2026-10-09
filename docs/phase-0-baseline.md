# MarketHub — Phase 0 baseline report

**Date:** 2026-10-09
**Repository:** https://github.com/praneethk399/MarketHub
**Baseline commit:** `2c29b3f` (`main`, in sync with `origin/main` — 0 ahead / 0 behind)
**Working tree:** clean apart from untracked tooling scratch (`.freebuff/`, `.cfreebuff/`)
**Environment:** Windows, Node v24.20.0, npm 11.19.0, corepack 0.35.0 → pnpm 12.9.1, Next.js 16.3.8 (Turbopack)

**Method.** Static reading of `README.md`, `SECURITY-REVIEW.md`, `TODO.md`, `docs/backend-architecture.md`,
`prisma/schema.prisma`, `next.config.ts`, `package.json`, every tracked file under `app/`, `lib/`, `services/`,
`tests/`, plus live probing of a running dev server (home, `/books`, `/api/health`, landing documents).
Findings are labelled **observed** (reproduced live) or **static** (read from source, not yet reproduced with a
running exploit). No dynamic penetration test and no PostgreSQL instance were available in this environment.

---

## 1. Baseline command results

All commands run from the repository root with the frozen lockfile. Raw logs: `.freebuff/baseline-build.log`.

| # | Command | Exit | Observed result |
|---|---|---|---|
| 1 | `corepack pnpm install --frozen-lockfile` | **0** | `Lockfile is up to date, resolution step is skipped` / `Done in 291ms using pnpm v12.9.1`. Supply-chain policy check passed. `postinstall` → `prisma generate`. |
| 2 | `corepack pnpm typecheck` | **0** | `tsc --noEmit`, no diagnostics. |
| 3 | `corepack pnpm test` | **0** | `node --import tsx --test tests/*.test.ts` → **24 pass / 0 fail**, 956 ms, single file `tests/social-security.test.ts`. |
| 4 | `corepack pnpm build` | **0** | Turbopack: `✓ Compiled successfully in 8.1s`; TypeScript finished in 1.4 s; all routes emitted. Static (`○`): `/`, `/atelier`, `/books`, `/social`. Dynamic (`ƒ`): `/books/[id]`, `/library`, `/vendors/[id]`, and all API routes. |
| 5 | `corepack pnpm audit` | **0** | `No known vulnerabilities found`. |
| 6 | dev server boot | **0** | See §2.1. |

### 1.1 Live smoke checks (observed)

| Check | Result |
|---|---|
| `GET http://localhost:3000/` | `200`, `<title>Books for the curious | MarketHub</title>`, hero + ThreeUI framed sections render |
| `GET /api/health` | `200` `{"status":"ok","persistence":"mock"}` |
| `GET /books` | `200` |
| `GET /landing-pages/complete-shelf-v2.html` | `200` (framed document served from our own origin) |
| Browser console | No errors. Warnings: sandbox-escape warning for the framed document (→ MH-05); two Next `<Image fill>` height warnings on Open Library covers; one preloaded-image-unused warning |
| Failed network request | one `net::ERR_ABORTED` on initial load |

**Port finding (observed).** `pnpm dev` maps to `next dev --hostname 0.0.0.0` and should bind 3000, but this
environment exports `PORT=0`, which makes Next bind an OS-assigned random port (observed `64564`, then
`38279`). Pinning `PORT=3000` is required for a stable URL; recorded in [`.freebuff/run.md`](../.freebuff/run.md).

---

## 2. Architecture map

### 2.1 Runtime shape

Next.js App Router with Route Handlers for REST, a service layer for business logic, Prisma for PostgreSQL,
and a process-local mock store used when `DATABASE_URL` is unset. `next.config.ts` computes the Turbopack
worker pool from CPU count and installed memory, and defines two distinct CSP policies: an app-wide policy
and a relaxed `framedDocumentHeaders` policy for the three standalone landing documents.

### 2.2 Page routes

| Route | Kind | Notes |
|---|---|---|
| `/` | static | `Navbar` + `Hero` + two framed ThreeUI sections + `Catalog` + `Footer` |
| `/books` | static | catalogue shell (client-side filtering/sorting) |
| `/books/[id]` | dynamic | book detail; calls `notFound()` |
| `/library` | dynamic | reading shelves/progress; reads session server-side |
| `/social` | static | social hub shell |
| `/vendors/[id]` | dynamic | vendor storefront; calls `notFound()` |
| `/atelier` | static | Ashen Press shader experience |

There is **no** `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`, `app/robots.ts`, or `app/sitemap.ts`
(→ MH-06, MH-17). There is no `/cart`, `/checkout`, `/login`, `/register`, `/orders`, `/wishlist`, `/vendor`,
`/admin` page — those journeys exist only as APIs (§2.4). The retired Vite section of `TODO.md` still claims
them (→ MH-12).

### 2.3 API surface

53 route handlers under `app/api/`. Groups: `auth` (register/login/logout/me + backwards-compatible `/api/auth`),
`books` (list/detail/reviews/social/passport), `products` (search/detail/reviews/social/passport/sellers),
`categories`, `cart` (legacy books + relational items), `wishlist`, `addresses`, `checkout`, `orders`
(+cancel), `vendor/applications`, `vendor/products`, `vendors`, `admin` (vendor-applications, suspend,
overview, **security-signals**), `social/friends`, `social/recommendations`, `privacy`, `lists`
(+items/members), `reading-progress`, `ai/chat`, `health`.

### 2.4 Authentication and session lifecycle

`services/auth.ts`:

- Opaque 32-byte token, base64url; only its SHA-256 hash is persisted (`Session.tokenHash @unique`).
- Cookie `markethub_session`, `HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`, `Secure` only when
  `NODE_ENV === 'production'`.
- `readSession()` re-reads the user (id, name, email, role, `isActive`) on every request, so role changes and
  deactivation take effect immediately; expired sessions are deleted lazily.
- Passwords: bcrypt (cost 12) for new accounts; legacy `scrypt:` hashes are verified with `timingSafeEqual`
  and transparently upgraded on successful login.
- Logout deletes the backing session row/entry and clears the cookie.
- No session rotation on login and no "revoke other sessions" path (no password-change endpoint exists).
- Login/register are rate-limited (10 / 15 min) and origin-checked; failure returns a generic `401`
  (`unauthorized()`), so client-supplied role/identity is never trusted.

### 2.5 Roles and authorization boundaries

`lib/authorization.ts` is the single choke point: `requireAuth`, `requireRole`, `requireCustomer`,
`requireVendor`, `requireAdmin`, `requireOwnership`. Ownership is passed as **server-derived** ids
(`user.id` from the session) — no handler was found reading a user id from the body.

Vendor scope has defence in depth: the route checks `role === 'VENDOR'`, and
`services/vendor-products.ts` independently re-checks the vendor profile
(`vendor.status !== VendorStatus.APPROVED → 403`) on list/create/read/update/delete. Admin endpoints call
`requireAdmin` directly, so hidden-UI attacks are not possible.

Mutation protection: `lib/request-security.ts#sameOriginOnly` compares the `Origin` header to the request's
forwarded host/proto and **returns `null` when `Origin` is absent**. `lib/rate-limit.ts` applies per-process
windows keyed on `x-forwarded-for` → `x-real-ip` → `'unknown'`.

### 2.6 Prisma models

`User`, `Vendor`, `Book` (legacy storefront), `VendorApplication`, `Category`, `Product`, `ProductImage`,
`Inventory`, `Cart`, `ProductCartItem`, `Wishlist`, `WishlistItem`, `LegacyBookWishlistItem`, `Address`,
`CartItem`, `Order`, `OrderItem`, `Payment`, `Review`, `Friendship`, `SocialPrivacy`, `Recommendation`,
`SocialList`, `ListItem`, `ListMember`, `ReadingProgress`, `PriceHistory`, `SecuritySignal`, `Session`,
`AuditLog`.

Notable constraints: `Session.tokenHash @unique`; `Payment.orderId @unique` + `Payment.transactionReference
@unique`; `ProductCartItem @@unique([cartId, productId])`; `WishlistItem @@unique([wishlistId, productId])`;
`LegacyBookWishlistItem @@unique([userId, bookId])`; `CartItem @@unique([cartId, bookId])`; `Review
@@unique([productId, userId])` **and** `@@unique([bookId, userId])`; `Friendship @@unique([requesterId,
addresseeId])`; `Recommendation` 4-column unique; `ListItem @@unique([listId, targetType, targetId])`;
`ListMember @@unique([listId, userId])`; `ReadingProgress @@unique([userId, targetType, targetId])`.
Indexes exist on the hot paths (`Product` vendor/category/ISBN/author/createdAt, `Order` user+status,
`AuditLog` user/entity/action, `SecuritySignal` type/subject). No `middleware.ts` exists.

### 2.7 Mock mode vs PostgreSQL

`lib/prisma.ts` exports `isDatabaseConfigured = Boolean(process.env.DATABASE_URL?.trim())`; every service
branches on it. Behaviour differences that matter:

| Concern | PostgreSQL path | Mock path |
|---|---|---|
| Sessions | `Session` rows | in-memory `Map` |
| Vendor product management | full CRUD | explicit `503` "Vendor product management requires PostgreSQL" |
| Checkout | one `$transaction`: reloads authoritative prices, validates active status + approved vendor, decrements legacy stock with `stock >= quantity` CAS, decrements product inventory with an optimistic `quantity`/`reserved` CAS, writes order + `Payment` (`method: 'SIMULATED'`) + `AuditLog` atomically | sequential reads/writes on `mockStore`, **no transaction**, no vendor-approval check, book-only order items |
| Cancellation | transactional, guarded `updateMany` state transition, restores stock/inventory, marks payment `REFUNDED` | sequential mutation of `mockStore`, `PLACED` only |
| Rate limits | process-local | process-local (shared code) |

No path falls back from a configured database to mock data: a configured-but-unreachable database surfaces as
a `503` from `/api/health`.

### 2.8 Journeys

- **Customer:** browse `/`, `/books`, `/books/[id]` → cart via `/api/cart*` → `/api/checkout` → `/api/orders*`
  → review via `/api/*/reviews` (eligibility = non-cancelled purchase) → wishlist, addresses, lists, reading
  progress, social, advisor.
- **Vendor:** `/api/vendor/applications` → admin approval → `/api/vendor/products*` (PostgreSQL only).
- **Admin:** `/api/admin/vendor-applications*`, `/api/admin/vendors/[id]/suspend`, `/api/admin/overview`,
  `/api/admin/security-signals`.
- **UI gap:** none of the customer/vendor/admin journeys above have a page route in the App Router; only the
  public storefront, library, social hub, vendor storefront, and atelier are surfaced.

### 2.9 Tests and untested critical paths

One file, `tests/social-security.test.ts`, 24 assertions covering privacy scoping, friendship rules,
recommendation scope, seller-passport metrics, vendor field exposure, ISBN-only seller grouping, advisor
tool allowlist, telemetry non-exposure, and reading-progress privacy.

**Completely untested:** session lifecycle (create/expire/logout/replay), role and ownership boundaries per
role, horizontal privilege escalation on carts/addresses/orders/lists/wishlists, vendor isolation and
suspension, admin authorization, validation/malformed input, origin checks, rate limits, cart totals,
checkout atomicity/oversell/double-submit, order state transitions, review eligibility and duplicate
prevention, search/filter/sort/pagination, and any UI/E2E or accessibility flow.

---

## 3. Prioritized issue register

Severity: **P0** security/data-loss/payment/authorization failure · **P1** broken core journey or production
blocker · **P2** important UX/performance/accessibility/defence defect · **P3** polish or maintainability.

**No P0 was confirmed.** Within the statically reviewed scope the authorization model is consistently
server-derived, and the only paths that could plausibly produce a P0 (dynamic privilege escalation, replay of
sessions, oversell under real concurrency) require a running PostgreSQL instance and live two-account testing
that this environment could not provide. Those are listed as unverified P0 candidates in §5 rather than
claimed as findings.

| ID | Sev | Area | Finding | Evidence | Verification |
|---|---|---|---|---|---|
| MH-01 | P1 | Checkout / money | Mock-mode checkout is neither atomic nor idempotent: it reads the cart, creates the order, then clears the cart and decrements stock as separate steps, and `POST /api/checkout` accepts no idempotency key. Two concurrent requests can both read a non-empty cart and create two orders with double stock decrements. The PostgreSQL path is protected by the transaction plus `stock >= quantity` / `quantity`+`reserved` CAS. | `services/orders.ts` (mock branch of `checkout`), `app/api/checkout/route.ts` | static |
| MH-02 | P1 | Tests | Automated coverage is 24 assertions in one file, limited to social/privacy invariants. Auth/session, role and ownership boundaries, cart totals, checkout, order transitions, vendor isolation/suspension, admin authz, validation, origin checks and rate limits are untested. | `tests/` (single file); `corepack pnpm test` output | static |
| MH-03 | P1 | Abuse controls | Rate limiting keys on the client-supplied `x-forwarded-for` / `x-real-ip` header and falls back to the literal `'unknown'` (one shared bucket for all unidentified clients). When the app is reachable without a trusted proxy that overwrites the header, an attacker rotates it to bypass every limit — including the login/register limit. The limiter is also process-local, so it is absent across instances. | `lib/rate-limit.ts:16-18`; applied at `app/api/auth/route.ts:22`, `app/api/checkout/route.ts:12` | static (topology-dependent) |
| MH-04 | P2 | CSP / XSS | The app-wide CSP uses `script-src 'self' 'unsafe-inline'` with no nonce or hash, so any inline-script injection is executable. This weakens the control the README advertises. Landing documents additionally allow `'unsafe-inline'` inline style/script plus jsDelivr/unpkg as script sources. | `next.config.ts` (`securityHeaders`, `framedDocumentHeaders`) | static |
| MH-05 | P2 | Frame isolation | The ThreeUI frames are same-origin documents sandboxed with `allow-same-origin allow-scripts` (plus downloads/forms/modals/popups), and the parent writes into `contentDocument` in `onLoad`. The sandbox provides no meaningful isolation for a same-origin document, and the browser warns about it. | `components/landing-pages/threeui-pages.tsx:61,87`; **observed** live console warning | observed |
| MH-06 | P2 | UX/robustness | No app-level `not-found.tsx`, `error.tsx`, or `loading.tsx`. 404s (from `notFound()` in `/books/[id]` and `/vendors/[id]`), thrown render errors, and route transitions fall back to framework defaults, so the required empty/loading/error polish does not exist. | `git ls-files 'app/**'` — only `page.tsx`, `layout.tsx`, `globals.css` | static |
| MH-07 | P2 | Supply chain | Direct dependencies are unpinned (`next`, `react`, `react-dom`, `lucide-react`, `tailwindcss`, `@tailwindcss/postcss`, `typescript` = `"latest"`). Installs are reproducible today (`--frozen-lockfile` verified), but any lockfile refresh silently adopts new majors of the framework. | `package.json:18-20,30-35` | observed |
| MH-08 | P2 | Authorization | No `middleware.ts`: authorization is entirely handler-local. Correct in the reviewed handlers, but there is no default-deny, so any future route that forgets `requireAuth` ships publicly accessible. | absence of `middleware.ts`; `lib/authorization.ts` usage map | static |
| MH-09 | P2 | Mode parity | Mock mode stores book lines and relational product lines in one `Map` keyed by id and `getCart`'s mock branch resolves every entry through the legacy book catalogue, so the two are indistinguishable; mock checkout emits only `bookId` order items and performs no `book.vendor.status === 'APPROVED'` check (the DB branch does). Demonstration behaviour diverges from production. | `services/cart.ts` (mock branch), `services/orders.ts` (mock branch) | static |
| MH-10 | P2 | Operability | `/api/health` returns only `{status, persistence}` — no version, no readiness/liveness split, no per-dependency detail, and it is unauthenticated and unmetered. Operators cannot distinguish "process up" from "ready to serve". | `app/api/health/route.ts`; **observed** `{"status":"ok","persistence":"mock"}` | observed |
| MH-11 | P2 | Observability | No structured logging, request correlation ids, or error boundaries. The only server-side logging is `console.error('[MarketHub API]', error)` in `lib/api.ts` and the health route; nothing ties a log line to a request or user. | `lib/api.ts:4-11`, `app/api/health/route.ts:14` | static |
| MH-12 | P3 | Docs accuracy | `TODO.md` documents the retired Vite/React-Router application (`src/data/books.ts`, `/customer/*`, `/vendor/*`, `/admin/*`, Recharts, Supabase modules) that no longer exists, and no root `AGENTS.md` exists although the work brief instructs reading one (only `BuildSecure/AGENTS.md`). `README.md`'s API table omits `/api/admin/security-signals`. | `TODO.md`, `README.md`, repo root listing | static |
| MH-13 | P3 | Hygiene | Vite-era dead code and committed build output are tracked: `index.html`, `app.config.ts`, `src/**`, `dist/**`, `tsconfig.app.json`, `tsconfig.node.json`, `public/manus-routes.json`, `.components.sh`. | `git ls-files` | static |
| MH-14 | P3 | Data integrity | `Review` permits both `productId` and `bookId` on a single row; nothing enforces exactly one target, so a row can occupy both unique indexes at once. | `prisma/schema.prisma` (`Review`) | static |
| MH-15 | P3 | Docs / secrets posture | Demo credentials (`ava@markethub.test` … password `Demo1234!`) are printed in `docs/backend-architecture.md`. Seeding is production-gated, but the gate is stated in a different section from the credentials. | `docs/backend-architecture.md` | static |
| MH-16 | P3 | Metadata/SEO | No `robots.txt` and no `sitemap.ts` route; Open Graph/Twitter/canonical coverage in `app/layout.tsx` has not been verified. | absence in `app/` and `public/` | static (unverified) |
| MH-17 | P3 | Build hygiene | `tsconfig.tsbuildinfo` (321 KB) sits in the working tree; it is git-ignored (`*.tsbuildinfo`) but confirms incremental state is shared between the dev server and `next build` in this checkout. | `ls -la` | observed |

---

## 4. Proposed implementation plan

Ordered so that every phase ends green on `typecheck` / `test` / `build` / `audit`, and each phase ships its
own regression tests. No phase proceeds while the previous one has a failing gate.

**Phase 1 — close the P1s (correctness and abuse controls)**
1. Make mock-mode checkout match the production contract: serialise checkout per user, re-read the cart
   inside the critical section, validate vendor approval and product status, and make the cart-clear +
   stock-decrement step atomic (or mark mock checkout explicitly non-durable and refuse concurrent calls).
2. Add an idempotency key to `POST /api/checkout` (client-supplied, stored with the order, replay returns the
   original order) so double-submit cannot duplicate an order in either mode.
3. Replace the spoofable rate-limit key with a trusted-proxy-aware client address resolution, document the
   required `TRUSTED_PROXY`/hop configuration, and provide a shared-store adapter seam so a distributed
   limiter can be dropped in without touching call sites.
4. Stand up the missing regression tests (§2.9) as the first deliverable of each fixed area: session
   lifecycle, per-role ownership boundaries, validation, origin, rate limit, cart totals, checkout
   idempotency, order transitions, review eligibility.

**Phase 2 — harden the browser surface**
5. Replace `'unsafe-inline'` in `script-src` with a nonce (or hash) strategy and verify every page still
   boots; keep `'unsafe-eval'` limited to development only.
6. Re-scope the landing frames: drop `allow-same-origin` where possible, and replace the parent's direct
   `contentDocument` style injection with a `postMessage` contract so the sandbox actually isolates.
7. Fix the two `<Image fill>` height warnings (fix the parent's fixed height / aspect ratio) and the unused
   preload warning.

**Phase 3 — product surface**
8. Add `not-found.tsx`, `error.tsx`, and `loading.tsx`, then the missing customer journeys
   (cart → checkout → orders → wishlist → addresses) on top of the existing, already-validated APIs.
9. Vendor and admin dashboards for the existing vendor/admin endpoints, permission-aware navigation,
   confirmation dialogs, safe tables/pagination.
10. Design-system pass across colours/typography/spacing/radii/shadows/buttons/forms/cards/badges/alerts/
    tables/tabs, plus focus-visible, keyboard navigation, landmarks, labels, contrast, reduced-motion, and
    screen-reader status announcements. Metadata, OG/Twitter, canonical, robots and sitemap.

**Phase 4 — performance**
11. Move client components back to the server where possible, stabilise image dimensions, remove duplicate
    API calls and waterfalls, paginate/virtualise long lists, verify `next build` + `next start` behaviour,
    and measure Core Web Vitals before/after.

**Phase 5 — operations and documentation**
12. Structured logging with request correlation ids, safe error boundaries, a readiness endpoint with
    dependency detail, startup environment validation with clear operator messages.
13. Reconcile `TODO.md`/`README.md` with reality, delete the Vite-era dead code, state the production seed
    gate next to the demo credentials, document the payment integration boundary, and record exact
    test/build/audit results plus deferred risks.

---

## 5. Verification gaps and limitations of this report

Stated explicitly so nothing here is mistaken for a passed check:

1. **No dynamic security testing.** No two-account privilege-escalation run, no session replay, no origin
   forgery, no rate-limit bypass attempt was executed. MH-04, MH-05, MH-08, MH-11 are static readings;
   MH-05 and MH-10 are the only ones reproduced live.
2. **No PostgreSQL available.** The database branches of checkout, cancellation, inventory CAS, vendor
   product CRUD, and every Prisma model constraint are **unexecuted**. Baseline items 2–5 all ran in mock
   mode, so the "PostgreSQL-backed mode" arm of Phase 4 is entirely unverified. The PG-side migration files
   (`docs/migrations/0001_social_shopping.sql`, `0002_legacy_book_wishlist.sql`) were not applied.
3. **Unverified P0 candidates** requiring the above before they can be confirmed or dismissed: oversell /
   duplicate order under real concurrency; horizontal privilege escalation across carts/addresses/orders/
   lists; vendor-suspension bypass on an already-authenticated session; admin route reachability without the
   UI; session replay after logout under concurrent requests; login enumeration through error/timing.
4. **No E2E or accessibility tooling.** The brief asks to add the lightest maintainable option if absent;
   none exists today, so the "critical UI flows on mobile and desktop" and "accessibility checks" items are
   not merely failing — they have no harness.
5. **Manual UI inspection was partial.** Only `/`, `/books`, `/api/health` and the landing documents were
   exercised live. Search/filter/sort, product detail, cart, checkout, orders, library, social, vendor and
   admin screens, and every empty/loading/error state were **not** inspected (several have no page route at
   all — MH-06/clause in §2.8).
6. **`corepack pnpm audit` scope.** Clean today, but this is a point-in-time advisory database result and
   transitive risk can change without a lockfile change.
7. **Third-party framed content.** The ThreeUI landing documents and the Ashen Press experience load scripts
   and media from jsDelivr, unpkg, Google Fonts and a Supabase bucket. They were served successfully but
   their authored code was not security-reviewed here.
