# MarketHub backend

The app uses Next.js route handlers as its REST API, domain services as the business-logic boundary, Prisma as the persistence client, and PostgreSQL as the configured database. The existing bookstore catalogue remains the local fallback when `DATABASE_URL` is unset.

## Layers

- `app/api/`: HTTP routes, request validation, authorization checks, and response codes.
- `services/`: authentication, products, cart, checkout/orders, vendors, and admin operations.
- `lib/prisma.ts`: shared Prisma client; database operations are enabled only when `DATABASE_URL` is set.
- `lib/mock-store.ts`: process-local mock backing store for development without PostgreSQL.
- `prisma/schema.prisma`: PostgreSQL schema for accounts, vendors, books, carts, and orders.

## REST endpoints

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Mock/database readiness check |
| `/api/auth` | GET, POST, DELETE | Read session, register/login, sign out |
| `/api/books` | GET, POST | Browse catalogue; admin creates a book |
| `/api/books/:id` | GET, DELETE | Read or deactivate a book |
| `/api/vendors` | GET | Browse sellers |
| `/api/vendors/:id` | GET | Seller details |
| `/api/cart` | GET, POST | Read cart; add or replace a line quantity |
| `/api/cart/:bookId` | PATCH, DELETE | Change quantity or remove a line |
| `/api/checkout` | POST | Validate stock, create an order, and clear cart |
| `/api/orders` | GET | Current account's orders |
| `/api/orders/:id` | GET | Read an owned order |
| `/api/admin/overview` | GET | Admin-only marketplace metrics |

All private endpoints require the signed, HTTP-only `markethub_session` cookie. New registrations are customer accounts; assign `VENDOR` or `ADMIN` roles through trusted database administration, never from public request input. Checkout uses a database transaction when PostgreSQL is configured.

## Run locally

1. Copy `.env.example` to `.env` and set `SESSION_SECRET` to a random secret. Leave `DATABASE_URL` unset to use mock mode.
2. With PostgreSQL available, set `DATABASE_URL`, then run `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed` to load the local catalogue and mock sellers.
3. Start the app with `pnpm dev`; check `/api/health`.

Mock records live in the server process and are reset when it restarts. They are intended for local development and are not shared across multiple server instances. A configured database connection failure is returned as an error rather than silently falling back to mock data.
