import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, vendorApplicationSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { recordAuditEvent } from '@/services/audit'
import { listMyVendorApplications, submitVendorApplication } from '@/services/vendor-applications'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await listMyVendorApplications(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your vendor applications.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-application', limit: 3, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = vendorApplicationSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const application = await submitVendorApplication(user.id, parsed.data)
    await recordAuditEvent(user.id, 'VENDOR_APPLIED', 'VendorApplication', application.id, request)
    return NextResponse.json({ success: true, data: application }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to submit your vendor application.')
  }
}
