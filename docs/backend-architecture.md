# MarketHub backend

MarketHub uses Next.js Route Handlers for REST endpoints, services for business logic, Prisma for PostgreSQL persistence, and process-local mock services for the legacy bookstore experience when `DATABASE_URL` is unset.

## Boundaries

- `app/api/` handles HTTP methods, authentication, validation, rate limits, authorization, and response codes.
- `services/` implements auth, catalogue, products, vendor applications/products, carts, checkout, orders, reviews, addresses, and audit operations.
- Social behavior is implemented in focused services for friendships, privacy, lists, recommendations, reading progress, trusted ratings, seller passports, comparisons, and the read-only advisor.
- `lib/authorization.ts` centralizes authenticated-role and ownership checks.
- `lib/api.ts` bounds JSON request bodies and provides safe error handling.
- `lib/request-security.ts` checks `Origin` on browser mutations.
- `lib/rate-limit.ts` applies per-process request windows to sensitive writes.
- `lib/prisma.ts` shares a Prisma Client; PostgreSQL operations are enabled only when `DATABASE_URL` is set.
- `lib/mock-store.ts` contains process-local development data.
- `prisma/schema.prisma` defines users, sessions, vendors/applications, products, inventory, carts, wishlists, addresses, orders, payments, reviews, and audit logs. The older `Book` model remains for storefront compatibility.

## Authentication and authorization

New passwords are hashed with bcrypt. Existing scrypt hashes are verified and upgraded after a successful login. Sessions use random opaque tokens; only their SHA-256 hashes are stored in the database, and the browser receives an HTTP-only, SameSite cookie with a seven-day expiry. Logout deletes the backing session. In mock mode, session records live in process memory.

Routes use centralized role helpers. Vendor product services scope records by the authenticated vendor's profile; customer cart, address, wishlist, and order operations derive the owner from the session. Vendor product publishing and public product discovery require an approved vendor. New sign-ups receive the `CUSTOMER` role.

The application configures a Content Security Policy and standard browser security headers. HSTS is sent only in production. Cookie-authenticated mutation routes reject mismatched `Origin` headers when present. JSON request bodies are capped at 1 MB. The in-memory rate limiter is process-local and must be replaced with a shared store for multi-instance deployments.

Social reads apply both record-level visibility and account-level settings in the service layer. Purchase aggregates are anonymous and opt-in; friends-only reading completion is restricted to accepted friends; notes are returned only to their owner. Demo social accounts and comparison fixtures are not seeded in production.

## Data and checkout

The existing `Book` model remains available to avoid breaking the current storefront. The newer relational product catalogue uses `Product`, `Category`, `ProductImage`, and `Inventory`. Product prices use PostgreSQL decimal values. Product cart lines keep an informational price snapshot; checkout reloads authoritative product and book prices.

Database checkout creates one order with item-level vendor ownership, decrements legacy book stock conditionally, and uses an optimistic inventory update for products within a transaction. A failed inventory update aborts the order transaction. A simulated INR payment and audit event are recorded in the same transaction. Eligible cancellations restore inventory and mark the simulated payment refunded. No external payment provider is integrated.

