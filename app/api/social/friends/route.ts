import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { firstValidationError, friendRequestSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { createFriendRequest, listFriendships } from '@/services/friend.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await listFriendships(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load friends.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'friend-request', limit: 10, windowMs: 10 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const user = requireCustomer(await requireAuth())
    const body = await readJsonObject(request)
    const parsed = friendRequestSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const friendship = await createFriendRequest(user.id, parsed.data.email)
    return NextResponse.json({ success: true, data: friendship }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Unable to send the friend request.')
  }
}
