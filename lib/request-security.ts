import { NextResponse } from 'next/server'

export function sameOriginOnly(request: Request): NextResponse | null {
  const origin = request.headers.get('origin')
  if (!origin) return null

  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || request.headers.get('host')
  if (!host) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })

  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || new URL(request.url).protocol.replace(':', '')
  let expectedOrigin: string
  try {
    expectedOrigin = new URL(`${protocol}://${host}`).origin
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  try {
    if (new URL(origin).origin === expectedOrigin) return null
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  return NextResponse.json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 })
}
