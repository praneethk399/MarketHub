import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { getSellerPassport } from '@/services/sellerPassport.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const passport = await getSellerPassport(id)
    if (!passport) return notFound('Seller')
    return NextResponse.json({ success: true, data: passport })
  } catch (error) {
    return apiError(error, 'Unable to load the seller passport.')
  }
}
