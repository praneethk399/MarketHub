import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

export async function getAdminOverview() {
  if (!isDatabaseConfigured) {
    return {
      users: mockStore.users.size,
      books: mockStore.books.size,
      vendors: mockStore.vendors.length,
      orders: mockStore.orders.length,
      grossSales: mockStore.orders.reduce((sum, order) => sum + order.total, 0),
      mode: 'mock',
    }
  }
  const [users, books, vendors, orders, sales] = await Promise.all([
    prisma.user.count(), prisma.book.count({ where: { active: true } }), prisma.vendor.count(),
    prisma.order.count(), prisma.order.aggregate({ _sum: { total: true } }),
  ])
  return { users, books, vendors, orders, grossSales: sales._sum.total ?? 0, mode: 'postgresql' }
}
