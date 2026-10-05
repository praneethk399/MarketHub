# MarketHub

MarketHub is a bookstore marketplace that helps readers discover books from independent sellers. The storefront is built with Next.js, React, TypeScript, and Tailwind CSS, with optional PostgreSQL persistence through Prisma.

## Project presentation

The project presentation is available at [`docs/presentations/MarketHub-Secure-Bookstore.pptx`](./docs/presentations/MarketHub-Secure-Bookstore.pptx).

## Features

- Browse, search, filter, and sort a curated catalogue of books.
- Explore marketplace vendors and book availability.
- Use cart, checkout, and order APIs.
- Register and sign in with session-based authentication.
- Use the built-in mock data without configuring a database, or connect PostgreSQL for persistent data.
- Manage books and view marketplace metrics with an administrator account.

## Requirements

- Node.js 20.9 or newer
- Corepack-enabled `pnpm`

## Run locally

Install dependencies and start the development server:

```powershell
corepack pnpm install
corepack pnpm dev
```

Open [http://localhost:3000/books](http://localhost:3000/books). The install step automatically generates the Prisma Client.

## Data and database setup

By default, the app uses in-process mock data and does not require a database. Mock changes are held in the server process and reset when it restarts.

To use PostgreSQL:

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. Set `SESSION_SECRET` to a long, random secret.
4. Generate the client, apply the Prisma schema, and seed the catalogue:

   ```powershell
   corepack pnpm db:generate
   corepack pnpm db:push
   corepack pnpm db:seed
   ```

Do not commit `.env` or share its secrets. When a database URL is configured, database connection errors are returned rather than silently switching to mock data.

## Useful commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Run the development server |
| `corepack pnpm build` | Create a production build |
| `corepack pnpm start` | Run the production server |
| `corepack pnpm db:generate` | Generate Prisma Client |
| `corepack pnpm db:push` | Apply the Prisma schema to the configured database |
| `corepack pnpm db:seed` | Seed the database with catalogue data |
| `corepack pnpm db:studio` | Open Prisma Studio |

## API and architecture

The REST API is implemented with Next.js route handlers. Routes validate requests and enforce authorization, while domain services separate business logic from HTTP handling.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Check service and persistence health |
| `/api/auth` | GET, POST, DELETE | Read a session, register or sign in, and sign out |
| `/api/books` | GET, POST | Browse books; administrators can add books |
| `/api/books/:id` | GET, DELETE | Read or deactivate a book |
| `/api/vendors` | GET | Browse vendors |
| `/api/vendors/:id` | GET | Read vendor details |
| `/api/cart` | GET, POST | Read the cart or add an item |
| `/api/cart/:bookId` | PATCH, DELETE | Update or remove a cart item |
| `/api/checkout` | POST | Place an order |
| `/api/orders` | GET | List the signed-in user's orders |
| `/api/orders/:id` | GET | Read an order |
| `/api/admin/overview` | GET | Read administrator marketplace metrics |

Private endpoints use the signed, HTTP-only `markethub_session` cookie. New accounts are customers by default; privileged roles must be assigned through trusted administration.

See the [backend architecture guide](./docs/backend-architecture.md) for more detail.

## Validation

```powershell
corepack pnpm build
```
