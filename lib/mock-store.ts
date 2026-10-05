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
  name: string
  city: string
  verified: boolean
  booksSold: number
  authenticity: number
  onTimeDelivery: number
  returnRate: number
  disputeRate: number
  activeSince: string
}

type MockStore = {
  books: Map<string, Book>
  users: Map<string, MockUser>
  carts: Map<string, Map<string, number>>
  orders: MockOrder[]
  vendors: MockVendor[]
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
})

const globalForStore = globalThis as typeof globalThis & { marketHubMockStore?: MockStore }
export const mockStore = globalForStore.marketHubMockStore ?? seedStore()
if (process.env.NODE_ENV !== 'production') globalForStore.marketHubMockStore = mockStore

export const createMockId = () => randomUUID()
