import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAuth, requireAdmin } from '@/lib/authorization'
import { listSecuritySignals } from '@/services/marketShield.service'

export const dynamic = 'force-dynamic'

/**
 * MarketShield telemetry — ADMIN ONLY (spec §31). This is the only endpoint
 * that ever returns security signals; no customer-facing response includes
 * internal fraud-detection data.
 */
export async function GET() {
  try {
    const user = requireAdmin(await requireAuth())
    void user
    return NextResponse.json({ success: true, data: await listSecuritySignals() })
  } catch (error) {
    return apiError(error, 'Unable to load security signals.')
  }
}
