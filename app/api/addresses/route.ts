import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, addressSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { recordAuditEvent } from '@/services/audit'
import { createAddress, listAddresses } from '@/services/addresses'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await listAddresses(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your addresses.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'address-write', limit: 30, windowMs: 60 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const parsed = addressSchema.safeParse(await readJsonObject(request))
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const address = await createAddress(user.id, parsed.data)
    await recordAuditEvent(user.id, 'ADDRESS_CREATED', 'Address', address.id, request)
    return NextResponse.json({ success: true, data: address }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to save the address.')
  }
}
