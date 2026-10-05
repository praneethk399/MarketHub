# MarketHub

MarketHub is an independent-bookstore marketplace built with Next.js App Router, React, TypeScript, Tailwind CSS, and Prisma. Readers can discover books and manage their carts, wishlists, addresses, orders, and verified-purchase reviews. The backend supports local catalogue data and optional PostgreSQL persistence.

## Presentation

See the [MarketHub project presentation](./docs/presentations/MarketHub-Secure-Bookstore.pptx).

## Requirements

- Node.js 20.9 or newer
- Corepack-enabled `pnpm`

## Run locally

```powershell
corepack pnpm install
corepack pnpm dev
```

Open [http://localhost:3000/books](http://localhost:3000/books). The install hook generates Prisma Client automatically.

## Data and persistence

Without `DATABASE_URL`, the existing storefront catalogue and customer services use process-local mock data. Mock accounts, carts, orders, addresses, wishlists, and sessions reset when the server process restarts. Database-backed product/vendor management requires PostgreSQL.

To configure PostgreSQL:

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a PostgreSQL connection string.
3. Generate Prisma Client, apply the schema, and seed the legacy bookstore catalogue:

   ```powershell
   corepack pnpm db:generate
   corepack pnpm db:push
   corepack pnpm db:seed
   ```

Never commit `.env` or expose database credentials. A configured database connection failure is reported as an error; it does not silently fall back to mock data.

## Marketplace capabilities

- Search, filter, and sort the book catalogue.
- Register and sign in; authentication uses HTTP-only, SameSite cookies backed by expiring server-side sessions.
- Add and update book or product cart items; checkout calculates prices on the server and updates inventory in a database transaction.
- Use wishlists and manage customer-owned addresses.
- Submit vendor applications; administrators can approve or reject applications and suspend vendors.
- Approved vendors can manage products, images, and inventory through scoped APIs.
- Customers can review products only after a non-cancelled purchase; each customer may review a product once.
- Book detail pages combine verified-purchase reviews, privacy-scoped friend signals, seller/product passports, seller comparisons, and a read-only shopping advisor.
- The `/social` hub supports friend requests, privacy settings, shared lists, reading progress, and private recommendations.
- Checkout records a simulated INR payment; it does not charge a payment provider.

Product search and catalogue APIs use the relational `Product`, `Category`, and `Inventory` models when PostgreSQL is configured. In mock mode, they adapt the existing bookstore catalogue. Existing `/api/books` endpoints remain available for storefront compatibility.

## API overview

| Endpoint | Methods | Access and purpose |
| --- | --- | --- |
| `/api/health` | GET | Check mock or PostgreSQL readiness |
| `/api/auth/register` | POST | Register a customer |
| `/api/auth/login` | POST | Sign in |
| `/api/auth/logout` | POST | Revoke the current session |
| `/api/auth/me` | GET | Read the current session user |
| `/api/auth` | GET, POST, DELETE | Backwards-compatible session and auth endpoint |
| `/api/products` | GET | Search and paginate products |
| `/api/products/:slug` | GET | Read an active product from an approved vendor |
| `/api/products/:slug/reviews` | GET, POST | Read reviews or add a verified-purchase review |
| `/api/categories` | GET | List categories with active products |
| `/api/books` | GET, POST | Browse the legacy catalogue; admins can add a book |
| `/api/books/:id` | GET, DELETE | Read or deactivate a legacy book |
| `/api/books/:id/social` | GET | Read community reviews and viewer-scoped social signals |
| `/api/books/:id/reviews` | GET, POST | Read visible reviews or submit a verified-purchase review |
| `/api/books/:id/passport` | GET | Read product and seller trust information |
| `/api/products/:slug/social` | GET | Read community reviews and viewer-scoped social signals |
| `/api/products/:slug/passport` | GET | Read product and seller trust information |
| `/api/products/:slug/sellers` | GET | Compare active sellers for the same ISBN |
| `/api/vendors/:id/passport` | GET | Read public seller trust information |
| `/api/social/friends` | GET, POST | List friends or send a friend request |
| `/api/social/friends/:id` | PATCH, DELETE | Respond to or remove a friendship |
| `/api/social/recommendations` | GET, POST | Read or send recipient-scoped recommendations |
| `/api/privacy` | GET, PATCH | Read or update social privacy settings |
| `/api/lists` | GET, POST | List or create private/shared reading lists |
| `/api/lists/:id` | GET, PATCH, DELETE | Read or manage an authorized list |
| `/api/lists/:id/items` | POST | Add a list item |
| `/api/lists/:id/items/:itemId` | DELETE | Remove a list item |
| `/api/lists/:id/members` | POST | Add a list member |
| `/api/lists/:id/members/:userId` | PATCH, DELETE | Update/remove a list member |
| `/api/reading-progress` | GET, POST | Read or update privacy-scoped reading progress |
| `/api/ai/chat` | POST | Run the deterministic, read-only shopping advisor |
| `/api/cart` | GET, POST | Read or update legacy book cart lines |
| `/api/cart/:bookId` | PATCH, DELETE | Update or remove a legacy book cart line |
| `/api/cart/items` | POST | Add a product to the cart |
| `/api/cart/items/:id` | PATCH, DELETE | Update or remove a product cart item |
| `/api/wishlist` | GET | Read the current customer's wishlist |
| `/api/wishlist/:productId` | POST, DELETE | Add or remove a wishlist item |
| `/api/addresses` | GET, POST | List or add customer-owned addresses |
| `/api/addresses/:id` | PATCH, DELETE | Update or remove an owned address |
| `/api/checkout` | POST | Create an order, update inventory, and record simulated payment |
| `/api/orders` | GET | List the current customer's orders |
| `/api/orders/:id` | GET | Read an owned order |
| `/api/orders/:id/cancel` | POST | Cancel an eligible owned order and restore stock |
| `/api/vendors` | GET | Browse approved sellers |
| `/api/vendors/:id` | GET | Read public details for an approved seller |
| `/api/vendor/applications` | GET, POST | Read or submit the current customer's vendor application |
| `/api/vendor/products` | GET, POST | List or create products for the authenticated vendor |
| `/api/vendor/products/:id` | GET, PATCH, DELETE | Read, update, or deactivate an owned product |
| `/api/admin/vendor-applications` | GET | Review vendor applications |
| `/api/admin/vendor-applications/:id` | PATCH | Approve or reject an application |
| `/api/admin/vendors/:id/suspend` | PATCH | Suspend a vendor |
| `/api/admin/overview` | GET | Read marketplace summary metrics |

Private operations derive identity from the server-side session. Vendor product queries are scoped to the authenticated vendor, and order queries are scoped to the current customer. Vendor approval and customer ownership are checked on the server, not inferred from UI visibility.

## Useful commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Start the development server |
| `corepack pnpm build` | Build and type-check the Next.js app |
| `corepack pnpm typecheck` | Run the TypeScript checker |
| `corepack pnpm test` | Run unit and social privacy/security regression tests |
| `corepack pnpm start` | Start the production server |
| `corepack pnpm db:generate` | Generate Prisma Client |
| `corepack pnpm db:push` | Apply the Prisma schema |
| `corepack pnpm db:seed` | Seed the legacy catalogue and sellers |
| `corepack pnpm db:studio` | Open Prisma Studio |

## Architecture and security notes

See the [backend architecture guide](./docs/backend-architecture.md) and [Prisma schema](./prisma/schema.prisma). Authentication secrets are not stored in browser storage; passwords use bcrypt for new accounts, with legacy scrypt hashes upgraded at successful sign-in. Mutating cookie-authenticated routes validate request origin, sensitive endpoints are rate-limited, and security headers are configured in Next.js.

Social data is filtered in services by both review/list visibility and account-level privacy. Private reading notes are returned only to their owner; network review badges disclose friends-only completion only to accepted friends. Demo social accounts, review/order fixtures, and comparison offers are limited to non-production mock mode/seeding.

The rate limiter and mock persistence are process-local. Use a shared rate-limit store and durable PostgreSQL before deploying multiple application instances. Payment is simulated, not a real payment integration. The project includes API capabilities that are not yet surfaced in a complete vendor/admin dashboard UI.
