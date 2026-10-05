import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { isDatabaseConfigured } from '@/lib/prisma'
import { listVendors } from '@/services/vendors'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ data: await listVendors(), source: isDatabaseConfigured ? 'postgresql' : 'mock' })
  } catch (error) {
    return apiError(error, 'Unable to load sellers.')
  }
}
