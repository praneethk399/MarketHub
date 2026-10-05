import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireVendor } from '@/lib/authorization'
import { firstValidationError, createProductSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { createVendorProduct, listVendorProducts } from '@/services/vendor-products'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const vendor = requireVendor(await requireAuth())
    return NextResponse.json({ success: true, data: await listVendorProducts(vendor.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your products.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-product-write', limit: 30, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const vendor = requireVendor(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = createProductSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    return NextResponse.json({ success: true, data: await createVendorProduct(vendor.id, parsed.data) }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to create the product.')
  }
}
