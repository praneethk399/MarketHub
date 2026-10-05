import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireVendor } from '@/lib/authorization'
import { firstValidationError, updateProductSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { deactivateVendorProduct, getVendorProduct, updateVendorProduct } from '@/services/vendor-products'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const vendor = requireVendor(await requireAuth())
    const { id } = await params
    return NextResponse.json({ success: true, data: await getVendorProduct(vendor.id, id) })
  } catch (error) {
    return apiError(error, 'Unable to load the product.')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-product-write', limit: 30, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const vendor = requireVendor(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = updateProductSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    return NextResponse.json({ success: true, data: await updateVendorProduct(vendor.id, id, parsed.data) })
  } catch (error) {
    return apiError(error, 'Unable to update the product.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-product-write', limit: 30, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const vendor = requireVendor(await requireAuth())
    const { id } = await params
    return NextResponse.json({ success: true, data: await deactivateVendorProduct(vendor.id, id) })
  } catch (error) {
    return apiError(error, 'Unable to deactivate the product.')
  }
}
