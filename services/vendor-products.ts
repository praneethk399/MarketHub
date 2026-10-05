import { randomUUID } from 'node:crypto'
import { ProductStatus, VendorStatus } from '@prisma/client'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { DomainError } from '@/lib/domain-error'
import type { z } from 'zod'
import type { createProductSchema, updateProductSchema } from '@/lib/validation'

type CreateProductInput = z.infer<typeof createProductSchema>
type UpdateProductInput = z.infer<typeof updateProductSchema>

function requireDatabase() {
  if (!isDatabaseConfigured) throw new DomainError('Vendor product management requires PostgreSQL.', 503)
}

function toProductDto(product: {
  id: string
  vendorId: string
  categoryId: string | null
  title: string
  slug: string
  description: string
  author: string
  isbn: string | null
  publisher: string | null
  publicationYear: number | null
  language: string
  format: string
  price: { toNumber(): number }
  compareAtPrice: { toNumber(): number } | null
  status: ProductStatus
  rating: number
  reviewCount: number
  images: { id: string; url: string; alt: string; position: number }[]
  category: { id: string; name: string; slug: string } | null
  inventory: { quantity: number; reserved: number; lowStockThreshold: number } | null
}) {
  return {
    id: product.id,
    vendorId: product.vendorId,
    categoryId: product.categoryId,
    title: product.title,
    slug: product.slug,
    description: product.description,
    author: product.author,
    isbn: product.isbn,
    publisher: product.publisher,
    publicationYear: product.publicationYear,
    language: product.language,
    format: product.format,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
    status: product.status,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availableInventory: product.inventory ? product.inventory.quantity - product.inventory.reserved : 0,
    inventory: product.inventory,
    images: product.images,
    category: product.category,
  }
}

function createSlug(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'book'
  return `${base}-${randomUUID().slice(0, 8)}`
}

export async function listVendorProducts(userId: string) {
  requireDatabase()
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    select: { id: true, status: true },
  })
  if (!vendor || vendor.status !== VendorStatus.APPROVED) throw new DomainError('An approved vendor profile is required.', 403)
  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    include: { images: { orderBy: { position: 'asc' } }, category: true, inventory: true },
    orderBy: { createdAt: 'desc' },
  })
  return products.map(toProductDto)
}

export async function createVendorProduct(userId: string, input: CreateProductInput) {
  requireDatabase()
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({ where: { userId }, select: { id: true, status: true } })
    if (!vendor || vendor.status !== VendorStatus.APPROVED) throw new DomainError('An approved vendor profile is required.', 403)
    if (input.categoryId && !await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } })) {
      throw new DomainError('The selected category does not exist.')
    }
    const status = input.status ?? ProductStatus.DRAFT
    if (status === ProductStatus.ACTIVE && input.quantity === 0) {
      throw new DomainError('A product must have available inventory before it can be published.')
    }
    const product = await tx.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: input.categoryId ?? null,
        title: input.title,
        slug: createSlug(input.slug ?? input.title),
        description: input.description,
        author: input.author,
        isbn: input.isbn ?? null,
        publisher: input.publisher ?? null,
        publicationYear: input.publicationYear ?? null,
        language: input.language,
        format: input.format,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        status,
        images: { create: input.images.map((image, position) => ({ ...image, position })) },
        inventory: { create: { quantity: input.quantity, lowStockThreshold: input.lowStockThreshold } },
      },
      include: { images: { orderBy: { position: 'asc' } }, category: true, inventory: true },
    })
    await tx.auditLog.create({
      data: { userId, action: 'PRODUCT_CREATED', entity: 'Product', entityId: product.id },
    })
    return toProductDto(product)
  })
}

export async function updateVendorProduct(userId: string, productId: string, input: UpdateProductInput) {
  requireDatabase()
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { inventory: true, vendor: { select: { userId: true, status: true } } },
    })
    if (!product) throw new DomainError('Product not found.', 404)
    if (product.vendor.userId !== userId) throw new DomainError('You do not have permission to modify this product.', 403)
    if (product.vendor.status !== VendorStatus.APPROVED) throw new DomainError('Only approved vendors can manage products.', 403)
    if (input.categoryId && !await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } })) {
      throw new DomainError('The selected category does not exist.')
    }

    const quantity = input.quantity ?? product.inventory?.quantity ?? 0
    const status = input.status ?? product.status
    if (quantity < (product.inventory?.reserved ?? 0)) {
      throw new DomainError('Inventory quantity cannot be lower than already reserved stock.')
    }
    if (status === ProductStatus.ACTIVE && quantity <= (product.inventory?.reserved ?? 0)) {
      throw new DomainError('A product must have available inventory before it can be published.')
    }
    const nextPrice = input.price ?? Number(product.price)
    const nextCompareAtPrice = input.compareAtPrice === undefined
      ? product.compareAtPrice?.toNumber() ?? null
      : input.compareAtPrice
    if (nextCompareAtPrice !== null && nextCompareAtPrice < nextPrice) {
      throw new DomainError('Compare-at price must be greater than or equal to price.')
    }
    const updated = await tx.product.update({
      where: { id: product.id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined ? { slug: createSlug(input.slug) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.author !== undefined ? { author: input.author } : {}),
        ...(input.isbn !== undefined ? { isbn: input.isbn || null } : {}),
        ...(input.publisher !== undefined ? { publisher: input.publisher || null } : {}),
        ...(input.publicationYear !== undefined ? { publicationYear: input.publicationYear } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.format !== undefined ? { format: input.format } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.images !== undefined ? {
          images: {
            deleteMany: {},
            create: input.images.map((image, position) => ({ ...image, position })),
          },
        } : {}),
        ...(input.quantity !== undefined || input.lowStockThreshold !== undefined ? {
          inventory: {
            upsert: {
              create: {
                quantity,
                lowStockThreshold: input.lowStockThreshold ?? 5,
              },
              update: {
                ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
                ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
              },
            },
          },
        } : {}),
      },
      include: { images: { orderBy: { position: 'asc' } }, category: true, inventory: true },
    })
    await tx.auditLog.create({
      data: { userId, action: 'PRODUCT_UPDATED', entity: 'Product', entityId: product.id },
    })
    return toProductDto(updated)
  })
}

export async function deactivateVendorProduct(userId: string, productId: string) {
  requireDatabase()
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true, vendor: { select: { userId: true, status: true } } },
    })
    if (!product) throw new DomainError('Product not found.', 404)
    if (product.vendor.userId !== userId) throw new DomainError('You do not have permission to modify this product.', 403)
    if (product.vendor.status !== VendorStatus.APPROVED) throw new DomainError('Only approved vendors can manage products.', 403)
    await tx.product.update({ where: { id: product.id }, data: { status: ProductStatus.INACTIVE } })
    await tx.auditLog.create({
      data: { userId, action: 'PRODUCT_DELETED', entity: 'Product', entityId: product.id },
    })
    return { id: product.id, status: ProductStatus.INACTIVE }
  })
}

export async function getVendorProduct(userId: string, productId: string) {
  requireDatabase()
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: { orderBy: { position: 'asc' } }, category: true, inventory: true, vendor: { select: { userId: true, status: true } } },
  })
  if (!product) throw new DomainError('Product not found.', 404)
  if (product.vendor.userId !== userId) throw new DomainError('You do not have permission to view this product.', 403)
  if (product.vendor.status !== VendorStatus.APPROVED) throw new DomainError('Only approved vendors can manage products.', 403)
  return toProductDto(product)
}
