import { NextResponse } from 'next/server'
import { DomainError } from './domain-error'

export function apiError(error: unknown, message = 'The request could not be completed.') {
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
  try {
    body = await request.json()
  } catch {
    throw new DomainError('Request body must contain valid JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DomainError('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}
