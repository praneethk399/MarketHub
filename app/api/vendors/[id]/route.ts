import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { getVendor } from '@/services/vendors'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const vendor = await getVendor(id)
    return vendor ? NextResponse.json({ data: vendor }) : notFound('Seller')
  } catch (error) {
    return apiError(error, 'Unable to load the seller.')
  }
}
