import { NextResponse } from 'next/server'
import { apiError, forbidden, unauthorized } from '@/lib/api'
import { readSession } from '@/services/auth'
import { getAdminOverview } from '@/services/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    if (user.role !== 'ADMIN') return forbidden()
    return NextResponse.json({ data: await getAdminOverview() })
  } catch (error) {
    return apiError(error, 'Unable to load marketplace administration metrics.')
  }
}
