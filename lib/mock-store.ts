import { randomUUID } from 'node:crypto'
import { hashSync } from 'bcryptjs'
import { books as catalogue, type Book } from '@/data/books'

export type MockUser = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN'
}

export type MockOrder = {
  id: string
  userId: string
  status: 'PLACED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  total: number
  createdAt: string
  items: { bookId: string; title: string; unitPrice: number; quantity: number }[]
  payment?: {
    amount: number
    currency: 'INR'
    status: 'PAID' | 'REFUNDED'
    method: 'SIMULATED'
    transactionReference: string
  }
}

export type MockVendor = {
  id: string
  userId?: string
  name: string
  storeName?: string
  slug?: string
  city: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  verified: boolean
  booksSold: number
  authenticity: number
  onTimeDelivery: number
  returnRate: number
  disputeRate: number
  activeSince: string
}

export type MockVendorApplication = {
  id: string
  userId: string
  storeName: string
  description: string
  businessEmail: string
  phone: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

export type MockReview = {
  id: string
  productId: string
  bookId?: string
  userId: string
  rating: number
  title: string | null
  content: string
  verified: boolean
  visibility?: 'PRIVATE' | 'FRIENDS' | 'PUBLIC'
  containsSpoilers?: boolean
  createdAt: string
  userName: string
}

export type SocialTargetType = 'BOOK' | 'PRODUCT'
export type SocialVisibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC'

export type MockFriendship = {
  id: string
  requesterId: string
  addresseeId: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED'
  createdAt: string
  updatedAt: string
}

export type MockPrivacy = {
  userId: string
  reviews: SocialVisibility
  purchases: 'PRIVATE' | 'LIMITED'
  reading: SocialVisibility
  defaultListVisibility: 'PRIVATE' | 'SHARED' | 'PUBLIC'
  updatedAt: string
}

export type MockRecommendation = {
  id: string
  senderId: string
  recipientId: string
  targetType: SocialTargetType
  targetId: string
  message: string | null
  createdAt: string
}

export type MockList = {
  id: string
  ownerId: string
  title: string
  description: string | null
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC'
  createdAt: string
  updatedAt: string
  items: {
    id: string
    targetType: SocialTargetType
    targetId: string
    addedById: string | null
    note: string | null
    preferred: boolean
    createdAt: string
  }[]
  members: { id: string; userId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER'; createdAt: string }[]
}

export type MockReadingProgress = {
  id: string
  userId: string
  targetType: SocialTargetType
  targetId: string
  status: 'NOT_STARTED' | 'CURRENTLY_READING' | 'FINISHED'
  progressPercentage: number
  notes: string | null
  visibility: SocialVisibility
  createdAt: string
  updatedAt: string
}

export type MockSecuritySignal = {
  id: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  subject: string
  subjectId: string | null
  count: number
  details: Record<string, unknown> | null
  createdAt: string
}

// Demo marketplace offers. Mirrors the relational Product columns used by
// seller comparison in database mode (ISBN-grouped listings from vendors).
export type MockOffer = {
  id: string
  isbn: string
  title: string
  vendorId: string
  price: number
  format: string
  status: 'ACTIVE'
  isDemo: true
}

export type MockAddress = {
  id: string
  userId: string
  label: string | null
  recipient: string
  line1: string
  line2: string | null
  city: string
  region: string
  postalCode: string
  country: string
  phone: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type MockStore = {
  books: Map<string, Book>
  users: Map<string, MockUser>
  carts: Map<string, Map<string, number>>
  orders: MockOrder[]
  vendors: MockVendor[]
  sessions: Map<string, { userId: string; expiresAt: number }>
  auditLogs: { userId: string | null; action: string; entity: string; entityId: string | null; createdAt: string }[]
  wishlists: Map<string, Set<string>>
  vendorApplications: Map<string, MockVendorApplication>
  reviews: MockReview[]
  addresses: Map<string, MockAddress>
  friendships: MockFriendship[]
  privacy: Map<string, MockPrivacy>
  recommendations: MockRecommendation[]
  lists: MockList[]
  readingProgress: MockReadingProgress[]
  securitySignals: MockSecuritySignal[]
  offers: MockOffer[]
}

export const initialVendors: MockVendor[] = [
  { id: 'paper-and-ink', name: 'Paper & Ink Books', city: 'Bengaluru', verified: true, booksSold: 1840, authenticity: 99.4, onTimeDelivery: 96, returnRate: 2.1, disputeRate: 0.3, activeSince: '2019-04-01' },
  { id: 'old-town-books', name: 'Old Town Books', city: 'Jaipur', verified: true, booksSold: 1260, authenticity: 98.7, onTimeDelivery: 93, returnRate: 3.2, disputeRate: 0.6, activeSince: '2020-08-15' },
  { id: 'chapter-house', name: 'The Chapter House', city: 'Kochi', verified: false, booksSold: 438, authenticity: 96.2, onTimeDelivery: 89, returnRate: 4.8, disputeRate: 1.1, activeSince: '2022-02-10' },
]

const now = () => new Date().toISOString()
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

const seedStore = (): MockStore => ({
  // Deterministic vendor assignment so seller attribution, seller passport and
  // seller comparison always come from real (demo) rows instead of constants.
  books: new Map(catalogue.map((book, index) => [book.id, { ...book, vendorId: initialVendors[index % initialVendors.length].id }])),
  users: new Map(),
  carts: new Map(),
  orders: [],
  vendors: initialVendors,
  sessions: new Map(),
  auditLogs: [],
  wishlists: new Map(),
  vendorApplications: new Map(),
  reviews: [],
  addresses: new Map(),
  friendships: [],
  privacy: new Map(),
  recommendations: [],
  lists: [],
  readingProgress: [],
  securitySignals: [],
  offers: [],
})

// ---------------------------------------------------------------------------
// DEMO social dataset (mock mode only). Clearly marked demo/test data per the
// spec: it exercises the privacy architecture rather than bypassing it.
// ---------------------------------------------------------------------------
export const demoCredentials = {
  ava: { id: 'demo-ava', name: 'Ava Sharma', email: 'ava@markethub.test', password: 'Demo1234!' },
  rahul: { id: 'demo-rahul', name: 'Rahul Verma', email: 'rahul@markethub.test', password: 'Demo1234!' },
  ananya: { id: 'demo-ananya', name: 'Ananya Rao', email: 'ananya@markethub.test', password: 'Demo1234!' },
  kiran: { id: 'demo-kiran', name: 'Kiran Iyer', email: 'kiran@markethub.test', password: 'Demo1234!' },
}

function seedDemoSocial(store: MockStore) {
  if (process.env.NODE_ENV === 'production') return
  if (store.users.size > 0) return // demo data is only seeded on a fresh store
  const passwordHash = hashSync('Demo1234!', 10)
  for (const [key, account] of Object.entries(demoCredentials)) {
    store.users.set(account.id, { id: account.id, name: account.name, email: account.email, passwordHash, role: 'CUSTOMER' })
    void key
  }
  const { ava, rahul, ananya, kiran } = demoCredentials

  const friendship = (requesterId: string, addresseeId: string, status: MockFriendship['status'], createdDaysAgo: number): MockFriendship => ({
    id: createMockId(), requesterId, addresseeId, status,
    createdAt: daysAgo(createdDaysAgo), updatedAt: daysAgo(createdDaysAgo),
  })
  store.friendships.push(
    friendship(ava.id, rahul.id, 'ACCEPTED', 120),
    friendship(ava.id, ananya.id, 'ACCEPTED', 90),
    friendship(rahul.id, kiran.id, 'ACCEPTED', 60),
    friendship(ananya.id, kiran.id, 'PENDING', 2),
  )

  const privacy = (userId: string, reviews: MockPrivacy['reviews'], purchases: MockPrivacy['purchases'], reading: MockPrivacy['reading']): MockPrivacy => ({
    userId, reviews, purchases, reading, defaultListVisibility: 'PRIVATE', updatedAt: now(),
  })
  store.privacy.set(ava.id, privacy(ava.id, 'PUBLIC', 'LIMITED', 'FRIENDS'))
  store.privacy.set(rahul.id, privacy(rahul.id, 'FRIENDS', 'PRIVATE', 'PRIVATE'))
  store.privacy.set(ananya.id, privacy(ananya.id, 'PUBLIC', 'LIMITED', 'PRIVATE'))
  store.privacy.set(kiran.id, privacy(kiran.id, 'PRIVATE', 'PRIVATE', 'PRIVATE'))

  // Demo reviews with mixed visibility + one spoiler review.
  const review = (bookId: string, user: typeof ava, rating: number, content: string, options: Partial<MockReview> = {}): MockReview => ({
    id: createMockId(), productId: bookId, bookId, userId: user.id, rating,
    title: null, content, verified: true, visibility: 'PUBLIC', containsSpoilers: false,
    createdAt: daysAgo(20), userName: user.name, ...options,
  })
  store.reviews.push(
    review('secret-garden', rahul, 5, 'Very useful for understanding the classics. Verified demo purchase.', { visibility: 'PUBLIC' }),
    review('secret-garden', ananya, 4, 'Good book, but chapter 6 gets difficult. Demo review.', { visibility: 'FRIENDS' }),
    review('secret-garden', kiran, 5, 'Private demo review that must never leak to friends.', { visibility: 'PRIVATE' }),
    review('atomic-habits', rahul, 4, 'Practical habits framework, helped me study better.', { visibility: 'PUBLIC' }),
    review('atomic-habits', ananya, 5, 'Excellent and actionable. Demo review.', { visibility: 'PUBLIC' }),
    review('atomic-habits', kiran, 4, 'Private notes on this book stay private.', { visibility: 'PRIVATE' }),
    review('hobbit', rahul, 5, 'A classic adventure. Spoiler: the dragon does not win.', { visibility: 'PUBLIC', containsSpoilers: true }),
    review('hobbit', ananya, 4, 'Cozy pacing, great for re-reads. Demo review.', { visibility: 'PUBLIC' }),
    review('psychology-money', rahul, 5, 'Changed how I think about saving. Demo review.', { visibility: 'PUBLIC' }),
    review('immortals', ananya, 5, 'Fresh mythological retelling. Demo review.', { visibility: 'PUBLIC' }),
    review('pride-prejudice', rahul, 4, 'Witty and timeless. Demo review.', { visibility: 'PUBLIC' }),
    review('great-gatsby', rahul, 5, 'Beautiful prose. Demo review.', { visibility: 'PUBLIC' }),
  )

  // Demo orders: each vendor gets >=5 orders covering delivered, shipped,
  // placed and cancelled/refunded outcomes so seller passport metrics are
  // derived from real rows rather than invented.
  const statuses: MockOrder['status'][] = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'PLACED', 'CANCELLED']
  const reviewers = [ava, rahul, ananya, kiran]
  initialVendors.forEach((vendor, vendorIndex) => {
    const vendorBooks = [...store.books.values()].filter((book) => book.vendorId === vendor.id)
    statuses.forEach((status, index) => {
      const book = vendorBooks[index % vendorBooks.length]
      if (!book || book.price === null) return
      const user = reviewers[(vendorIndex + index) % reviewers.length]
      store.orders.push({
        id: createMockId(), userId: user.id, status, total: book.price,
        createdAt: daysAgo(40 - index * 5),
        items: [{ bookId: book.id, title: book.title, unitPrice: book.price, quantity: 1 }],
        payment: {
          amount: book.price, currency: 'INR',
          status: status === 'CANCELLED' ? 'REFUNDED' : 'PAID',
          method: 'SIMULATED', transactionReference: `SIM-DEMO-${vendorIndex}-${index}`,
        },
      })
    })
  })

  store.recommendations.push({
    id: createMockId(), senderId: rahul.id, recipientId: ava.id,
    targetType: 'BOOK', targetId: 'atomic-habits', message: 'Start with this one.', createdAt: daysAgo(9),
  })
  store.recommendations.push({
    id: createMockId(), senderId: ananya.id, recipientId: ava.id,
    targetType: 'BOOK', targetId: 'hobbit', message: null, createdAt: daysAgo(4),
  })

  store.lists.push({
    id: createMockId(), ownerId: ava.id, title: 'Cybersecurity Starter Pack',
    description: 'Demo shared list.', visibility: 'SHARED', createdAt: daysAgo(15), updatedAt: daysAgo(15),
    items: [
      { id: createMockId(), targetType: 'BOOK', targetId: 'deep-work', addedById: ava.id, note: 'Focus habits', preferred: true, createdAt: daysAgo(14) },
      { id: createMockId(), targetType: 'BOOK', targetId: 'psychology-money', addedById: rahul.id, note: null, preferred: false, createdAt: daysAgo(12) },
    ],
    members: [
      { id: createMockId(), userId: ava.id, role: 'OWNER', createdAt: daysAgo(15) },
      { id: createMockId(), userId: rahul.id, role: 'EDITOR', createdAt: daysAgo(14) },
      { id: createMockId(), userId: ananya.id, role: 'VIEWER', createdAt: daysAgo(14) },
    ],
  })
  store.lists.push({
    id: createMockId(), ownerId: rahul.id, title: 'Books I Recommend',
    description: null, visibility: 'PRIVATE', createdAt: daysAgo(30), updatedAt: daysAgo(30),
    items: [], members: [{ id: createMockId(), userId: rahul.id, role: 'OWNER', createdAt: daysAgo(30) }],
  })

  store.readingProgress.push({
    id: createMockId(), userId: ava.id, targetType: 'BOOK', targetId: 'deep-work',
    status: 'CURRENTLY_READING', progressPercentage: 34, notes: 'Private notes stay private.',
    visibility: 'FRIENDS', createdAt: daysAgo(10), updatedAt: daysAgo(2),
  })
  store.readingProgress.push({
    id: createMockId(), userId: rahul.id, targetType: 'BOOK', targetId: 'hobbit',
    status: 'FINISHED', progressPercentage: 100, notes: null,
    visibility: 'PRIVATE', createdAt: daysAgo(80), updatedAt: daysAgo(60),
  })

  // Demo marketplace offers from other vendors for the same ISBN, so seller
  // comparison has real rows to group (grouping key = ISBN only).
  const offers: { isbn: string; title: string; vendorIndex: number; price: number; id: string }[] = [
    { id: 'offer-secret-garden-old-town', isbn: '9780141182186', title: 'The Secret Garden', vendorIndex: 1, price: 285 },
    { id: 'offer-secret-garden-chapter-house', isbn: '9780141182186', title: 'The Secret Garden', vendorIndex: 2, price: 315 },
    { id: 'offer-hobbit-old-town', isbn: '9780261103283', title: 'The Hobbit', vendorIndex: 1, price: 385 },
    { id: 'offer-atomic-habits-paper-ink', isbn: '9780735211292', title: 'Atomic Habits', vendorIndex: 0, price: 529 },
    { id: 'offer-atomic-habits-chapter-house', isbn: '9780735211292', title: 'Atomic Habits', vendorIndex: 2, price: 559 },
  ]
  for (const offer of offers) {
    store.offers.push({
      id: offer.id, isbn: offer.isbn, title: offer.title,
      vendorId: initialVendors[offer.vendorIndex].id, price: offer.price,
      format: 'paperback', status: 'ACTIVE', isDemo: true,
    })
  }
}

const globalForStore = globalThis as typeof globalThis & { marketHubMockStore?: MockStore }
export const mockStore = globalForStore.marketHubMockStore ?? seedStore()
if (process.env.NODE_ENV !== 'production') globalForStore.marketHubMockStore = mockStore

export const createMockId = () => randomUUID()

seedDemoSocial(mockStore)
