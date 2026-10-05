import { NextResponse } from 'next/server'
import { apiError, forbidden, notFound, unauthorized } from '@/lib/api'
import { readSession } from '@/services/auth'
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    if (user.role !== 'ADMIN') return forbidden()
    const { id } = await params
    const removed = await removeProduct(id)
    return removed ? NextResponse.json({ deleted: true }) : notFound('Book')
  } catch (error) {
    return apiError(error, 'Unable to remove the book.')
  }
}
