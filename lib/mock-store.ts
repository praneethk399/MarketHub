import { randomUUID } from 'node:crypto'
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
  userId: string
  rating: number
  title: string | null
  content: string
  verified: true
  createdAt: string
  userName: string
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
}

export const initialVendors: MockVendor[] = [
  { id: 'paper-and-ink', name: 'Paper & Ink Books', city: 'Bengaluru', verified: true, booksSold: 1840, authenticity: 99.4, onTimeDelivery: 96, returnRate: 2.1, disputeRate: 0.3, activeSince: '2019-04-01' },
  { id: 'old-town-books', name: 'Old Town Books', city: 'Jaipur', verified: true, booksSold: 1260, authenticity: 98.7, onTimeDelivery: 93, returnRate: 3.2, disputeRate: 0.6, activeSince: '2020-08-15' },
  { id: 'chapter-house', name: 'The Chapter House', city: 'Kochi', verified: false, booksSold: 438, authenticity: 96.2, onTimeDelivery: 89, returnRate: 4.8, disputeRate: 1.1, activeSince: '2022-02-10' },
]

const seedStore = (): MockStore => ({
  books: new Map(catalogue.map((book) => [book.id, { ...book }])),
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
})

const globalForStore = globalThis as typeof globalThis & { marketHubMockStore?: MockStore }
export const mockStore = globalForStore.marketHubMockStore ?? seedStore()
if (process.env.NODE_ENV !== 'production') globalForStore.marketHubMockStore = mockStore

export const createMockId = () => randomUUID()
