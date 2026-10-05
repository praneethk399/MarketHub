import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { getProductPassport } from '@/services/productPassport.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const passport = await getProductPassport({ targetType: 'BOOK', targetId: id })
    if (!passport) return notFound('Book')
    return NextResponse.json({ success: true, data: passport })
  } catch (error) {
    return apiError(error, 'Unable to load the product passport.')
  }
}
