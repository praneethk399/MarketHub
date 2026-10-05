import { NextResponse } from 'next/server'
import { apiError, badRequest, forbidden, readJsonObject, unauthorized } from '@/lib/api'
import { isDatabaseConfigured } from '@/lib/prisma'
import { DomainError } from '@/lib/domain-error'
import { readSession } from '@/services/auth'
import { listProducts, saveProduct } from '@/services/products'
import type { Book } from '@/data/books'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({ data: await listProducts(), source: isDatabaseConfigured ? 'postgresql' : 'mock' })
  } catch (error) {
    return apiError(error, 'Unable to load books.')
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSession()
    if (!user) return unauthorized()
    if (user.role !== 'ADMIN') return forbidden()
    const body = await readJsonObject(request) as Partial<Book>
    if (typeof body.id !== 'string' || !body.id.trim()
      || typeof body.title !== 'string' || !body.title.trim()
      || typeof body.author !== 'string' || !body.author.trim()
      || typeof body.cover !== 'string' || !body.cover.trim()
      || typeof body.category !== 'string' || !body.category.trim()) {
      return badRequest('Book id, title, author, cover, category, and format are required.')
    }
    if (body.format !== 'paperback' && body.format !== 'hardcover') return badRequest('Format must be paperback or hardcover.')
    if (body.status !== undefined && body.status !== 'in-stock' && body.status !== 'out-of-stock') {
      return badRequest('Status must be in-stock or out-of-stock.')
    }
    if (body.price !== undefined && body.price !== null && (!Number.isFinite(body.price) || body.price < 0)) {
      return badRequest('Price must be a non-negative number or null.')
    }
    if (body.stock !== undefined && body.stock !== null && (!Number.isInteger(body.stock) || body.stock < 0)) {
      return badRequest('Stock must be a non-negative whole number or null.')
    }
    if (body.rating !== undefined && (!Number.isFinite(body.rating) || body.rating < 0 || body.rating > 5)) {
      return badRequest('Rating must be between 0 and 5.')
    }
    if (body.reviews !== undefined && (!Number.isInteger(body.reviews) || body.reviews < 0)) {
      return badRequest('Review count must be a non-negative whole number.')
    }
    const book: Book = {
      id: body.id.trim(), title: body.title.trim(), author: body.author.trim(), cover: body.cover,
      isbn: body.isbn, price: body.price ?? null, originalPrice: body.originalPrice, rating: body.rating,
      reviews: body.reviews, stock: body.stock, status: body.status ?? 'in-stock', badge: body.badge,
      category: body.category, format: body.format, sellerCount: body.sellerCount ?? 0, action: body.action,
    }
    return NextResponse.json({ data: await saveProduct(book) }, { status: 201 })
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.status })
    return apiError(error, 'Unable to create the book.')
  }
}
