import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdmin, requireAuth } from '@/lib/authorization'
import { listVendorApplications } from '@/services/vendor-applications'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    requireAdmin(await requireAuth())
    return NextResponse.json({ success: true, data: await listVendorApplications() })
  } catch (error) {
    return apiError(error, 'Unable to load vendor applications.')
  }
}
