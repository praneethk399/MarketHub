import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

export async function listVendors() {
  if (!isDatabaseConfigured) return mockStore.vendors
  return prisma.vendor.findMany({ orderBy: [{ verified: 'desc' }, { name: 'asc' }] })
}

export async function getVendor(id: string) {
  if (!isDatabaseConfigured) return mockStore.vendors.find((vendor) => vendor.id === id) ?? null
  return prisma.vendor.findUnique({ where: { id }, include: { books: { where: { active: true }, select: { id: true, title: true } } } })
}
