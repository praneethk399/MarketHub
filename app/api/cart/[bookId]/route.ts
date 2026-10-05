import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { removeCartItem, setCartQuantity } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request) as { quantity?: unknown }
    if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 100) {
      return badRequest('Quantity must be a whole number between 0 and 100.')
    }
    const { bookId } = await params
    return NextResponse.json(await setCartQuantity(user.id, bookId, body.quantity))
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to update your cart.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { bookId } = await params
    return NextResponse.json(await removeCartItem(user.id, bookId))
  } catch (error) {
    return apiError(error, 'Unable to remove the item from your cart.')
  }
}
