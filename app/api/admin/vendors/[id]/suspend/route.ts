import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdmin, requireAuth } from '@/lib/authorization'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { suspendVendor } from '@/services/vendor-applications'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'vendor-review', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const admin = requireAdmin(await requireAuth())
    const { id } = await params
    return NextResponse.json({ success: true, data: await suspendVendor(admin.id, id) })
  } catch (error) {
    return apiError(error, 'Unable to suspend the vendor.')
  }
}
