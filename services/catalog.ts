import { ProductStatus, VendorStatus } from '@prisma/client'
import { z } from 'zod'
import { books } from '@/data/books'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  author: z.string().trim().max(120).optional(),
  format: z.string().trim().max(40).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'bestseller']).default('newest'),
}).strict().refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
  message: 'Minimum price must not exceed maximum price.',
})

export type ProductQuery = z.infer<typeof productQuerySchema>

export function toBookProduct(book: (typeof books)[number]) {
  return {
    id: book.id,
    slug: book.id,
    title: book.title,
    description: '',
    author: book.author,
    isbn: book.isbn ?? null,
    publisher: null,
    publicationYear: null,
    language: 'en',
    format: book.format,
    price: book.price,
    compareAtPrice: book.originalPrice ?? null,
    status: book.status === 'in-stock' ? 'ACTIVE' as const : 'OUT_OF_STOCK' as const,
    rating: book.rating ?? 0,
    reviewCount: book.reviews ?? 0,
    availableInventory: book.stock,
    images: [{ url: book.cover, alt: `Cover of ${book.title}`, position: 0 }],
    category: { name: book.category, slug: slugify(book.category) },
    vendor: null,
  }
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function listCatalogProducts(query: ProductQuery) {
  if (!isDatabaseConfigured) {
    const needle = query.search?.toLowerCase()
    let items = [...mockStore.books.values()].map(toBookProduct).filter((product) => {
      if (needle && !`${product.title} ${product.author} ${product.isbn ?? ''} ${product.description}`.toLowerCase().includes(needle)) return false
      if (query.category && product.category.slug !== slugify(query.category) && product.category.name.toLowerCase() !== query.category.toLowerCase()) return false
      if (query.author && !product.author.toLowerCase().includes(query.author.toLowerCase())) return false
      if (query.format && product.format.toLowerCase() !== query.format.toLowerCase()) return false
      if (query.minPrice !== undefined && (product.price === null || product.price < query.minPrice)) return false
      if (query.maxPrice !== undefined && (product.price === null || product.price > query.maxPrice)) return false
      if (query.inStock === 'true' && (product.availableInventory === null || product.availableInventory === undefined || product.availableInventory <= 0)) return false
      return true
    })
    items.sort((a, b) => {
      if (query.sort === 'price_asc') return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
      if (query.sort === 'price_desc') return (b.price ?? -1) - (a.price ?? -1)
      if (query.sort === 'rating') return b.rating - a.rating
      if (query.sort === 'bestseller') return b.reviewCount - a.reviewCount
      return a.title.localeCompare(b.title)
    })
    const total = items.length
    items = items.slice((query.page - 1) * query.limit, query.page * query.limit)
    return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } }
  }

  const where = {
    status: ProductStatus.ACTIVE,
    vendor: { is: { status: VendorStatus.APPROVED } },
    ...(query.search ? {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { author: { contains: query.search, mode: 'insensitive' as const } },
        { isbn: { contains: query.search, mode: 'insensitive' as const } },
        { publisher: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(query.category ? { category: { is: { slug: slugify(query.category) } } } : {}),
    ...(query.author ? { author: { contains: query.author, mode: 'insensitive' as const } } : {}),
    ...(query.format ? { format: { equals: query.format, mode: 'insensitive' as const } } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined ? {
      price: {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      },
    } : {}),
    ...(query.inStock === 'true' ? { inventory: { is: { quantity: { gt: 0 } } } } : {}),
  }
  const orderBy = query.sort === 'price_asc' ? { price: 'asc' as const }
    : query.sort === 'price_desc' ? { price: 'desc' as const }
      : query.sort === 'rating' ? { rating: 'desc' as const }
        : query.sort === 'bestseller' ? { reviewCount: 'desc' as const }
          : { createdAt: 'desc' as const }
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        images: { orderBy: { position: 'asc' } },
        category: true,
        inventory: true,
        vendor: { select: { id: true, name: true, storeName: true, slug: true } },
      },
    }),
  ])

  const items = rows.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    author: product.author,
    isbn: product.isbn,
    publisher: product.publisher,
    publicationYear: product.publicationYear,
    language: product.language,
    format: product.format,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    status: product.status,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availableInventory: product.inventory ? product.inventory.quantity - product.inventory.reserved : 0,
    images: product.images.map(({ url, alt, position }) => ({ url, alt, position })),
    category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
    vendor: product.vendor,
  }))
  return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } }
}

