import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { getProduct } from './products'
import { DomainError } from '@/lib/domain-error'

export async function getCart(userId: string) {
  if (isDatabaseConfigured) {
    const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: { book: true } } } })
    const items = (cart?.items ?? []).map(({ book, quantity }) => ({
      bookId: book.id, title: book.title, author: book.author, cover: book.coverUrl,
      price: book.price, quantity, lineTotal: book.price === null ? null : book.price * quantity,
    }))
    return { items, subtotal: items.reduce((total, item) => total + (item.lineTotal ?? 0), 0) }
  }

  const lines = mockStore.carts.get(userId) ?? new Map<string, number>()
  const items = await Promise.all([...lines].map(async ([bookId, quantity]) => {
    const book = await getProduct(bookId)
    return book ? { bookId, title: book.title, author: book.author, cover: book.cover, price: book.price, quantity, lineTotal: book.price === null ? null : book.price * quantity } : null
  }))
  const present = items.filter((item) => item !== null)
  return { items: present, subtotal: present.reduce((total, item) => total + (item.lineTotal ?? 0), 0) }
}

export async function setCartQuantity(userId: string, bookId: string, quantity: number) {
  const book = await getProduct(bookId)
  if (!book) throw new DomainError('Book not found.', 404)
  if (quantity < 0 || !Number.isInteger(quantity)) throw new DomainError('Quantity must be a non-negative whole number.')
  if (book.stock !== null && book.stock !== undefined && quantity > book.stock) throw new DomainError('Requested quantity exceeds available stock.')
  if (quantity > 0 && book.status !== 'in-stock') throw new DomainError('This book is currently unavailable.')

  if (isDatabaseConfigured) {
    const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} })
    if (quantity === 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId } })
    } else {
      await prisma.cartItem.upsert({
        where: { cartId_bookId: { cartId: cart.id, bookId } },
        create: { cartId: cart.id, bookId, quantity },
        update: { quantity },
      })
    }
  } else {
    const cart = mockStore.carts.get(userId) ?? new Map<string, number>()
    if (quantity === 0) cart.delete(bookId)
    else cart.set(bookId, quantity)
    mockStore.carts.set(userId, cart)
  }
  return getCart(userId)
}

export async function removeCartItem(userId: string, bookId: string) {
  if (isDatabaseConfigured) {
    const cart = await prisma.cart.findUnique({ where: { userId } })
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId } })
  } else {
    mockStore.carts.get(userId)?.delete(bookId)
  }
  return getCart(userId)
}
