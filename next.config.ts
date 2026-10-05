import { cpus, totalmem } from 'node:os'
import type { NextConfig } from 'next'

/**
 * Turbopack worker count.
 *
 * Hard-coding 2 left most cores idle and made builds slow. Every worker runs
 * its own V8 heap, though, and a worker the OS has to kill surfaces as
 * "Panic in async function" or "Jest worker encountered N child process
 * exceptions" rather than a useful error — so the pool is sized from the
 * machine instead of from a constant: one core is left for the dev server and
 * the editor, and the pool is kept inside a quarter of installed memory.
 */
const workerCount = Math.max(1, Math.min(cpus().length - 1, Math.floor(totalmem() / 1024 ** 3 / 4), 6))

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { cpus: workerCount },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://images.unsplash.com https://covers.openlibrary.org",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ') },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' })
    }
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
      },
    ],
  },
}

export default nextConfig
