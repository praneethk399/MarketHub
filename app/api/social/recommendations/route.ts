import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, recommendationSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { listRecommendations, sendRecommendation } from '@/services/recommendation.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await listRecommendations(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load recommendations.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'recommendation', limit: 20, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = recommendationSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const recommendation = await sendRecommendation({
      senderId: user.id,
      recipientId: parsed.data.recipientId,
      recipientEmail: parsed.data.recipientEmail,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      message: parsed.data.message,
    })
    return NextResponse.json({ success: true, data: recommendation }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to send the recommendation.')
  }
}
