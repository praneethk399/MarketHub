import type { NextResponse } from 'next/server'
import { apiFailure } from './api'

type RateWindow = { count: number; resetAt: number }
type RateLimitOptions = { limit: number; windowMs: number; namespace: string }

const globalForRateLimit = globalThis as typeof globalThis & {
  marketHubRateWindows?: Map<string, RateWindow>
}
const windows = globalForRateLimit.marketHubRateWindows ?? new Map<string, RateWindow>()
globalForRateLimit.marketHubRateWindows = windows

export function rateLimit(request: Request, options: RateLimitOptions): NextResponse | null {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const key = `${options.namespace}:${address}`
  const now = Date.now()
  const current = windows.get(key)
  const window = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current

  window.count += 1
  windows.set(key, window)

  if (windows.size > 10_000) {
    for (const [entryKey, entry] of windows) {
      if (entry.resetAt <= now) windows.delete(entryKey)
    }
  }

  if (window.count <= options.limit) return null
  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000))
  const response = apiFailure('Too many requests. Please try again later.', 429)
  response.headers.set('Retry-After', String(retryAfter))
  return response
}
