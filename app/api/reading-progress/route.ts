import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { assertReadingInput, getReadingProgress, listReadingProgress, upsertReadingProgress } from '@/services/social.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = requireCustomer(await requireAuth())
    const url = new URL(request.url)
    const targetType = url.searchParams.get('targetType') === 'PRODUCT' ? 'PRODUCT' as const : 'BOOK' as const
    const targetId = url.searchParams.get('targetId')
    const subjectId = url.searchParams.get('userId')
    if (targetId) {
      return NextResponse.json({ success: true, data: await getReadingProgress(user.id, targetType, targetId) })
    }
    return NextResponse.json({ success: true, data: await listReadingProgress(user.id, subjectId ?? undefined) })
  } catch (error) {
    return apiError(error, 'Unable to load reading progress.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'reading-progress', limit: 60, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = assertReadingInput(body)
    const progress = await upsertReadingProgress(user.id, parsed)
    return NextResponse.json({ success: true, data: progress }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to save reading progress.')
  }
}
