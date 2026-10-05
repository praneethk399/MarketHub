import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { readSession } from '@/services/auth'
import { DomainError } from '@/lib/domain-error'
import { getTrustedSummary, listVisibleReviews } from '@/services/trusted-rating.service'

export const dynamic = 'force-dynamic'

/**
 * One batched social payload for the product page (spec §40: avoid many
 * round-trips). Anonymous visitors get community data only; signed-in
 * viewers additionally get their privacy-scoped network signals.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const viewer = await readSession()
    const summary = await getTrustedSummary({ targetType: 'BOOK', targetId: id, viewerId: viewer?.id ?? null })
    const reviews = await listVisibleReviews({ targetType: 'BOOK', targetId: id, viewerId: viewer?.id ?? null })
    return NextResponse.json({
      success: true,
      data: { ...summary, reviews },
    })
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) return notFound('Book')
    return apiError(error, 'Unable to load social information for this book.')
  }
}