export async function getCatalogProduct(slug: string) {
  if (!isDatabaseConfigured) {
    const book = mockStore.books.get(slug)
    return book ? toBookProduct(book) : null
  }

  const product = await prisma.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
    include: {
      images: { orderBy: { position: 'asc' } },
      category: true,
      inventory: true,
      vendor: { select: { id: true, name: true, storeName: true, slug: true } },
    },
  })
  if (!product) return null
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    author: product.author,
    isbn: product.isbn,
    publisher: product.publisher,
    publicationYear: product.publicationYear,
    language: product.language,
    format: product.format,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    status: product.status,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availableInventory: product.inventory ? product.inventory.quantity - product.inventory.reserved : 0,
    images: product.images.map(({ url, alt, position }) => ({ url, alt, position })),
    category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
    vendor: product.vendor,
  }
}

export async function listCatalogCategories() {
  if (!isDatabaseConfigured) {
    const categories = [...new Set([...mockStore.books.values()].map((book) => book.category))]
    return categories.map((name) => ({ name, slug: slugify(name) })).sort((a, b) => a.name.localeCompare(b.name))
  }
  return prisma.category.findMany({
    where: { products: { some: { status: ProductStatus.ACTIVE, vendor: { status: VendorStatus.APPROVED } } } },
    select: { id: true, name: true, slug: true, description: true },
    orderBy: { name: 'asc' },
  })
}

export async function getWishlist(userId: string) {
  if (!isDatabaseConfigured) {
    const ids = mockStore.wishlists.get(userId) ?? new Set<string>()
    return [...ids].map((id) => mockStore.books.get(id)).filter((book) => book !== undefined).map(toBookProduct)
  }
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: {
      items: {
        where: { product: { status: ProductStatus.ACTIVE, vendor: { status: VendorStatus.APPROVED } } },
        include: {
          product: {
            include: {
              images: { orderBy: { position: 'asc' }, take: 1 },
              category: true,
              inventory: true,
              vendor: { select: { id: true, name: true, storeName: true, slug: true } },
            },
          },
        },
      },
    },
  })
  return wishlist?.items.map(({ product }) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    author: product.author,
    isbn: product.isbn,
    publisher: product.publisher,
    publicationYear: product.publicationYear,
    language: product.language,
    format: product.format,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice === null ? null : Number(product.compareAtPrice),
    status: product.status,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availableInventory: product.inventory ? product.inventory.quantity - product.inventory.reserved : 0,
    images: product.images.map(({ url, alt, position }) => ({ url, alt, position })),
    category: product.category ? { name: product.category.name, slug: product.category.slug } : null,
    vendor: product.vendor,
  })) ?? []
}

export async function addWishlistProduct(userId: string, productId: string) {
  if (!isDatabaseConfigured) {
    if (!mockStore.books.has(productId)) return false
    const items = mockStore.wishlists.get(userId) ?? new Set<string>()
    items.add(productId)
    mockStore.wishlists.set(userId, items)
    return true
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE, vendor: { is: { status: VendorStatus.APPROVED } } },
    select: { id: true },
  })
  if (!product) return false
  const wishlist = await prisma.wishlist.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  })
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    create: { wishlistId: wishlist.id, productId },
    update: {},
  })
  return true
}

export async function removeWishlistProduct(userId: string, productId: string) {
  if (!isDatabaseConfigured) {
    return mockStore.wishlists.get(userId)?.delete(productId) ?? false
  }
  const wishlist = await prisma.wishlist.findUnique({ where: { userId }, select: { id: true } })
  if (!wishlist) return false
  const deleted = await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } })
  return deleted.count > 0
}
