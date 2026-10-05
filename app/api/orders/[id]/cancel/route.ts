import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { cancelOrder } from '@/services/orders'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'order-cancel', limit: 5, windowMs: 15 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    return NextResponse.json({ success: true, data: await cancelOrder(user.id, id) })
  } catch (error) {
    return apiError(error, 'Unable to cancel the order.')
  }
}
