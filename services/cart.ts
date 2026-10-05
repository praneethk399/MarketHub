import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { getProduct } from './products'
import { DomainError } from '@/lib/domain-error'
import { ProductStatus, VendorStatus } from '@prisma/client'

export async function getCart(userId: string) {
  if (isDatabaseConfigured) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: { include: { book: true } },
        productItems: { include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } },
      },
    })
    const bookItems = (cart?.items ?? []).map(({ book, quantity }) => ({
      bookId: book.id, title: book.title, author: book.author, cover: book.coverUrl,
      price: book.price, quantity, lineTotal: book.price === null ? null : book.price * quantity,
    }))
    const productItems = (cart?.productItems ?? []).map(({ id, product, quantity }) => {
      const price = Number(product.price)
      return {
        itemId: id, productId: product.id, bookId: product.id, title: product.title, author: product.author,
        cover: product.images[0]?.url ?? '', price, quantity, lineTotal: price * quantity,
      }
    })
    const items = [...bookItems, ...productItems]
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
  if (quantity < 0 || quantity > 100 || !Number.isInteger(quantity)) throw new DomainError('Quantity must be a whole number between 0 and 100.')
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

export async function addProductToCart(userId: string, productId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new DomainError('Quantity must be a whole number between 1 and 100.')
  }
  if (!isDatabaseConfigured) {
    const book = await getProduct(productId)
    if (!book) throw new DomainError('Product not found.', 404)
    const current = mockStore.carts.get(userId)?.get(productId) ?? 0
    return setCartQuantity(userId, productId, current + quantity)
  }

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
      include: { inventory: true },
    })
    if (!product) throw new DomainError('Product is not available.', 404)
    const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} })
    const existing = await tx.productCartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      select: { quantity: true },
    })
    const nextQuantity = (existing?.quantity ?? 0) + quantity
    const available = product.inventory ? product.inventory.quantity - product.inventory.reserved : 0
    if (nextQuantity > available) throw new DomainError('Requested quantity exceeds available inventory.')
    await tx.productCartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity: nextQuantity, priceAtAddition: product.price },
      update: { quantity: nextQuantity, priceAtAddition: product.price },
    })
  })
  return getCart(userId)
}

export async function updateProductCartItem(userId: string, itemId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
    throw new DomainError('Quantity must be a whole number between 0 and 100.')
  }
  if (!isDatabaseConfigured) {
    if (quantity === 0) return removeCartItem(userId, itemId)
    return setCartQuantity(userId, itemId, quantity)
  }

  await prisma.$transaction(async (tx) => {
    const item = await tx.productCartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: { include: { inventory: true, vendor: { select: { status: true } } } } },
    })
    if (!item) throw new DomainError('Cart item not found.', 404)
    if (quantity === 0) {
      await tx.productCartItem.delete({ where: { id: item.id } })
      return
    }
    if (item.product.status !== ProductStatus.ACTIVE || item.product.vendor.status !== VendorStatus.APPROVED) {
      throw new DomainError('This product is no longer available.')
    }
    const available = item.product.inventory
      ? item.product.inventory.quantity - item.product.inventory.reserved
      : 0
    if (quantity > available) throw new DomainError('Requested quantity exceeds available inventory.')
    await tx.productCartItem.update({
      where: { id: item.id },
      data: { quantity, priceAtAddition: item.product.price },
    })
  })
  return getCart(userId)
}

export async function removeProductCartItem(userId: string, itemId: string) {
  if (!isDatabaseConfigured) return removeCartItem(userId, itemId)
  await prisma.productCartItem.deleteMany({ where: { id: itemId, cart: { userId } } })
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
