import { NextResponse } from 'next/server'
import { apiFailure } from './api'

export function sameOriginOnly(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  if (!origin) return null

  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || request.headers.get('host')
  if (!host) return apiFailure('Invalid request origin.', 403)

  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || new URL(request.url).protocol.replace(':', '')
  let expectedOrigin: string
  try {
    expectedOrigin = new URL(`${protocol}://${host}`).origin
  } catch {
    return apiFailure('Invalid request origin.', 403)
  }

  try {
    if (new URL(origin).origin === expectedOrigin) return null
  } catch {
    return apiFailure('Invalid request origin.', 403)
  }
  return apiFailure('Cross-origin requests are not allowed.', 403)
}
