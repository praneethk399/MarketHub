import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { getCart, setCartQuantity } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json(await getCart(user.id))
  } catch (error) {
    return apiError(error, 'Unable to load your cart.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request) as { bookId?: unknown; quantity?: unknown }
    if (typeof body.bookId !== 'string' || !body.bookId.trim()) return badRequest('A book id is required.')
    const quantity = body.quantity === undefined ? 1 : body.quantity
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return badRequest('Quantity must be a whole number between 1 and 100.')
    const cart = await getCart(user.id)
    const currentQuantity = cart.items.find((item) => item.bookId === body.bookId)?.quantity ?? 0
    return NextResponse.json(await setCartQuantity(user.id, body.bookId, currentQuantity + quantity), { status: 201 })
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to update your cart.')
  }
}
