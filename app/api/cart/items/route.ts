import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, productCartAddSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { addProductToCart } from '@/services/cart'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'cart-write', limit: 60, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = productCartAddSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    return NextResponse.json({
      success: true,
      data: await addProductToCart(user.id, parsed.data.productId, parsed.data.quantity),
    }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to add the product to your cart.')
  }
}
