import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAuth, requireCustomer } from '@/lib/authorization'
import { getWishlist } from '@/services/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = requireCustomer(await requireAuth())
    return NextResponse.json({ success: true, data: await getWishlist(user.id) })
  } catch (error) {
    return apiError(error, 'Unable to load your wishlist.')
  }
}
