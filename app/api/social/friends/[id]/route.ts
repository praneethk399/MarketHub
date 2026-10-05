import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, friendActionSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { removeFriendship, respondToFriendRequest } from '@/services/friend.service'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'friend-action', limit: 30, windowMs: 10 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = friendActionSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const { id } = await params
    const result = await respondToFriendRequest(user.id, id, parsed.data.action)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'Unable to update the connection.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const user = requireCustomer(await requireAuth())
    const { id } = await params
    await removeFriendship(user.id, id)
    return NextResponse.json({ success: true, data: { friendshipId: id, removed: true } })
  } catch (error) {
    return apiError(error, 'Unable to remove the connection.')
  }
}
