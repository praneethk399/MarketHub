import { PrismaClient } from '@prisma/client'
import { hashSync } from 'bcryptjs'
import { books } from '../data/books'
import { buildComparisonOffers } from '../data/seller-offers'
import { initialVendors } from '../lib/mock-store'

const prisma = new PrismaClient()

const demoUsers = [
  { id: 'demo-ava', name: 'Ava Sharma', email: 'ava@markethub.test' },
  { id: 'demo-rahul', name: 'Rahul Verma', email: 'rahul@markethub.test' },
  { id: 'demo-ananya', name: 'Ananya Rao', email: 'ananya@markethub.test' },
  { id: 'demo-kiran', name: 'Kiran Iyer', email: 'kiran@markethub.test' },
] as const

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

/**
 * Run an async task over many items in bounded parallel batches.
 *
 * The catalogue holds hundreds of books and competing listings, so awaiting
 * them one at a time made seeding needlessly slow. Batching keeps the promise
 * count near the Prisma connection pool while removing the serial round-trips.
 */
async function inBatches<T>(items: T[], size: number, run: (item: T, index: number) => Promise<unknown>) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map((item, offset) => run(item, start + offset)))
  }
}

async function seedDemoSocial() {
  const existing = await prisma.user.findUnique({ where: { email: demoUsers[0].email }, select: { id: true } })
  if (existing) {
    console.log('Demo social data already present — skipped.')
    return
  }

  const passwordHash = hashSync('Demo1234!', 10)
  for (const user of demoUsers) {
    await prisma.user.create({
      data: { id: user.id, name: user.name, email: user.email, passwordHash, role: 'CUSTOMER' },
    })
  }
  const [ava, rahul, ananya, kiran] = demoUsers.map((user) => user.id)

  // Privacy settings (demonstrates every combination).
  await prisma.socialPrivacy.createMany({
    data: [
      { userId: ava, reviews: 'PUBLIC', purchases: 'LIMITED', reading: 'FRIENDS' },
      { userId: rahul, reviews: 'FRIENDS', purchases: 'PRIVATE', reading: 'PRIVATE' },
      { userId: ananya, reviews: 'PUBLIC', purchases: 'LIMITED', reading: 'PRIVATE' },
      { userId: kiran, reviews: 'PRIVATE', purchases: 'PRIVATE', reading: 'PRIVATE' },
    ],
  })

  await prisma.friendship.createMany({
    data: [
      { requesterId: ava, addresseeId: rahul, status: 'ACCEPTED', createdAt: daysAgo(120), updatedAt: daysAgo(120) },
      { requesterId: ava, addresseeId: ananya, status: 'ACCEPTED', createdAt: daysAgo(90), updatedAt: daysAgo(90) },
      { requesterId: rahul, addresseeId: kiran, status: 'ACCEPTED', createdAt: daysAgo(60), updatedAt: daysAgo(60) },
      { requesterId: ananya, addresseeId: kiran, status: 'PENDING', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    ],
  })

  // Reviews: mixed visibility, one spoiler — all attached to storefront books.
  const reviewRows: {
    bookId: string; userId: string; rating: number; content: string
    visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'; containsSpoilers?: boolean; createdAt: Date
  }[] = [
    { bookId: 'secret-garden', userId: rahul, rating: 5, content: 'Very useful for understanding the classics. Verified demo purchase.', visibility: 'PUBLIC', createdAt: daysAgo(25) },
    { bookId: 'secret-garden', userId: ananya, rating: 4, content: 'Good book, but chapter 6 gets difficult. Demo review.', visibility: 'FRIENDS', createdAt: daysAgo(20) },
    { bookId: 'secret-garden', userId: kiran, rating: 5, content: 'Private demo review that must never leak to friends.', visibility: 'PRIVATE', createdAt: daysAgo(18) },
    { bookId: 'atomic-habits', userId: rahul, rating: 4, content: 'Practical habits framework, helped me study better.', visibility: 'PUBLIC', createdAt: daysAgo(30) },
    { bookId: 'atomic-habits', userId: ananya, rating: 5, content: 'Excellent and actionable. Demo review.', visibility: 'PUBLIC', createdAt: daysAgo(22) },
    { bookId: 'hobbit', userId: rahul, rating: 5, content: 'A classic adventure. Spoiler: the dragon does not win.', visibility: 'PUBLIC', containsSpoilers: true, createdAt: daysAgo(40) },
    { bookId: 'hobbit', userId: ananya, rating: 4, content: 'Cozy pacing, great for re-reads. Demo review.', visibility: 'PUBLIC', createdAt: daysAgo(35) },
    { bookId: 'psychology-money', userId: rahul, rating: 5, content: 'Changed how I think about saving. Demo review.', visibility: 'PUBLIC', createdAt: daysAgo(15) },
    { bookId: 'immortals', userId: ananya, rating: 5, content: 'Fresh mythological retelling. Demo review.', visibility: 'PUBLIC', createdAt: daysAgo(12) },
    { bookId: 'pride-prejudice', userId: rahul, rating: 4, content: 'Witty and timeless. Demo review.', visibility: 'PUBLIC', createdAt: daysAgo(10) },
  ]
  for (const row of reviewRows) {
    const book = await prisma.book.findUnique({ where: { id: row.bookId }, select: { id: true } })
    if (!book) continue
    await prisma.review.create({
      data: {
        bookId: row.bookId, userId: row.userId, rating: row.rating, content: row.content,
        verified: true, visibility: row.visibility, containsSpoilers: row.containsSpoilers ?? false,
        createdAt: row.createdAt,
      },
    })
  }

  // Demo orders so seller passport metrics derive from real rows.
  const statuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'PLACED', 'CANCELLED'] as const
  const reviewerIds = [ava, rahul, ananya, kiran]
  for (const [vendorIndex, vendor] of initialVendors.entries()) {
    const vendorBooks = books.filter((book) => books.indexOf(book) % initialVendors.length === vendorIndex)
    for (const [index, status] of statuses.entries()) {
      const book = vendorBooks[index % vendorBooks.length]
      if (!book || book.price === null) continue
      const userId = reviewerIds[(vendorIndex + index) % reviewerIds.length]
      const order = await prisma.order.create({
        data: {
          userId,
          status: status as 'DELIVERED',
          subtotal: book.price,
          total: book.price,
          createdAt: daysAgo(40 - index * 5),
          items: {
            create: {
              bookId: book.id,
              vendorId: vendor.id,
              title: book.title,
              unitPrice: book.price,
              quantity: 1,
            },
          },
        },
      })
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: book.price,
          status: status === 'CANCELLED' ? 'REFUNDED' : 'PAID',
          method: 'SIMULATED',
          transactionReference: `SIM-SEED-${vendorIndex}-${index}`,
        },
      })
    }
  }

  // Recommendations (recipient-scoped only).
  await prisma.recommendation.createMany({
    data: [
      { senderId: rahul, recipientId: ava, targetType: 'BOOK', targetId: 'atomic-habits', message: 'Start with this one.', createdAt: daysAgo(9) },
      { senderId: ananya, recipientId: ava, targetType: 'BOOK', targetId: 'hobbit', createdAt: daysAgo(4) },
    ],
  })

  // Shared + private lists.
  const sharedList = await prisma.socialList.create({
    data: {
      ownerId: ava,
      title: 'Cybersecurity Starter Pack',
      description: 'Demo shared list.',
      visibility: 'SHARED',
      members: {
        create: [
          { userId: ava, role: 'OWNER' },
          { userId: rahul, role: 'EDITOR' },
          { userId: ananya, role: 'VIEWER' },
        ],
      },
      items: {
        create: [
          { targetType: 'BOOK', targetId: 'deep-work', addedById: ava, note: 'Focus habits', preferred: true },
          { targetType: 'BOOK', targetId: 'psychology-money', addedById: rahul },
        ],
      },
    },
  })
  void sharedList
  await prisma.socialList.create({
    data: {
      ownerId: rahul,
      title: 'Books I Recommend',
      visibility: 'PRIVATE',
      members: { create: { userId: rahul, role: 'OWNER' } },
    },
  })

  // Reading progress (private by default) — fills the demo shelves.
  await prisma.readingProgress.createMany({
    data: [
      { userId: ava, targetType: 'BOOK', targetId: 'deep-work', status: 'CURRENTLY_READING', progressPercentage: 34, notes: 'Private notes stay private.', visibility: 'FRIENDS' },
      { userId: ava, targetType: 'BOOK', targetId: 'atomic-habits', status: 'CURRENTLY_READING', progressPercentage: 62, visibility: 'FRIENDS' },
      { userId: ava, targetType: 'BOOK', targetId: 'hobbit', status: 'CURRENTLY_READING', progressPercentage: 18, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'psychology-money', status: 'CURRENTLY_READING', progressPercentage: 75, visibility: 'FRIENDS' },
      { userId: ava, targetType: 'BOOK', targetId: 'song-achilles', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'midnight-library', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'immortals', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'murder-orient', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'alchemist', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'book-thief', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'secret-garden', status: 'FINISHED', progressPercentage: 100, visibility: 'FRIENDS' },
      { userId: ava, targetType: 'BOOK', targetId: 'pride-prejudice', status: 'FINISHED', progressPercentage: 100, visibility: 'FRIENDS' },
      { userId: ava, targetType: 'BOOK', targetId: 'great-gatsby', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'jane-eyre', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'ikigai', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: rahul, targetType: 'BOOK', targetId: 'hobbit', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      // Fuller shelves from the catalogue obtained by `scripts/fetch-books.mjs`.
      { userId: ava, targetType: 'BOOK', targetId: 'the-nightingale-hannah', status: 'CURRENTLY_READING', progressPercentage: 41, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'number-the-stars-lowry', status: 'CURRENTLY_READING', progressPercentage: 8, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-hitchhiker-s-guide-to-the-galaxy-adams', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-lightning-thief-riordan', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'watchmen-moore', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'anne-of-green-gables-montgomery', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'dubliners-joyce', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-gene-mukherjee', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'moneyball-lewis', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-millionaire-next-door-stanley', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-lion-the-witch-and-the-wardrobe-lewis', status: 'NOT_STARTED', progressPercentage: 0, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'born-a-crime-noah', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'through-the-looking-glass-carroll', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'a-suitable-boy-seth', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-two-towers-tolkien', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
      { userId: ava, targetType: 'BOOK', targetId: 'the-sword-of-summer-riordan', status: 'FINISHED', progressPercentage: 100, visibility: 'PRIVATE' },
    ],
  })

  console.log('Seeded demo social data (4 users, friendships, privacy, reviews, orders, lists).')
}

async function seedSellerComparisonOffers() {
  // Competing listings from other vendors sharing an ISBN, so seller
  // comparison has real rows to group (grouping key = ISBN only). The offers
  // are derived from each book's advertised sellerCount, so the shelf's
  // "3 sellers" claim is always backed by actual database rows.
  const sourceBooks = books.map((book, index) => ({
    ...book,
    vendorId: initialVendors[index % initialVendors.length].id,
  }))
  const offers = buildComparisonOffers(sourceBooks, initialVendors.map((vendor) => vendor.id))

  await inBatches(offers, 8, async (offer) => {
    const productId = `demo-offer-${offer.id}`
    const created = await prisma.product.upsert({
      where: { id: productId },
      create: {
        id: productId,
        vendorId: offer.vendorId,
        title: offer.title,
        slug: offer.id,
        description: 'Demo marketplace listing used for seller comparison (seed data).',
        author: 'See catalogue entry',
        isbn: offer.isbn,
        format: offer.format,
        price: offer.price,
        status: 'ACTIVE',
      },
      update: { price: offer.price, format: offer.format, status: 'ACTIVE' },
    })
    // Price history for the product passport (>=2 points).
    const existingPoints = await prisma.priceHistory.count({ where: { productId: created.id } })
    if (existingPoints === 0) {
      await prisma.priceHistory.createMany({
        data: [
          { productId: created.id, price: offer.price + 30, recordedAt: daysAgo(30) },
          { productId: created.id, price: offer.price, recordedAt: daysAgo(5) },
        ],
      })
    }
  })
  console.log(`Seeded ${offers.length} comparison offers with price history.`)
}

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

  await inBatches(books, 8, async (book, index) => {
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
      // Deterministic seller attribution so seller passport / comparison have
      // real rows to derive from.
      vendorId: initialVendors[index % initialVendors.length].id,
    }
    await prisma.book.upsert({ where: { id: book.id }, create: { id: book.id, ...data }, update: data })
  })

  if (process.env.NODE_ENV === 'production') {
    console.log('Skipped demo social accounts and comparison offers in production.')
  } else {
    await seedDemoSocial()
    await seedSellerComparisonOffers()
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
