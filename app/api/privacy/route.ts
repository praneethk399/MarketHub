import { NextResponse } from 'next/server'
import { apiError, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { assertPrivacyPatch, getPrivacy, updatePrivacy, RECOMMENDATION_VISIBILITY } from '@/services/privacy.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    const settings = await getPrivacy(user.id)
    return NextResponse.json({
      success: true,
      data: { ...settings, recommendations: RECOMMENDATION_VISIBILITY },
    })
  } catch (error) {
    return apiError(error, 'Unable to load privacy settings.')
  }
}

export async function PATCH(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'privacy', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const patch = assertPrivacyPatch(body)
    const settings = await updatePrivacy(user.id, patch)
    return NextResponse.json({
      success: true,
      data: { ...settings, recommendations: RECOMMENDATION_VISIBILITY },
    })
  } catch (error) {
    return apiError(error, 'Unable to update privacy settings.')
  }
}
