import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { checkout } from '@/services/orders'

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'checkout', limit: 5, windowMs: 15 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ data: await checkout(user.id) }, { status: 201 })
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Checkout could not be completed.')
  }
}
