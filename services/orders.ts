import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore, createMockId } from '@/lib/mock-store'
import { getCart } from './cart'
import { getProduct } from './products'
import { DomainError } from '@/lib/domain-error'

export async function listOrders(userId: string) {
  if (!isDatabaseConfigured) return mockStore.orders.filter((order) => order.userId === userId)
  return prisma.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' } })
}

export async function getOrder(userId: string, id: string) {
  if (!isDatabaseConfigured) return mockStore.orders.find((order) => order.userId === userId && order.id === id) ?? null
  return prisma.order.findFirst({ where: { userId, id }, include: { items: true } })
}

export async function checkout(userId: string) {
  if (isDatabaseConfigured) {
    return prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { include: { book: true } } } })
      if (!cart?.items.length) throw new DomainError('Your cart is empty.')
      const lines = cart.items.map(({ book, quantity }) => {
        if (!book.active || book.status !== 'in-stock' || book.price === null) throw new DomainError(`${book.title} cannot be purchased right now.`)
        if (book.stock !== null && quantity > book.stock) throw new DomainError(`There is not enough stock for ${book.title}.`)
        return { book, quantity }
      })
      const total = lines.reduce((sum, line) => sum + (line.book.price ?? 0) * line.quantity, 0)
      const order = await tx.order.create({
        data: {
          userId, total,
          items: { create: lines.map(({ book, quantity }) => ({ bookId: book.id, title: book.title, unitPrice: book.price!, quantity })) },
        },
        include: { items: true },
      })
      for (const { book, quantity } of lines) {
        if (book.stock !== null) {
          const update = await tx.book.updateMany({
            where: { id: book.id, active: true, stock: { gte: quantity } },
            data: { stock: { decrement: quantity }, ...(book.stock === quantity ? { status: 'out-of-stock' } : {}) },
          })
          if (update.count !== 1) throw new DomainError(`There is not enough stock for ${book.title}.`)
        }
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      return order
    })
  }

  const cart = await getCart(userId)
  if (!cart.items.length) throw new DomainError('Your cart is empty.')
  const items = cart.items.map((item) => {
    if (item.price === null || item.lineTotal === null) throw new DomainError(`${item.title} has no available price.`)
    return { bookId: item.bookId, title: item.title, unitPrice: item.price, quantity: item.quantity }
  })
  const books = await Promise.all(items.map((item) => getProduct(item.bookId)))
  items.forEach((item, index) => {
    const book = books[index]
    if (!book || book.status !== 'in-stock' || (book.stock !== null && book.stock !== undefined && item.quantity > book.stock)) {
      throw new DomainError(`There is not enough stock for ${item.title}.`)
    }
  })
  const order = { id: createMockId(), userId, status: 'PLACED' as const, total: cart.subtotal, createdAt: new Date().toISOString(), items }
  mockStore.orders.unshift(order)
  mockStore.carts.set(userId, new Map())
  items.forEach((item, index) => {
    const book = books[index]
    if (book?.stock !== null && book?.stock !== undefined) {
      const updated = { ...book, stock: book.stock - item.quantity }
      if (updated.stock === 0) updated.status = 'out-of-stock'
      mockStore.books.set(book.id, updated)
    }
  })
  return order
}
