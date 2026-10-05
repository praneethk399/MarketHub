import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { getOrder } from '@/services/orders'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    const order = await getOrder(user.id, id)
    return order ? NextResponse.json({ data: order }) : notFound('Order')
  } catch (error) {
    return apiError(error, 'Unable to load the order.')
  }
}
