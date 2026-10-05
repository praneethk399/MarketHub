import { ProductStatus, VendorStatus } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId, type MockReview } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'
import { listVisibleReviews } from '@/services/trusted-rating.service'
import { noteReviewCreated } from '@/services/marketShield.service'

export type ReviewInput = {
  rating: number
  title?: string
  content: string
  visibility?: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  containsSpoilers?: boolean
}

function sanitizeReviewInput(review: ReviewInput) {
  return {
    rating: review.rating,
    title: review.title,
    content: review.content,
    visibility: review.visibility ?? 'PUBLIC' as const,
    containsSpoilers: review.containsSpoilers ?? false,
  }
}

export async function listProductReviews(productSlug: string, viewerId?: string | null) {
  if (!isDatabaseConfigured) {
    const book = [...mockStore.books.values()].find((entry) => entry.id === productSlug)
    if (!book) return null
    // Visibility-filtered: private reviews never leak through this endpoint.
    return listVisibleReviews({ targetType: 'BOOK', targetId: book.id, viewerId: viewerId ?? null })
  }

  const product = await prisma.product.findFirst({
    where: { slug: productSlug, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
    select: { id: true },
  })
  if (!product) return null
  return listVisibleReviews({ targetType: 'PRODUCT', targetId: product.id, viewerId: viewerId ?? null })
}

export async function createVerifiedReview(
  userId: string,
  productSlug: string,
  review: ReviewInput,
) {
  const input = sanitizeReviewInput(review)
  if (!isDatabaseConfigured) {
    const product = [...mockStore.books.values()].find((entry) => entry.id === productSlug)
    if (!product) throw new DomainError('Product not found.', 404)
    const purchased = mockStore.orders.some((order) =>
      order.userId === userId
      && order.status !== 'CANCELLED'
      && order.items.some((item) => item.bookId === product.id))
    if (!purchased) throw new DomainError('You can review a product only after purchasing it.', 403)
    if (mockStore.reviews.some((entry) => entry.productId === product.id && entry.userId === userId)) {
      throw new DomainError('You have already reviewed this product.', 409)
    }
    const user = mockStore.users.get(userId)
    if (!user) throw new DomainError('User not found.', 404)
    const result = {
      id: createMockId(),
      productId: product.id,
      userId,
      rating: review.rating,
      title: review.title ?? null,
      content: review.content,
      verified: true as const,
      visibility: input.visibility,
      containsSpoilers: input.containsSpoilers,
      createdAt: new Date().toISOString(),
      user: { name: user.name, avatar: null },
    }
    const { user: reviewUser, ...storedReview } = result
    mockStore.reviews.push({ ...storedReview, userName: reviewUser.name })
    const allReviews = mockStore.reviews.filter((entry) => entry.productId === product.id)
    mockStore.books.set(product.id, {
      ...product,
      rating: allReviews.reduce((sum, entry) => sum + entry.rating, 0) / allReviews.length,
      reviews: allReviews.length,
    })
    const { userId: _userId, ...safeResult } = result
    await noteReviewCreated(userId, 'PRODUCT', product.id)
    return safeResult
  }

  let reviewedProductId = ''
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { slug: productSlug, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
      select: { id: true },
    })
    if (!product) throw new DomainError('Product not found.', 404)
    reviewedProductId = product.id
    const purchase = await tx.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId, status: { not: 'CANCELLED' } },
      },
      select: { id: true },
    })
    if (!purchase) throw new DomainError('You can review a product only after purchasing it.', 403)

    const created = await tx.review.create({
      data: {
        productId: product.id, userId, rating: review.rating, title: review.title,
        content: review.content, verified: true,
        visibility: input.visibility, containsSpoilers: input.containsSpoilers,
      },
      select: {
        id: true, rating: true, title: true, content: true, verified: true,
        visibility: true, containsSpoilers: true, createdAt: true,
        user: { select: { name: true, avatar: true } },
      },
    }).catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new DomainError('You have already reviewed this product.', 409)
      }
      throw error
    })
    const aggregate = await tx.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { _all: true },
    })
    await tx.product.update({
      where: { id: product.id },
      data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count._all },
    })
    await tx.auditLog.create({
      data: { userId, action: 'REVIEW_CREATED', entity: 'Product', entityId: product.id },
    })
    return created
  }).then(async (created) => {
    await noteReviewCreated(userId, 'PRODUCT', reviewedProductId)
    return created
  })
}

/** Create a review for a storefront Book (verified purchase required). */
export async function createBookReview(userId: string, bookId: string, review: ReviewInput) {
  const input = sanitizeReviewInput(review)
  if (!isDatabaseConfigured) {
    const book = mockStore.books.get(bookId)
    if (!book) throw new DomainError('Book not found.', 404)
    const purchased = mockStore.orders.some((order) =>
      order.userId !== undefined
      && order.userId === userId
      && order.status !== 'CANCELLED'
      && order.items.some((item) => item.bookId === bookId))
    if (!purchased) throw new DomainError('You can review a product only after purchasing it.', 403)
    if (mockStore.reviews.some((entry) => entry.bookId === bookId && entry.userId === userId)) {
      throw new DomainError('You have already reviewed this product.', 409)
    }
    const user = mockStore.users.get(userId)
    if (!user) throw new DomainError('User not found.', 404)
    const created: MockReview = {
      id: createMockId(), productId: bookId, bookId, userId, rating: review.rating,
      title: review.title ?? null, content: review.content, verified: true,
      visibility: input.visibility, containsSpoilers: input.containsSpoilers,
      createdAt: new Date().toISOString(), userName: user.name,
    }
    mockStore.reviews.push(created)
    await noteReviewCreated(userId, 'BOOK', bookId)
    const { userId: _userId, userName: _userName, ...safe } = created
    return { ...safe, user: { name: user.name, avatar: null } }
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, active: true }, select: { id: true } })
  if (!book) throw new DomainError('Book not found.', 404)
  const purchase = await prisma.orderItem.findFirst({
    where: { bookId, order: { userId, status: { not: 'CANCELLED' } } },
    select: { id: true },
  })
  if (!purchase) throw new DomainError('You can review a product only after purchasing it.', 403)

  const created = await prisma.review.create({
    data: {
      bookId, userId, rating: review.rating, title: review.title, content: review.content,
      verified: true, visibility: input.visibility, containsSpoilers: input.containsSpoilers,
    },
    select: {
      id: true, rating: true, title: true, content: true, verified: true,
      visibility: true, containsSpoilers: true, createdAt: true,
      user: { select: { name: true, avatar: true } },
    },
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new DomainError('You have already reviewed this product.', 409)
    }
    throw error
  })
  await prisma.auditLog.create({
    data: { userId, action: 'REVIEW_CREATED', entity: 'Book', entityId: bookId },
  })
  await noteReviewCreated(userId, 'BOOK', bookId)
  return created
}
