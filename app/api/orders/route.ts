import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { listOrders } from '@/services/orders'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ data: await listOrders(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your orders.')
  }
}
