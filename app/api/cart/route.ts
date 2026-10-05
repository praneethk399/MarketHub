import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject, unauthorized } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { readSession } from '@/services/auth'
import { getCart, setCartQuantity } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    return NextResponse.json(await getCart(user.id))
  } catch (error) {
    return apiError(error, 'Unable to load your cart.')
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    const body = await readJsonObject(request) as { bookId?: unknown; quantity?: unknown }
    if (typeof body.bookId !== 'string' || !body.bookId.trim()) return badRequest('A book id is required.')
    const quantity = body.quantity === undefined ? 1 : body.quantity
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) return badRequest('Quantity must be a positive whole number.')
    const cart = await getCart(user.id)
    const currentQuantity = cart.items.find((item) => item.bookId === body.bookId)?.quantity ?? 0
    return NextResponse.json(await setCartQuantity(user.id, body.bookId, currentQuantity + quantity), { status: 201 })
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to update your cart.')
  }
}
