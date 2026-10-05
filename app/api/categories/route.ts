import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { listCatalogCategories } from '@/services/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await listCatalogCategories() })
  } catch (error) {
    return apiError(error, 'Unable to load categories.')
  }
}
