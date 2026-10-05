import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject, unauthorized } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { firstValidationError, authRequestSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginOnly } from '@/lib/request-security'
import { authenticateUser, clearSessionCookie, readSession, registerUser, setSessionCookie } from '@/services/auth'
import { recordAuditEvent } from '@/services/audit'

export async function GET() {
  try {
    const user = await readSession()
    return NextResponse.json({ success: true, data: { user }, user })
  } catch (error) {
    return apiError(error, 'Unable to read the current session.')
  }
}

export async function POST(request: Request) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    const rateLimitError = rateLimit(request, { namespace: 'auth', limit: 10, windowMs: 15 * 60 * 1000 })
    if (rateLimitError) return rateLimitError
    const body = await readJsonObject(request)
    const parsed = authRequestSchema.safeParse(body)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const input = parsed.data

    const user = input.action === 'register'
      ? await registerUser(input.name, input.email, input.password)
      : await authenticateUser(input.email, input.password)
    if (!user) return unauthorized()
    await recordAuditEvent(user.id, input.action === 'register' ? 'USER_REGISTERED' : 'USER_LOGIN', 'User', user.id, request)
    return await setSessionCookie(NextResponse.json({ success: true, data: { user }, user }), user)
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to complete authentication.')
  }
}

export async function DELETE(request: Request) {
  const originError = sameOriginOnly(request)
  if (originError) return originError
  try {
    const user = await readSession()
    const response = await clearSessionCookie(NextResponse.json({ success: true, data: { signedOut: true }, signedOut: true }))
    if (user) await recordAuditEvent(user.id, 'USER_LOGOUT', 'User', user.id, request)
    return response
  } catch (error) {
    return apiError(error, 'Unable to sign out.')
  }
}
