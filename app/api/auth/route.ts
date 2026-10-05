import { NextResponse } from 'next/server'
import { apiError, badRequest, readJsonObject, unauthorized } from '@/lib/api'
import { DomainError } from '@/lib/domain-error'
import { authenticateUser, clearSessionCookie, readSession, registerUser, setSessionCookie } from '@/services/auth'

export async function GET() {
  try {
    return NextResponse.json({ user: await readSession() })
  } catch (error) {
    return apiError(error, 'Unable to read the current session.')
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request)
    const action = body.action
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('Enter a valid email address.')
    if (password.length < 8 || password.length > 128) return badRequest('Password must contain between 8 and 128 characters.')
    if (action === 'register' && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80)) {
      return badRequest('Name must be between 2 and 80 characters.')
    }

    const user = action === 'register'
      ? await registerUser(typeof body.name === 'string' ? body.name : '', email, password)
      : action === 'login'
        ? await authenticateUser(email, password)
        : null

    if (action !== 'register' && action !== 'login') return badRequest('Action must be "register" or "login".')
    if (!user) return unauthorized()
    return setSessionCookie(NextResponse.json({ user }), user)
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to complete authentication.')
  }
}

export async function DELETE() {
  return clearSessionCookie(NextResponse.json({ signedOut: true }))
}
