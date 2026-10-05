import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { compareSellers } from '@/services/sellerComparison.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const comparison = await compareSellers({ targetType: 'PRODUCT', targetId: slug })
    if (!comparison) return notFound('Product')
    return NextResponse.json({ success: true, data: comparison })
  } catch (error) {
    return apiError(error, 'Unable to load seller comparison.')
  }
}
