import { PrismaClient } from '@prisma/client'
import { books } from '../data/books'
import { initialVendors } from '../lib/mock-store'

const prisma = new PrismaClient()

async function main() {
  for (const vendor of initialVendors) {
    await prisma.vendor.upsert({
      where: { id: vendor.id },
      create: {
        id: vendor.id,
        name: vendor.name,
        city: vendor.city,
        verified: vendor.verified,
        booksSold: vendor.booksSold,
        authenticity: vendor.authenticity,
        onTimeDelivery: vendor.onTimeDelivery,
        returnRate: vendor.returnRate,
        disputeRate: vendor.disputeRate,
        activeSince: new Date(vendor.activeSince),
      },
      update: {
        name: vendor.name,
        city: vendor.city,
        verified: vendor.verified,
        booksSold: vendor.booksSold,
        authenticity: vendor.authenticity,
        onTimeDelivery: vendor.onTimeDelivery,
        returnRate: vendor.returnRate,
        disputeRate: vendor.disputeRate,
        activeSince: new Date(vendor.activeSince),
      },
    })
  }

  for (const book of books) {
    const data = {
      title: book.title,
      author: book.author,
      coverUrl: book.cover,
      isbn: book.isbn ?? null,
      price: book.price,
      originalPrice: book.originalPrice ?? null,
      rating: book.rating ?? null,
      reviews: book.reviews ?? null,
      stock: book.stock ?? null,
      status: book.status,
      badge: book.badge ?? null,
      category: book.category,
      format: book.format,
      sellerCount: book.sellerCount,
      active: true,
    }
    await prisma.book.upsert({ where: { id: book.id }, create: { id: book.id, ...data }, update: data })
  }

  console.log(`Seeded ${books.length} books and ${initialVendors.length} sellers.`)
}

main()
  .catch((error: unknown) => {
    console.error('MarketHub database seeding failed.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
