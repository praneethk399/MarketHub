import { NextResponse } from 'next/server'
import { DomainError } from './domain-error'

export function apiError(error: unknown, message = 'The request could not be completed.') {
  if (error instanceof DomainError) {
    return apiFailure(error.message, error.status)
  }
  console.error('[MarketHub API]', error)
  return apiFailure(message, 500)
}

export function apiFailure(message: string, status: number) {
  const code = status === 400 ? 'BAD_REQUEST'
    : status === 401 ? 'UNAUTHORIZED'
      : status === 403 ? 'FORBIDDEN'
        : status === 404 ? 'NOT_FOUND'
          : status === 409 ? 'CONFLICT'
            : status === 413 ? 'PAYLOAD_TOO_LARGE'
              : status === 429 ? 'RATE_LIMITED'
                : status === 503 ? 'SERVICE_UNAVAILABLE'
                  : 'INTERNAL_SERVER_ERROR'
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

export function badRequest(message: string) {
  return apiFailure(message, 400)
}

export function unauthorized() {
  return apiFailure('Sign in to continue.', 401)
}

export function forbidden() {
  return apiFailure('You do not have permission to perform this action.', 403)
}

export function notFound(resource = 'Resource') {
  return apiFailure(`${resource} not found.`, 404)
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
    throw new DomainError('Request body must be no larger than 1 MB.', 413)
  }

  const reader = request.body?.getReader()
  if (!reader) throw new DomainError('Request body must contain valid JSON.')
  const decoder = new TextDecoder()
  let raw = ''
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
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw new DomainError('Request body must contain valid JSON.')
  } finally {
    reader.releaseLock()
  }
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    throw new DomainError('Request body must contain valid JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DomainError('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}
