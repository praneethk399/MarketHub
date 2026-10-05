import { NextResponse } from 'next/server'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ status: 'ok', persistence: 'mock' })
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', persistence: 'postgresql' })
  } catch (error) {
    console.error('[MarketHub API] Database health check failed.', error)
    return NextResponse.json({ status: 'error', persistence: 'postgresql', error: 'Database is unavailable.' }, { status: 503 })
  }
}
