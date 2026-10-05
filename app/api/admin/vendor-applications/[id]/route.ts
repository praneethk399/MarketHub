import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAdmin, requireAuth } from '@/lib/authorization'
import { firstValidationError, vendorApplicationDecisionSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { reviewVendorApplication } from '@/services/vendor-applications'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-review', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const admin = requireAdmin(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = vendorApplicationDecisionSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    const result = await reviewVendorApplication(admin.id, id, parsed.data.decision, parsed.data.adminNotes)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'Unable to review the vendor application.')
  }
}
