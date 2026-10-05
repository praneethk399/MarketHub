import { PrismaClient } from '@prisma/client'
import { hashSync } from 'bcryptjs'
import { books } from '../data/books'
import { initialVendors } from '../lib/mock-store'

const prisma = new PrismaClient()

const demoUsers = [
  { id: 'demo-ava', name: 'Ava Sharma', email: 'ava@markethub.test' },
  { id: 'demo-rahul', name: 'Rahul Verma', email: 'rahul@markethub.test' },
  { id: 'demo-ananya', name: 'Ananya Rao', email: 'ananya@markethub.test' },
  { id: 'demo-kiran', name: 'Kiran Iyer', email: 'kiran@markethub.test' },
] as const

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

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
    ],
  })

  console.log('Seeded demo social data (4 users, friendships, privacy, reviews, orders, lists).')
}

async function seedSellerComparisonOffers() {
  // Products from other vendors sharing ISBNs of curated books so seller
  // comparison has real rows to group (grouping key = ISBN only).
  const offers = [
    { isbn: '9780141182186', title: 'The Secret Garden', vendorIndex: 1, price: 285, slug: 'the-secret-garden-old-town' },
    { isbn: '9780141182186', title: 'The Secret Garden', vendorIndex: 2, price: 315, slug: 'the-secret-garden-chapter-house' },
    { isbn: '9780261103283', title: 'The Hobbit', vendorIndex: 1, price: 385, slug: 'the-hobbit-old-town' },
    { isbn: '9780735211292', title: 'Atomic Habits', vendorIndex: 0, price: 529, slug: 'atomic-habits-paper-ink' },
    { isbn: '9780735211292', title: 'Atomic Habits', vendorIndex: 2, price: 559, slug: 'atomic-habits-chapter-house' },
  ]
  for (const offer of offers) {
    const vendor = initialVendors[offer.vendorIndex]
    const created = await prisma.product.upsert({
      where: { id: `demo-offer-${offer.slug}` },
      create: {
        id: `demo-offer-${offer.slug}`,
        vendorId: vendor.id,
        title: offer.title,
        slug: offer.slug,
        description: 'Demo marketplace listing used for seller comparison (seed data).',
        author: 'See catalogue entry',
        isbn: offer.isbn,
        format: 'paperback',
        price: offer.price,
        status: 'ACTIVE',
      },
      update: { price: offer.price, status: 'ACTIVE' },
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
  }
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

  for (const [index, book] of books.entries()) {
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
  }

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
