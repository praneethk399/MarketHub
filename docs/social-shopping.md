# Social Shopping & Trusted Commerce integration

This document describes the social layer added on top of the **existing** MarketHub
architecture (Next.js route handlers → services → Prisma/PostgreSQL, with the
in-process mock store when `DATABASE_URL` is empty). Nothing existing was
replaced: authentication, RBAC, cart, checkout, orders, reviews, vendor and
admin APIs keep working unchanged.

## 1. Architecture

```
Browser
  ↓  (existing pages + new social sections)
/api/...                        route handlers: auth, RBAC, ownership, validation, rate limits, origin checks
  ↓
services/friend.service.ts      friendships
services/privacy.service.ts     privacy settings + pure visibility rules
services/trusted-rating.service.ts  friends' reviews, community vs network rating, badges
services/recommendation.service.ts  friend-to-friend recommendations
services/list.service.ts        shared/collaborative lists
services/sellerPassport.service.ts  explainable seller score (derived metrics)
services/productPassport.service.ts product passport
services/sellerComparison.service.ts ISBN-grouped seller comparison + ranking
services/ai.service.ts          AI shopping advisor (allowlisted, read-only tools)
services/marketShield.service.ts security signals (admin-only telemetry)
services/social.service.ts      reading progress
services/social-targets.ts      shared target resolution + batch queries
  ↓
Prisma (PostgreSQL)  |  lib/mock-store.ts (demo mode)
```

Every service implements the same flow required by the spec:

```
AUTHENTICATE → AUTHORIZE → CHECK PRIVACY → VALIDATE → CHECK OWNERSHIP
→ BUSINESS RULES → SERVICE → DATABASE → SAFE DTO → AUDIT (where required)
```

## 2. Database changes (additive only)

New enums: `FriendshipStatus`, `SocialVisibility`, `PurchaseVisibility`,
`ListVisibility`, `ListRole`, `ReadingStatus`, `SocialTargetType`.

New models: `Friendship`, `SocialPrivacy`, `Recommendation`, `SocialList`,
`ListItem`, `ListMember`, `ReadingProgress`, `PriceHistory`, `SecuritySignal`.

Extended model: `Review` gained `visibility` (default `PUBLIC` to preserve the
existing marketplace-public review behaviour), `containsSpoilers`, and an
optional `bookId` so storefront books can be reviewed (the legacy `productId`
became nullable for that reason).

Migration SQL: [`docs/migrations/0001_social_shopping.sql`](migrations/0001_social_shopping.sql)
(ADD COLUMN / CREATE TABLE only — no destructive statements, existing rows are
preserved). The project's runtime convention is `pnpm db:push`; the SQL is
provided for auditability and for teams that run reviewed migrations.

## 3. Privacy model

| Area | Values | Default |
| --- | --- | --- |
| Reviews | `PRIVATE` / `FRIENDS` / `PUBLIC` | `PUBLIC` (matches existing public review behaviour) |
| Purchases | `PRIVATE` / `LIMITED` | `PRIVATE` |
| Reading activity | `PRIVATE` / `FRIENDS` / `PUBLIC` | `PRIVATE` |
| Lists (per list) | `PRIVATE` / `SHARED` / `PUBLIC` | `PRIVATE` (configurable default) |
| Recommendations | `INTENDED_RECIPIENTS_ONLY` (constant) | always recipient-only |

Rules enforced in `services/privacy.service.ts`:

* Effective review visibility = **stricter** of the review's own visibility and
  the author's account-level setting.
* Community rating counts only effectively-public reviews; network rating counts
  only reviews visible to the signed-in viewer through accepted friendships.
  The two signals are never mixed.
* `friendsAlsoBought` is an **aggregate count only**, and counts a friend's
  purchase only when that friend's purchase privacy is `LIMITED`.
* Private notes on reading progress are returned to their owner only.
* List members are only exposed to members; `PUBLIC` viewers see items but not
  membership.

## 4. API surface (new)

| Endpoint | Methods | Notes |
| --- | --- | --- |
| `/api/social/friends` | GET, POST | list connections; request by email |
| `/api/social/friends/:id` | PATCH, DELETE | accept/decline/block; remove |
| `/api/social/recommendations` | GET, POST | recipient-scoped recommendations |
| `/api/privacy` | GET, PATCH | privacy settings (with explanations in UI) |
| `/api/lists` | GET, POST | owned + member lists |
| `/api/lists/:id` | GET, PATCH, DELETE | visibility/membership enforced server-side |
| `/api/lists/:id/items` | POST | owner/editor only |
| `/api/lists/:id/items/:itemId` | DELETE, PATCH | remove item / mark preferred |
| `/api/lists/:id/members` | POST | owner only, accepted friends only |
| `/api/lists/:id/members/:userId` | DELETE | owner only |
| `/api/books/:id/social` | GET | one batched payload: ratings, friend reviews, badges, visible reviews |
| `/api/books/:id/reviews` | GET, POST | visibility-aware list / verified-purchase creation |
| `/api/books/:id/passport` | GET | product passport + seller passport + comparison |
| `/api/products/:slug/social` | GET | relational products |
| `/api/products/:slug/passport` | GET | relational products |
| `/api/products/:slug/sellers` | GET | seller comparison |
| `/api/vendors/:id/passport` | GET | seller passport |
| `/api/ai/chat` | POST | advisor (anonymous allowed, social signals require a session) |
| `/api/reading-progress` | GET, POST | private by default |
| `/api/admin/security-signals` | GET | **admin only** MarketShield telemetry |

