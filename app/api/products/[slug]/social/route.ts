import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { readSession } from '@/services/auth'
import { DomainError } from '@/lib/domain-error'
import { getTrustedSummary, listVisibleReviews } from '@/services/trusted-rating.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const viewer = await readSession()
    const summary = await getTrustedSummary({ targetType: 'PRODUCT', targetId: slug, viewerId: viewer?.id ?? null })
    const reviews = await listVisibleReviews({ targetType: 'PRODUCT', targetId: slug, viewerId: viewer?.id ?? null })
    return NextResponse.json({ success: true, data: { ...summary, reviews } })
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) return notFound('Product')
    return apiError(error, 'Unable to load social information for this product.')
  }
}
