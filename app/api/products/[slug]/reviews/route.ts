import { NextResponse } from 'next/server'
import { apiError, badRequest, notFound, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, reviewSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { createVerifiedReview, listProductReviews } from '@/services/reviews'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const reviews = await listProductReviews(slug)
    return reviews === null
      ? notFound('Product')
      : NextResponse.json({ success: true, data: reviews })
  } catch (error) {
    return apiError(error, 'Unable to load product reviews.')
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'product-review', limit: 5, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { slug } = await params
    const review = await createVerifiedReview(user.id, slug, parsed.data)
    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to create the review.')
  }
}
