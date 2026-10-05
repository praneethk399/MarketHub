import { NextResponse } from 'next/server'
import { apiError, badRequest, notFound, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, reviewSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { readSession } from '@/services/auth'
import { DomainError } from '@/lib/domain-error'
import { createBookReview } from '@/services/reviews'
import { listVisibleReviews } from '@/services/trusted-rating.service'
import { resolveTarget } from '@/services/social-targets'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const book = await resolveTarget('BOOK', id)
    if (!book) return notFound('Book')
    const viewer = await readSession()
    const reviews = await listVisibleReviews({ targetType: 'BOOK', targetId: id, viewerId: viewer?.id ?? null })
    return NextResponse.json({ success: true, data: reviews })
  } catch (error) {
    return apiError(error, 'Unable to load reviews.')
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'book-review', limit: 5, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    const review = await createBookReview(user.id, id, parsed.data)
    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) return notFound('Book')
    return apiError(error, 'Unable to create the review.')
  }
}
