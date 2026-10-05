import { NextResponse } from 'next/server'
import { apiError, badRequest } from '@/lib/api'
import { firstValidationError } from '@/lib/validation'
import { listCatalogProducts, productQuerySchema } from '@/services/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const rawQuery = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = productQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return badRequest(firstValidationError(parsed.error))
    const result = await listCatalogProducts(parsed.data)
    return NextResponse.json({ success: true, data: result.items, pagination: result.pagination })
  } catch (error) {
    return apiError(error, 'Unable to load products.')
  }
}