## API endpoints

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Mock/database readiness |
| `/api/auth/register` | POST | Create a customer account |
| `/api/auth/login` | POST | Authenticate and issue a session |
| `/api/auth/logout` | POST | Revoke the current session |
| `/api/auth/me` | GET | Read current session |
| `/api/auth` | GET, POST, DELETE | Backwards-compatible auth route |
| `/api/products` | GET | Validated catalogue search and pagination |
| `/api/products/:slug` | GET | Public active product details |
| `/api/products/:slug/reviews` | GET, POST | Product reviews and verified-purchase review creation |
| `/api/categories` | GET | Public catalogue categories |
| `/api/books` | GET, POST | Legacy book listing and admin creation |
| `/api/books/:id` | GET, DELETE | Legacy book details/deactivation |
| `/api/books/:id/social` | GET | Community reviews and viewer-scoped network signals |
| `/api/books/:id/reviews` | GET, POST | Visible reviews and verified-purchase review creation |
| `/api/books/:id/passport` | GET | Product/seller passport and seller comparison |
| `/api/products/:slug/social` | GET | Community reviews and viewer-scoped social signals |
| `/api/products/:slug/passport` | GET | Product/seller passport and seller comparison |
| `/api/products/:slug/sellers` | GET | Compare active sellers for the same ISBN |
| `/api/vendors/:id/passport` | GET | Public seller trust information |
| `/api/social/friends` | GET, POST | List friends or send a request |
| `/api/social/friends/:id` | PATCH, DELETE | Respond to or remove a request/friendship |
| `/api/social/recommendations` | GET, POST | Recipient-scoped recommendations |
| `/api/privacy` | GET, PATCH | Read/update account-level social privacy |
| `/api/lists` | GET, POST | List/create reading lists |
| `/api/lists/:id` | GET, PATCH, DELETE | Read/update/delete an authorized list |
| `/api/lists/:id/items` | POST | Add a list item |
| `/api/lists/:id/items/:itemId` | DELETE | Remove a list item |
| `/api/lists/:id/members` | POST | Add a list member |
| `/api/lists/:id/members/:userId` | PATCH, DELETE | Update/remove a list member |
| `/api/reading-progress` | GET, POST | Read/update visible reading progress |
| `/api/ai/chat` | POST | Deterministic, read-only shopping advisor |
| `/api/cart` | GET, POST | Legacy book cart |
| `/api/cart/:bookId` | PATCH, DELETE | Legacy cart item mutation |
| `/api/cart/items` | POST | Add a relational product to the cart |
| `/api/cart/items/:id` | PATCH, DELETE | Update/remove a product cart item |
| `/api/wishlist` | GET | Read the current user's wishlist |
| `/api/wishlist/:productId` | POST, DELETE | Add/remove a wishlist item |
| `/api/addresses` | GET, POST | List or create the current user's addresses |
| `/api/addresses/:id` | PATCH, DELETE | Update/delete an owned address |
| `/api/checkout` | POST | Create an order and simulated payment |
| `/api/orders` | GET | List the current user's orders |
| `/api/orders/:id` | GET | Read an owned order |
| `/api/orders/:id/cancel` | POST | Cancel an eligible order |
| `/api/vendors` | GET | List approved vendors |
| `/api/vendors/:id` | GET | Public approved vendor details |
| `/api/vendor/applications` | GET, POST | Submit/read the current user's application |
| `/api/vendor/products` | GET, POST | List/create products for the current vendor |
| `/api/vendor/products/:id` | GET, PATCH, DELETE | Read/update/deactivate an owned product |
| `/api/admin/vendor-applications` | GET | List applications for administrators |
| `/api/admin/vendor-applications/:id` | PATCH | Approve or reject an application |
| `/api/admin/vendors/:id/suspend` | PATCH | Suspend a vendor |
| `/api/admin/overview` | GET | Marketplace summary metrics |

The `/api/products` mock-mode catalogue adapts the existing curated books. Relational vendor product management requires PostgreSQL; it returns a service-unavailable error rather than pretending to persist changes in mock mode.

## Social shopping and trusted commerce

The social layer extends the same route → service → Prisma pattern; nothing existing was replaced. See `docs/social-shopping.md` for the full specification mapping.

- **Privacy**: `SocialPrivacy` stores account-level settings (reviews / purchases / reading / default list visibility). Effective review visibility is the stricter of the review's own visibility and the author's setting, computed in `services/privacy.service.ts` and applied on every review-listing path.
- **Friends**: `Friendship` (PENDING / ACCEPTED / DECLINED / BLOCKED) with self-, duplicate- and unauthorized-modification guards in `services/friend.service.ts`.
- **Trusted rating**: community rating counts effectively-public reviews; network rating counts only reviews visible to the viewer through accepted friendships. Friend recommendations and the “people in your network own this” aggregate are computed from real rows, with purchase aggregates gated on the owner's `LIMITED` purchase privacy.
- **Passports and comparison**: `services/sellerPassport.service.ts` derives an explainable score from orders, reviews and listings (documented weights; “Not enough data” rather than invented numbers), and `services/sellerComparison.service.ts` groups sellers strictly by ISBN with a documented trust/price ranking that never recommends a seller without trust data.
- **AI advisor**: `services/ai.service.ts` exposes five allowlisted read-only tools behind `/api/ai/chat`; there is no direct database access and no write capability.
- **MarketShield**: `services/marketShield.service.ts` records burst/cluster signals for admin review only (`/api/admin/security-signals`); customer responses never include telemetry.

Demo accounts for local exploration (mock mode and `prisma/seed.ts`): `ava@markethub.test`, `rahul@markethub.test`, `ananya@markethub.test`, `kiran@markethub.test` — password `Demo1234!`. These demo identities exist only in the seeded/demo datasets and must not be seeded in production.

## Local setup

1. Copy `.env.example` to `.env`. Leave `DATABASE_URL` empty to use mock mode.
2. For PostgreSQL, configure `DATABASE_URL`, then run `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed`.
3. Start the app with `pnpm dev` and inspect `/api/health`.

Mock data is not shared across server processes. Production deployments should use PostgreSQL and a distributed rate-limit store. Payment simulation, vendor/admin dashboard UI, and the remaining advanced marketplace workflows are not substitutes for a real payment integration or a complete production marketplace.
