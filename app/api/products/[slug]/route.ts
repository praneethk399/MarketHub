import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { getCatalogProduct } from '@/services/catalog'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const product = await getCatalogProduct(slug)
    return product
      ? NextResponse.json({ success: true, data: product })
      : notFound('Product')
  } catch (error) {
    return apiError(error, 'Unable to load the product.')
  }
}
