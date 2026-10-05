import { NextResponse } from 'next/server'
import { apiError, notFound } from '@/lib/api'
import { requireAdmin, requireAuth } from '@/lib/authorization'
import { sameOriginOnly } from '@/lib/request-security'
import { getProduct, removeProduct } from '@/services/products'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const book = await getProduct(id)
    return book ? NextResponse.json({ data: book }) : notFound('Book')
  } catch (error) {
    return apiError(error, 'Unable to load the book.')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originError = sameOriginOnly(request)
    if (originError) return originError
    requireAdmin(await requireAuth())
    const { id } = await params
    const removed = await removeProduct(id)
    return removed ? NextResponse.json({ deleted: true }) : notFound('Book')
  } catch (error) {
    return apiError(error, 'Unable to remove the book.')
  }
}
