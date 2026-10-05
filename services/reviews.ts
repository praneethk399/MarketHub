import { ProductStatus, VendorStatus } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId } from '@/lib/mock-store'
import { DomainError } from '@/lib/domain-error'

export async function listProductReviews(productSlug: string) {
  if (!isDatabaseConfigured) {
    const book = [...mockStore.books.values()].find((entry) => entry.id === productSlug)
    if (!book) return null
    return mockStore.reviews
      .filter((review) => review.productId === book.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content,
        verified: review.verified,
        createdAt: review.createdAt,
        user: { name: review.userName, avatar: null },
      }))
  }

  const product = await prisma.product.findFirst({
    where: { slug: productSlug, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
    select: { id: true },
  })
  if (!product) return null
  return prisma.review.findMany({
    where: { productId: product.id },
    select: {
      id: true, rating: true, title: true, content: true, verified: true, createdAt: true,
      user: { select: { name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createVerifiedReview(
  userId: string,
  productSlug: string,
  review: { rating: number; title?: string; content: string },
) {
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
    return safeResult
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { slug: productSlug, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
      select: { id: true },
    })
    if (!product) throw new DomainError('Product not found.', 404)
    const purchase = await tx.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId, status: { not: 'CANCELLED' } },
      },
      select: { id: true },
    })
    if (!purchase) throw new DomainError('You can review a product only after purchasing it.', 403)

    const created = await tx.review.create({
      data: { productId: product.id, userId, rating: review.rating, title: review.title, content: review.content, verified: true },
      select: {
        id: true, rating: true, title: true, content: true, verified: true, createdAt: true,
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
  })
}
