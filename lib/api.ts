import { NextResponse } from 'next/server'
import { DomainError } from './domain-error'

export function apiError(error: unknown, message = 'The request could not be completed.') {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('[MarketHub API]', error)
  return NextResponse.json({ error: message }, { status: 500 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'You do not have permission to perform this action.' }, { status: 403 })
}

export function notFound(resource = 'Resource') {
  return NextResponse.json({ error: `${resource} not found.` }, { status: 404 })
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
    throw new DomainError('Request body must be no larger than 1 MB.', 413)
  }

  const reader = request.body?.getReader()
  if (!reader) throw new DomainError('Request body must contain valid JSON.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1_048_576) {
        await reader.cancel()
        throw new DomainError('Request body must be no larger than 1 MB.', 413)
      }
      chunks.push(value)
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw new DomainError('Request body must contain valid JSON.')
  } finally {
    reader.releaseLock()
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DomainError('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}
