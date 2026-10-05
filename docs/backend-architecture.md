# MarketHub backend

MarketHub uses Next.js Route Handlers for REST endpoints, services for business logic, Prisma for PostgreSQL persistence, and process-local mock services for the legacy bookstore experience when `DATABASE_URL` is unset.

## Boundaries

- `app/api/` handles HTTP methods, authentication, validation, rate limits, authorization, and response codes.
- `services/` implements auth, catalogue, products, vendor applications/products, carts, checkout, orders, reviews, addresses, and audit operations.
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

## Local setup

1. Copy `.env.example` to `.env`. Leave `DATABASE_URL` empty to use mock mode.
2. For PostgreSQL, configure `DATABASE_URL`, then run `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed`.
3. Start the app with `pnpm dev` and inspect `/api/health`.

Mock data is not shared across server processes. Production deployments should use PostgreSQL and a distributed rate-limit store. Payment simulation, vendor/admin dashboard UI, and the remaining advanced marketplace workflows are not substitutes for a real payment integration or a complete production marketplace.
