import type { Book } from '@/data/books'
import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'
import { importedAsBook, importedById } from './catalogue'
import { DomainError } from '@/lib/domain-error'

function fromDatabase(book: {
  id: string; title: string; author: string; coverUrl: string; isbn: string | null
  price: number | null; originalPrice: number | null; rating: number | null
  reviews: number | null; stock: number | null; status: string; badge: string | null
  category: string; format: string; sellerCount: number; vendorId: string | null
}): Book {
  return {
    id: book.id, title: book.title, author: book.author, cover: book.coverUrl,
    isbn: book.isbn ?? undefined, price: book.price, originalPrice: book.originalPrice ?? undefined,
    rating: book.rating ?? undefined, reviews: book.reviews ?? undefined, stock: book.stock,
    status: book.status === 'out-of-stock' ? 'out-of-stock' : 'in-stock',
    badge: book.badge ?? undefined, category: book.category,
    format: book.format === 'hardcover' ? 'hardcover' : 'paperback',
    sellerCount: book.sellerCount,
    vendorId: book.vendorId,
  }
}

function toDatabase(book: Book) {
  /* The persistence column is NOT NULL and the admin route already validates
     `format`, so refusing here rather than defaulting keeps the rule "never invent
     catalogue data" true even if a future caller forgets. Title, author, cover and
     category are likewise required by the schema and by that route. */
  if (!book.format) throw new DomainError('A format is required to publish a book.', 400)
  return {
    id: book.id, title: book.title, author: book.author, coverUrl: book.cover,
    isbn: book.isbn ?? null, price: book.price, originalPrice: book.originalPrice ?? null,
    rating: book.rating ?? null, reviews: book.reviews ?? null, stock: book.stock ?? null,
    status: book.status, badge: book.badge ?? null, category: book.category,
    format: book.format, sellerCount: book.sellerCount,
  }
}

export async function listProducts() {
  if (!isDatabaseConfigured) return [...mockStore.books.values()]
  const results = await prisma.book.findMany({
    where: { active: true, OR: [{ vendorId: null }, { vendor: { is: { status: 'APPROVED' } } }] },
    orderBy: { title: 'asc' },
  })
  return results.map(fromDatabase)
}

export async function getProduct(id: string) {
  if (!isDatabaseConfigured) {
    const seeded = mockStore.books.get(id)
    if (seeded) return seeded
    // Imported catalogue records are metadata-only (no price, no stock), but their
    // detail pages must still resolve rather than 404.
    const imported = importedById(id)
    return imported ? importedAsBook(imported) : null
  }
  const result = await prisma.book.findFirst({
    where: { id, active: true, OR: [{ vendorId: null }, { vendor: { is: { status: 'APPROVED' } } }] },
  })
  return result ? fromDatabase(result) : null
}

export async function saveProduct(book: Book) {
  if (!isDatabaseConfigured) {
    mockStore.books.set(book.id, { ...book })
    return book
  }
  const saved = await prisma.book.upsert({
    where: { id: book.id },
    create: toDatabase(book),
    update: toDatabase(book),
  })
  return fromDatabase(saved)
}

export async function removeProduct(id: string) {
  if (!isDatabaseConfigured) return mockStore.books.delete(id)
  const result = await prisma.book.updateMany({ where: { id, active: true }, data: { active: false } })
  return result.count > 0
}
