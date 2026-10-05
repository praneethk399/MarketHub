import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject } from '@/lib/api'
import { firstValidationError, aiChatSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { readSession } from '@/services/auth'
import { advise } from '@/services/ai.service'

export const dynamic = 'force-dynamic'

/**
 * AI Shopping Advisor endpoint (spec §28).
 * The model-equivalent is a deterministic decision engine over five
 * allowlisted, read-only tools — see services/ai.service.ts. The viewer
 * identity comes from the session only; the client can never inject one.
 */
export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'ai-chat', limit: 15, windowMs: 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const body = await readJsonObject(request)
    const parsed = aiChatSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const viewer = await readSession()
    const result = await advise(parsed.data.message, { viewerId: viewer?.id ?? null })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return apiError(error, 'The advisor could not complete that request.')
  }
}
