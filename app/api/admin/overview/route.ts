import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdmin, requireAuth } from '@/lib/authorization'
import { getAdminOverview } from '@/services/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    requireAdmin(await requireAuth())
    return NextResponse.json({ data: await getAdminOverview() })
  } catch (error) {
    return apiError(error, 'Unable to load marketplace administration metrics.')
  }
}
