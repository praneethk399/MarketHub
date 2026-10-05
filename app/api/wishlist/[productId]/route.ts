import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { DomainError } from '@/lib/domain-error'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { recordAuditEvent } from '@/services/audit'
import { addWishlistProduct, removeWishlistProduct } from '@/services/catalog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'wishlist-write', limit: 30, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { productId } = await params
    if (!productId || productId.length > 128) throw new DomainError('Invalid product id.')
    if (!await addWishlistProduct(user.id, productId)) return notFound('Product')
    await recordAuditEvent(user.id, 'WISHLIST_ITEM_ADDED', 'Product', productId, request)
    return NextResponse.json({ success: true, data: { productId, saved: true } }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to save the product.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'wishlist-write', limit: 30, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { productId } = await params
    if (!productId || productId.length > 128) throw new DomainError('Invalid product id.')
    if (!await removeWishlistProduct(user.id, productId)) return notFound('Wishlist item')
    await recordAuditEvent(user.id, 'WISHLIST_ITEM_REMOVED', 'Product', productId, request)
    return NextResponse.json({ success: true, data: { productId, saved: false } })
  } catch (error) {
    return apiError(error, 'Unable to remove the product from your wishlist.')
  }
}
