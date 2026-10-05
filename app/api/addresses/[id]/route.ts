import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, addressUpdateSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { recordAuditEvent } from '@/services/audit'
import { deleteAddress, updateAddress } from '@/services/addresses'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'address-write', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const parsed = addressUpdateSchema.safeParse(await readJsonObject(request))
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    const address = await updateAddress(user.id, id, parsed.data)
    await recordAuditEvent(user.id, 'ADDRESS_UPDATED', 'Address', id, request)
    return NextResponse.json({ success: true, data: address })
  } catch (error) {
    return apiError(error, 'Unable to update the address.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'address-write', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    const result = await deleteAddress(user.id, id)
    await recordAuditEvent(user.id, 'ADDRESS_DELETED', 'Address', id, request)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'Unable to delete the address.')
  }
}
