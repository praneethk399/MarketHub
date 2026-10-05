# MarketHub

An editorial independent-bookstore marketplace built with Next.js, React, TypeScript, and Tailwind CSS. The storefront runs against local mock data by default; optional PostgreSQL persistence is available through Prisma.

## Requirements

- Node.js 20.9 or newer
- Corepack-enabled package manager (`pnpm`)

## Run locally

```powershell
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000/books`.

## Optional PostgreSQL

Copy `.env.example` to `.env`, set a strong `SESSION_SECRET`, and configure `DATABASE_URL` with your PostgreSQL connection string. Then prepare the schema and seed the catalogue:

```powershell
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm db:seed
```

Without `DATABASE_URL`, the API uses in-process mock data. See [the backend architecture guide](./docs/backend-architecture.md) for the API routes, persistence behavior, and security notes.

## Validation

```powershell
corepack pnpm build
```