Existing endpoints changed only minimally: `/api/products/:slug/reviews` now
filters by viewer visibility, and the review schema accepts `visibility` and
`containsSpoilers`.

## 5. Seller Passport — explainable scoring

Documented in `services/sellerPassport.service.ts` and surfaced in the API:

```
Seller Score = Σ(factor × weight) / Σ(available weights)
customerSatisfaction 30%  avg rating on the seller’s items (≥5 reviews)
deliveryReliability  25%  delivered / (delivered + cancelled) settled orders (≥4)
authenticity         15%  share of listings with a checksum-valid ISBN (≥3 listings)
disputePerformance   15%  1 − refunded / all orders (≥5 orders)
priceCompetitiveness 15%  ISBN groups where the seller is at/below median (≥1 group)
returnPerformance      —  no return tracking exists → always "Not enough data"
```

The overall score needs at least two available factors, one of which must be
satisfaction or delivery. Otherwise the passport says **“Not enough data”**
instead of inventing a number. Vendors with `SUSPENDED`/`PENDING` status are not
exposed, and only public vendor fields are returned.

## 6. AI Shopping Advisor

```
Browser → POST /api/ai/chat → allowlisted read-only tools → services → database
tools: searchProducts, getProductDetails, compareProducts, getSellerPassport, getTrustedRecommendations
```

* No direct database access, no write capability, no price/order/checkout
  mutation and no RBAC bypass. `runTool()` throws 403 for any other name.
* The message is parsed into typed parameters (budget, keywords, intent) — free
  text is never executed, which is the prompt-injection defence.
* Social tools run with the session viewer, so privacy rules apply unchanged.
* Answers are a deterministic calculation over real data (no API keys, no black
  box), and each pick explains its trade-offs; a trusted-seller pick is omitted
  rather than invented when trust data is missing.

## 7. MarketShield

`services/marketShield.service.ts` records signals for friend-request bursts,
recommendation bursts, review clusters and repeated denied social actions, with
in-window de-duplication. Signals live in `SecuritySignal` (or the mock store)
and are exposed **only** through the admin-only endpoint. No customer-facing
response contains telemetry.

## 8. Demo data

`prisma/seed.ts` (database mode) and `lib/mock-store.ts` (demo mode) create four
demo customers — `ava@markethub.test`, `rahul@markethub.test`,
`ananya@markethub.test`, `kiran@markethub.test`, all with password
`Demo1234!` — with friendships, mixed review/reading/purchase privacy, orders
that give each seller real metrics, shared and private lists, recommendations,
reading progress, plus ISBN-shared offers from other sellers for comparison and
price history. Everything is real rows in the store: no hard-coded trust
numbers are rendered anywhere.

## 9. My library (reading room UI)

`/library` renders the reader's shelves using the existing reading-progress data:
Currently reading, Next up (tracked `NOT_STARTED` items plus purchased books
with no reading record yet) and Finished. Layout and styling live in a scoped
`.library-*` / `.shelf-*` block in `app/globals.css`, so the dark storefront
styling is untouched — the cream reading room is an inset surface inside the
existing shell.

- `services/library.service.ts` joins progress with catalogue metadata for the
  session viewer only (never a client-supplied id), so private shelves stay private.
- `components/library/library-shell.tsx` provides the sidebar, Continue reading
  card, pill tabs, search, wooden shelves and the All books grid.
- `components/library/library-controls.tsx` adds “Next up / Reading / Finished”
  controls plus a visibility selector on the product page.
- Shelves degrade gracefully: signed-out or empty shelves show an explanatory
  empty state rather than a broken layout, and on narrow screens each shelf
  scrolls horizontally instead of overflowing.

## 10. Tests

`tests/social-security.test.ts` (node:test, run with `pnpm test`) covers:

* privacy: private review invisible, friends-only visible to friends only,
  account-level caps, community/network separation, private purchase excluded
  from aggregates, private list hidden, shared list member-only
* social authorization: self/duplicate friendship, unauthorized accept/remove,
  list ownership and membership, viewer cannot edit, non-friend cannot be added,
  recommendations recipient-scoped and friend-only
* seller passport: metrics derived from rows, insufficient data honest, vendor
  isolation and suspended vendors hidden, pure score rules
* seller comparison: ISBN-only grouping, prices from the store, warranty/delivery
  honesty, explainable weights, no price-only ranking
* AI: allowlist rejection, no writes to orders/reviews/prices, no private data
  in answers, anonymous network data withheld
* MarketShield: signals recorded, telemetry absent from customer payloads
* reading progress: private by default, notes never leak

## 11. Known limitations

* Seller-side warranty/return-policy fields do not exist in the schema yet, so
  the passport and comparison display “Not specified” instead of inventing
  values; delivery estimates are likewise unavailable.
* Returns are not tracked, so `returnPerformance` is always reported as
  unavailable.
* Vote/mark-preferred: only owner/editor “preferred” marking is implemented
  (per-member voting is not).
* “Ask Your Friends”, social activity feed, product lifecycle and gift-mode UI
  are not implemented (P2 items); the advisor already handles gift-style
  questions through the same allowlisted tools.
* The rate limiter remains process-local (pre-existing limitation).
* In mock mode (no `DATABASE_URL`) relational products do not exist, so
  `/api/products/:slug/*` social endpoints return 404 by design; the storefront
  book endpoints are the fully featured path.
