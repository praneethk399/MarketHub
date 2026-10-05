import { isDatabaseConfigured, prisma } from '@/lib/prisma'
import { mockStore } from '@/lib/mock-store'

export async function listVendors() {
  if (!isDatabaseConfigured) {
    return mockStore.vendors
      .filter((vendor) => vendor.status === 'APPROVED' || (!vendor.status && vendor.verified))
      .map(publicVendor)
  }
  return prisma.vendor.findMany({
    where: { status: 'APPROVED' },
    select: {
      id: true, name: true, storeName: true, slug: true, description: true, logo: true, city: true,
      verified: true, booksSold: true, authenticity: true, onTimeDelivery: true, returnRate: true,
      disputeRate: true, activeSince: true, createdAt: true,
    },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
  })
}

export async function getVendor(id: string) {
  if (!isDatabaseConfigured) {
    const vendor = mockStore.vendors.find((entry) => entry.id === id)
    return vendor && (vendor.status === 'APPROVED' || (!vendor.status && vendor.verified)) ? publicVendor(vendor) : null
  }
  return prisma.vendor.findFirst({
    where: { id, status: 'APPROVED' },
    select: {
      id: true, name: true, storeName: true, slug: true, description: true, logo: true, city: true,
      verified: true, booksSold: true, authenticity: true, onTimeDelivery: true, returnRate: true,
      disputeRate: true, activeSince: true, createdAt: true,
      books: {
        where: { active: true },
        select: { id: true, title: true },
      },
      products: {
        where: { status: 'ACTIVE' },
        select: { id: true, title: true, slug: true },
      },
    },
  })
}

function publicVendor(vendor: typeof mockStore.vendors[number]) {
  const { id, name, storeName, slug, city, verified, booksSold, authenticity, onTimeDelivery, returnRate, disputeRate, activeSince } = vendor
  return { id, name, storeName: storeName ?? name, slug, city, verified, booksSold, authenticity, onTimeDelivery, returnRate, disputeRate, activeSince }
}
