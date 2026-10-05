import { randomBytes, randomUUID } from 'node:crypto'
import { Prisma, ProductStatus } from '@prisma/client'
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
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: { include: { book: { include: { vendor: true } } } },
          productItems: { include: { product: { include: { inventory: true, vendor: true } } } },
        },
      })
      if (!cart || (!cart.items.length && !cart.productItems.length)) throw new DomainError('Your cart is empty.')
      const lines = cart.items.map(({ book, quantity }) => {
        if (!book.active || book.status !== 'in-stock' || book.price === null) throw new DomainError(`${book.title} cannot be purchased right now.`)
        if (book.vendorId && book.vendor?.status !== 'APPROVED') throw new DomainError(`${book.title} is not sold by an approved vendor.`)
        if (book.stock !== null && quantity > book.stock) throw new DomainError(`There is not enough stock for ${book.title}.`)
        return { book, quantity }
      })
      const productLines = cart.productItems.map(({ product, quantity }) => {
        if (product.status !== ProductStatus.ACTIVE) throw new DomainError(`${product.title} cannot be purchased right now.`)
        if (product.vendor.status !== 'APPROVED') throw new DomainError(`${product.title} is not sold by an approved vendor.`)
        const available = product.inventory ? product.inventory.quantity - product.inventory.reserved : 0
        if (quantity > available) throw new DomainError(`There is not enough stock for ${product.title}.`)
        return { product, quantity }
      })
      const bookSubtotal = lines.reduce((sum, line) => sum + (line.book.price ?? 0) * line.quantity, 0)
      const productSubtotal = productLines.reduce(
        (sum, line) => sum.plus(line.product.price.mul(line.quantity)),
        new Prisma.Decimal(0),
      )
      const subtotal = new Prisma.Decimal(bookSubtotal).plus(productSubtotal)
      const total = subtotal.toNumber()
      const orderItems = [
        ...lines.map(({ book, quantity }) => ({
          bookId: book.id, title: book.title, unitPrice: book.price!, quantity,
        })),
        ...productLines.map(({ product, quantity }) => ({
          productId: product.id,
          vendorId: product.vendorId,
          title: product.title,
          productTitleSnapshot: product.title,
          unitPrice: product.price.toNumber(),
          unitPriceSnapshot: product.price,
          subtotal: product.price.mul(quantity),
          quantity,
        })),
      ]
      const order = await tx.order.create({
        data: {
          userId,
          orderNumber: `MH-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
          subtotal,
          total,
          items: { create: orderItems },
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
      for (const { product, quantity } of productLines) {
        if (!product.inventory) throw new DomainError(`There is not enough stock for ${product.title}.`)
        const update = await tx.inventory.updateMany({
          where: {
            productId: product.id,
            quantity: product.inventory.quantity,
            reserved: product.inventory.reserved,
          },
          data: { quantity: { decrement: quantity } },
        })
        if (update.count !== 1) throw new DomainError(`There is not enough stock for ${product.title}.`)
        if (product.inventory.quantity - quantity === 0) {
          await tx.product.update({ where: { id: product.id }, data: { status: ProductStatus.OUT_OF_STOCK } })
        }
      }
      await Promise.all([
        tx.cartItem.deleteMany({ where: { cartId: cart.id } }),
        tx.productCartItem.deleteMany({ where: { cartId: cart.id } }),
      ])
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          amount: total,
          currency: 'INR',
          status: 'PAID',
          method: 'SIMULATED',
          transactionReference: `SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
        },
      })
      await tx.auditLog.create({
        data: { userId, action: 'ORDER_CREATED', entity: 'Order', entityId: order.id },
      })
      return { ...order, payment }
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
    const book = mockStore.books.get(item.bookId) ?? books[index]
    books[index] = book ?? null
    if (!book || book.status !== 'in-stock' || (book.stock !== null && book.stock !== undefined && item.quantity > book.stock)) {
      throw new DomainError(`There is not enough stock for ${item.title}.`)
    }
  })
  const order = {
    id: createMockId(),
    userId,
    status: 'PLACED' as const,
    total: cart.subtotal,
    createdAt: new Date().toISOString(),
    items,
    payment: {
      amount: cart.subtotal,
      currency: 'INR' as const,
      status: 'PAID' as const,
      method: 'SIMULATED' as const,
      transactionReference: `SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
    },
  }
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
  mockStore.auditLogs.push({
    userId, action: 'ORDER_CREATED', entity: 'Order', entityId: order.id, createdAt: new Date().toISOString(),
  })
  return order
}

export async function cancelOrder(userId: string, orderId: string) {
  if (isDatabaseConfigured) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true },
      })
      if (!order) throw new DomainError('Order not found.', 404)
      if (order.status !== 'PLACED' && order.status !== 'PENDING') {
        throw new DomainError('This order can no longer be cancelled.', 409)
      }

      const changed = await tx.order.updateMany({
        where: { id: orderId, userId, status: { in: ['PLACED', 'PENDING'] } },
        data: { status: 'CANCELLED' },
      })
      if (changed.count !== 1) throw new DomainError('This order can no longer be cancelled.', 409)

      for (const item of order.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { status: true, vendor: { select: { status: true } } },
          })
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          })
          if (product?.status === ProductStatus.OUT_OF_STOCK && product.vendor.status === 'APPROVED') {
            await tx.product.update({ where: { id: item.productId }, data: { status: ProductStatus.ACTIVE } })
          }
          continue
        }
        if (!item.bookId) continue
        const book = await tx.book.findUnique({ where: { id: item.bookId }, select: { stock: true, status: true } })
        if (book?.stock !== null && book?.stock !== undefined) {
          await tx.book.update({
            where: { id: item.bookId },
            data: {
              stock: { increment: item.quantity },
              ...(book.status === 'out-of-stock' ? { status: 'in-stock' } : {}),
            },
          })
        }
      }
      await tx.payment.updateMany({ where: { orderId, status: 'PAID' }, data: { status: 'REFUNDED' } })
      await tx.auditLog.create({
        data: { userId, action: 'ORDER_CANCELLED', entity: 'Order', entityId: orderId },
      })
      return tx.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } })
    })
  }

  const order = mockStore.orders.find((entry) => entry.id === orderId && entry.userId === userId)
  if (!order) throw new DomainError('Order not found.', 404)
  if (order.status !== 'PLACED') throw new DomainError('This order can no longer be cancelled.', 409)

  for (const item of order.items) {
    const book = mockStore.books.get(item.bookId)
    if (book?.stock !== null && book?.stock !== undefined) {
      const stock = book.stock + item.quantity
      mockStore.books.set(book.id, { ...book, stock, status: stock > 0 ? 'in-stock' : book.status })
    }
  }
  order.status = 'CANCELLED'
  if (order.payment?.status === 'PAID') order.payment.status = 'REFUNDED'
  mockStore.auditLogs.push({
    userId, action: 'ORDER_CANCELLED', entity: 'Order', entityId: orderId, createdAt: new Date().toISOString(),
  })
  return order
}
