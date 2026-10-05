import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject, unauthorized } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { readSession } from '@/services/auth'
import { removeCartItem, setCartQuantity } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    const body = await readJsonObject(request) as { quantity?: unknown }
    if (typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity < 0) {
      return badRequest('Quantity must be a non-negative whole number.')
    }
    const { bookId } = await params
    return NextResponse.json(await setCartQuantity(user.id, bookId, body.quantity))
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to update your cart.')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    const { bookId } = await params
    return NextResponse.json(await removeCartItem(user.id, bookId))
  } catch (error) {
    return apiError(error, 'Unable to remove the item from your cart.')
  }
}
