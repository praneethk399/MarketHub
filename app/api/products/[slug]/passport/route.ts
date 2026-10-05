import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { getProductPassport } from '@/services/productPassport.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const passport = await getProductPassport({ targetType: 'PRODUCT', targetId: slug })
    if (!passport) return notFound('Product')
    return NextResponse.json({ success: true, data: passport })
  } catch (error) {
    return apiError(error, 'Unable to load the product passport.')
  }
}
