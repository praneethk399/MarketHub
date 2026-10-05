import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

export type SocialTargetType = 'BOOK' | 'PRODUCT'

export type ResolvedTarget = {
  type: SocialTargetType
  id: string
  title: string
  author: string
  cover: string | null
  isbn: string | null
  price: number | null
  format: string | null
  vendorId: string | null
}

/** Resolve a social target (book or relational product). Returns null when unknown. */
export async function resolveTarget(type: SocialTargetType, idOrSlug: string): Promise<ResolvedTarget | null> {
  if (type === 'BOOK') {
    if (!isDatabaseConfigured) {
      const book = mockStore.books.get(idOrSlug)
      if (!book) return null
      return {
        type: 'BOOK', id: book.id, title: book.title, author: book.author, cover: book.cover ?? null,
        isbn: book.isbn ?? null, price: book.price ?? null, format: book.format ?? null,
        vendorId: book.vendorId ?? null,
      }
    }
    const book = await prisma.book.findFirst({
      where: { id: idOrSlug, active: true },
      select: { id: true, title: true, author: true, coverUrl: true, isbn: true, price: true, format: true, vendorId: true },
    })
    if (!book) return null
    return {
      type: 'BOOK', id: book.id, title: book.title, author: book.author, cover: book.coverUrl,
      isbn: book.isbn, price: book.price, format: book.format, vendorId: book.vendorId,
    }
  }

  if (!isDatabaseConfigured) return null // relational products require PostgreSQL
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], status: 'ACTIVE', vendor: { status: 'APPROVED' } },
    select: {
      id: true, title: true, author: true, isbn: true, price: true, format: true, vendorId: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
    },
  })
  if (!product) return null
  return {
    type: 'PRODUCT', id: product.id, title: product.title, author: product.author,
    cover: product.images[0]?.url ?? null, isbn: product.isbn, price: Number(product.price),
    format: product.format, vendorId: product.vendorId,
  }
}

export async function requireTarget(type: SocialTargetType, idOrSlug: string): Promise<ResolvedTarget> {
  const target = await resolveTarget(type, idOrSlug)
  if (!target) throw new DomainError(type === 'BOOK' ? 'Book not found.' : 'Product not found.', 404)
  return target
}

export type TargetReviewRow = {
  id: string
  userId: string
  rating: number
  title: string | null
  content: string
  verified: boolean
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  containsSpoilers: boolean
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
}

/** All review rows for a target (before any visibility filtering). */
export async function getTargetReviews(type: SocialTargetType, targetId: string): Promise<TargetReviewRow[]> {
  if (!isDatabaseConfigured) {
    return mockStore.reviews
      .filter((review) => (type === 'BOOK' ? (review.bookId ?? review.productId) === targetId : review.productId === targetId && !review.bookId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((review) => ({
        id: review.id, userId: review.userId, rating: review.rating, title: review.title,
        content: review.content, verified: review.verified,
        visibility: review.visibility ?? 'PUBLIC', containsSpoilers: review.containsSpoilers ?? false,
        createdAt: review.createdAt,
        user: { id: review.userId, name: review.userName, avatar: null },
      }))
  }
  const rows = await prisma.review.findMany({
    where: type === 'BOOK' ? { bookId: targetId } : { productId: targetId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, userId: true, rating: true, title: true, content: true, verified: true,
      visibility: true, containsSpoilers: true, createdAt: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
  })
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

/** Batch-resolve many targets of one type (no N+1 in list/recommendation DTOs). */
export async function resolveTargets(type: SocialTargetType, ids: string[]): Promise<Map<string, ResolvedTarget>> {
  const unique = [...new Set(ids)]
  const map = new Map<string, ResolvedTarget>()
  if (!unique.length) return map
  if (type === 'BOOK') {
    if (!isDatabaseConfigured) {
      for (const id of unique) {
        const target = await resolveTarget('BOOK', id)
        if (target) map.set(id, target)
      }
      return map
    }
    const rows = await prisma.book.findMany({
      where: { id: { in: unique }, active: true },
      select: { id: true, title: true, author: true, coverUrl: true, isbn: true, price: true, format: true, vendorId: true },
    })
    for (const book of rows) {
      map.set(book.id, {
        type: 'BOOK', id: book.id, title: book.title, author: book.author, cover: book.coverUrl,
        isbn: book.isbn, price: book.price, format: book.format, vendorId: book.vendorId,
      })
    }
    return map
  }
  if (!isDatabaseConfigured) return map
  const rows = await prisma.product.findMany({
    where: { id: { in: unique }, status: 'ACTIVE', vendor: { status: 'APPROVED' } },
    select: {
      id: true, title: true, author: true, isbn: true, price: true, format: true, vendorId: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
    },
  })
  for (const product of rows) {
    map.set(product.id, {
      type: 'PRODUCT', id: product.id, title: product.title, author: product.author,
      cover: product.images[0]?.url ?? null, isbn: product.isbn, price: Number(product.price),
      format: product.format, vendorId: product.vendorId,
    })
  }
  return map
}

/** User ids with a non-cancelled order containing this target (purchase signal). */
export async function getTargetPurchasers(type: SocialTargetType, targetId: string): Promise<Set<string>> {
  if (!isDatabaseConfigured) {
    const ids = new Set<string>()
    for (const order of mockStore.orders) {
      if (order.status === 'CANCELLED') continue
      if (order.items.some((item) => item.bookId === targetId)) ids.add(order.userId)
    }
    return ids
  }
  const rows = await prisma.orderItem.findMany({
    where: type === 'BOOK'
      ? { bookId: targetId, order: { status: { not: 'CANCELLED' } } }
      : { productId: targetId, order: { status: { not: 'CANCELLED' } } },
    select: { order: { select: { userId: true } } },
  })
  const ids = new Set<string>()
  for (const row of rows) ids.add(row.order.userId)
  return ids
}
