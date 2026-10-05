import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  marketHubPrisma?: PrismaClient
}

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL?.trim())

export const prisma = globalForPrisma.marketHubPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.marketHubPrisma = prisma
}
