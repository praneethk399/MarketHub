import { books, type Book } from '../data/books'

const pause = async <T,>(value: T) => { await Promise.resolve(); return value }

export const bookService = {
  list: () => pause(books),
  getById: (id: string) => pause(books.find((book) => book.id === id) || null),
  search: (query: string) => pause(books.filter((book) => [book.title, book.author, book.category, book.publisher || '', book.isbn || ''].join(' ').toLowerCase().includes(query.toLowerCase())))
}
export const authService = { signIn: (email: string) => pause({ email, role: 'customer', demo: true }), signOut: () => pause(true) }
export const vendorService = { list: () => pause(['Chapter One Books', 'Paper Lantern', 'The Reading Room', 'Little Chapters']), getById: (id: string) => pause({ id, name: id }) }
export const cartService = { get: () => pause({}), save: (cart: Record<string, number>) => pause(cart) }
export const wishlistService = { get: () => pause([] as string[]), save: (ids: string[]) => pause(ids) }
export const orderService = { list: () => pause([{ id: 'MH-24091', status: 'Shipped', total: 848 }]), create: (items: Book[]) => pause({ id: `MH-${Date.now().toString().slice(-5)}`, items }) }
export const reviewService = { list: (bookId: string) => pause({ bookId, reviews: [] }) }
export const adminService = { metrics: () => pause({ customers: 428, vendors: 18, books: 55, orders: 1240, revenue: 684000 }) }
export const aiService = { respond: (prompt: string) => pause(`A local MarketHub response for: ${prompt}`) }
