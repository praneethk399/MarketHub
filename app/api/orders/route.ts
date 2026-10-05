import { NextResponse } from 'next/server'
import { apiError, unauthorized } from '@/lib/api'
import { readSession } from '@/services/auth'
import { listOrders } from '@/services/orders'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    return NextResponse.json({ data: await listOrders(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your orders.')
  }
}
