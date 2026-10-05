import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, productCartUpdateSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { removeProductCartItem, updateProductCartItem } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = productCartUpdateSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    return NextResponse.json({
      success: true,
      data: await updateProductCartItem(user.id, id, parsed.data.quantity),
    })
  } catch (error) {
    return apiError(error, 'Unable to update the cart item.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    return NextResponse.json({
      success: true,
      data: await removeProductCartItem(user.id, id),
    })
  } catch (error) {
    return apiError(error, 'Unable to remove the cart item.')
  }
}
